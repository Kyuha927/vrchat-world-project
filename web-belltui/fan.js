// fan.js — Fan (Neighbor) client logic
// NO vibration. Bell sounds only. Coin betting + SOOP rewards.
let socket = null;
let myFan = null;
let isReady = false;
let currentScreen = 'join-screen';
let joinedCode = '';
let joinedName = '';
let myCoins = 100; // starting coins

const TRAIT_LABELS = {
  slow: '느린 추격', fast: '빠른 추격', far: '넓은 감지',
  ghost: '투명 유령', alarm: '연쇄 알람', alert: '무전 경보',
  stun: '스턴 고양이', throw: '슬리퍼 투척',
};
const PROX_TEXT = ['조용함', '발소리가 들린다...', '가까이 온다!', '🔔 바로 앞이다!!'];
const PROX_COLORS = ['#444', '#886600', '#cc6600', '#E94560'];
const BET_OPTIONS = [10, 30, 50, 100];
let currentBet = 10;

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// === Audio (bell sounds only, NO vibration) ===
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playBell(freq = 800, dur = 0.15, vol = 0.3) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch(e) {}
}
function bellSuccess() { playBell(1200, 0.15); setTimeout(() => playBell(1600, 0.2), 150); }
function bellFail() { playBell(300, 0.3, 0.25); setTimeout(() => playBell(200, 0.4, 0.2), 200); }
function bellTap() { playBell(900, 0.08, 0.15); }
function bellCatch() { playBell(800, 0.1); setTimeout(() => playBell(1000, 0.1), 100); setTimeout(() => playBell(1400, 0.2), 200); }
function bellProximity(level) { if (level >= 3) playBell(600, 0.1, 0.12); else if (level >= 2) playBell(400, 0.08, 0.08); }

// === Screen Management ===
function showScreen(id) {
  const next = document.getElementById(id);
  if (!next) return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  next.classList.add('active');
  currentScreen = id;
}

// === Connection ===
function joinRoom() {
  const code = document.getElementById('input-code').value.trim().toUpperCase();
  const name = document.getElementById('input-name').value.trim() || '이웃주민';
  const errEl = document.getElementById('join-error');
  const joinBtn = document.getElementById('btn-join');
  if (code.length < 4) { errEl.textContent = '4자리 방 코드를 입력하세요'; return; }
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
  joinedCode = code; joinedName = name;
  errEl.textContent = '접속 중...'; joinBtn.disabled = true;
  if (typeof io !== 'function') { errEl.textContent = 'Socket.io를 불러올 수 없습니다'; joinBtn.disabled = false; return; }

  socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    socket.emit('setName', name);
    socket.emit('joinAsNeighbor', { code, name }, (res) => {
      if (!res.ok) { errEl.textContent = res.err; joinBtn.disabled = false; socket.removeAllListeners(); socket.disconnect(); socket = null; return; }
      myFan = res.fan;
      myCoins = 100;
      setupLobby(res.snapshot);
      showScreen('lobby-screen');
    });
  });
  socket.on('connect_error', () => { errEl.textContent = '서버에 연결할 수 없습니다'; joinBtn.disabled = false; });
  socket.on('lobbyUpdate', (data) => { document.getElementById('fan-count').textContent = `참가자: ${data.fanCount}명`; });
  socket.on('countdown', (snapshot) => { showScreen('countdown-screen'); updateCountdown(snapshot); });
  socket.on('fanState', (state) => updateGameState(state));
  socket.on('gameEvent', (evt) => handleGameEvent(evt));
  socket.on('result', (results) => showResults(results));
  socket.on('hostLeft', () => showScreen('dc-screen'));
  socket.on('serverError', () => showScreen('dc-screen'));
  socket.on('disconnect', () => {
    if (currentScreen !== 'result-screen') {
      setTimeout(() => { if (socket && !socket.connected) showScreen('dc-screen'); }, 2000);
    }
  });
}

// === Lobby ===
function setupLobby(snapshot) {
  document.getElementById('lobby-code').textContent = snapshot.code;
  document.getElementById('fan-count').textContent = `참가자: ${snapshot.fanCount}명`;
  if (snapshot.reward) {
    const rEl = document.getElementById('lobby-reward');
    if (rEl) rEl.textContent = `🎁 보상: ${snapshot.reward}`;
  }
  if (myFan) {
    document.getElementById('nb-emoji').textContent = myFan.neighborType.emoji;
    document.getElementById('nb-name').textContent = myFan.neighborType.name;
    document.getElementById('nb-trait').textContent = TRAIT_LABELS[myFan.neighborType.trait] || myFan.neighborType.trait;
    document.getElementById('nb-role').textContent = myFan.neighborType.name;
  }
}

function toggleReady() {
  if (!socket || !socket.connected) return;
  isReady = !isReady;
  const btn = document.getElementById('btn-ready');
  btn.textContent = isReady ? '✅ 준비 완료!' : '✋ 준비!';
  btn.classList.toggle('ready', isReady);
  socket.emit('fanReady', isReady);
  bellTap();
}

// === Countdown ===
function updateCountdown(snapshot) {
  const cd = snapshot.countdown;
  document.getElementById('cd-num').textContent = cd > 0 ? cd : 'GO!';
  if (cd <= 0) setTimeout(() => showScreen('game-screen'), 500);
}

// === Bet ===
function selectBet(amount) {
  if (amount > myCoins) amount = myCoins;
  if (amount < 1) amount = 1;
  currentBet = amount;
  document.querySelectorAll('.bet-btn').forEach(b => b.classList.remove('selected'));
  const el = document.querySelector(`.bet-btn[data-bet="${amount}"]`);
  if (el) el.classList.add('selected');
  document.getElementById('bet-display').textContent = `${currentBet}`;
  bellTap();
}

function updateCoinDisplay() {
  const el = document.getElementById('coin-count');
  if (el) el.textContent = myCoins;
}

// === Game State ===
function updateGameState(state) {
  if (state.state === 'countdown') {
    if (currentScreen !== 'countdown-screen') showScreen('countdown-screen');
    document.getElementById('cd-num').textContent = state.countdown > 0 ? state.countdown : 'GO!';
    if (state.countdown <= 0) setTimeout(() => showScreen('game-screen'), 500);
    return;
  }
  if (state.state === 'play' && currentScreen !== 'game-screen') showScreen('game-screen');

  document.getElementById('game-timer').textContent = state.timeLeft;
  document.getElementById('catch-count').textContent = state.catchCount;
  document.getElementById('miss-count').textContent = state.missCount;
  document.getElementById('host-score').textContent = state.hostScore;
  document.getElementById('host-lives').textContent = state.hostLives;
  updateCoinDisplay();
  updateProximity(state.proximity);

  const trapBtn = document.getElementById('btn-trap');
  if (state.trapReady) { trapBtn.classList.remove('cooldown'); trapBtn.textContent = '🪤 함정'; }
  else { trapBtn.classList.add('cooldown'); trapBtn.textContent = `🪤 ${state.trapCooldown}s`; }

  if (state.openCooldown > 0) {
    document.getElementById('cooldown-timer').textContent = state.openCooldown;
    showActionGroup('action-cooldown');
  } else if (state.myDoorState === 'closed') {
    showActionGroup('action-closed');
  }
  updateDoorVisual(state.myDoorState, state.openCooldown);
}

function updateProximity(level) {
  level = Math.max(0, Math.min(3, level || 0));
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`prox-${i}`);
    dot.classList.toggle('active', i <= level);
    dot.style.backgroundColor = i <= level ? PROX_COLORS[level] : '#333';
  }
  document.getElementById('prox-text').textContent = PROX_TEXT[level];
  document.getElementById('prox-text').style.color = PROX_COLORS[level];
  bellProximity(level);
}

function updateDoorVisual(doorState, cooldown) {
  const frame = document.getElementById('door-frame');
  const label = document.getElementById('door-label');
  const surface = document.getElementById('door-surface');
  const openBtn = document.getElementById('btn-open');
  frame.className = 'door-frame';

  switch (doorState) {
    case 'closed':
      if (cooldown > 0) {
        frame.classList.add('penalty');
        surface.textContent = '⛔';
        label.textContent = `페널티! ${cooldown}초 대기`;
        openBtn.disabled = true;
        openBtn.textContent = `⛔ ${cooldown}초`;
      } else {
        surface.textContent = '🚪';
        label.textContent = '방송을 보고 타이밍을 노리세요!';
        openBtn.disabled = false;
        openBtn.textContent = `🚪 문 열기! (${currentBet}코인)`;
        showActionGroup('action-closed');
      }
      break;
    case 'open':
      frame.classList.add('open');
      surface.textContent = '👀';
      label.textContent = '🎯 성공! 쵸로키를 잡아라!';
      showActionGroup('action-chase');
      break;
    case 'chasing':
      frame.classList.add('chasing');
      surface.textContent = '🏃';
      label.textContent = '추격 중!';
      showActionGroup('action-chase');
      break;
  }
}

function showActionGroup(id) {
  document.querySelectorAll('.action-group').forEach(g => g.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// === Fan Actions ===
function tryOpenDoor() {
  if (!socket || !socket.connected) return;
  if (myCoins < currentBet) { showToast('코인이 부족합니다!', 'fail'); return; }
  socket.emit('fanAction', { type: 'openDoor', bet: currentBet });
  bellTap();
}

function chase(dir) {
  if (!socket || !socket.connected) return;
  socket.emit('fanAction', { type: 'chase', dir });
  bellTap();
}

function placeTrap() {
  if (!socket || !socket.connected) return;
  socket.emit('fanAction', { type: 'trap' });
  bellTap();
}

function retreat() {
  if (!socket || !socket.connected) return;
  socket.emit('fanAction', { type: 'retreatDoor' });
}

function react(emoji) {
  if (!socket || !socket.connected) return;
  socket.emit('fanReaction', emoji);
  showFloatingReaction(emoji);
  bellTap();
}

// === Game Events ===
function handleGameEvent(evt) {
  switch (evt.type) {
    case 'openSuccess':
      const winAmount = (evt.bet || currentBet) * 3;
      myCoins += winAmount;
      bellSuccess();
      showFloatingReaction('🎯');
      showToast(`🎯 적중! +${winAmount} 코인! (3배)`, 'success');
      updateCoinDisplay();
      break;
    case 'openFail':
      myCoins = Math.max(0, myCoins - (evt.bet || currentBet));
      bellFail();
      showFloatingReaction('❌');
      showToast(`❌ 빗나감! -${evt.bet || currentBet} 코인 (${evt.missCount}번째)`, 'fail');
      updateCoinDisplay();
      break;
    case 'cooldownActive':
      showToast(`⛔ 쿨다운 중! ${evt.remaining}초`, 'fail');
      break;
    case 'catchSuccess':
      if (socket && evt.fanId === socket.id) {
        myCoins += 50;
        bellCatch();
        showFloatingReaction('🎉');
        showToast('🎉 잡았다!! +50 코인 보너스!', 'success');
        updateCoinDisplay();
      }
      break;
    case 'fanReaction':
      showFloatingReaction(evt.emoji);
      break;
  }
}

// === Results ===
function showResults(results) {
  showScreen('result-screen');
  document.getElementById('result-host').innerHTML =
    `<div style="font-size:32px">🔨</div>
     <div style="font-size:18px;font-weight:700;color:#E94560">${escapeHtml(results.hostName)}</div>
     <div>점수: ${escapeHtml(results.hostScore)} | 남은 라이프: ${escapeHtml(results.hostLives)}</div>`;

  if (results.mvp) {
    let rewardHtml = '';
    if (results.reward) {
      rewardHtml = `<div style="margin-top:8px;padding:8px;background:rgba(255,209,102,.1);border-radius:8px;color:#ffd166;font-weight:700">🎁 보상: ${escapeHtml(results.reward)}</div>`;
    }
    document.getElementById('result-mvp').innerHTML =
      `<div style="font-size:14px;color:#ffd166">👑 MVP 이웃</div>
       <div style="font-size:28px">${escapeHtml(results.mvp.neighborType.emoji)}</div>
       <div style="font-weight:700">${escapeHtml(results.mvp.name)}</div>
       <div>잡기: ${escapeHtml(results.mvp.catchCount)}회 | 코인: ${escapeHtml(results.mvp.coins)}개</div>
       ${rewardHtml}`;
  }
  const me = results.fans.find(f => f.name === myFan?.name);
  if (me) {
    document.getElementById('result-me').innerHTML =
      `<div style="font-size:14px;color:#A855F7">내 결과</div>
       <div style="font-size:28px">${escapeHtml(me.neighborType.emoji)}</div>
       <div style="font-weight:700">${escapeHtml(me.name)}</div>
       <div>잡기: ${escapeHtml(me.catchCount)}회 | 코인: ${myCoins}개</div>`;
  }
}

// === UI Utilities ===
function showFloatingReaction(emoji) {
  const overlay = document.getElementById('reactions-overlay');
  const el = document.createElement('div');
  el.className = 'floating-reaction';
  el.textContent = emoji;
  el.style.left = (20 + Math.random() * 60) + '%';
  el.style.bottom = '80px';
  overlay.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function showToast(msg, type) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.getElementById('app').appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const codeInput = document.getElementById('input-code');
  const nameInput = document.getElementById('input-name');
  if (code) { codeInput.value = code; nameInput.focus(); }
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  });
  [codeInput, nameInput].forEach(input => {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
  });
  // Default bet
  selectBet(10);
});
