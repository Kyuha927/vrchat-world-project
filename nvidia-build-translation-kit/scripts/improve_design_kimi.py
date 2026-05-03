#!/usr/bin/env python3
"""
Improve all V2 design documents using NVIDIA Build API with Kimi K2.
Reads the review feedback and rewrites each document to near-perfect (9.5+/10).
"""
import json, os, pathlib, time, urllib.error, urllib.request

API_KEY  = os.environ.get("NVIDIA_API_KEY") or os.environ.get("NGC_API_KEY", "")
API_URL  = os.environ.get("NVIDIA_API_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
MODEL    = "moonshotai/kimi-k2-instruct"
BASE_DIR = pathlib.Path(__file__).parent.parent

REVIEW_FILE = BASE_DIR / "data" / "kimi_design_review.md"
OUT_DIR     = BASE_DIR / "data" / "improved_v3"
OUT_DIR.mkdir(parents=True, exist_ok=True)

DESIGN_DIR  = BASE_DIR.parent / "VRChat_World" / "villain-hero-server"
# 실제 경로 찾기
if not DESIGN_DIR.exists():
    DESIGN_DIR = pathlib.Path("/Users/mac/VRChat_World/villain-hero-server")

DOCS_TO_IMPROVE = [
    ("ONE_PAGE_DESIGN_v2.md",             DESIGN_DIR),
    ("docs/STORY_VORTEX_PART1_v2.md",     DESIGN_DIR),
    ("docs/NPC_SUB_VORTEX_v2.md",         DESIGN_DIR),
    ("docs/STORY_WILDLAND_v2.md",         DESIGN_DIR),
    ("docs/NPC_SUB_WILDLAND_v2.md",       DESIGN_DIR),
    ("docs/STORY_CHEONGPUNG_PART1_v2.md", DESIGN_DIR),
    ("docs/NPC_SUB_SANCTUARY_ARCADIA_v2.md", DESIGN_DIR),
    ("docs/MONSTER_BESTIARY.md",          DESIGN_DIR),
]

def call_kimi(messages: list, max_tokens: int = 4096) -> str:
    body = json.dumps({
        "model": MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }).encode()
    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                data = json.loads(resp.read())
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"  Attempt {attempt+1} failed: {e}")
            time.sleep(5)
    raise RuntimeError("API call failed after 3 retries")

def load(path: pathlib.Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""

def main():
    if not API_KEY:
        print("❌ NVIDIA_API_KEY not set"); return

    review = load(REVIEW_FILE)
    if not review:
        print("❌ Review file not found. Run review_design_kimi.py first."); return

    print(f"📋 Review loaded ({len(review)} chars)")
    print(f"📁 Output → {OUT_DIR}\n")

    # ──────────────────────────────────────────────
    # STEP 1: 개선 지침 생성 (한 번만 호출)
    # ──────────────────────────────────────────────
    print("🧠 Step 1: Generating improvement guidelines from review...")
    guidelines_msg = [
        {"role": "system", "content": (
            "You are a senior game designer and narrative director. "
            "You specialize in Minecraft RPG servers with streamer-centric content. "
            "Reply in Korean. Be extremely detailed and specific."
        )},
        {"role": "user", "content": (
            f"아래는 '빌런 vs 히어로' 마인크래프트 서버 기획 문서 전체에 대한 Kimi K2 검토 보고서야.\n\n"
            f"```\n{review}\n```\n\n"
            "이 피드백을 기반으로, 각 문서를 9.5/10 이상으로 끌어올리기 위한 **구체적인 개선 지침**을 작성해줘.\n"
            "지침은 다음을 반드시 포함해야 해:\n"
            "1. 시간선형성 문제 해결 방안 (시즌 리셋 vs NPC 기억 보존)\n"
            "2. 빌런/히어로 밸런스 재조정 (전쟁터 위치, 정화 스킬 이중 이득 해소)\n"
            "3. 보스 HP 재조정 수치 (팩 사냥 보스 4인 파티 기준)\n"
            "4. 신규 플레이어 10분 온보딩 퀘스트 3개 설계\n"
            "5. 금화 경제 시스템 설계 (공허 파편과의 관계)\n"
            "6. 로그아웃 페널티 시스템\n"
            "7. 크로스 진영 협력 던전 2개 개요\n"
            "각 항목을 마크다운 섹션으로 구분해서 작성해줘."
        )},
    ]
    guidelines = call_kimi(guidelines_msg, max_tokens=3000)
    guidelines_path = OUT_DIR / "improvement_guidelines.md"
    guidelines_path.write_text(f"# 개선 지침\n\n{guidelines}", encoding="utf-8")
    print(f"  ✅ Guidelines saved → {guidelines_path.name}\n")

    # ──────────────────────────────────────────────
    # STEP 2: 문서별 개선
    # ──────────────────────────────────────────────
    for rel_path, base in DOCS_TO_IMPROVE:
        src_path = base / rel_path
        original = load(src_path)
        if not original:
            print(f"  ⚠️  Skip (not found): {rel_path}")
            continue

        doc_name = pathlib.Path(rel_path).name
        out_name  = doc_name.replace("_v2.", "_v3.").replace(".md", "_v3.md") if "_v3." not in doc_name else doc_name
        if "_v2" not in out_name and "_v3" not in out_name:
            out_name = doc_name.replace(".md", "_v3.md")
        out_path  = OUT_DIR / out_name

        print(f"✏️  Improving: {doc_name}  ({len(original)} chars)")

        improve_msg = [
            {"role": "system", "content": (
                "You are a senior game designer. "
                "Rewrite Korean game design documents to be near-perfect (9.5+/10). "
                "Preserve all original Korean creative content. "
                "Add concrete improvements inline. Reply entirely in Korean markdown."
            )},
            {"role": "user", "content": (
                f"## 검토 보고서 요약\n{review[:2000]}\n\n"
                f"## 개선 지침\n{guidelines[:2000]}\n\n"
                f"---\n\n"
                f"## 원본 문서: {doc_name}\n\n```markdown\n{original}\n```\n\n"
                "위 원본 문서를 검토 피드백과 개선 지침을 반영해서 **완전히 개선된 버전**으로 재작성해줘.\n\n"
                "**반드시 지킬 규칙:**\n"
                "- 원본의 창작 내용(NPC 이름, 스토리, 세계관)은 절대 삭제하지 말 것\n"
                "- 피드백에서 지적된 문제점을 모두 해결한 내용 추가\n"
                "- 누락된 시스템(튜토리얼, 경제, 로그아웃 페널티 등)은 해당 문서에 맞는 섹션 추가\n"
                "- 기존 점수에서 최소 +0.8점 개선되도록 퀄리티 향상\n"
                "- 전체 마크다운으로 출력 (코드블록 없이 직접 출력)\n"
            )},
        ]

        try:
            improved = call_kimi(improve_msg, max_tokens=5000)
            out_path.write_text(improved, encoding="utf-8")
            print(f"  ✅ Saved → {out_path.name}  ({len(improved)} chars)\n")
        except Exception as e:
            print(f"  ❌ Failed: {e}\n")

    # ──────────────────────────────────────────────
    # STEP 3: 최종 종합 평가 재실행
    # ──────────────────────────────────────────────
    print("🏁 Step 3: Final re-evaluation of improved documents...")
    improved_docs = list(OUT_DIR.glob("*.md"))
    combined = ""
    for p in improved_docs:
        if "guideline" in p.name or "review" in p.name:
            continue
        txt = p.read_text(encoding="utf-8")
        combined += f"\n\n---\n## {p.name}\n{txt[:3000]}"

    final_msg = [
        {"role": "system", "content": "You are a strict game design evaluator. Rate in Korean."},
        {"role": "user", "content": (
            f"아래는 개선된 V3 기획 문서들이야.\n\n{combined[:35000]}\n\n"
            "이전 리뷰에서 8.7/10이었는데, 개선된 문서들을 보고 **새로운 점수**와 함께 "
            "각 카테고리별 점수 및 추가로 보완할 점이 있다면 간결하게 작성해줘. "
            "형식: 이전 리뷰와 동일한 마크다운 구조."
        )},
    ]
    try:
        final_review = call_kimi(final_msg, max_tokens=2000)
        final_path = OUT_DIR / "final_review_v3.md"
        final_path.write_text(
            f"# Kimi K2 Final Review — V3 Documents\n\n> Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n---\n\n{final_review}",
            encoding="utf-8"
        )
        print(f"  ✅ Final review → {final_path.name}\n")
        print("=" * 60)
        print(final_review[:800])
    except Exception as e:
        print(f"  ❌ Final review failed: {e}")

    print("\n🎉 All done! Check:", OUT_DIR)

if __name__ == "__main__":
    main()
