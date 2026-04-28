// net.js — Socket.io client wrapper for Belltui multiplayer
const NET = {
  socket: null,
  connected: false,
  myId: null,
  roomCode: null,
  roomState: null, // last lobby/state snapshot
  onLobbyUpdate: null,
  onStateUpdate: null,
  onGameEvent: null,
  onResult: null,
  onCountdown: null,
  onChat: null,
  onPlayerLeft: null,
  onHostLeft: null,
  onError: null,

  connect(serverUrl) {
    return new Promise((resolve, reject) => {
      if (this.socket) this.disconnect();
      if (typeof io !== 'function') {
        reject(new Error('Socket.io client is not loaded'));
        return;
      }

      // Use relative path when served from same server
      const url = serverUrl || window.location.origin;
      let settled = false;
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 500,
        timeout: 5000,
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.myId = this.socket.id;
        console.log('[NET] Connected:', this.myId);
        if (!settled) {
          settled = true;
          resolve(this.myId);
        }
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        console.log('[NET] Disconnected:', reason);
      });

      this.socket.on('connect_error', (err) => {
        console.error('[NET] Connection error:', err.message);
        if (!settled) {
          settled = true;
          reject(err);
        }
        if (this.onError) this.onError(err);
      });

      this.socket.io.on('reconnect_failed', () => {
        const err = new Error('서버에 다시 연결할 수 없습니다');
        if (this.onError) this.onError(err);
      });

      // Lobby updates
      this.socket.on('lobby', (snapshot) => {
        this.roomState = snapshot;
        if (this.onLobbyUpdate) this.onLobbyUpdate(snapshot);
      });

      // Game state sync (~20Hz)
      this.socket.on('state', (snapshot) => {
        this.roomState = snapshot;
        if (this.onStateUpdate) this.onStateUpdate(snapshot);
      });

      // Game events (bell rings, catches, etc.)
      this.socket.on('gameEvent', (evt) => {
        if (this.onGameEvent) this.onGameEvent(evt);
      });

      // Countdown
      this.socket.on('countdown', (snapshot) => {
        this.roomState = snapshot;
        if (this.onCountdown) this.onCountdown(snapshot);
      });

      // Game results
      this.socket.on('result', (results) => {
        if (this.onResult) this.onResult(results);
      });

      // Chat
      this.socket.on('chat', (data) => {
        if (this.onChat) this.onChat(data);
      });

      // Player left
      this.socket.on('playerLeft', (data) => {
        if (this.onPlayerLeft) this.onPlayerLeft(data);
      });

      this.socket.on('hostLeft', () => {
        if (this.onHostLeft) this.onHostLeft();
      });

      this.socket.on('serverError', (data) => {
        const err = new Error(data?.err || 'server_error');
        if (this.onError) this.onError(err);
      });
    });
  },

  emitWithAck(event, payload) {
    return new Promise((resolve) => {
      if (!this.socket || !this.connected) {
        resolve({ ok: false, err: '서버에 연결되어 있지 않습니다' });
        return;
      }

      this.socket.timeout(5000).emit(event, payload, (err, res) => {
        if (err) resolve({ ok: false, err: '서버 응답 시간이 초과되었습니다' });
        else resolve(res || { ok: true });
      });
    });
  },

  setName(name) {
    if (this.socket) this.socket.emit('setName', name);
  },

  async createRoom(data = {}) {
    const res = await this.emitWithAck('createRoom', data);
    if (res.ok) {
      this.roomCode = res.code;
      this.roomState = res.snapshot;
    }
    return res;
  },

  async joinRoom(code, name) {
    const res = await this.emitWithAck('joinAsNeighbor', { code, name });
    if (res.ok) {
      this.roomCode = code;
      this.roomState = res.snapshot;
    }
    return res;
  },

  setReady(ready) {
    if (this.socket) this.socket.emit('fanReady', ready);
  },

  sendInput(input) {
    if (this.socket && this.connected) {
      this.socket.volatile.emit('hostState', input);
    }
  },

  sendHostState(state) {
    this.sendInput(state);
  },

  sendBellRung(floor, doorIdx) {
    if (this.socket && this.connected) {
      this.socket.emit('bellRung', { floor, doorIdx });
    }
  },

  startHostGame() {
    return this.emitWithAck('hostStart', {});
  },

  sendChat(msg) {
    if (this.socket) this.socket.emit('chat', msg);
  },

  leaveRoom() {
    if (this.socket && this.connected) this.socket.emit('leaveRoom');
    this.roomCode = null;
    this.roomState = null;
  },

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.myId = null;
    this.roomCode = null;
    this.roomState = null;
  },
};
