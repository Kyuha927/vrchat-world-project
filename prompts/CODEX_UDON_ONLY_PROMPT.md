# Codex - Udon 스크립트 단독 생성

`world_spec/world_spec.json`의 `interactions` 배열을 읽어서 각 인터랙션에 맞는 UdonSharp 스크립트를 생성해줘.

- `portal`: UdonSharp `VRCPortalMarker` 래퍼
- `toggle_light`: 버튼 누르면 라이트 On/Off, 네트워크 동기화
- `audio_player`: URL 스트리밍 + 볼륨 슬라이더
- `elevator`: 애니메이션 + 탑승 감지 + 층 이동

생성된 스크립트는 `unity/Assets/VRC/Scripts/`에 저장하고 해당 씬 오브젝트에 `AddComponent`로 자동 부착해줘.
