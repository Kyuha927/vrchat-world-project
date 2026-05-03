import sys
sys.path.append("/Users/mac/VRChat_World/scripts")
from api_client import ask_kimi

prompt = """
마인크래프트 서버 'Villain vs Hero' V3 세계관에 아래 두 요소를 적용한 기획안을 작성해줘. 간결하되 창작적으로.

2. 비대칭 퀘스트: 영웅은 석양 마을 NPC 만수를 지켜야 하고, 빌런은 만수를 죽여야만 다음 단계로 넘어갈 수 있는 퀘스트. 대사 예시 2개씩 포함.
3. 역사적 흔적 시스템: 이전 시즌 플레이어의 묘비·서명·폐허가 청풍장/생츄어리에 남아 신규 퀘스트로 연결되는 구체적 구현 방법.

각 항목에 퀘스트 이름, NPC, 대사 예시, 시스템 분기 결과를 포함해서 풍부하게 작성해줘. 문학적이고 창작적인 톤으로.
"""

print("Kimi K2 에게 2번, 3번 기획 구체화를 요청 중입니다... (최대 2분 소요)")
try:
    result = ask_kimi(prompt, max_tokens=2000, temperature=0.7)
    
    # 결과를 파일로 저장
    import os
    output_path = "/Users/mac/VRChat_World/villain-hero-server/docs/KIMI_10_POINTS_2_3.md"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# Kimi K2: 만점을 위한 비대칭 퀘스트 및 역사적 흔적 기획안\n\n")
        f.write(result)
        
    print(f"\n✅ 생성 완료! 문서가 저장되었습니다: {output_path}")
    print("\n=== 내용 요약 ===")
    print(result[:500] + "...\n(나머지는 파일에서 확인)")
except Exception as e:
    print(f"❌ 오류 발생: {e}")
