# Codex CLI 입력 프롬프트

다음 VRChat 월드를 AI 파이프라인으로 자동 생성해줘.

월드 설명: [여기에 월드 콘셉트를 한 문장으로]

실행 순서:

1. `scripts/gen_spec.py`를 실행해서 위 설명을 `world_spec/world_spec.json`, `world_spec/room_graph.json`, `world_spec/asset_manifest.json`으로 변환해줘.

2. `scripts/gen_assets.py`를 실행해서 `asset_manifest`의 모든 에셋을 병렬로 Meshy API에 요청하고 `assets/raw/`에 저장해줘. 실패한 항목은 `asset_manifest`에 `"status": "failed"`로 마킹해줘.

3. `scripts/repair_assets.py`를 실행해서 `assets/raw/`의 모든 GLB를 Blender Python으로 리토폴로지, UV, LOD 생성, 콜라이더 단순화 처리하고 `assets/ready/`에 저장해줘. 폴리곤은 오브젝트당 최대 15,000으로 제한해줘.

4. `scripts/assemble_scene.py`를 실행해서 Unity Editor `-batchmode -quit`로 `assets/ready/`의 에셋을 임포트하고, `world_spec/room_graph.json` 구조에 따라 씬에 배치해줘. `VRC_SceneDescriptor`를 자동으로 부착해줘.

5. `scripts/gen_udon.py`를 실행해서 `world_spec/world_spec.json`의 `interactions` 목록을 UdonSharp 스크립트로 변환하고 `unity/Assets/VRC/Scripts/`에 저장해줘. 각 인터랙션 오브젝트에 스크립트를 자동 부착해줘.

6. `scripts/qa_check.py`를 실행해서 성능 예산을 검사해줘. 드로우콜 200 이상, 폴리곤 70,000 이상, 머티리얼 누락이 있으면 자동으로 수정해줘.

각 단계 완료 시 `logs/pipeline_YYYYMMDD_HHMMSS.log`에 기록해줘.
오류 발생 시 최대 3회 자동 재시도 후 에스컬레이션해줘.
