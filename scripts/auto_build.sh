#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 벨튀 대작전 — 전체 빌드 자동화 스크립트
# AI가 Unity 씬 조립, UdonSharp 부착, 라이트맵 베이크까지 자동 실행
#
# 사용법:
#   bash scripts/auto_build.sh              # 전체 빌드
#   bash scripts/auto_build.sh --scene-only # 씬 생성만
#   bash scripts/auto_build.sh --udon-only  # Udon 부착만
#   bash scripts/auto_build.sh --bake-only  # 라이트맵 베이크만
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# === 경로 설정 ===
UNITY_EDITOR="/Applications/Unity/Hub/Editor/2022.3.22f1/Unity.app/Contents/MacOS/Unity"
PROJECT_PATH="/Users/mac/VRChat_World/unity"
LOG_DIR="/Users/mac/VRChat_World/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/auto_build_${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

# === 유틸리티 ===
log() {
    local msg="[$(date +%H:%M:%S)] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

run_unity() {
    local method="$1"
    local desc="$2"
    local unity_log="${LOG_DIR}/unity_${method}_${TIMESTAMP}.log"

    log "🔧 Unity 실행: ${desc} (${method})"
    log "   로그: ${unity_log}"

    "$UNITY_EDITOR" \
        -batchmode \
        -quit \
        -projectPath "$PROJECT_PATH" \
        -executeMethod "$method" \
        -logFile "$unity_log" \
        2>&1 | tee -a "$LOG_FILE" || {
            log "❌ Unity 실행 실패: ${method}"
            log "   상세 로그 확인: ${unity_log}"
            tail -20 "$unity_log" 2>/dev/null >> "$LOG_FILE"
            return 1
        }

    log "✅ 완료: ${desc}"
}

# === 메인 ===
MODE="${1:-all}"

log "═══════════════════════════════════════════"
log "🎮 벨튀 대작전 — 자동 빌드 파이프라인"
log "   모드: ${MODE}"
log "   Unity: ${UNITY_EDITOR}"
log "   프로젝트: ${PROJECT_PATH}"
log "═══════════════════════════════════════════"

# Unity 존재 확인
if [ ! -f "$UNITY_EDITOR" ]; then
    log "❌ Unity를 찾을 수 없습니다: ${UNITY_EDITOR}"
    exit 1
fi

# 프로젝트 확인
if [ ! -d "$PROJECT_PATH/Assets" ]; then
    log "❌ Unity 프로젝트를 찾을 수 없습니다: ${PROJECT_PATH}"
    exit 1
fi

case "$MODE" in
    all)
        log ""
        log "━━━ Step 1/4: 씬 자동 생성 ━━━"
        run_unity "BellTuiSceneBuilder.AutoBuild" "벨튀 월드 씬 생성"

        log ""
        log "━━━ Step 2/4: UdonSharp 스크립트 부착 ━━━"
        run_unity "BellTuiUdonAttacher.AutoAttach" "UdonSharp 컴포넌트 부착"

        log ""
        log "━━━ Step 3/4: 라이트맵 베이크 ━━━"
        run_unity "BellTuiBaker.AutoBake" "라이트맵 베이크"

        log ""
        log "━━━ Step 4/4: QA 검사 ━━━"
        python3 /Users/mac/VRChat_World/scripts/qa_check.py | tee -a "$LOG_FILE"
        ;;
    --scene-only)
        run_unity "BellTuiSceneBuilder.AutoBuild" "벨튀 월드 씬 생성"
        ;;
    --udon-only)
        run_unity "BellTuiUdonAttacher.AutoAttach" "UdonSharp 컴포넌트 부착"
        ;;
    --bake-only)
        run_unity "BellTuiBaker.AutoBake" "라이트맵 베이크"
        ;;
    *)
        echo "사용법: $0 [all|--scene-only|--udon-only|--bake-only]"
        exit 1
        ;;
esac

log ""
log "═══════════════════════════════════════════"
log "✅ 빌드 파이프라인 완료!"
log "   로그: ${LOG_FILE}"
log "═══════════════════════════════════════════"
