import concurrent.futures
import hashlib
import json
import math
import os
import pathlib
import random
import re
import sys
import time
import urllib.error
import urllib.request

MODEL = os.environ.get('NVIDIA_MODEL', 'qwen/qwen3.5-397b-a17b')
API_URL = os.environ.get('NVIDIA_API_URL', 'https://integrate.api.nvidia.com/v1/chat/completions')
BASE = pathlib.Path(os.environ.get('NOVEL_TRANSLATION_BASE', pathlib.Path.cwd() / 'data')).resolve()
ROOT = pathlib.Path(os.environ.get('NOVEL_RAW_ROOT', BASE / 'raw')).resolve()
OUT = pathlib.Path(os.environ.get('NOVEL_TRANSLATED_OUT', BASE / 'translated')).resolve()
OUT.mkdir(parents=True, exist_ok=True)
CHUNK_CHARS = 4200
MAX_WORKERS = 2
TEMPERATURE = 0.2

PROMPT_PREFIX = (
    'Translate the following Japanese light-novel/web-novel text into natural Korean.\n'
    'Requirements:\n'
    '- Output only the Korean translation. No explanations.\n'
    '- Preserve paragraph breaks, dialogue rhythm, emotion, tense, and literary tone.\n'
    '- Avoid stiff machine-translation style; make it read like a Korean light novel/web novel.\n'
    '- Preserve names, honorifics, numbers, symbols, and markdown-like headings when appropriate, but translate headings naturally.\n'
    '- Do not summarize, omit, add plot, or censor. Translate every sentence.\n\n'
    'SOURCE:\n'
)


def get_key():
    key = os.environ.get('NVIDIA_API_KEY') or os.environ.get('NGC_API_KEY')
    if not key:
        raise SystemExit('NVIDIA_API_KEY or NGC_API_KEY missing')
    return key


def split_paragraphs(text, limit=CHUNK_CHARS):
    # Keep blank-line paragraph structure as much as practical.
    paras = re.split(r'(\n{2,})', text)
    units = []
    for i in range(0, len(paras), 2):
        part = paras[i]
        sep = paras[i+1] if i+1 < len(paras) else ''
        if part or sep:
            units.append(part + sep)
    chunks = []
    cur = ''
    for u in units:
        if len(cur) + len(u) <= limit:
            cur += u
            continue
        if cur.strip():
            chunks.append(cur)
            cur = ''
        if len(u) <= limit:
            cur = u
            continue
        # Very long paragraph fallback: split by sentence punctuation.
        sentences = re.split(r'(?<=[\u3002\uff01\uff1f!?])', u)
        for sent in sentences:
            if not sent:
                continue
            if len(cur) + len(sent) > limit and cur.strip():
                chunks.append(cur)
                cur = sent
            else:
                cur += sent
    if cur.strip():
        chunks.append(cur)
    return chunks


def read_done(jsonl_path):
    done = {}
    if not jsonl_path.exists():
        return done
    with jsonl_path.open('r', encoding='utf-8') as f:
        for line in f:
            try:
                row = json.loads(line)
            except Exception:
                continue
            if row.get('status') == 'ok':
                done[row['chunk_id']] = row
    return done


def call_translate(key, chunk_text, chunk_id):
    prompt = PROMPT_PREFIX + chunk_text
    # Korean output may use more tokens than Japanese input in this endpoint tokenizer.
    max_tokens = min(12000, max(1200, int(len(chunk_text) * 2.2)))
    payload = {
        'model': MODEL,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': TEMPERATURE,
        'max_tokens': max_tokens,
    }
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    headers = {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json; charset=utf-8',
    }
    last_error = None
    for attempt in range(1, 7):
        try:
            req = urllib.request.Request(API_URL, data=body, headers=headers)
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            content = data['choices'][0]['message'].get('content') or ''
            usage = data.get('usage') or {}
            return {
                'status': 'ok',
                'chunk_id': chunk_id,
                'model': data.get('model', MODEL),
                'seconds': round(time.time() - t0, 3),
                'source_chars': len(chunk_text),
                'translated_chars': len(content),
                'usage': usage,
                'translation': content.strip(),
            }
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode('utf-8', errors='replace')[:800]
            except Exception:
                err_body = str(e)
            last_error = f'HTTP {e.code}: {err_body}'
            if e.code in (400, 401, 403, 404):
                break
        except Exception as e:
            last_error = repr(e)
        sleep = min(90, (2 ** attempt) + random.random() * 3)
        print(f'WARN retry chunk={chunk_id} attempt={attempt} error={last_error} sleep={sleep:.1f}s', flush=True)
        time.sleep(sleep)
    return {'status': 'error', 'chunk_id': chunk_id, 'source_chars': len(chunk_text), 'error': last_error}


def safe_stem(path):
    return path.stem.replace('_raw_all', '')


def process_file(path, key):
    rel = path.relative_to(ROOT)
    stem = safe_stem(path)
    out_md = OUT / f'{stem}.ko.md'
    jsonl = OUT / f'{stem}.chunks.jsonl'
    manifest = OUT / f'{stem}.manifest.json'
    text = path.read_text(encoding='utf-8-sig')
    chunks = split_paragraphs(text)
    done = read_done(jsonl)
    print(f'FILE {path.name}: chars={len(text)} chunks={len(chunks)} done={len(done)}', flush=True)

    tasks = []
    for idx, chunk in enumerate(chunks, 1):
        chunk_hash = hashlib.sha256(chunk.encode('utf-8')).hexdigest()[:16]
        chunk_id = f'{idx:04d}-{chunk_hash}'
        if chunk_id not in done:
            tasks.append((idx, chunk_id, chunk))

    if tasks:
        with jsonl.open('a', encoding='utf-8', newline='\n') as jf:
            def worker(item):
                idx, chunk_id, chunk = item
                row = call_translate(key, chunk, chunk_id)
                row['index'] = idx
                return row
            with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                futs = {ex.submit(worker, item): item for item in tasks}
                completed = 0
                for fut in concurrent.futures.as_completed(futs):
                    row = fut.result()
                    jf.write(json.dumps(row, ensure_ascii=False) + '\n')
                    jf.flush()
                    completed += 1
                    status = row.get('status')
                    print(f'  {path.name} {completed}/{len(tasks)} {row.get("chunk_id")} {status} src={row.get("source_chars")} out={row.get("translated_chars")} sec={row.get("seconds")}', flush=True)
                    if status != 'ok':
                        print('ERROR row:', row, flush=True)

    rows = read_done(jsonl)
    ordered = []
    missing = []
    for idx, chunk in enumerate(chunks, 1):
        chunk_hash = hashlib.sha256(chunk.encode('utf-8')).hexdigest()[:16]
        chunk_id = f'{idx:04d}-{chunk_hash}'
        if chunk_id in rows:
            ordered.append(rows[chunk_id]['translation'])
        else:
            missing.append(chunk_id)
    if missing:
        print(f'FILE_INCOMPLETE {path.name}: missing={len(missing)}', flush=True)
    else:
        content = '\n\n'.join(ordered).strip() + '\n'
        out_md.write_text(content, encoding='utf-8', newline='\n')
        manifest.write_text(json.dumps({
            'source': str(path),
            'relative_source': str(rel),
            'output': str(out_md),
            'model': MODEL,
            'source_chars': len(text),
            'chunks': len(chunks),
            'output_chars': len(content),
            'status': 'complete',
            'created_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        }, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'FILE_COMPLETE {path.name}: output={out_md} chars={len(content)}', flush=True)
    return not missing


def main():
    key = get_key()
    files = sorted(ROOT.rglob('*.txt'))
    if not files:
        raise SystemExit('No txt files found')
    ok = True
    for path in files:
        ok = process_file(path, key) and ok
    if not ok:
        raise SystemExit(2)


if __name__ == '__main__':
    main()
