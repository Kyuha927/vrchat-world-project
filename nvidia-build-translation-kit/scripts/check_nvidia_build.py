import json
import os
import sys
import urllib.error
import urllib.request

API_URL = os.environ.get("NVIDIA_API_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
MODEL = os.environ.get("NVIDIA_MODEL", "qwen/qwen3.5-397b-a17b")


def main():
    key = os.environ.get("NVIDIA_API_KEY") or os.environ.get("NGC_API_KEY")
    if not key:
        print(json.dumps({"ok": False, "error": "NVIDIA_API_KEY/NGC_API_KEY missing"}, ensure_ascii=False))
        return 2

    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": "Reply with OK only."}],
        "temperature": 0,
        "max_tokens": 8,
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = (data["choices"][0]["message"].get("content") or "").strip()
        print(json.dumps({"ok": True, "model": data.get("model", MODEL), "reply": text}, ensure_ascii=False))
        return 0
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:800]
        print(json.dumps({"ok": False, "status": e.code, "error": body}, ensure_ascii=False))
        return 1
    except Exception as e:
        print(json.dumps({"ok": False, "error": repr(e)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
