const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });
const path = require('path');
const os = require('os');

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, '../')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Rooms state
// roomCode: { host: socketId, fans: Map<socketId, {name, neighborType, ready}>, state: 'waiting'|'playing', hostReward: string }
const rooms = new Map();

const NEIGHBOR_TYPES = [
  { trait: 'slow', emoji: '👵', name: '할머니', desc: '천천히 쫓아옵니다' },
  { trait: 'fast', emoji: '💪', name: '근육맨', desc: '매우 빠르게 쫓아옵니다' },
  { trait: 'far', emoji: '🐕', name: '강아지집', desc: '멀리서도 감지합니다' },
  { trait: 'ghost', emoji: '👻', name: '유령', desc: '은밀하게 다가옵니다' },
  { trait: 'alarm', emoji: '👩', name: '아줌마', desc: '주변 이웃도 깨웁니다' },
  { trait: 'alert', emoji: '👮', name: '경비원', desc: '다른 층으로 무전합니다' },
  { trait: 'stun', emoji: '🐱', name: '고양이집', desc: '주인공을 멈칫하게 합니다' },
  { trait: 'throw', emoji: '😴', name: '잠옷아저씨', desc: '원거리에서 슬리퍼를 던집니다' }
];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
        return alias.address;
    }
  }
  return '0.0.0.0';
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.data = { isHost: false, roomCode: null, name: '팬' };

  // --- Host Events ---
  socket.on('createRoom', (data, callback) => {
    let code = generateRoomCode();
    while (rooms.has(code)) code = generateRoomCode();
    
    rooms.set(code, {
      host: socket.id,
      hostName: data.name || '스트리머',
      fans: new Map(),
      state: 'waiting',
      hostReward: ''
    });
    
    socket.data.isHost = true;
    socket.data.roomCode = code;
    socket.join(code);
    
    console.log(`Room created: ${code} by ${socket.id}`);
    if (callback) callback({ ok: true, code });
  });

  socket.on('setReward', (rewardStr) => {
    const r = socket.data.roomCode;
    if (socket.data.isHost && rooms.has(r)) {
      rooms.get(r).hostReward = rewardStr;
      io.to(r).emit('rewardUpdated', rewardStr);
    }
  });

  socket.on('startHostGame', (callback) => {
    const r = socket.data.roomCode;
    const room = rooms.get(r);
    if (!socket.data.isHost || !room) {
      if (callback) callback({ ok: false, err: '방이 없거나 호스트가 아님' });
      return;
    }
    
    const fansArray = Array.from(room.fans.values());
    if (fansArray.length === 0) {
      if (callback) callback({ ok: false, err: '참여한 팬이 없습니다' });
      return;
    }
    
    const allReady = fansArray.every(f => f.ready);
    if (!allReady) {
      if (callback) callback({ ok: false, err: '아직 준비하지 않은 팬이 있습니다' });
      return;
    }

    room.state = 'playing';
    io.to(r).emit('gameStarted');
    if (callback) callback({ ok: true });
  });

  socket.on('hostStateUpdate', (state) => {
    if (socket.data.isHost && socket.data.roomCode) {
      // Forward host game state to all fans
      socket.to(socket.data.roomCode).emit('hostState', state);
    }
  });

  socket.on('hostBellRung', (data) => {
    if (socket.data.isHost && socket.data.roomCode) {
      socket.to(socket.data.roomCode).emit('bellRung', data);
    }
  });

  socket.on('hostCaught', (data) => {
    const r = socket.data.roomCode;
    if (socket.data.isHost && r) {
      const room = rooms.get(r);
      const fan = room.fans.get(data.fanId);
      if (fan) {
        fan.score = (fan.score || 0) + 1;
        io.to(r).emit('catchSuccess', { 
          fanId: data.fanId, 
          fanName: fan.name,
          total: fan.score
        });
      }
    }
  });

  // --- Fan Events ---
  socket.on('joinRoom', (data, callback) => {
    const code = (data.code || '').toUpperCase();
    if (!rooms.has(code)) {
      if (callback) callback({ ok: false, err: '방을 찾을 수 없습니다' });
      return;
    }
    const room = rooms.get(code);
    if (room.state !== 'waiting') {
      if (callback) callback({ ok: false, err: '이미 게임이 시작되었습니다' });
      return;
    }

    // Default random neighbor
    const nb = NEIGHBOR_TYPES[Math.floor(Math.random() * NEIGHBOR_TYPES.length)];
    
    room.fans.set(socket.id, {
      id: socket.id,
      name: data.name || '팬',
      neighborType: nb,
      ready: false,
      score: 0
    });

    socket.data.isHost = false;
    socket.data.roomCode = code;
    socket.join(code);

    if (callback) callback({ 
      ok: true, 
      hostName: room.hostName,
      neighborType: nb,
      hostReward: room.hostReward
    });

    // Notify host
    io.to(room.host).emit('fanJoined', { 
      count: room.fans.size,
      snapshot: getRoomSnapshot(room)
    });
    
    // Broadcast fan list to other fans too
    socket.to(code).emit('fanReadyUpdate', getRoomSnapshot(room));
  });

  socket.on('fanReady', (data, callback) => {
    const r = socket.data.roomCode;
    if (!r) return;
    const room = rooms.get(r);
    if (!room) return;
    
    const fan = room.fans.get(socket.id);
    if (fan) {
      fan.ready = data.ready;
      if (data.neighborType) {
        fan.neighborType = data.neighborType;
      }
      io.to(r).emit('fanReadyUpdate', getRoomSnapshot(room));
      if (callback) callback({ ok: true });
    }
  });

  socket.on('fanAction', (action) => {
    const r = socket.data.roomCode;
    if (!r) return;
    const room = rooms.get(r);
    if (!room || room.state !== 'playing') return;

    const fan = room.fans.get(socket.id);
    if (!fan) return;

    // Send action to host
    io.to(room.host).emit('gameEvent', {
      type: action.type,
      fanId: socket.id,
      fanName: fan.name,
      neighborType: fan.neighborType,
      ...action.payload
    });
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    const r = socket.data.roomCode;
    if (r && rooms.has(r)) {
      const room = rooms.get(r);
      if (socket.data.isHost) {
        io.to(r).emit('hostLeft');
        rooms.delete(r);
      } else {
        room.fans.delete(socket.id);
        io.to(room.host).emit('fanLeft', { 
          count: room.fans.size,
          snapshot: getRoomSnapshot(room)
        });
        io.to(r).emit('fanReadyUpdate', getRoomSnapshot(room));
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

function getRoomSnapshot(room) {
  return {
    fans: Array.from(room.fans.values()).map(f => ({
      id: f.id,
      name: f.name,
      ready: f.ready,
      neighborType: f.neighborType,
      score: f.score
    }))
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIpAddress();
  console.log('----------------------------------------------------');
  console.log(`🚀 Bell-Tui Arcade Server Running!`);
  console.log(`💻 Host on PC: http://localhost:${PORT}`);
  console.log(`📱 Play on Mobile: http://${ip}:${PORT}`);
  console.log('----------------------------------------------------');
});