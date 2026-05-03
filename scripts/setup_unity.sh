#!/bin/bash
# 벨튀 대작전 — Unity Hub 설치 및 프로젝트 열기 안내 스크립트
# macOS (Apple Silicon) 전용

set -e

UNITY_VERSION="2022.3.22f1"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)/unity"
LOG_DIR="$(cd "$(dirname "$0")/.." && pwd)/logs"
LOG_FILE="${LOG_DIR}/unity_setup_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"

echo "═══════════════════════════════════════════" | tee "$LOG_FILE"
echo "  벨튀 대작전 — Unity 개발 환경 설정 가이드" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 1. Unity Hub 확인
echo "📦 Step 1: Unity Hub 확인" | tee -a "$LOG_FILE"
if [ -d "/Applications/Unity Hub.app" ]; then
    echo "  ✅ Unity Hub가 이미 설치되어 있습니다." | tee -a "$LOG_FILE"
else
    echo "  ❌ Unity Hub가 설치되어 있지 않습니다." | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "  다운로드 링크:" | tee -a "$LOG_FILE"
    echo "  👉 https://unity.com/download" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "  또는 터미널에서:" | tee -a "$LOG_FILE"
    echo "  brew install --cask unity-hub" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "  Unity Hub를 설치한 후 이 스크립트를 다시 실행하세요." | tee -a "$LOG_FILE"
fi

# 2. Unity Editor 확인
echo "" | tee -a "$LOG_FILE"
echo "🎮 Step 2: Unity Editor $UNITY_VERSION 확인" | tee -a "$LOG_FILE"
UNITY_PATH="/Applications/Unity/Hub/Editor/$UNITY_VERSION"
if [ -d "$UNITY_PATH" ]; then
    echo "  ✅ Unity $UNITY_VERSION이 설치되어 있습니다." | tee -a "$LOG_FILE"
    echo "  경로: $UNITY_PATH" | tee -a "$LOG_FILE"
else
    echo "  ❌ Unity $UNITY_VERSION이 설치되어 있지 않습니다." | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "  Unity Hub에서 설치:" | tee -a "$LOG_FILE"
    echo "  1. Unity Hub 열기" | tee -a "$LOG_FILE"
    echo "  2. Installs 탭 → Install Editor" | tee -a "$LOG_FILE"
    echo "  3. Archive → Download Archive → $UNITY_VERSION 선택" | tee -a "$LOG_FILE"
    echo "  4. 모듈: Android Build Support 포함 (Quest 호환용)" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "  또는 직접 다운로드:" | tee -a "$LOG_FILE"
    echo "  👉 https://unity.com/releases/editor/whats-new/$UNITY_VERSION" | tee -a "$LOG_FILE"
fi

# 3. 프로젝트 확인
echo "" | tee -a "$LOG_FILE"
echo "📁 Step 3: 프로젝트 구조 확인" | tee -a "$LOG_FILE"
echo "  프로젝트 경로: $PROJECT_DIR" | tee -a "$LOG_FILE"

if [ -f "$PROJECT_DIR/ProjectSettings/ProjectVersion.txt" ]; then
    echo "  ✅ ProjectVersion.txt 존재" | tee -a "$LOG_FILE"
else
    echo "  ❌ ProjectVersion.txt 누락" | tee -a "$LOG_FILE"
fi

if [ -f "$PROJECT_DIR/Packages/vpm-manifest.json" ]; then
    echo "  ✅ VPM manifest 존재" | tee -a "$LOG_FILE"
    echo "  설치된 패키지:" | tee -a "$LOG_FILE"
    cat "$PROJECT_DIR/Packages/vpm-manifest.json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for pkg, info in data.get('dependencies', {}).items():
    print(f'    - {pkg} v{info[\"version\"]}')
for pkg, info in data.get('locked', {}).items():
    print(f'    🔒 {pkg} v{info[\"version\"]}')
" 2>/dev/null | tee -a "$LOG_FILE"
else
    echo "  ❌ VPM manifest 누락" | tee -a "$LOG_FILE"
fi

if [ -d "$PROJECT_DIR/Packages/com.vrchat.worlds" ]; then
    echo "  ✅ VRChat Worlds SDK 설치됨" | tee -a "$LOG_FILE"
else
    echo "  ❌ VRChat Worlds SDK 누락" | tee -a "$LOG_FILE"
fi

if [ -d "$PROJECT_DIR/Packages/com.vrchat.udonsharp" ]; then
    echo "  ✅ UdonSharp 설치됨" | tee -a "$LOG_FILE"
else
    echo "  ⚠️  UdonSharp 폴더 누락 (resolve 필요)" | tee -a "$LOG_FILE"
fi

# 4. 스크립트 확인
echo "" | tee -a "$LOG_FILE"
echo "📝 Step 4: UdonSharp 스크립트 확인" | tee -a "$LOG_FILE"
SCRIPTS=("GameManager" "BellButton" "DoorController" "ScoreBoard" "NotorietySystem" "HideSpot" "FloorElevator")
for script in "${SCRIPTS[@]}"; do
    if [ -f "$PROJECT_DIR/Assets/VRC/Scripts/${script}.cs" ]; then
        echo "  ✅ ${script}.cs" | tee -a "$LOG_FILE"
    else
        echo "  ❌ ${script}.cs 누락" | tee -a "$LOG_FILE"
    fi
done

# 5. Editor 도구 확인
echo "" | tee -a "$LOG_FILE"
echo "🛠️  Step 5: Editor 도구 확인" | tee -a "$LOG_FILE"
EDITORS=("BellTuiSceneBuilder" "BellTuiUdonAttacher")
for editor in "${EDITORS[@]}"; do
    if [ -f "$PROJECT_DIR/Assets/VRC/Editor/${editor}.cs" ]; then
        echo "  ✅ ${editor}.cs" | tee -a "$LOG_FILE"
    else
        echo "  ❌ ${editor}.cs 누락" | tee -a "$LOG_FILE"
    fi
done

# 6. 다음 단계
echo "" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "  🚀 다음 단계" | tee -a "$LOG_FILE"
echo "═══════════════════════════════════════════" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "  Unity Hub에서 프로젝트를 열어주세요:" | tee -a "$LOG_FILE"
echo "  1. Unity Hub → Projects → Open → '$PROJECT_DIR' 선택" | tee -a "$LOG_FILE"
echo "  2. Unity Editor가 열리면 약 3~5분 기다림 (SDK 임포트)" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "  씬 생성:" | tee -a "$LOG_FILE"
echo "  3. 메뉴: VRC BellTui → 🏗️ Build World Scene" | tee -a "$LOG_FILE"
echo "  4. 메뉴: VRC BellTui → 🔗 Attach Udon Scripts" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "  테스트:" | tee -a "$LOG_FILE"
echo "  5. VRChat SDK 창: VRChat SDK → Show Control Panel" | tee -a "$LOG_FILE"
echo "  6. Builder 탭 → Build & Test" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
echo "  로그 저장: $LOG_FILE" | tee -a "$LOG_FILE"
