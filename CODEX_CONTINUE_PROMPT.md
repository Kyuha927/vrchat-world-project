# 벨튀 대작전 — Codex 이어서 할 작업 프롬프트

아래 프롬프트를 Codex CLI에 그대로 복사해서 붙여넣으세요.

---

## 프롬프트 (복사용)

```
이 레포는 '벨튀 대작전' 2D 웹 아케이드 게임이야. web-belltui/ 폴더에 정적 HTML5 게임이 있어.
현재 상태:
- GitHub 레포: Kyuha927/vrchat-world-project (public)
- 게임 파일: web-belltui/ 폴더 (index.html, game.js, style.css, net.js, sprites.js 등)
- 서버 불필요: PeerJS P2P 멀티플레이 (net.js에 구현됨)
- GitHub Pages: 아직 안 됨 (workflow 파일이 깨져있음)

다음 작업을 순서대로 해줘:

### 1. game_v2.js → game.js 교체
- web-belltui/game_v2.js를 game.js로 복사 (2층 줌 + 한글 폰트 + 스프라이트 확대)

### 2. 깨진 GitHub Actions workflow 정리 및 재생성
- .github/workflows/ 폴더의 모든 파일 삭제
- 새로 .github/workflows/deploy.yml 생성 (아래 YAML 사용)

### 3. GitHub Pages 활성화
- gh api repos/Kyuha927/vrchat-world-project/pages -X PUT -f build_type=workflow

### 4. 배포 확인
- git push 후 https://kyuha927.github.io/vrchat-world-project/ 접속 테스트
```

### deploy.yml 내용:
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web-belltui
      - id: deployment
        uses: actions/deploy-pages@v4
```
