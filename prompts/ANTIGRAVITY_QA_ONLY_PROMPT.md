# Antigravity - QA만 단독 실행

`unity/Assets/VRC/Worlds/`의 씬 파일을 분석해서 VRChat 업로드 전 QA를 수행해줘.

다음 항목을 체크하고 Browser Recording 아티팩트를 만들어줘:

1. `VRC_SceneDescriptor` 컴포넌트 존재 여부
2. 스폰 포인트 Transform 확인 (`y > 0`)
3. 머티리얼 참조 누락 오브젝트 수
4. 총 폴리곤 수(목표: 70,000 미만)
5. 총 드로우콜 추정(목표: 200 미만)
6. UdonSharp 컴파일 에러 수

실패 항목이 있으면 Codex에게 수정 지시를 내려줘.
