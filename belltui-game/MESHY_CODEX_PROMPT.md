# Codex Agent Task: Meshy AI 웹 UI 자동화 (Image-to-3D)

## 1. 프로젝트 배경
VRChat용 'Bell-Tui (벨튀 대작전)' 사이버펑크 게임의 3D 에셋을 생성 중입니다.
Meshy API는 유료 구독이 필요하므로, **웹 UI(무료 크레딧 100개)를 브라우저 자동화로 조작**하여 3D 모델을 생성합니다.

## 2. 계정 정보
- **Meshy URL**: https://app.meshy.ai (또는 https://www.meshy.ai/ko/workspace)
- **계정**: jhk920707 (이미 로그인되어 있음)
- **무료 크레딧**: 100개 (에셋 1개당 약 20크레딧 소모)

## 3. 파일 경로
- **입력 이미지**: `belltui-game/assets/turnaround/` 폴더의 `*_turnaround.png` 파일들
- **출력 GLB**: `belltui-game/assets/raw/3d/` 폴더에 `{asset_id}.glb`로 저장

## 4. 우선순위 에셋 목록 (크레딧 고려, 5개 선별)

| 순서 | 파일명 | 저장명 | 설명 |
|------|--------|--------|------|
| 1 | `choroki_base_turnaround.png` | `choroki_base.glb` | 메인 캐릭터 (무기 미포함 기본 바디) |
| 2 | `sledgehammer_turnaround.png` | `sledgehammer.glb` | 메인 무기 (캐릭터와 분리 생성) |
| 3 | `door_closed_turnaround.png` | `door_closed.glb` | 아파트 문 (핵심 환경) |
| 4 | `npc_grandma_turnaround.png` | `npc_grandma.glb` | 할머니 NPC |
| 5 | `patrol_drone_turnaround.png` | `patrol_drone.glb` | 순찰 드론 (적 유닛) |

## 5. 실행 워크플로우

### Step 1: Meshy 작업 공간 진입
- `https://www.meshy.ai/ko/workspace` 또는 `https://app.meshy.ai` 접속
- 왼쪽 사이드바에서 **"Image to 3D"** 메뉴 클릭

### Step 2: 이미지 업로드
- 업로드 영역(드래그 앤 드롭 또는 파일 선택 버튼) 클릭
- 위 표의 순서대로 해당 `*_turnaround.png` 파일을 업로드

### Step 3: 생성 설정
- **Art Style**: 기본값 유지 (또는 "Cartoon" 선택 가능 시 선택)
- **PBR**: 활성화 (체크박스가 있으면 켜기)
- **Generate** 버튼 클릭

### Step 4: 대기 및 다운로드
- 진행률 표시가 100%가 될 때까지 대기 (보통 1~2분)
- 완료되면 결과물 3D 뷰어에서 **Download** 아이콘 클릭
- 포맷: **GLB** 선택
- 다운로드된 파일을 `belltui-game/assets/raw/3d/` 폴더로 이동
- 파일명을 위 표의 `저장명`으로 변경

### Step 5: 반복
- 위 표의 5개 에셋에 대해 Step 2~4를 반복

## 6. 주의사항
- 페이지 로딩/생성 중 충분히 대기할 것 (최소 3초 간격)
- 팝업이나 모달(프로모션, 튜토리얼)이 뜨면 X 또는 Skip 버튼으로 닫기
- 무한 루프 방지: 각 단계 최대 3분 타임아웃 설정
- 문제 발생 시 스크린샷과 함께 어느 단계에서 막혔는지 보고

## 7. 3D AI 도구 비교 참고 (검증된 정보)

| | Hunyuan3D-2 | Meshy | Tripo |
|---|---|---|---|
| **강점** | 기하학적 정확도 + 텍스처 일관성 | 빠른 반복 + 사용 편의성 | 깔끔한 토폴로지 |
| **메쉬 품질** | 매끄러운 표면, 정확한 윤곽 | 약간 거칠 수 있음 (후처리 필요) | 매우 깔끔한 쿼드 기반 |
| **텍스처 품질** | 고충실도, PBR 지향 | 다양한 스타일 프리셋 | 일관적, 양호 |
| **라이선스** | ⚠️ 상업용 별도 허가 필요 | ✅ CC BY 4.0 | ✅ 명확 |
| **추천 용도** | 프로토타이핑, 복잡한 오브젝트 | 게임 에셋 빠른 생성 | 3D 프린팅, 리깅용 |

> **결론**: Hunyuan3D-2는 메쉬와 텍스처 모두 최상위권이지만 상업 라이선스 제한이 있어, 상용 게임에는 Meshy(편의성+라이선스)가 실용적임.
