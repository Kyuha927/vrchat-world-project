# Codex 앱 프롬프트 (복사해서 붙여넣기)

```
/Users/mac/VRChat_World 레포에서 벨튀 대작전 웹게임을 GitHub Pages로 배포해줘.

현재 상태:
- 레포: Kyuha927/vrchat-world-project (이미 public)
- web-belltui/game_v2.js에 최신 게임 코드 있음 (2층 줌, 한글 폰트)
- web-belltui/game.js는 이미 game_v2.js로 교체됨 (로컬)
- .github/workflows/deploy.yml 이미 로컬에 생성됨
- style.css 업데이트됨 (Noto Sans KR)
- 아직 git push 안 됨

할 일:

1. git push
cd /Users/mac/VRChat_World
git add web-belltui/game.js web-belltui/style.css .github/workflows/deploy.yml
git commit -m "fix: game.js 2-floor zoom + deploy workflow"
git push origin main

2. GitHub Pages 활성화
gh api repos/Kyuha927/vrchat-world-project/pages -X PUT -f build_type=workflow
(404면 POST로: gh api repos/Kyuha927/vrchat-world-project/pages -X POST -f build_type=workflow)
(gh 없으면 curl로: curl -X PUT -H "Authorization: Bearer $(cat ~/.config/gh/hosts.yml | grep oauth_token | head -1 | awk '{print $2}')" -H "Accept: application/vnd.github+json" https://api.github.com/repos/Kyuha927/vrchat-world-project/pages -d '{"build_type":"workflow"}')

3. 배포 확인
Actions 탭에서 workflow 완료 대기 후:
curl -s -o /dev/null -w "%{http_code}" https://kyuha927.github.io/vrchat-world-project/
200이면 성공!

최종 URL: https://kyuha927.github.io/vrchat-world-project/
```
