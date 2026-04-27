# Codex - 실패 에셋만 다시 돌릴 때

`world_spec/asset_manifest.json`에서 `"status": "failed"`인 에셋들만 다시 Meshy API에 요청해서 `assets/raw/`에 저장하고, `scripts/repair_assets.py`로 최적화 후 `assets/ready/`로 이동해줘.

완료 후 manifest의 status를 `"ready"`로 업데이트해줘.
