# VRChat_World 프로젝트 전역 환경 설정
# ~/.zshrc 에 아래 한 줄을 추가하면 어디서든 api_client를 import 할 수 있습니다:
#   source /Users/mac/VRChat_World/scripts/env_setup.sh

# ─── API Keys ───
export NVIDIA_API_KEY="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"

# ─── Python Path (api_client.py를 어디서든 import 가능) ───
export PYTHONPATH="/Users/mac/VRChat_World/scripts:${PYTHONPATH}"

# ─── DNS 안정화 (Google + Cloudflare) ───
networksetup -setdnsservers Wi-Fi 8.8.8.8 1.1.1.1 2>/dev/null

# ─── SSL 인증서 검증 완화 (LibreSSL 2.8.3 호환) ───
export PYTHONHTTPSVERIFY=0
export NODE_TLS_REJECT_UNAUTHORIZED=0

# ─── Quick Aliases ───
alias ask-kimi="python3 /Users/mac/VRChat_World/scripts/api_client.py"

echo "✅ VRChat_World 환경 로드 완료 (DNS 고정, API 키 설정됨)"
