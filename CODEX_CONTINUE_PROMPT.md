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

### 1. game_v2.js → game.js 교체 (2층 줌 + 한글 폰트)
- web-belltui/game_v2.js 파일이 있으면 game.js로 복사
- 없으면 web-belltui/game.js에서 다음 변경 적용:
  - `const FLOOR_GAP=280;` 추가 (GAME_TIME 다음 줄)
  - `fy(f)` 함수를 `return 1600-f*FLOOR_GAP` 으로 변경
  - constructor에 `this.camY=0;` 추가, `this.upY()` 뒤에 `this.camY=this.p.y-cv.height*.6;`
  - update()에서 cam 라인 뒤에 `this.camY+=(this.p.y-cv.height*.6-this.camY)*.1;`
  - draw()에서 `cx.translate(-cm,0)` → `cx.translate(-cm,-this.camY)`
  - 모든 캔버스 폰트 'Outfit' → "'Noto Sans KR',sans-serif"
  - 스프라이트 크기: 문 68x104, 플레이어 60x60, NPC 52x60

### 2. 깨진 GitHub Actions workflow 정리 및 재생성
- .github/workflows/ 폴더의 모든 파일 삭제 (pages.yml, static.yml 등)
- 새로 .github/workflows/deploy.yml 생성:

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

### 3. GitHub Pages 활성화
- GitHub API로 Pages 설정: build_type을 "workflow"로
- `gh api repos/Kyuha927/vrchat-world-project/pages -X POST -f build_type=workflow` 
- 이미 있으면: `gh api repos/Kyuha927/vrchat-world-project/pages -X PUT -f build_type=workflow`

### 4. 배포 확인
- git push 후 Actions 탭에서 workflow 실행 확인
- 완료되면 https://kyuha927.github.io/vrchat-world-project/ 접속 테스트
- 이 URL이 최종 모바일 플레이 링크가 됨

### 5. 모바일 테스트 체크리스트
- 폰 브라우저에서 위 URL 접속
- 터치 컨트롤 오버레이 표시 확인
- 솔로 플레이 정상 동작 확인
- 멀티플레이 → 방 코드 생성 → 다른 기기에서 접속 테스트
```

---

## 현재 레포 구조 참고

```
vrchat-world-project/
├── web-belltui/
│   ├── index.html          ← PeerJS CDN 포함, socket.io 제거됨
│   ├── game.js             ← 메인 게임 (아직 구버전, game_v2.js로 교체 필요)
│   ├── game_v2.js          ← 2층 줌 + 한글 폰트 + 스프라이트 확대 버전
│   ├── style.css           ← Noto Sans KR 폰트, 글자 잘림 수정 완료
│   ├── net.js              ← PeerJS P2P 네트워킹 (서버 불필요!)
│   ├── sprites.js          ← 스프라이트 로더
│   ├── character-select.js ← 캐릭터 선택 UI
│   ├── fan.html / fan.js   ← 팬 참여 페이지
│   └── assets/2d/          ← 2D 스프라이트 에셋
├── .github/workflows/      ← 깨진 workflow 파일들 (정리 필요)
└── WINDOWS_HANDOVER.md
```
