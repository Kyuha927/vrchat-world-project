import sys
import os
import glob

sys.path.append("/Users/mac/VRChat_World/scripts")
from api_client import ask_kimi

def get_novel_text(paths):
    text = ""
    for p in sorted(paths):
        with open(p, "r", encoding="utf-8") as f:
            text += f"\n\n--- [ {os.path.basename(p)} ] ---\n\n"
            text += f.read()
    return text

def review_novel(title, text):
    print(f"[{title}] 원고를 Kimi K2에 전송하여 검토를 요청합니다... (최대 3~5분 소요될 수 있습니다)")
    prompt = f"""
다음은 웹소설 '{title}'의 원고입니다.
이 원고를 읽고, 한국 웹소설 시장(문피아, 네이버 시리즈 등) 기준에서 다음 5가지 항목에 대해 구체적이고 날카로운 피드백을 작성해주세요.

1. 첫인상 및 초반부 흡입력 (후킹 요소)
2. 캐릭터 매력도
3. 플롯 및 전개 속도 (사이다 타율)
4. 세계관 및 장르적 적합성
5. 연재를 위한 개선 제안 (총평)

[원고 내용 시작]
{text}
[원고 내용 끝]
"""
    system_prompt = "당신은 한국 웹소설 시장 트렌드와 독자 니즈를 완벽히 꿰뚫고 있는 최고의 전문 편집자입니다."
    
    # 텍스트가 너무 길면 Kimi API 컨텍스트 리밋에 걸릴 수 있으므로, 적절히 설정
    # 타임아웃을 넉넉히 줍니다.
    try:
        result = ask_kimi(prompt, system=system_prompt, max_tokens=4000, temperature=0.7, timeout=300)
        return result
    except Exception as e:
        return f"에러 발생: {e}"

def main():
    # 터미널에서 인자를 넘긴 경우: review_novels "작품명 (장르)" /경로/*.md
    if len(sys.argv) > 2:
        title = sys.argv[1]
        files = sys.argv[2:]
        novels = {title: files}
    else:
        # 기본 검토 대상
        novels = {
            "성녀 (다크 판타지)": glob.glob("/Users/mac/성녀/episodes/*.md"),
            "노인 (현판/스릴러)": glob.glob("/Users/mac/노인/원고/*.md"),
            "무협 - 추영문편 (무협)": glob.glob("/Users/mac/무협/원고/episodes/*.md")
        }

    out_dir = "/Users/mac/Documents/리뷰_결과"
    os.makedirs(out_dir, exist_ok=True)

    for title, files in novels.items():
        if not files:
            print(f"[{title}] 파일을 찾을 수 없습니다.")
            continue
        
        text = get_novel_text(files)
        # 글자수 간략 체크
        print(f"[{title}] 총 {len(files)}화, 글자수: {len(text)}자")
        
        review = review_novel(title, text)
        
        out_file = os.path.join(out_dir, f"{title.split(' ')[0]}_Kimi_리뷰.md")
        with open(out_file, "w", encoding="utf-8") as f:
            f.write(f"# {title} Kimi K2 종합 검토 리뷰\n\n")
            f.write(review)
        
        print(f"✅ [{title}] 리뷰 완료 -> {out_file}\n")

if __name__ == "__main__":
    main()
