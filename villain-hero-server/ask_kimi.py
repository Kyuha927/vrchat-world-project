import json, urllib.request, ssl

API_KEY = "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"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

print("Kimi K2 에게 질문 중... (최대 2분 소요)")

req = urllib.request.Request(
    "https://integrate.api.nvidia.com/v1/chat/completions",
    data=json.dumps({
        "model": "moonshotai/kimi-k2-instruct",
        "messages": [
            {"role": "system", "content": "You are a senior narrative designer. Answer in Korean. Be concise."},
            {"role": "user", "content": "현재 마인크래프트 서버 'Villain vs Hero'의 스토리 기획이 9.5점/10점이야. 서사적으로 완벽한 10점 만점이 되려면 정확히 어떤 문학적/창작적 장치나 스토리 요소가 더 필요한지 3가지만 가장 날카롭게 제시해줘."}
        ],
        "max_tokens": 800, "temperature": 0.7
    }).encode(),
    headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, context=ctx, timeout=120) as resp:
        print("\n=== Kimi K2 응답 ===\n")
        print(json.loads(resp.read())["choices"][0]["message"]["content"])
except Exception as e:
    print(f"Error: {e}")
