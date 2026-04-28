// fan.js — Fan (Neighbor) client logic
let socket = null;
let myFan = null;
let isReady = false;
let currentScreen = 'join-screen';
let joinedCode = '';
let joinedName = '';
let reconnectScreen = null;

const TRAIT_LABELS = {
  slow: '느린 추격',
  fast: '빠른 추격',
  far: '넓은 감지',
  ghost: '투명 유령',
  alarm: '연쇄 알람',
  alert: '무전 경보',
  stun: '스턴 고양이',
  throw: '슬리퍼 투척',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

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

  if (code.length < 4) {
    errEl.textContent = '4자리 방 코드를 입력하세요';
    return;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  joinedCode = code;
  joinedName = name;
  errEl.textContent = '접속 중...';
  joinBtn.disabled = true;

  if (typeof io !== 'function') {
    errEl.textContent = 'Socket.io 클라이언트를 불러올 수 없습니다';
    joinBtn.disabled = false;
    return;
  }

  socket = io(window.location.origin, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    socket.emit('setName', name);
    socket.emit('joinAsNeighbor', { code, name }, (res) => {
      if (!res.ok) {
        errEl.textContent = res.err;
        joinBtn.disabled = false;
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
        return;
      }

      myFan = res.fan;
      setupLobby(res.snapshot);
      showScreen('lobby-screen');
    });
  });

  socket.on('connect_error', () => {
    errEl.textContent = '서버에 연결할 수 없습니다';
    joinBtn.disabled = false;
  });

  socket.io.on('reconnect', () => {
    const screenBeforeReconnect = reconnectScreen || currentScreen;
    reconnectScreen = null;
    if (screenBeforeReconnect !== 'lobby-screen' || !joinedCode) return;
    socket.emit('setName', joinedName);
    socket.emit('joinAsNeighbor', { code: joinedCode, name: joinedName }, (res) => {
      if (!res.ok) {
        showScreen('dc-screen');
        return;
      }
      myFan = res.fan;
      setupLobby(res.snapshot);
    });
  });

  // Event handlers
  socket.on('lobbyUpdate', (data) => {
    document.getElementById('fan-count').textContent = `참가자: ${data.fanCount}명`;
  });

  socket.on('countdown', (snapshot) => {
    showScreen('countdown-screen');
    updateCountdown(snapshot);
  });

  socket.on('fanState', (state) => {
    updateGameState(state);
  });

  socket.on('bellRung', (data) => {
    onBellRung(data);
  });

  socket.on('gameEvent', (evt) => {
    handleGameEvent(evt);
  });

  socket.on('result', (results) => {
    showResults(results);
  });

  socket.on('hostLeft', () => {
    showScreen('dc-screen');
  });

  socket.on('serverError', () => {
    showScreen('dc-screen');
  });

  socket.on('disconnect', () => {
    if (currentScreen !== 'result-screen') {
      reconnectScreen = currentScreen;
      setTimeout(() => {
        if (socket && !socket.connected && currentScreen === reconnectScreen) {
          showScreen('dc-screen');
        }
      }, 2000);
    }
  });
}

// === Lobby ===
function setupLobby(snapshot) {
  document.getElementById('lobby-code').textContent = snapshot.code;
  document.getElementById('fan-count').textContent = `참가자: ${snapshot.fanCount}명`;

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
}

// === Countdown ===
function updateCountdown(snapshot) {
  const num = document.getElementById('cd-num');
  const cd = snapshot.countdown;
  num.textContent = cd > 0 ? cd : 'GO!';

  if (cd <= 0) {
    setTimeout(() => showScreen('game-screen'), 500);
  }
}

// === Game State ===
function updateGameState(state) {
  if (state.state === 'countdown') {
    if (currentScreen !== 'countdown-screen') showScreen('countdown-screen');
    document.getElementById('cd-num').textContent = state.countdown > 0 ? state.countdown : 'GO!';
    if (state.countdown <= 0) setTimeout(() => showScreen('game-screen'), 500);
    return;
  }

  if (state.state === 'play' && currentScreen !== 'game-screen') {
    showScreen('game-screen');
  }

  // Update timer
  document.getElementById('game-timer').textContent = state.timeLeft;

  // Update catch count
  document.getElementById('catch-count').textContent = state.catchCount;

  // Update trap button
  const trapBtn = document.getElementById('btn-trap');
  if (state.trapReady) {
    trapBtn.classList.remove('cooldown');
    trapBtn.textContent = '🪤 함정';
  } else {
    trapBtn.classList.add('cooldown');
    trapBtn.textContent = `🪤 ${state.trapCooldown}s`;
  }

  // Update door visual
  updateDoorVisual(state.myDoorState);
}

function updateDoorVisual(doorState) {
  const frame = document.querySelector('.door-frame');
  const label = document.getElementById('door-label');
  const surface = document.getElementById('door-surface');

  frame.className = 'door-frame';

  switch (doorState) {
    case 'closed':
      surface.textContent = '🚪';
      label.textContent = '문 닫힘 — 대기 중';
      showActionGroup('action-wait');
      break;
    case 'watching':
      frame.classList.add('ringing');
      surface.textContent = '🔔';
      label.textContent = '🔔 딩동! 쵸로키가 벨을 눌렀다!';
      showActionGroup('action-bell');
      vibrate();
      break;
    case 'open':
      frame.classList.add('open');
      surface.textContent = '👀';
      label.textContent = '문 열림 — 쵸로키를 찾는 중';
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

// === Bell Event ===
function onBellRung(data) {
  vibrate([100, 50, 100]);
}

// === Fan Actions ===
function openDoor() {
  if (!socket || !socket.connected) return;
  socket.emit('fanAction', { type: 'openDoor' });
  vibrate(50);
}

function ignoreBell() {
  if (!socket || !socket.connected) return;
  socket.emit('fanAction', { type: 'retreatDoor' });
}

function chase(dir) {
  if (!socket || !socket.connected) return;
  socket.emit('fanAction', { type: 'chase', dir });
  vibrate(30);
}

function chaseButton(event, dir) {
  event.preventDefault();
  chase(dir);
}

function placeTrap() {
  if (!socket || !socket.connected) return;
  socket.emit('fanAction', { type: 'trap' });
  vibrate([50, 30, 50]);
}

function retreat() {
  if (!socket || !socket.connected) return;
  socket.emit('fanAction', { type: 'retreatDoor' });
}

function react(emoji) {
  if (!socket || !socket.connected) return;
  socket.emit('fanReaction', emoji);
  showFloatingReaction(emoji);
  vibrate(20);
}

// === Game Events ===
function handleGameEvent(evt) {
  switch (evt.type) {
    case 'catchSuccess':
      if (evt.fanId === socket.id) {
        vibrate([200, 50, 200]);
        showFloatingReaction('🎉');
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
    document.getElementById('result-mvp').innerHTML =
	      `<div style="font-size:14px;color:#ffd166">👑 MVP 이웃</div>
	       <div style="font-size:28px">${escapeHtml(results.mvp.neighborType.emoji)}</div>
	       <div style="font-weight:700">${escapeHtml(results.mvp.name)}</div>
	       <div>잡은 횟수: ${escapeHtml(results.mvp.catchCount)}회</div>`;
  }

  // Find my result
  const me = results.fans.find(f => f.name === myFan?.name);
  if (me) {
    document.getElementById('result-me').innerHTML =
	      `<div style="font-size:14px;color:#A855F7">내 결과</div>
	       <div style="font-size:28px">${escapeHtml(me.neighborType.emoji)}</div>
	       <div style="font-weight:700">${escapeHtml(me.name)}</div>
	       <div>잡은 횟수: ${escapeHtml(me.catchCount)}회</div>`;
  }
}

// === Utilities ===
function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

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

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const codeInput = document.getElementById('input-code');
  const nameInput = document.getElementById('input-name');

  if (code) {
    codeInput.value = code;
    nameInput.focus();
  }

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  });

  [codeInput, nameInput].forEach(input => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') joinRoom();
    });
  });
});
