// GameRoom.js — Asymmetric multiplayer: 1 Streamer (Choroki) + N Fans (Neighbors)
function cleanName(value, fallback) {
  const cleaned = String(value || fallback)
    .replace(/[<>&"'`]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .substring(0, 12);
  return cleaned || fallback;
}

class GameRoom {
  constructor(code, hostId, hostName) {
    this.code = code;
    this.hostId = hostId;
    this.hostName = cleanName(hostName, '쵸로키');
    this.state = 'lobby'; // lobby | countdown | play | result
    this.seed = Math.floor(Math.random() * 999999);
    this.tick = 0;
    this.maxFans = 30;
    this.countdownTimer = 0;
    this.gameTimer = 0;
    this.gameDuration = 90 * 60; // 90 seconds at ~20Hz server tick
    this.created = Date.now();

    // Fan players (neighbors)
    this.fans = new Map();

    // Door/floor state synced from host
    this.floors = [];
    this.hostState = {
      x: 100, y: 0, fl: 0, face: 1, vx: 0, af: 0,
      score: 0, combo: 0, lives: 3, ring: 0, dash: false,
      notoriety: 0, goodCount: 0, state: 'play',
    };

    // Neighbor assignments: doorIdx → fanId
    this.neighborSlots = new Map();

    // Events queue for broadcast
    this.events = [];
  }

  addFan(id, name) {
    if (this.fans.size >= this.maxFans) return { ok: false, err: '방이 가득 찼습니다' };
    if (id === this.hostId) return { ok: false, err: '호스트는 팬으로 참가할 수 없습니다' };

    const NEIGHBOR_TYPES = [
      { name: '할머니', emoji: '👵', trait: 'slow', speed: 1.2 },
      { name: '근육맨', emoji: '💪', trait: 'fast', speed: 3.5 },
      { name: '강아지집', emoji: '🐕', trait: 'far', speed: 2.8 },
      { name: '유령', emoji: '👻', trait: 'ghost', speed: 2.0 },
      { name: '아줌마', emoji: '👩', trait: 'alarm', speed: 2.2 },
      { name: '경비원', emoji: '👮', trait: 'alert', speed: 3.0 },
      { name: '고양이집', emoji: '🐱', trait: 'stun', speed: 1.0 },
      { name: '잠옷아저씨', emoji: '😴', trait: 'throw', speed: 1.5 },
    ];

    const nbType = NEIGHBOR_TYPES[this.fans.size % NEIGHBOR_TYPES.length];
    const fan = {
      id,
      name: cleanName(name, '팬'),
      neighborType: nbType,
      assignedDoor: null, // { floor, doorIdx } — assigned when game starts
      ready: false,
      // In-game state
      doorState: 'closed', // closed | watching | open | chasing
      chaseDir: 0, // -1 left, 0 none, 1 right
      chaseX: 0,
      trapReady: true,
      trapCooldown: 0,
      catchCount: 0,
      reaction: null, // emoji reaction
      connected: true,
    };

    this.fans.set(id, fan);
    return { ok: true, fan };
  }

  removeFan(id) {
    this.fans.delete(id);
    for (const [slot, fanId] of this.neighborSlots) {
      if (fanId === id) this.neighborSlots.delete(slot);
    }
  }

  setFanReady(id, ready) {
    const f = this.fans.get(id);
    if (f) f.ready = ready;
  }

  canStart() {
    if (this.fans.size < 1) return false;
    for (const f of this.fans.values()) {
      if (!f.ready) return false;
    }
    return true;
  }

  startCountdown() {
    this.state = 'countdown';
    this.countdownTimer = 60; // 3 seconds at 20Hz

    // Assign fans to door slots
    this.assignDoors();
  }

  assignDoors() {
    this.neighborSlots.clear();
    // Create door assignments across 6 floors
    // Each floor has 5 + floorIdx doors
    const assignments = [];
    for (let fl = 0; fl < 6; fl++) {
      const nd = 5 + fl;
      for (let d = 0; d < nd; d++) {
        assignments.push({ floor: fl, doorIdx: d });
      }
    }
    // Shuffle assignments
    for (let i = assignments.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [assignments[i], assignments[j]] = [assignments[j], assignments[i]];
    }

    let idx = 0;
    for (const fan of this.fans.values()) {
      if (idx < assignments.length) {
        fan.assignedDoor = assignments[idx];
        this.neighborSlots.set(`${assignments[idx].floor}_${assignments[idx].doorIdx}`, fan.id);
        idx++;
      }
    }
  }

  startGame() {
    this.state = 'play';
    this.gameTimer = this.gameDuration;
    this.tick = 0;

    // Reset fan states
    for (const fan of this.fans.values()) {
      fan.doorState = 'closed';
      fan.chaseDir = 0;
      fan.chaseX = 0;
      fan.trapReady = true;
      fan.trapCooldown = 0;
      fan.catchCount = 0;
    }
  }

  // Called by host to sync Choroki state
  updateHostState(state) {
    if (!state || typeof state !== 'object') return;

    const numericFields = new Set([
      'x', 'y', 'fl', 'face', 'vx', 'af',
      'score', 'combo', 'lives', 'ring', 'notoriety', 'goodCount',
    ]);

    for (const [key, value] of Object.entries(state)) {
      if (!(key in this.hostState)) continue;

      if (numericFields.has(key)) {
        if (!Number.isFinite(value)) continue;
        if (key === 'lives') this.hostState[key] = Math.max(0, Math.min(5, Math.floor(value)));
        else if (key === 'fl') this.hostState[key] = Math.max(0, Math.min(5, Math.floor(value)));
        else this.hostState[key] = value;
      } else if (key === 'dash') {
        this.hostState[key] = Boolean(value);
      } else if (key === 'state' && typeof value === 'string') {
        this.hostState[key] = value.substring(0, 20);
      }
    }
  }

  // Fan actions
  fanAction(fanId, action) {
    const fan = this.fans.get(fanId);
    if (!fan || !fan.assignedDoor || !action || typeof action !== 'object') return null;

    switch (action.type) {
      case 'openDoor':
        // Fan decides to open their door (when bell was rung)
        if (fan.doorState === 'watching') {
          fan.doorState = 'open';
          return {
            type: 'fanOpenDoor',
            fanId,
            fanName: fan.name,
            floor: fan.assignedDoor.floor,
            doorIdx: fan.assignedDoor.doorIdx,
            neighborType: fan.neighborType,
          };
        }
        break;

      case 'chase':
        // Fan chooses chase direction
        if (fan.doorState === 'open' || fan.doorState === 'chasing') {
          fan.doorState = 'chasing';
          fan.chaseDir = action.dir < 0 ? -1 : action.dir > 0 ? 1 : 0;
          return {
            type: 'fanChase',
            fanId,
            floor: fan.assignedDoor.floor,
            doorIdx: fan.assignedDoor.doorIdx,
            dir: fan.chaseDir,
            speed: fan.neighborType.speed,
          };
        }
        break;

      case 'trap':
        // Fan places a trap (cooldown-based)
        if (fan.trapReady && (fan.doorState === 'open' || fan.doorState === 'chasing')) {
          fan.trapReady = false;
          fan.trapCooldown = 400; // 20 seconds at 20Hz
          return {
            type: 'fanTrap',
            fanId,
            fanName: fan.name,
            floor: fan.assignedDoor.floor,
            doorIdx: fan.assignedDoor.doorIdx,
            neighborTrait: fan.neighborType.trait,
          };
        }
        break;

      case 'reaction':
        // Fan sends emoji reaction
        fan.reaction = String(action.emoji || '').substring(0, 8);
        return {
          type: 'fanReaction',
          fanId,
          fanName: fan.name,
          emoji: fan.reaction,
        };

      case 'retreatDoor':
        // Fan goes back inside
        fan.doorState = 'closed';
        fan.chaseDir = 0;
        return {
          type: 'fanRetreat',
          fanId,
          floor: fan.assignedDoor.floor,
          doorIdx: fan.assignedDoor.doorIdx,
        };
    }
    return null;
  }

  // Host notifies that bell was rung at a specific door
  bellRung(floor, doorIdx) {
    if (!Number.isInteger(floor) || !Number.isInteger(doorIdx)) return null;
    const key = `${floor}_${doorIdx}`;
    const fanId = this.neighborSlots.get(key);
    if (fanId) {
      const fan = this.fans.get(fanId);
      if (fan && fan.doorState === 'closed') {
        fan.doorState = 'watching';
        return {
          type: 'bellAtDoor',
          fanId,
          floor,
          doorIdx,
        };
      }
    }
    return null;
  }

  // Host notifies a catch happened
  hostCaught(fanId) {
    const fan = this.fans.get(fanId);
    if (fan) {
      fan.catchCount++;
      fan.doorState = 'closed';
      fan.chaseDir = 0;
      return { type: 'catchSuccess', fanId, fanName: fan.name, total: fan.catchCount };
    }
    return null;
  }

  update() {
    if (this.state === 'countdown') {
      if (this.fans.size === 0) {
        this.state = 'lobby';
        this.countdownTimer = 0;
        this.neighborSlots.clear();
        return;
      }
      this.countdownTimer--;
      if (this.countdownTimer <= 0) this.startGame();
      return;
    }
    if (this.state !== 'play') return;

    this.tick++;
    this.gameTimer--;

    if (this.fans.size === 0) {
      this.state = 'result';
      return;
    }

    // Update trap cooldowns
    for (const fan of this.fans.values()) {
      if (!fan.trapReady) {
        fan.trapCooldown--;
        if (fan.trapCooldown <= 0) fan.trapReady = true;
      }
    }

    if (this.gameTimer <= 0 || this.hostState.lives <= 0) {
      this.state = 'result';
    }
  }

  getSnapshot() {
    const fans = [];
    for (const f of this.fans.values()) {
      fans.push({
        id: f.id,
        name: f.name,
        neighborType: f.neighborType,
        assignedDoor: f.assignedDoor,
        ready: f.ready,
        doorState: f.doorState,
        chaseDir: f.chaseDir,
        chaseX: f.chaseX,
        trapReady: f.trapReady,
        trapCooldown: Math.ceil(f.trapCooldown / 20),
        catchCount: f.catchCount,
        reaction: f.reaction,
        connected: f.connected,
      });
    }

    return {
      code: this.code,
      state: this.state,
      seed: this.seed,
      tick: this.tick,
      timeLeft: Math.ceil(this.gameTimer / 20),
      countdown: Math.ceil(this.countdownTimer / 20),
      hostId: this.hostId,
      hostName: this.hostName,
      hostState: this.hostState,
      fans,
      fanCount: this.fans.size,
    };
  }

  getResults() {
    const fans = [];
    for (const f of this.fans.values()) {
      fans.push({
        name: f.name,
        neighborType: f.neighborType,
        catchCount: f.catchCount,
      });
    }
    fans.sort((a, b) => b.catchCount - a.catchCount);

    return {
      hostName: this.hostName,
      hostScore: this.hostState.score,
      hostCombo: this.hostState.combo,
      hostLives: this.hostState.lives,
      fans,
      mvp: fans.length > 0 ? fans[0] : null,
    };
  }

  isEmpty() {
    return this.fans.size === 0 && !this.hostId;
  }
}

module.exports = GameRoom;
