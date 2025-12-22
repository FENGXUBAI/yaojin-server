import { Server, Socket } from 'socket.io';
console.log('Starting server script...');
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import { GameState, initGame, playTurn, resolveReturnTribute, hasValidMove, Action, forceWin } from './engine/game';
import { decideBotAction, getHintOptions } from './engine/ai';
import crypto from 'crypto';
import { Card } from './engine/cards';
import { detectPattern } from './engine/patterns';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const app = express();
const httpServer = createServer(app);

const SERVER_VERSION = process.env.YAOJIN_VERSION || `dev-${new Date().toISOString()}`;
const DEBUG_ENABLED = process.env.YAOJIN_DEBUG === '1';

// 解析 JSON 请求体
app.use(express.json());

// CORS 支持
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/version', (_req, res) => {
  res.status(200).json({ version: SERVER_VERSION });
});

// ============== 用户认证 API ==============

// 简易用户存储（内存，重启会丢失）
const users = new Map<string, { id: string; nickname: string; avatarUrl: string; coins: number; level: number }>();

// 生成简单 token
function generateToken(userId: string): string {
  return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
}

// 游客登录
app.post('/api/auth/guest', (req, res) => {
  try {
    const { nickname } = req.body || {};
    const finalNickname = nickname || `玩家${Math.floor(Math.random() * 10000)}`;
    
    const userId = `guest_${crypto.randomBytes(8).toString('hex')}`;
    const user = {
      id: userId,
      nickname: finalNickname,
      avatarUrl: '',
      coins: 10000,
      level: 1
    };
    
    users.set(userId, user);
    const token = generateToken(userId);
    
    console.log(`[登录] 游客登录成功: ${finalNickname} (${userId})`);
    
    res.json({
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        coins: user.coins,
        level: user.level
      }
    });
  } catch (error: any) {
    console.error('[登录] 游客登录失败:', error);
    res.status(500).json({ error: error.message || '登录失败' });
  }
});

// 微信登录（简化版，实际需要调用微信API）
app.post('/api/auth/wechat', (req, res) => {
  try {
    const { code, nickname, avatarUrl } = req.body || {};
    
    // 简化处理：用 code 生成用户ID
    const userId = `wx_${crypto.createHash('md5').update(code || Date.now().toString()).digest('hex').slice(0, 16)}`;
    
    let user = users.get(userId);
    if (!user) {
      user = {
        id: userId,
        nickname: nickname || `微信用户${Math.floor(Math.random() * 1000)}`,
        avatarUrl: avatarUrl || '',
        coins: 10000,
        level: 1
      };
      users.set(userId, user);
    }
    
    const token = generateToken(userId);
    
    console.log(`[登录] 微信登录成功: ${user.nickname} (${userId})`);
    
    res.json({
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        coins: user.coins,
        level: user.level
      }
    });
  } catch (error: any) {
    console.error('[登录] 微信登录失败:', error);
    res.status(500).json({ error: error.message || '登录失败' });
  }
});

// 获取用户信息
app.get('/api/user/profile', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权' });
    }
    
    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const userId = decoded.split(':')[0];
    
    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============== 房间 HTTP API ==============

// 生成房间ID
function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// HTTP 房间存储（与 Socket.IO 房间分开）
const httpRooms = new Map<string, {
  id: string;
  ownerId: string;
  ownerName: string;
  playerCount: number;
  players: { id: string; name: string; ready: boolean }[];
  createdAt: number;
}>();

// 创建房间
app.post('/api/room/create', (req, res) => {
  try {
    const { playerCount = 3, playerName = '玩家' } = req.body || {};
    
    // 生成唯一房间ID
    let roomId = generateRoomId();
    while (httpRooms.has(roomId)) {
      roomId = generateRoomId();
    }
    
    // 生成玩家ID
    const playerId = `player_${crypto.randomBytes(8).toString('hex')}`;
    
    const room = {
      id: roomId,
      ownerId: playerId,
      ownerName: playerName,
      playerCount,
      players: [{ id: playerId, name: playerName, ready: true }],
      createdAt: Date.now()
    };
    
    httpRooms.set(roomId, room);
    
    console.log(`[房间] 创建房间: ${roomId} by ${playerName}`);
    
    res.json({
      roomId,
      playerId,
      room: {
        id: roomId,
        players: room.players,
        playerCount,
        isOwner: true
      }
    });
  } catch (error: any) {
    console.error('[房间] 创建失败:', error);
    res.status(500).json({ error: error.message || '创建房间失败' });
  }
});

// 加入房间
app.post('/api/room/join', (req, res) => {
  try {
    const { roomId, playerName = '玩家' } = req.body || {};
    
    if (!roomId) {
      return res.status(400).json({ error: '请提供房间号' });
    }
    
    const room = httpRooms.get(roomId.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }
    
    if (room.players.length >= room.playerCount) {
      return res.status(400).json({ error: '房间已满' });
    }
    
    const playerId = `player_${crypto.randomBytes(8).toString('hex')}`;
    room.players.push({ id: playerId, name: playerName, ready: false });
    
    console.log(`[房间] ${playerName} 加入房间: ${roomId}`);
    
    res.json({
      roomId: room.id,
      playerId,
      room: {
        id: room.id,
        players: room.players,
        playerCount: room.playerCount,
        isOwner: false
      }
    });
  } catch (error: any) {
    console.error('[房间] 加入失败:', error);
    res.status(500).json({ error: error.message || '加入房间失败' });
  }
});

// 快速匹配（简化版：直接创建带机器人的房间）
app.post('/api/match/quick', (req, res) => {
  try {
    const { playerCount = 3, playerName = '玩家' } = req.body || {};
    
    // 生成房间
    let roomId = generateRoomId();
    while (httpRooms.has(roomId)) {
      roomId = generateRoomId();
    }
    
    const playerId = `player_${crypto.randomBytes(8).toString('hex')}`;
    
    // 创建带机器人的房间
    const players: { id: string; name: string; ready: boolean }[] = [
      { id: playerId, name: playerName, ready: true }
    ];
    
    // 添加机器人
    const botNames = ['小明', '小红', '小刚', '小美', '阿强'];
    for (let i = 1; i < playerCount; i++) {
      players.push({
        id: `bot_${i}`,
        name: botNames[Math.floor(Math.random() * botNames.length)] + (i > 1 ? i : ''),
        ready: true
      });
    }
    
    const room = {
      id: roomId,
      ownerId: playerId,
      ownerName: playerName,
      playerCount,
      players,
      createdAt: Date.now()
    };
    
    httpRooms.set(roomId, room);
    
    console.log(`[匹配] 快速匹配成功: ${roomId} for ${playerName}`);
    
    res.json({
      roomId,
      playerId,
      matched: true,
      room: {
        id: roomId,
        players: room.players,
        playerCount
      }
    });
  } catch (error: any) {
    console.error('[匹配] 匹配失败:', error);
    res.status(500).json({ error: error.message || '匹配失败' });
  }
});

// 获取房间信息
app.get('/api/room/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const room = httpRooms.get(roomId.toUpperCase());
    
    if (!room) {
      return res.status(404).json({ error: '房间不存在' });
    }
    
    res.json({
      room: {
        id: room.id,
        players: room.players,
        playerCount: room.playerCount,
        ownerId: room.ownerId
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============== 静态文件服务 ==============

// Serve static files from the React Native Web build
// Disable caching to avoid clients getting stale JS bundles after redeploy.
const distPath = path.join(__dirname, 'dist');
app.use(
  express.static(distPath, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store');
    },
  })
);

// Fallback to index.html for SPA routing (if any)
// Only send file if it exists, otherwise return 404
const fs = require('fs');
const indexPath = path.join(distPath, 'index.html');
app.use((req, res) => {
  // Skip API routes that weren't matched
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.setHeader('Cache-Control', 'no-store');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

interface Room {
  id: string;
  players: { id: string; name: string; ready: boolean; score: number; mvpSound?: string; connected: boolean; lastSeen: number; clientKey: string; isBot?: boolean; isTrusteeship?: boolean }[];
  owner: string;
  gameState: GameState | null;
  lastRoundResult?: { finishedOrder: number[]; revolution: boolean };
  turnTimer?: NodeJS.Timeout;
  eventSeq: number;
  recentSfxEvents: Array<{ seq: number; evt: any }>;
  mvpSeq: number;
  recentMvpEvents: Array<{ seq: number; evt: any }>;
  matchHistory: Array<{ timestamp: number; scores: { name: string; score: number }[]; winner: string }>;
}

const rooms = new Map<string, Room>();
const socketRoom = new Map<string, string>();
const socketClientKey = new Map<string, string>();
const lastEventAt = new Map<string, number>();

function newClientKey() {
  return crypto.randomBytes(16).toString('hex');
}

function publicizeGameState(state: GameState) {
  const { hands, ...rest } = state;
  return {
    ...rest,
    handCounts: hands.map(h => h.length),
  };
}

function isRateLimited(socketId: string, minIntervalMs: number) {
  const now = Date.now();
  const prev = lastEventAt.get(socketId) ?? 0;
  if (now - prev < minIntervalMs) return true;
  lastEventAt.set(socketId, now);
  return false;
}

function emitSfx(r: Room, evt: any) {
  r.eventSeq += 1;
  const payload = { ...evt, seq: r.eventSeq };
  r.recentSfxEvents.push({ seq: r.eventSeq, evt: payload });
  // Ring buffer cap
  const maxKeep = 60;
  if (r.recentSfxEvents.length > maxKeep) {
    r.recentSfxEvents.splice(0, r.recentSfxEvents.length - maxKeep);
  }
  io.to(r.id).emit('sfxEvent', payload);
}

function emitMvp(r: Room, evt: { sound: string; name: string; durationMs: number }) {
  r.mvpSeq += 1;
  const startedAt = Date.now();
  const gameId = r.gameState?.gameId ?? '';
  const payload = { ...evt, startedAt, seq: r.mvpSeq, gameId };
  r.recentMvpEvents.push({ seq: r.mvpSeq, evt: payload });
  const maxKeep = 20;
  if (r.recentMvpEvents.length > maxKeep) {
    r.recentMvpEvents.splice(0, r.recentMvpEvents.length - maxKeep);
  }
  io.to(r.id).emit('mvpEvent', payload);
}

function executeBotTurn(room: Room) {
  if (!room.gameState || room.gameState.status !== 'playing') return;
  
  const state = room.gameState;
  const currentPlayerIdx = state.currentPlayer;
  const player = room.players[currentPlayerIdx];
  
  if (!player) return;
  if (!player.isBot && !player.isTrusteeship) return;

  try {
    const action = decideBotAction(state, currentPlayerIdx);
    
    // Simulate "thinking" delay is handled by the caller (setTimeout)
    
    const nextState = playTurn(state, action);
    room.gameState = nextState;
    
    io.to(room.id).emit('gameState', publicizeGameState(nextState));
    
    if (action.type === 'play') {
      const p = detectPattern(action.cards);
      if (p) {
        emitSfx(room, { kind: 'play', by: currentPlayerIdx, pattern: p });
        
        // Bot Chat: React to big plays
        if (p.type === 'FOUR' || (p.type === 'PAIR' && p.extra?.isKingBomb)) {
            setTimeout(() => {
                const bots = room.players.filter(pl => pl.isBot);
                if (bots.length > 0) {
                    const randomBot = bots[Math.floor(Math.random() * bots.length)];
                    const msgs = ['666', '厉害了', '这牌也能抓到？', '要不起要不起', '大佬求放过'];
                    const msg = msgs[Math.floor(Math.random() * msgs.length)];
                    io.to(room.id).emit('chatMessage', {
                        sender: randomBot.name,
                        message: msg,
                        timestamp: Date.now()
                    });
                }
            }, 1000);
        }
      }
    } else if (action.type === 'pass') {
      emitSfx(room, { kind: 'pass', by: currentPlayerIdx });
    }

    // Check game over
    if (nextState.finishedOrder.length >= nextState.playerCount) {
       // Calculate Scores (Bot Logic Duplication - Refactor ideally, but for now copy logic)
       const baseScore = 1000;
       const multiplier = nextState.multiplier;
       const totalStake = baseScore * multiplier;
       const finished = nextState.finishedOrder;
       
       if (room.players.length === 3) {
           const winnerIdx = finished[0];
           const loserIdx = finished[2];
           room.players[winnerIdx].score += totalStake;
           room.players[loserIdx].score -= totalStake;
       } else if (room.players.length === 4) {
           const p1 = finished[0];
           const p2 = finished[1];
           const p3 = finished[2];
           const p4 = finished[3];
           room.players[p1].score += totalStake;
           room.players[p4].score -= totalStake;
           room.players[p2].score += totalStake / 2;
           room.players[p3].score -= totalStake / 2;
       }

       room.matchHistory.push({
           timestamp: Date.now(),
           scores: room.players.map(p => ({ name: p.name, score: p.score })),
           winner: room.players[finished[0]].name
       });
       if (room.matchHistory.length > 10) room.matchHistory.shift();

       room.lastRoundResult = {
           finishedOrder: nextState.finishedOrder,
           revolution: nextState.revolution
       };
       io.to(room.id).emit('gameOver', { finishedOrder: nextState.finishedOrder, scores: room.players.map(p => ({ id: p.id, score: p.score })), multiplier });
       
       // MVP Check
       const winnerIdx = nextState.finishedOrder[0];
       const winner = room.players[winnerIdx];
       if (winner && winner.mvpSound) {
           emitMvp(room, { sound: winner.mvpSound, name: winner.name, durationMs: 15000 });
       }
       
       emitRoomState(room);

    } else {
       // Start timer for next player
       startTurnTimer(room);
    }

  } catch (e) {
    console.error(`Bot execution error for room ${room.id}:`, e);
    // Fallback: pass
    try {
        const nextState = playTurn(state, { type: 'pass' });
        room.gameState = nextState;
        io.to(room.id).emit('gameState', publicizeGameState(nextState));
        startTurnTimer(room);
    } catch (e2) {
        console.error('Bot fallback failed:', e2);
    }
  }
}

function startTurnTimer(room: Room) {
  if (room.turnTimer) clearTimeout(room.turnTimer);
  if (!room.gameState || room.gameState.status !== 'playing') return;

  const state = room.gameState;
  const currentPlayerIdx = state.currentPlayer;
  const player = room.players[currentPlayerIdx];
  
  // Bot or Trusteeship handling
  if (player && (player.isBot || player.isTrusteeship)) {
      const delay = player.isBot ? (1500 + Math.random() * 1000) : 1000;
      room.turnTimer = setTimeout(() => {
          executeBotTurn(room);
      }, delay);
      return;
  }

  const hand = state.hands[currentPlayerIdx];
  
  //  isBot: p.isBot,
  // Determine if it's a free turn or forced play
  let compareAgainst = state.lastPlay;
  if (compareAgainst && compareAgainst.by === currentPlayerIdx) {
      compareAgainst = null;
  }
  // Also check the "Qi" / "Pass" logic for free turn
  // If owner finished and everyone passed, it's free turn.
  // We need to replicate the logic from playTurn or expose it.
  // For simplicity, let's assume if compareAgainst.by is current player, it's free.
  // If compareAgainst is NOT null, we check hasValidMove.
  
  // Re-implement the "free turn" check from game.ts to be sure
  if (compareAgainst) {
      const activePlayers = state.playerCount - state.finishedOrder.length;
      const ownerFinished = state.finishedOrder.includes(compareAgainst.by);
      const everyonePassed = state.passesInRow >= activePlayers - 1;
      if (ownerFinished && everyonePassed) {
          compareAgainst = null;
      }
  }

  const canPlay = hasValidMove(hand, compareAgainst);
  const duration = canPlay ? 25000 : 3000;

  // Emit timer info to clients (optional, but good for UI)
  io.to(room.id).emit('turnTimer', { duration, startTime: Date.now() });

  room.turnTimer = setTimeout(() => {
      // Timeout -> Enable Trusteeship
      console.log(`Timeout for room ${room.id}, player ${currentPlayerIdx} -> Enabling Trusteeship`);
      if (player) {
          player.isTrusteeship = true;
          emitRoomState(room);
      }
      
      // Execute turn immediately
      executeBotTurn(room);
  }, duration);
}

function emitRoomState(r: Room) {
  const publicGameState = r.gameState ? publicizeGameState(r.gameState) : null;

  const publicPlayers = r.players.map(p => ({
    id: p.id,
    name: p.name,
    ready: p.ready,
    score: p.score,
    connected: p.connected,
    isBot: p.isBot,
    isTrusteeship: p.isTrusteeship,
  }));

  io.to(r.id).emit('roomState', {
    players: publicPlayers,
    gameState: publicGameState,
    owner: r.owner,
    debugEnabled: DEBUG_ENABLED,
    matchHistory: r.matchHistory,
  });

  // Back-compat: keep emitting roomUpdate but with sanitized gameState
  io.to(r.id).emit('roomUpdate', {
    players: publicPlayers,
    gameState: publicGameState,
    owner: r.owner,
  });
}

function emitPrivateState(r: Room) {
  if (!r.gameState) return;
  const publicGameState = publicizeGameState(r.gameState);
  for (let idx = 0; idx < r.players.length; idx++) {
    const p = r.players[idx];
    if (!p.connected) continue;
    const target = io.sockets.sockets.get(p.id);
    if (!target) continue;
    const hand: Card[] = r.gameState.hands[idx];
    target.emit('privateState', { myIndex: idx, hand, gameState: publicGameState });
  }
}

io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  socket.on('listRooms', () => {
    if (isRateLimited(socket.id, 1000)) return;
    const roomList = Array.from(rooms.values())
      .filter(r => r.players.length > 0) // Only show active rooms
      .map(r => ({
        id: r.id,
        playerCount: r.players.length,
        status: r.gameState ? 'playing' : 'waiting',
        ownerName: r.players.find(p => p.id === r.owner)?.name || 'Unknown'
      }));
    socket.emit('roomList', roomList);
  });

  socket.on('chatMessage', ({ room, message }: { room: string; message: string }) => {
    if (isRateLimited(socket.id, 500)) return;
    const r = rooms.get(room);
    if (!r) return;
    
    const player = r.players.find(p => p.id === socket.id);
    if (!player) return;

    // Broadcast to room
    io.to(room).emit('chatMessage', {
      sender: player.name,
      message: message.substring(0, 100), // Limit length
      timestamp: Date.now()
    });
  });

  socket.on('join', ({ room, name, clientKey, lastSfxSeq, lastMvpSeq }: { room: string; name: string; clientKey?: string; lastSfxSeq?: number; lastMvpSeq?: number }) => {
    if (isRateLimited(socket.id, 200)) return;
    socket.join(room);
    let r = rooms.get(room);
    if (!r) {
      r = { id: room, players: [], gameState: null, owner: socket.id, eventSeq: 0, recentSfxEvents: [], mvpSeq: 0, recentMvpEvents: [], matchHistory: [] };
      rooms.set(room, r);
    }

    const now = Date.now();

    // Resolve or assign persistent identity
    const resolvedClientKey = (clientKey && String(clientKey).trim()) ? String(clientKey).trim() : newClientKey();
    
    // Prefer matching by persistent clientKey.
    const existingByKey = r.players.find(p => p.clientKey === resolvedClientKey);
    const existingByName = r.players.find(p => p.name === name);

    // Enforce unique names unless it's the same identity.
    if (!existingByKey && existingByName && (existingByName as any).clientKey && (existingByName as any).clientKey !== resolvedClientKey) {
      socket.emit('error', '该昵称已被占用，请更换昵称或使用原设备重连');
      return;
    }

    // Legacy client (no clientKey) trying to join with an already-claimed name.
    if (!existingByKey && existingByName && (existingByName as any).clientKey && !clientKey) {
      socket.emit('error', '该昵称已被占用（需要原设备身份信息），请更换昵称');
      return;
    }

    const existing = existingByKey || existingByName;
    if (!existing) {
      if (r.players.length >= 4) {
        socket.emit('error', 'Room full');
        return;
      }
      r.players.push({
        id: socket.id,
        name,
        ready: false,
        score: 10000,
        mvpSound: undefined,
        connected: true,
        lastSeen: now,
        clientKey: resolvedClientKey,
      });
    } else {
      // update socket id
      const oldId = existing.id;
      existing.id = socket.id;
      existing.connected = true;
      existing.lastSeen = now;
      existing.clientKey = existing.clientKey || resolvedClientKey;
      socketRoom.delete(oldId);
      socketClientKey.delete(oldId);
      
      // If this player was the owner, update the owner ID to the new socket ID
      if (r.owner === oldId) {
        r.owner = socket.id;
        console.log(`Owner ${name} reconnected. Updated owner ID to ${socket.id}`);
      }
    }

    socketRoom.set(socket.id, room);
    socketClientKey.set(socket.id, resolvedClientKey);

    socket.emit('joinAck', { room, name, clientKey: resolvedClientKey, debugEnabled: DEBUG_ENABLED });

    console.log(`Room ${room} update: ${r.players.length} players. Owner: ${r.owner}`);
    emitRoomState(r);
    emitPrivateState(r);

    // Replay recent SFX events to help clients recover after refresh/reconnect
    try {
      const last = typeof lastSfxSeq === 'number' ? lastSfxSeq : 0;
      const toReplay = r.recentSfxEvents
        .filter(e => e.seq > last)
        .slice(-25)
        .map(e => e.evt);
      for (const evt of toReplay) {
        socket.emit('sfxEvent', evt);
      }
    } catch {}

    // Replay active MVP (if any) so refresh/reconnect resumes the room's current MVP music
    try {
      const last = typeof lastMvpSeq === 'number' ? lastMvpSeq : 0;
      const now = Date.now();
      const candidates = r.recentMvpEvents.filter(e => e.seq > last).map(e => e.evt);
      // Prefer the latest active one
      const latest = candidates.length ? candidates[candidates.length - 1] : (r.recentMvpEvents.length ? r.recentMvpEvents[r.recentMvpEvents.length - 1].evt : null);
      if (latest && typeof latest.startedAt === 'number' && typeof latest.durationMs === 'number') {
        const elapsed = now - latest.startedAt;
        if (elapsed >= 0 && elapsed < latest.durationMs) {
          socket.emit('mvpEvent', latest);
        }
      }
    } catch {}
  });

  socket.on('start', ({ room }: { room: string }) => {
    if (isRateLimited(socket.id, 300)) return;
    const r = rooms.get(room);
    if (!r) return;
    
    if (r.owner !== socket.id) {
      socket.emit('error', '只有房主可以开始游戏');
      return;
    }

    if (r.players.length < 2) {
       socket.emit('error', '需要至少2人才能开始');
       return;
    }
    
    try {
      const state = initGame({ 
        playerCount: r.players.length,
        lastRoundResult: r.lastRoundResult
      });
      r.gameState = state;
      io.to(room).emit('gameStart', publicizeGameState(state));
      emitRoomState(r);
      emitPrivateState(r);
      startTurnTimer(r);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('setMvpSound', ({ room, sound }: { room: string; sound: string }) => {
    if (isRateLimited(socket.id, 100)) return;
    const r = rooms.get(room);
    if (!r) return;
    const p = r.players.find(p => p.id === socket.id);
    if (p) {
      p.mvpSound = sound;
      // Optionally broadcast to update UI if needed, but maybe not necessary
    }
  });

  socket.on('getHints', ({ room, hintKey }: { room: string; hintKey?: string }) => {
    if (isRateLimited(socket.id, 120)) return;
    const r = rooms.get(room);
    if (!r || !r.gameState) return;

    const pIdx = r.players.findIndex(p => p.id === socket.id);
    if (pIdx === -1) return;

    const state = r.gameState;

    // Tribute return stage: suggest lowest cards to return.
    if (state.status === 'tribute_return') {
      const pending = state.pendingReturns?.find(pr => pr.actionBy === pIdx);
      if (!pending) {
        socket.emit('hints', { hintKey, options: [] });
        return;
      }
      const hand = state.hands[pIdx] ?? [];
      const sorted = [...hand].sort((a, b) => {
        if (a.isJoker !== b.isJoker) return a.isJoker ? 1 : -1;
        return a.sortValue - b.sortValue;
      });
      const pick = sorted.slice(0, pending.count);
      socket.emit('hints', { hintKey, options: pick.length === pending.count ? [pick] : [] });
      return;
    }

    // Normal play stage: only provide hints for current player.
    if (state.currentPlayer !== pIdx) {
      socket.emit('hints', { hintKey, options: [] });
      return;
    }

    let compareAgainst = state.lastPlay;
    if (compareAgainst) {
      const isOwner = compareAgainst.by === pIdx;
      const activePlayers = state.playerCount - state.finishedOrder.length;
      const ownerFinished = state.finishedOrder.includes(compareAgainst.by);
      const everyonePassed = state.passesInRow >= activePlayers - 1;
      if (isOwner || (ownerFinished && everyonePassed)) {
        compareAgainst = null;
      }
    }

    const hand = state.hands[pIdx] ?? [];
    const options = getHintOptions(hand, compareAgainst);
    socket.emit('hints', { hintKey, options });
  });

  socket.on('action', ({ room, action }: { room: string; action: Action }) => {
    if (isRateLimited(socket.id, 80)) return;
    const r = rooms.get(room);
    if (!r || !r.gameState) return;

    try {
      // Map socket to player index
      const pIdx = r.players.findIndex(p => p.id === socket.id);
      if (pIdx === -1) return;
      
      const prevFinishedCount = r.gameState.finishedOrder.length;

      let nextState: GameState;

      if (action.type === 'returnTribute') {
          nextState = resolveReturnTribute(r.gameState, pIdx, action.cards);
      } else {
          if (r.gameState.currentPlayer !== pIdx) {
            socket.emit('error', 'Not your turn');
            return;
          }
          nextState = playTurn(r.gameState, action);
      }

      r.gameState = nextState;

      // Authoritative SFX event for all clients (do NOT leak card details)
      if (action.type === 'pass') {
        emitSfx(r, { kind: 'pass', by: pIdx });
      }
      if (action.type === 'play') {
        const cards = action.cards ?? [];
        const pat = detectPattern(cards);
        if (pat) {
          const hasJoker = cards.some(c => c.isJoker);
          const hasA2 = cards.some(c => c.rank === 'A' || c.rank === '2');
          emitSfx(r, {
            kind: 'play',
            by: pIdx,
            patternType: pat.type,
            isKingBomb: !!pat.extra?.isKingBomb,
            count: cards.length,
            hasJoker,
            hasA2,
          });
        } else {
          const all4 = cards.length > 0 && cards.every(c => !c.isJoker && c.rank === '4');
          if (all4 && (cards.length === 2 || cards.length === 3)) {
            emitSfx(r, { kind: 'qi', by: pIdx, count: cards.length });
          } else {
            emitSfx(r, { kind: 'play', by: pIdx, patternType: 'UNKNOWN', count: cards.length });
          }
        }
      }
      
      // Check if someone just finished
      if (nextState.finishedOrder.length > prevFinishedCount) {
          // The player who actively finished is at the index of the previous count
          // (e.g. if 0 people finished, the new one is at index 0)
          const newFinishedIdx = nextState.finishedOrder[prevFinishedCount];
            const finishedPlayer = r.players[newFinishedIdx];
            if (finishedPlayer && finishedPlayer.mvpSound) {
              emitMvp(r, { sound: finishedPlayer.mvpSound, name: finishedPlayer.name, durationMs: 10000 });
            }
      }
      
      emitRoomState(r);
      emitPrivateState(r);

      // Check game over
      if (nextState.finishedOrder.length >= nextState.playerCount) {
         if (r.turnTimer) clearTimeout(r.turnTimer);
         
         // Calculate Scores
         const baseScore = 1000;
         const multiplier = nextState.multiplier;
         const totalStake = baseScore * multiplier;
         const finished = nextState.finishedOrder;
         
         if (r.players.length === 3) {
             // 3 Players: 1st gets from 3rd
             const winnerIdx = finished[0];
             const loserIdx = finished[2];
             r.players[winnerIdx].score += totalStake;
             r.players[loserIdx].score -= totalStake;
         } else if (r.players.length === 4) {
             // 4 Players: 1st gets from 4th, 2nd gets half from 3rd
             const p1 = finished[0];
             const p2 = finished[1];
             const p3 = finished[2];
             const p4 = finished[3];
             
             r.players[p1].score += totalStake;
             r.players[p4].score -= totalStake;
             
             r.players[p2].score += totalStake / 2;
             r.players[p3].score -= totalStake / 2;
         }
// Record History
         r.matchHistory.push({
             timestamp: Date.now(),
             scores: r.players.map(p => ({ name: p.name, score: p.score })),
             winner: r.players[finished[0]].name
         });
         // Keep last 10
         if (r.matchHistory.length > 10) r.matchHistory.shift();

         
         r.lastRoundResult = {
             finishedOrder: nextState.finishedOrder,
             revolution: nextState.revolution
         };
         
         io.to(room).emit('gameOver', { 
             finishedOrder: nextState.finishedOrder,
             scores: r.players.map(p => ({ id: p.id, score: p.score })),
             multiplier: multiplier
         });
         
        // Broadcast updated room info to show new scores immediately
        emitRoomState(r);

      } else {
         // Start timer for next player
         startTurnTimer(r);
      }

    } catch (e: any) {
      console.error(`Action error for room ${room}:`, e);
      socket.emit('error', e.message);
    }
  });

  socket.on('debug_win', ({ room }) => {
    if (isRateLimited(socket.id, 200)) return;
    const r = rooms.get(room);
    if (!r || !r.gameState) return;
    if (!DEBUG_ENABLED || r.owner !== socket.id) {
      socket.emit('error', 'debug_win 已关闭');
      return;
    }
    const pIdx = r.players.findIndex(p => p.id === socket.id);
    if (pIdx === -1) return;

    try {
        const prevFinishedCount = r.gameState.finishedOrder.length;
        const nextState = forceWin(r.gameState, pIdx);
        r.gameState = nextState;

        // Check if someone just finished (for debug_win)
        if (nextState.finishedOrder.length > prevFinishedCount) {
            const newFinishedIdx = nextState.finishedOrder[prevFinishedCount];
            const finishedPlayer = r.players[newFinishedIdx];
            if (finishedPlayer && finishedPlayer.mvpSound) {
              emitMvp(r, { sound: finishedPlayer.mvpSound, name: finishedPlayer.name, durationMs: 10000 });
            }
        }

        emitRoomState(r);
        emitPrivateState(r);

        // Check game over (Duplicate logic from action handler)
        if (nextState.finishedOrder.length >= nextState.playerCount) {
             if (r.turnTimer) clearTimeout(r.turnTimer);
             
             const baseScore = 1000;
             const multiplier = nextState.multiplier;
             const totalStake = baseScore * multiplier;
             const finished = nextState.finishedOrder;
             
             if (r.players.length === 3) {
                 const winnerIdx = finished[0];
                 const loserIdx = finished[2];
                 r.players[winnerIdx].score += totalStake;
                 r.players[loserIdx].score -= totalStake;
             } else if (r.players.length === 4) {
                 const p1 = finished[0];
                 const p2 = finished[1];
                 const p3 = finished[2];
                 const p4 = finished[3];
                 
                 r.players[p1].score += totalStake;
                 r.players[p4].score -= totalStake;
                 
                 r.players[p2].score += totalStake / 2;
                 r.players[p3].score -= totalStake / 2;
             }

             r.lastRoundResult = {
                 finishedOrder: nextState.finishedOrder,
                 revolution: nextState.revolution
             };
             
             io.to(room).emit('gameOver', { 
                 finishedOrder: nextState.finishedOrder,
                 scores: r.players.map(p => ({ id: p.id, score: p.score })),
                 multiplier: multiplier
             });
             
             emitRoomState(r);
        } else {
             startTurnTimer(r);
        }
    } catch (e) {
        console.error('Debug win error:', e);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const room = socketRoom.get(socket.id);
    socketRoom.delete(socket.id);
    socketClientKey.delete(socket.id);
    if (!room) return;

    const r = rooms.get(room);
    if (!r) return;

    const p = r.players.find(pl => pl.id === socket.id);
    if (p) {
      p.connected = false;
      p.lastSeen = Date.now();
    }

    // Broadcast update so clients can keep state consistent
    emitRoomState(r);
    emitPrivateState(r);

    // If everyone left and no game running, clean up the room
    const allDisconnected = r.players.length > 0 && r.players.every(pl => !pl.connected);
    if (allDisconnected && !r.gameState) {
      if (r.turnTimer) clearTimeout(r.turnTimer);
      rooms.delete(room);
      console.log(`Room ${room} cleaned up (idle & empty).`);
    }
  });

  // 聊天消息处理
  socket.on('chatMessage', ({ room, message, isEmoji }: { room: string, message: string, isEmoji?: boolean }) => {
    if (isRateLimited(socket.id, 100)) return;
    const r = rooms.get(room);
    if (!r) return;
    const player = r.players.find(p => p.id === socket.id);
    if (!player) return;
    
    // 广播聊天消息给房间内所有玩家
    io.to(room).emit('chatMessage', {
      player: player.name,
      message: message,
      isEmoji: isEmoji || false
    });
  });
});

const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
