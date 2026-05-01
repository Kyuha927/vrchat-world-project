// net.js — PeerJS P2P networking for Belltui multiplayer (no server needed!)
// Host phone creates a room, fans connect directly via WebRTC DataChannel.
// Only the PeerJS public cloud is used for signaling (handshake only).

const NET = {
  peer: null,
  connections: new Map(), // host: fanId -> DataConnection
  hostConn: null,         // fan: DataConnection to host
  connected: false,
  myId: null,
  roomCode: null,
  roomState: null,
  isHost: false,
  name: '',
  fanCount: 0,
  fans: [],

  // Callbacks (same API surface as before)
  onLobbyUpdate: null,
  onStateUpdate: null,
  onGameEvent: null,
  onResult: null,
  onCountdown: null,
  onChat: null,
  onPlayerLeft: null,
  onHostLeft: null,
  onError: null,

  // Fake socket-like interface for game.js compatibility
  socket: null,

  _makeSocket() {
    const handlers = {};
    return {
      _handlers: handlers,
      on(event, fn) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(fn);
      },
      emit(event, data) {
        // Host: broadcast to all fans
        if (NET.isHost) {
          NET.connections.forEach(conn => {
            if (conn.open) conn.send({ event, data });
          });
        }
        // Fan: send to host
        else if (NET.hostConn && NET.hostConn.open) {
          NET.hostConn.send({ event, data });
        }
      },
      _fire(event, data) {
        (handlers[event] || []).forEach(fn => fn(data));
      },
      removeAllListeners() {
        Object.keys(handlers).forEach(k => delete handlers[k]);
      },
    };
  },

  _genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  connect() {
    return new Promise((resolve, reject) => {
      if (this.peer) { this.peer.destroy(); this.peer = null; }
      this.socket = this._makeSocket();
      this.peer = new Peer(undefined, {
        debug: 0,
        config: { iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]}
      });
      this.peer.on('open', id => {
        this.connected = true;
        this.myId = id;
        console.log('[NET] PeerJS open:', id);
        resolve(id);
      });
      this.peer.on('error', err => {
        console.error('[NET] PeerJS error:', err);
        if (this.onError) this.onError(err);
        reject(err);
      });
      this.peer.on('disconnected', () => {
        this.connected = false;
        console.log('[NET] PeerJS disconnected, reconnecting...');
        try { this.peer.reconnect(); } catch(e) {}
      });
    });
  },

  setName(name) { this.name = name; },

  // === HOST FUNCTIONS ===

  async createRoom(data = {}) {
    const code = this._genCode();
    // Recreate peer with deterministic ID so fans can find us
    if (this.peer) this.peer.destroy();
    this.socket = this._makeSocket();

    return new Promise((resolve, reject) => {
      const peerId = 'belltui-' + code.toLowerCase();
      this.peer = new Peer(peerId, {
        debug: 0,
        config: { iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]}
      });

      this.peer.on('open', () => {
        this.connected = true;
        this.isHost = true;
        this.roomCode = code;
        this.myId = peerId;
        this.fans = [];
        this.fanCount = 0;
        console.log('[NET] Room created:', code);

        // Listen for fan connections
        this.peer.on('connection', conn => this._onFanConnect(conn));

        resolve({ ok: true, code, snapshot: { fans: [] } });
      });

      this.peer.on('error', err => {
        if (err.type === 'unavailable-id') {
          // Code already taken, try another
          resolve({ ok: false, err: '코드 충돌. 다시 시도해주세요.' });
        } else {
          reject(err);
        }
      });
    });
  },

  _onFanConnect(conn) {
    console.log('[NET] Fan connecting:', conn.peer);
    conn.on('open', () => {
      const fanId = conn.peer;
      this.connections.set(fanId, conn);
      this.fanCount = this.connections.size;

      conn.on('data', msg => this._onHostReceive(fanId, msg));
      conn.on('close', () => this._onFanDisconnect(fanId));
      conn.on('error', () => this._onFanDisconnect(fanId));
    });
  },

  _onHostReceive(fanId, msg) {
    if (!msg || !msg.event) return;
    const { event, data } = msg;

    if (event === 'setName') {
      let fan = this.fans.find(f => f.id === fanId);
      if (!fan) {
        fan = { id: fanId, name: data, ready: false, neighborType: { emoji: '👤', trait: 'slow' } };
        this.fans.push(fan);
      } else {
        fan.name = data;
      }
      this.fanCount = this.fans.length;
      const snapshot = { fans: this.fans };
      this.socket._fire('fanJoined', { count: this.fanCount, snapshot });
      // Notify all fans of lobby update
      this._broadcast({ event: 'lobby', data: snapshot });
    }
    else if (event === 'fanReady') {
      const fan = this.fans.find(f => f.id === fanId);
      if (fan) fan.ready = data;
      this.socket._fire('fanReadyUpdate', { fans: this.fans });
      this._broadcast({ event: 'lobby', data: { fans: this.fans } });
    }
    else if (event === 'neighborType') {
      const fan = this.fans.find(f => f.id === fanId);
      if (fan) fan.neighborType = data;
    }
    else {
      // Forward game events to host game.js
      this.socket._fire('gameEvent', { ...data, type: event, fanId, fanName: (this.fans.find(f=>f.id===fanId)||{}).name });
    }
  },

  _onFanDisconnect(fanId) {
    this.connections.delete(fanId);
    this.fans = this.fans.filter(f => f.id !== fanId);
    this.fanCount = this.fans.length;
    this.socket._fire('fanLeft', { count: this.fanCount, snapshot: { fans: this.fans } });
    this._broadcast({ event: 'lobby', data: { fans: this.fans } });
  },

  _broadcast(msg) {
    this.connections.forEach(conn => {
      if (conn.open) conn.send(msg);
    });
  },

  startHostGame() {
    this._broadcast({ event: 'gameStart', data: {} });
    return Promise.resolve({ ok: true });
  },

  sendHostState(state) {
    if (!this.isHost) return;
    this._broadcast({ event: 'state', data: state });
  },

  sendBellRung(floor, doorIdx) {
    if (!this.isHost) return;
    this._broadcast({ event: 'bellRung', data: { floor, doorIdx } });
  },

  // === FAN FUNCTIONS ===

  async joinRoom(code, name) {
    if (!this.peer || this.peer.destroyed) await this.connect();

    return new Promise((resolve, reject) => {
      const hostId = 'belltui-' + code.toLowerCase();
      const conn = this.peer.connect(hostId, { reliable: true });

      const timeout = setTimeout(() => {
        resolve({ ok: false, err: '호스트를 찾을 수 없습니다. 코드를 확인하세요.' });
      }, 8000);

      conn.on('open', () => {
        clearTimeout(timeout);
        this.hostConn = conn;
        this.roomCode = code;
        this.isHost = false;
        this.socket = this._makeSocket();

        // Send name to host
        conn.send({ event: 'setName', data: name });

        // Listen for host messages
        conn.on('data', msg => {
          if (!msg || !msg.event) return;
          const { event, data } = msg;
          if (event === 'lobby') {
            this.roomState = data;
            if (this.onLobbyUpdate) this.onLobbyUpdate(data);
          } else if (event === 'state') {
            if (this.onStateUpdate) this.onStateUpdate(data);
          } else if (event === 'gameStart') {
            if (this.onCountdown) this.onCountdown({ phase: 'playing' });
          } else if (event === 'bellRung') {
            if (this.onGameEvent) this.onGameEvent({ type: 'bellRung', ...data });
          } else if (event === 'result') {
            if (this.onResult) this.onResult(data);
          } else if (event === 'chat') {
            if (this.onChat) this.onChat(data);
          } else {
            if (this.onGameEvent) this.onGameEvent({ type: event, ...data });
          }
        });

        conn.on('close', () => {
          if (this.onHostLeft) this.onHostLeft();
          this.connected = false;
        });

        resolve({ ok: true, snapshot: { fans: [] } });
      });

      conn.on('error', err => {
        clearTimeout(timeout);
        resolve({ ok: false, err: '연결 실패: ' + err.message });
      });
    });
  },

  setReady(ready) {
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ event: 'fanReady', data: ready });
    }
  },

  sendInput(input) {
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ event: 'hostState', data: input });
    }
  },

  sendChat(msg) {
    if (this.isHost) {
      this._broadcast({ event: 'chat', data: { name: this.name, msg } });
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send({ event: 'chat', data: msg });
    }
  },

  // === CLEANUP ===

  leaveRoom() {
    if (this.isHost) {
      this._broadcast({ event: 'hostLeft', data: {} });
      this.connections.forEach(c => c.close());
      this.connections.clear();
    } else if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    this.fans = [];
    this.fanCount = 0;
    this.roomCode = null;
    this.roomState = null;
    this.isHost = false;
  },

  disconnect() {
    this.leaveRoom();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    if (this.socket) this.socket.removeAllListeners();
    this.socket = null;
    this.connected = false;
    this.myId = null;
  },
};
