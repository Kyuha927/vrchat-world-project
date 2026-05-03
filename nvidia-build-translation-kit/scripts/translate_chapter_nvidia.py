import argparse, hashlib, json, os, pathlib, random, re, sys, time, urllib.error, urllib.request

MODEL = os.environ.get('NVIDIA_MODEL', 'qwen/qwen3.5-397b-a17b')
API_URL = os.environ.get('NVIDIA_API_URL', 'https://integrate.api.nvidia.com/v1/chat/completions')
BASE = pathlib.Path(os.environ.get('NOVEL_TRANSLATION_BASE', pathlib.Path.cwd() / 'data')).resolve()
RAWROOT = pathlib.Path(os.environ.get('NOVEL_RAW_ROOT', BASE / 'raw')).resolve()
CHAPTER_OUT = pathlib.Path(os.environ.get('NOVEL_CHAPTER_OUT', BASE / 'chapters')).resolve()
STATE = pathlib.Path(os.environ.get('NOVEL_TRANSLATION_STATE', BASE / 'chapter_state.json')).resolve()
CHAPTER_OUT.mkdir(parents=True, exist_ok=True)
STATE.parent.mkdir(parents=True, exist_ok=True)

PROMPT_PREFIX = '''일본어 라이트노벨/웹소설 원문을 자연스러운 한국어 라노벨/웹소설 문체로 번역해.
규칙:
- 설명 없이 번역문만 출력.
- 문단, 대사 리듬, 감정선, 시점, 말투를 유지.
- 딱딱한 직역투를 피하고 한국어 독자가 읽기 편하게 다듬기.
- 이름, 호칭, 숫자, 고유명사, 작품 내 용어는 함부로 바꾸지 않기.
- 요약/누락/추가 창작 금지. 모든 문장을 번역.
- 제목 줄도 자연스럽게 번역.

원문:
'''

def key():
    k=os.environ.get('NVIDIA_API_KEY') or os.environ.get('NGC_API_KEY')
    if not k:
        raise SystemExit('NVIDIA_API_KEY/NGC_API_KEY missing')
    return k

def slug(s):
    s=re.sub(r'[\\/:*?"<>|]+','_',s).strip()
    s=re.sub(r'\s+',' ',s)
    return s[:80] or 'chapter'

def read_state():
    if STATE.exists():
        return json.loads(STATE.read_text(encoding='utf-8'))
    return {'translated':{}, 'uploaded':{}}

def write_state(st):
    STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding='utf-8')

def split_chapters(text):
    matches=list(re.finditer(r'^### .+? ###\s*$', text, flags=re.M))
    if not matches:
        return [{'index':1,'heading':'본문','source':text}]
    pre=text[:matches[0].start()].strip()
    chapters=[]
    for i,m in enumerate(matches):
        start=m.start()
        end=matches[i+1].start() if i+1<len(matches) else len(text)
        src=text[start:end].strip()
        chapters.append({'index':i+1,'heading':m.group(0).strip(), 'source':src})
    if pre:
        # keep metadata with first chapter
        chapters[0]['source']=pre+'\n\n'+chapters[0]['source']
    return chapters

def find_raw(work):
    names={
        'dungeon_streamer':'dungeon_streamer_raw_all.txt',
        'jijibaba':'jijibaba_raw_all.txt',
        'nobody_knows':'nobody_knows_raw_all.txt',
    }
    target=names.get(work, work)
    hits=list(RAWROOT.rglob(target))
    if not hits:
        raise SystemExit(f'raw not found: {target}')
    return hits[0]

def split_long(text, limit=5200):
    paras=re.split(r'(\n{2,})', text)
    units=[]
    for i in range(0,len(paras),2):
        part=paras[i]; sep=paras[i+1] if i+1<len(paras) else ''
        if part or sep: units.append(part+sep)
    chunks=[]; cur=''
    for u in units:
        if len(cur)+len(u)<=limit:
            cur+=u; continue
        if cur.strip(): chunks.append(cur); cur=''
        if len(u)<=limit:
            cur=u; continue
        sentences=re.split(r'(?<=[\u3002\uff01\uff1f!?])',u)
        for sent in sentences:
            if not sent: continue
            if len(cur)+len(sent)>limit and cur.strip(): chunks.append(cur); cur=sent
            else: cur+=sent
    if cur.strip(): chunks.append(cur)
    return chunks

def call(k, source, max_tokens=None):
    if max_tokens is None:
        max_tokens=min(12000, max(1200, int(len(source)*2.4)))
    payload={'model':MODEL,'messages':[{'role':'user','content':PROMPT_PREFIX+source}], 'temperature':0.2, 'max_tokens':max_tokens}
    body=json.dumps(payload, ensure_ascii=False).encode('utf-8')
    headers={'Authorization':'Bearer '+k, 'Content-Type':'application/json; charset=utf-8'}
    last=None
    for attempt in range(1,7):
        try:
            req=urllib.request.Request(API_URL, data=body, headers=headers)
            t0=time.time()
            with urllib.request.urlopen(req, timeout=240) as resp:
                data=json.loads(resp.read().decode('utf-8'))
            txt=(data['choices'][0]['message'].get('content') or '').strip()
            return txt, data.get('usage'), round(time.time()-t0,3)
        except urllib.error.HTTPError as e:
            try: msg=e.read().decode('utf-8',errors='replace')[:600]
            except: msg=str(e)
            last=f'HTTP {e.code}: {msg}'
            if e.code in (400,401,403,404): break
        except Exception as e:
            last=repr(e)
        sleep=min(90, 2**attempt + random.random()*5)
        print(f'RETRY attempt={attempt} err={last} sleep={sleep:.1f}', flush=True)
        time.sleep(sleep)
    raise RuntimeError(last)

def translate_chapter(work, chapter_index, force=False):
    raw=find_raw(work)
    text=raw.read_text(encoding='utf-8-sig')
    chapters=split_chapters(text)
    if chapter_index<1 or chapter_index>len(chapters):
        raise SystemExit(f'chapter out of range 1..{len(chapters)}')
    ch=chapters[chapter_index-1]
    work_dir=CHAPTER_OUT/work
    work_dir.mkdir(parents=True, exist_ok=True)
    src_hash=hashlib.sha256(ch['source'].encode('utf-8')).hexdigest()[:16]
    fn=f'{chapter_index:04d}_{slug(ch["heading"].strip("# "))}.ko.md'
    out_path=work_dir/fn
    meta_path=work_dir/(fn+'.json')
    if out_path.exists() and not force:
        print(json.dumps({'status':'exists','work':work,'chapter':chapter_index,'heading':ch['heading'],'path':str(out_path),'meta':str(meta_path)}, ensure_ascii=False))
        return
    chunks=split_long(ch['source'])
    k=key()
    translations=[]; usages=[]; secs=[]
    print(f'TRANSLATE_START work={work} chapter={chapter_index}/{len(chapters)} heading={ch["heading"]} chars={len(ch["source"])} chunks={len(chunks)}', flush=True)
    for i,chunk in enumerate(chunks,1):
        tr, usage, sec=call(k, chunk)
        translations.append(tr)
        usages.append(usage)
        secs.append(sec)
        print(f'  chunk {i}/{len(chunks)} src={len(chunk)} out={len(tr)} sec={sec}', flush=True)
    content='\n\n'.join(translations).strip()+'\n'
    out_path.write_text(content, encoding='utf-8', newline='\n')
    meta={'status':'translated','work':work,'chapter':chapter_index,'chapter_count':len(chapters),'heading':ch['heading'],'source_chars':len(ch['source']),'output_chars':len(content),'chunks':len(chunks),'seconds':sum(secs),'usage':usages,'model':MODEL,'source_hash':src_hash,'path':str(out_path),'created_at':time.strftime('%Y-%m-%dT%H:%M:%S%z')}
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    st=read_state(); st.setdefault('translated',{})[f'{work}:{chapter_index:04d}']=meta; write_state(st)
    print(json.dumps({'status':'translated','work':work,'chapter':chapter_index,'heading':ch['heading'],'path':str(out_path),'meta':str(meta_path),'output_chars':len(content)}, ensure_ascii=False))

def list_status(work=None):
    works=[work] if work else ['dungeon_streamer','jijibaba','nobody_knows']
    st=read_state()
    for w in works:
        raw=find_raw(w); chapters=split_chapters(raw.read_text(encoding='utf-8-sig'))
        files=list((CHAPTER_OUT/w).glob('*.ko.md')) if (CHAPTER_OUT/w).exists() else []
        print(json.dumps({'work':w,'chapters':len(chapters),'local_chapter_files':len(files),'translated_state':len([k for k in st.get('translated',{}) if k.startswith(w+':')]),'uploaded_state':len([k for k in st.get('uploaded',{}) if k.startswith(w+':')])}, ensure_ascii=False))

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['translate','status'])
    ap.add_argument('--work')
    ap.add_argument('--chapter', type=int)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--base', help='Working data directory. Overrides NOVEL_TRANSLATION_BASE for this run.')
    ap.add_argument('--raw-root', help='Directory containing *_raw_all.txt files. Overrides NOVEL_RAW_ROOT for this run.')
    args=ap.parse_args()
    if args.base:
        BASE = pathlib.Path(args.base).resolve()
        RAWROOT = pathlib.Path(args.raw_root).resolve() if args.raw_root else BASE / 'raw'
        CHAPTER_OUT = BASE / 'chapters'
        STATE = BASE / 'chapter_state.json'
        CHAPTER_OUT.mkdir(parents=True, exist_ok=True)
        STATE.parent.mkdir(parents=True, exist_ok=True)
    elif args.raw_root:
        RAWROOT = pathlib.Path(args.raw_root).resolve()
    if args.cmd=='status': list_status(args.work)
    elif args.cmd=='translate': translate_chapter(args.work, args.chapter, args.force)
