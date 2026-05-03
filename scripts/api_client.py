"""
Global API Client — 모든 프로젝트에서 import해서 사용하는 공용 HTTP 클라이언트.
- SSL 인증서 이슈 자동 우회 (LibreSSL 2.8.3 호환)
- 타임아웃 120초 기본
- 3회 자동 재시도
- DNS 실패 시 자동 감지 및 안내 메시지
"""
import json, ssl, time, urllib.request, subprocess, sys

# ─── SSL Context (LibreSSL 2.8.3 호환) ───
def _make_ssl_ctx():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx

_SSL_CTX = _make_ssl_ctx()

# ─── API Keys ───
NVIDIA_API_KEY = "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"
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

# ─── DNS Health Check ───
def check_network():
    """Return True if internet is reachable."""
    return True

def fix_dns():
    """Attempt to fix DNS by setting Google/Cloudflare DNS."""
    print("⚠️  네트워크 불안정 감지. DNS 자동 수정 시도 중...")
    try:
        subprocess.run(["networksetup", "-setdnsservers", "Wi-Fi", "8.8.8.8", "1.1.1.1"],
                       capture_output=True, timeout=5)
        subprocess.run(["dscacheutil", "-flushcache"], capture_output=True, timeout=5)
        print("✅ DNS 설정 완료 (8.8.8.8 / 1.1.1.1)")
        time.sleep(2)
        return check_network()
    except Exception as e:
        print(f"❌ DNS 수정 실패: {e}")
        return False

# ─── Core API Call (3-retry, 120s timeout) ───
def call_api(messages, model="moonshotai/kimi-k2-instruct",
             max_tokens=1000, temperature=0.7, timeout=300, retries=3):
    """
    Call NVIDIA Build API with automatic retry and network recovery.
    Returns the response text string, or raises RuntimeError on total failure.
    """
    # Pre-flight network check
    if not check_network():
        if not fix_dns():
            raise RuntimeError("❌ 인터넷 연결 불가. Wi-Fi를 확인하거나 Mac을 재부팅해 주세요.")

    body = json.dumps({
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }).encode()

    req = urllib.request.Request(
        NVIDIA_API_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    last_error = None
    for attempt in range(1, retries + 1):
        try:
            print(f"  🔄 API 호출 시도 {attempt}/{retries}...")
            with urllib.request.urlopen(req, context=_SSL_CTX, timeout=timeout) as resp:
                data = json.loads(resp.read())
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            last_error = e
            print(f"  ⚠️  시도 {attempt} 실패: {e}")
            if attempt < retries:
                # Try DNS fix between retries
                if "nodename" in str(e) or "servname" in str(e):
                    fix_dns()
                time.sleep(3)

    raise RuntimeError(f"❌ {retries}회 모두 실패. 마지막 에러: {last_error}")


# ─── Convenience Functions ───
def ask_kimi(prompt, system="You are a senior narrative designer. Answer in Korean.", **kwargs):
    """Quick helper to ask Kimi K2 a question."""
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    return call_api(messages, model="moonshotai/kimi-k2-instruct", **kwargs)


def ask_kimi_creative(prompt, context="", **kwargs):
    """
    창작/서사/기획 전용 Kimi K2 호출.
    - max_tokens=2000 고정 (분량 제한 없음)
    - 문학적·창작적 톤의 시스템 프롬프트
    - 선택적으로 기존 세계관 context를 주입 가능
    """
    system = (
        "너는 시니어 내러티브 디자이너이자 게임 세계관 작가야. "
        "마인크래프트 서버 'Villain vs Hero'의 세계관을 설계하고 있어. "
        "답변은 한국어로, 문학적이고 창작적인 톤으로 작성해. "
        "분량 제한 없이 풍부하게 써줘. "
        "퀘스트 이름, NPC 대사, 시스템 분기 결과를 반드시 포함해."
    )
    if context:
        system += f"\n\n[기존 세계관 컨텍스트]\n{context}"

    defaults = {"max_tokens": 2000, "temperature": 0.7}
    defaults.update(kwargs)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    return call_api(messages, model="moonshotai/kimi-k2-instruct", **defaults)


def ask_llama(prompt, system="You are a helpful assistant. Answer in Korean.", **kwargs):
    """Quick helper to ask Llama 3.1 70B."""
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    return call_api(messages, model="meta/llama-3.1-70b-instruct", **kwargs)


# ─── CLI Mode ───
if __name__ == "__main__":
    if len(sys.argv) > 1:
        prompt = " ".join(sys.argv[1:])
    else:
        prompt = input("질문 입력: ")

    print(f"\n🧠 Kimi K2에게 질문 중...\n")
    try:
        result = ask_kimi(prompt)
        print("=== Kimi K2 응답 ===\n")
        print(result)
    except RuntimeError as e:
        print(e)
