import sys
import os

sys.path.append("/Users/mac/VRChat_World/scripts")
from api_client import ask_kimi

def rewrite_novel(title, file_path, codex_feedback):
    if not os.path.exists(file_path):
        print(f"❌ 파일을 찾을 수 없습니다: {file_path}")
        return
        
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()
        
    print(f"[{title}] 1화 원고를 Kimi K2에 전송하여 윤문을 요청합니다... (최대 3~5분 소요)")
    
    prompt = f"""
다음은 웹소설 '{title}'의 1화 원고입니다.
최고의 웹소설 편집자로서 아래의 'Codex 피드백'을 적극 반영하여 이 1화 원고를 리라이팅(윤문)해주세요.
불필요한 반복 묘사를 줄이고, 템포를 빠르게 하며, 도입부의 훅(Hook)을 강력하게 만들어주세요.

[Codex 피드백]
{codex_feedback}

[원고 내용 시작]
{text}
[원고 내용 끝]
"""
    system_prompt = "당신은 한국 웹소설 시장 트렌드와 독자 니즈를 완벽히 꿰뚫고 있는 최고의 전문 편집자 겸 작가입니다."
    
    try:
        result = ask_kimi(prompt, system=system_prompt, max_tokens=4000, temperature=0.7, timeout=300)
        return result
    except Exception as e:
        return f"에러 발생: {e}"

def main():
    targets = [
        {
            "title": "성녀 (다크 판타지)",
            "path": "/Users/mac/성녀/episodes/EP01.md",
            "feedback": "- 1화 후반의 참상과 결심 사이를 압축하여 속도감을 높일 것\n- '살아남기'가 아니라 '강해져서 빼앗기지 않기'라는 주인공 카론의 주도적 목표를 1화에 분명히 박아둘 것\n- 고통 묘사의 반복을 줄일 것"
        },
        {
            "title": "노인 (현판/스릴러)",
            "path": "/Users/mac/노인/원고/EP01_PROLOGUE.md",
            "feedback": "- 시장, 빈 의자 등 비슷한 정서의 일상 묘사를 압축할 것\n- '붉은 하늘'이 갈라지는 사건 등 텐션이 올라가는 지점을 최대한 앞으로 당겨 첫 화부터 긴장감을 줄 것\n- 평화의 시대에 검을 놓지 않은 사람의 씁쓸함은 남기되, 도축의 쾌감을 향한 예열을 짧게 할 것"
        },
        {
            "title": "무협 - 추영문편 (무협)",
            "path": "/Users/mac/무협/원고/episodes/SECT_EP01_입문.md",
            "feedback": "- 꿈에서 깨어난 뒤 현실의 불안함, 두통을 호소하는 반복 묘사를 대폭 쳐낼 것\n- 첫 화 안에서 꿈과 현실의 대비를 빠르게 보여주고, 꿈의 정체에 대한 힌트를 조금 더 명확히 줄 것\n- 주인공 강태가 무엇을 원하는지(더 강해지고 싶다는 욕망)를 선명하게 보여줄 것"
        }
    ]

    out_dir = "/Users/mac/Documents/리뷰_결과"
    os.makedirs(out_dir, exist_ok=True)

    for target in targets:
        title = target["title"]
        path = target["path"]
        feedback = target["feedback"]
        
        rewritten_text = rewrite_novel(title, path, feedback)
        if rewritten_text:
            out_file = os.path.join(out_dir, f"{title.split(' ')[0]}_Kimi_윤문본.md")
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(f"# {title} - Kimi K2 윤문본 (Codex 피드백 반영)\n\n")
                f.write(rewritten_text)
            print(f"✅ [{title}] 윤문 완료 -> {out_file}\n")

if __name__ == "__main__":
    main()
