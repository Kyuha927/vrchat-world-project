#!/usr/bin/env python3
import json, base64, urllib.request, sys, os

TOKEN = os.popen("security find-generic-password -s 'github.com' -w 2>/dev/null || echo ''").read().strip()
if not TOKEN:
    # Try git credential
    TOKEN = os.popen("git credential fill <<< 'protocol=https\nhost=github.com' 2>/dev/null | grep password | cut -d= -f2").read().strip()
if not TOKEN:
    print("ERROR: No GitHub token found. Trying from git config...")
    TOKEN = os.popen("cat ~/.config/gh/hosts.yml 2>/dev/null | grep oauth_token | head -1 | awk '{print $2}'").read().strip()

if not TOKEN:
    print("ERROR: Cannot find GitHub token")
    sys.exit(1)

REPO = "Kyuha927/vrchat-world-project"
BRANCH = "main"
API = f"https://api.github.com/repos/{REPO}/contents"

def get_sha(path):
    req = urllib.request.Request(f"{API}/{path}?ref={BRANCH}", headers={"Authorization": f"token {TOKEN}"})
    resp = json.loads(urllib.request.urlopen(req).read())
    return resp["sha"]

def push_file(local_path, remote_path, message):
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    sha = get_sha(remote_path)
    data = json.dumps({"message": message, "content": content, "sha": sha, "branch": BRANCH}).encode()
    req = urllib.request.Request(f"{API}/{remote_path}", data=data, method="PUT",
        headers={"Authorization": f"token {TOKEN}", "Content-Type": "application/json"})
    resp = json.loads(urllib.request.urlopen(req).read())
    print(f"✅ {remote_path} → commit {resp['commit']['sha'][:8]}")

push_file("web-belltui/game_v2.js", "web-belltui/game.js", "feat: 2-floor zoom, Korean font, scaled sprites")
print("Done!")
