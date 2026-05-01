// server/index.js — Asymmetric multiplayer: Streamer (Choroki) vs Fans (Neighbors)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameRoom = require('./GameRoom');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

const rooms = new Map();

function safeAck(callback, payload) {
  if (typeof callback === 'function') callback(payload);
}

function cleanName(value, fallback) {
  const cleaned = String(value || fallback)
    .replace(/[<>&"'`]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .substring(0, 12);
  return cleaned || fallback;
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? genCode() : code;
}

// Cleanup stale rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.isEmpty() || now - room.created > 60 * 60 * 1000) {
      rooms.delete(code);
      console.log(`[x] Room ${code} expired`);
    }
  }
}, 60 * 1000);

// Game loop — 20Hz
setInterval(() => {
  for (const [code, room] of rooms) {
    try {
      if (room.state === 'play' || room.state === 'countdown') {
        room.update();

        // Send full state to host
        io.to(`host_${code}`).emit('state', room.getSnapshot());

        // Send lightweight fan-specific state to each fan (NO position info)
        for (const fan of room.fans.values()) {
          if (fan.connected) {
            const fs = room.getFanState(fan.id);
            if (fs) io.to(fan.id).emit('fanState', fs);
          }
        }

        if (room.state === 'result') {
          const results = room.getResults();
          io.to(code).emit('result', results);
        }
      }
    } catch (err) {
      console.error(`[!] Room ${code} failed:`, err);
      io.to(code).emit('serverError', { err: 'server_error' });
      rooms.delete(code);
    }
  }
}, 50);

io.on('connection', (socket) => {
  let currentRoom = null;
  let role = null; // 'host' | 'fan'
  let playerName = 'Guest';

  function leaveCurrentRoom(reason = 'left') {
    if (!currentRoom) return;
    const code = currentRoom;
    const room = rooms.get(code);

    if (room) {
      if (role === 'host') {
        io.to(code).emit('hostLeft');
        rooms.delete(code);
        console.log(`[HOST] ${playerName} ${reason}, room ${code} closed`);
      } else if (role === 'fan') {
        room.removeFan(socket.id);
        io.to(`host_${code}`).emit('fanLeft', {
          name: playerName,
          count: room.fans.size,
          snapshot: room.getSnapshot(),
        });
        io.to(code).emit('lobbyUpdate', { fanCount: room.fans.size });
        console.log(`[FAN] ${playerName} ${reason} room ${code}`);
      }
    }

    socket.leave(code);
    socket.leave(`host_${code}`);
    currentRoom = null;
    role = null;
  }

  socket.on('setName', (name) => {
    playerName = cleanName(name, 'Guest');
  });

  // === HOST (Streamer) ===
  socket.on('createRoom', (data, callback) => {
    if (typeof data === 'function') {
      callback = data;
      data = {};
    }
    leaveCurrentRoom('replaced');

    const code = genCode();
    playerName = cleanName(data?.name || playerName, '쵸로키');
    const room = new GameRoom(code, socket.id, playerName);
    rooms.set(code, room);
    currentRoom = code;
    role = 'host';
    socket.join(code);
    socket.join(`host_${code}`);

    console.log(`[HOST] Room ${code} created by ${playerName}`);
    safeAck(callback, { ok: true, code, snapshot: room.getSnapshot() });
  });

  socket.on('hostStart', (data, callback) => {
    if (typeof data === 'function') {
      callback = data;
    }
    if (!currentRoom || role !== 'host') return safeAck(callback, { ok: false, err: '호스트 방이 없습니다' });
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'lobby') return safeAck(callback, { ok: false, err: '시작할 수 없는 상태입니다' });
    if (room.fans.size < 1) return safeAck(callback, { ok: false, err: '팬이 1명 이상 필요합니다' });
    if (!room.canStart()) return safeAck(callback, { ok: false, err: '모든 팬이 준비해야 합니다' });

    room.startCountdown();
    io.to(currentRoom).emit('countdown', room.getSnapshot());
    console.log(`[HOST] Game starting in room ${currentRoom}`);
    safeAck(callback, { ok: true });
  });

  socket.on('hostState', (state) => {
    if (!currentRoom || role !== 'host') return;
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'play') return;
    room.updateHostState(state);
  });

  socket.on('setReward', (reward) => {
    if (!currentRoom || role !== 'host') return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.reward = String(reward || '').substring(0, 30);
    io.to(currentRoom).emit('lobbyUpdate', { fanCount: room.fans.size, reward: room.reward });
  });

  socket.on('bellRung', (data) => {
    if (!currentRoom || role !== 'host') return;
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'play') return;

    const floor = Number(data?.floor);
    const doorIdx = Number(data?.doorIdx);
    const evt = room.bellRung(floor, doorIdx);
    if (evt) {
      // DO NOT notify the fan directly — they must watch the stream!
      // Only notify host for UI rendering
      socket.emit('gameEvent', evt);
    }
  });

  socket.on('hostCaught', (data) => {
    if (!currentRoom || role !== 'host') return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const evt = room.hostCaught(data?.fanId);
    if (evt) {
      io.to(currentRoom).emit('gameEvent', evt);
    }
  });

  // === FAN (Neighbor) ===
  socket.on('joinAsNeighbor', (data, callback) => {
    const code = (data?.code || '').toUpperCase().trim();
    playerName = cleanName(data?.name, '팬');

    const room = rooms.get(code);
    if (!room) return safeAck(callback, { ok: false, err: '방을 찾을 수 없습니다' });
    if (room.state !== 'lobby') return safeAck(callback, { ok: false, err: '이미 게임이 진행 중입니다' });

    leaveCurrentRoom('switched');
    const result = room.addFan(socket.id, playerName);
    if (!result.ok) return safeAck(callback, { ok: false, err: result.err });

    currentRoom = code;
    role = 'fan';
    socket.join(code);

    console.log(`[FAN] ${playerName} joined room ${code} (${room.fans.size}/${room.maxFans})`);
    safeAck(callback, { ok: true, fan: result.fan, snapshot: room.getSnapshot() });

    // Notify host of new fan
    io.to(`host_${code}`).emit('fanJoined', {
      name: playerName,
      count: room.fans.size,
      snapshot: room.getSnapshot(),
    });

    // Notify all fans
    io.to(code).emit('lobbyUpdate', { fanCount: room.fans.size });
  });

  socket.on('fanReady', (ready) => {
    if (!currentRoom || role !== 'fan') return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.setFanReady(socket.id, ready);
    io.to(`host_${currentRoom}`).emit('fanReadyUpdate', room.getSnapshot());
  });

  socket.on('fanAction', (action) => {
    if (!currentRoom || role !== 'fan') return;
    const room = rooms.get(currentRoom);
    if (!room || room.state !== 'play') return;

    const evt = room.fanAction(socket.id, action);
    if (evt) {
      if (evt.type === 'fanOpenDoor') {
        // Success: broadcast to host + acting fan
        if (evt.success) {
          io.to(`host_${currentRoom}`).emit('gameEvent', evt);
          socket.emit('gameEvent', { type: 'openSuccess' });
        } else {
          // Miss penalty: only tell the fan
          socket.emit('gameEvent', { type: 'openFail', missCount: evt.missCount, cooldown: evt.cooldown });
        }
      } else if (evt.type === 'cooldownActive') {
        socket.emit('gameEvent', evt);
      } else {
        // Chase, trap, retreat etc — broadcast to host
        io.to(`host_${currentRoom}`).emit('gameEvent', evt);
        if (evt.type === 'fanReaction') io.to(currentRoom).emit('gameEvent', evt);
      }
    }
  });

  socket.on('fanReaction', (emoji) => {
    if (!currentRoom || role !== 'fan') return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const evt = room.fanAction(socket.id, { type: 'reaction', emoji: String(emoji || '').substring(0, 8) });
    if (evt) {
      io.to(currentRoom).emit('gameEvent', evt);
    }
  });

  // === COMMON ===
  socket.on('chat', (msg) => {
    if (!currentRoom) return;
    msg = String(msg || '').substring(0, 100);
    io.to(currentRoom).emit('chat', {
      name: playerName,
      role,
      msg,
    });
  });

  socket.on('leaveRoom', (callback) => {
    leaveCurrentRoom('left');
    safeAck(callback, { ok: true });
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom('disconnected from');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🔔 Belltui Server — http://localhost:${PORT}`);
  console.log(`   Host:  http://localhost:${PORT}/index.html`);
  console.log(`   Fan:   http://localhost:${PORT}/fan.html`);
  // Print local network IPs for phone access
  try {
    const nets = require('os').networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`   📱 Phone: http://${net.address}:${PORT}/index.html`);
          console.log(`   📱 Fan:   http://${net.address}:${PORT}/fan.html`);
        }
      }
    }
  } catch(e) {}
});
