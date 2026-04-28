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
  onError: null,

  connect(serverUrl) {
    return new Promise((resolve, reject) => {
      if (this.socket) this.socket.disconnect();

      // Use relative path when served from same server
      const url = serverUrl || window.location.origin;
      this.socket = io(url, { transports: ['websocket', 'polling'] });

      this.socket.on('connect', () => {
        this.connected = true;
        this.myId = this.socket.id;
        console.log('[NET] Connected:', this.myId);
        resolve(this.myId);
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        console.log('[NET] Disconnected');
      });

      this.socket.on('connect_error', (err) => {
        console.error('[NET] Connection error:', err.message);
        reject(err);
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
    });
  },

  setName(name) {
    if (this.socket) this.socket.emit('setName', name);
  },

  createRoom() {
    return new Promise((resolve) => {
      this.socket.emit('createRoom', (res) => {
        if (res.ok) {
          this.roomCode = res.code;
          this.roomState = res.snapshot;
        }
        resolve(res);
      });
    });
  },

  joinRoom(code) {
    return new Promise((resolve) => {
      this.socket.emit('joinRoom', code, (res) => {
        if (res.ok) {
          this.roomCode = res.code;
          this.roomState = res.snapshot;
        }
        resolve(res);
      });
    });
  },

  setReady(ready) {
    if (this.socket) this.socket.emit('ready', ready);
  },

  sendInput(input) {
    if (this.socket && this.connected) {
      this.socket.volatile.emit('input', input);
    }
  },

  sendChat(msg) {
    if (this.socket) this.socket.emit('chat', msg);
  },

  leaveRoom() {
    if (this.socket) this.socket.emit('leaveRoom');
    this.roomCode = null;
    this.roomState = null;
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.myId = null;
    this.roomCode = null;
    this.roomState = null;
  },
};
