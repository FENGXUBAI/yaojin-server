/**
 * 耀金斗地主服务器 v2.0
 * 集成版本 - 支持 Web 和微信小程序
 */

import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';

// 游戏引擎
import { GameState, initGame, playTurn, resolveReturnTribute, hasValidMove, Action, forceWin } from './engine/game';
import { decideBotAction, getHintOptions } from './engine/ai';
import { Card } from './engine/cards';
import { detectPattern } from './engine/patterns';

// 新增模块
import { AuthService, verifyToken, socketAuthMiddleware, User } from './auth';
import { createDatabase, Database, DatabaseUser } from './database';
import { MatchMaker } from './matchmaker';

import crypto from 'crypto';

// 环境变量配置
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const DATABASE_URL = process.env.DATABASE_URL;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8081', 'http://localhost:3000'];

// 初始化数据库
const db = createDatabase(DATABASE_URL);

// 初始化认证服务
const authService = new AuthService(JWT_SECRET, {
  appId: process.env.WX_APPID || '',
  secret: process.env.WX_SECRET || ''
});

// Express 应用
const app = express();
const httpServer = createServer(app);

// CORS 配置
app.use(cors({
  origin: NODE_ENV === 'production' ? CORS_ORIGINS : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// ============== REST API ==============

// 健康检查
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: NODE_ENV });
});

// 版本信息
app.get('/version', (_req, res) => {
  res.json({ 
    version: process.env.YAOJIN_VERSION || '2.0.0',
    env: NODE_ENV 
  });
});

// 游客登录
app.post('/api/auth/guest', async (req, res) => {
  try {
    const { nickname } = req.body;
    const result = await authService.guestLogin(nickname || `玩家${Math.floor(Math.random() * 10000)}`);
    
    // 创建或更新用户
    let user = await db.getUserById(result.user.id);
    if (!user) {
      user = await db.createUser({
        id: result.user.id,
        nickname: result.user.nickname,
        avatarUrl: result.user.avatarUrl
      });
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 微信登录
app.post('/api/auth/wechat', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: '缺少 code 参数' });
    }
    
    const result = await authService.wxLogin(code);
    
    // 创建或更新用户
    let user = await db.getUserById(result.user.id);
    if (!user) {
      user = await db.createUser({
        id: result.user.id,
        openId: result.user.openId,
        nickname: result.user.nickname,
        avatarUrl: result.user.avatarUrl
      });
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 认证中间件
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权' });
  }
  
  const token = authHeader.substring(7);
  const user = verifyToken(token, JWT_SECRET);
  
  if (!user) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
  
  (req as any).user = user;
  next();
};

// 获取用户信息
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const user = await db.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 更新用户信息
app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { nickname, avatarUrl } = req.body;
    
    const user = await db.updateUser(userId, { nickname, avatarUrl });
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取排行榜
app.get('/api/leaderboard/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    
    const users = await db.getLeaderboard(type as 'coins' | 'wins' | 'level', limit);
    res.json({ leaderboard: users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取战绩
app.get('/api/user/records', authMiddleware, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    
    const records = await db.getGameRecords(userId, limit);
    res.json({ records });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 静态文件服务
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  },
}));

// SPA 路由
app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(distPath, 'index.html'));
});

// ============== Socket.IO ==============

const io = new Server(httpServer, {
  cors: {
    origin: NODE_ENV === 'production' ? CORS_ORIGINS : '*',
    methods: ['GET', 'POST']
  }
});

// Socket.IO 认证中间件 (可选)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    const user = verifyToken(token, JWT_SECRET);
    if (user) {
      (socket as any).user = user;
    }
  }
  // 允许未认证连接 (游客模式)
  next();
});

// 房间和玩家管理
interface Player {
  id: string;
  name: string;
  ready: boolean;
  score: number;
  mvpSound?: string;
  connected: boolean;
  lastSeen: number;
  clientKey: string;
  isBot?: boolean;
  isTrusteeship?: boolean;
  userId?: string; // 关联用户ID
}

interface Room {
  id: string;
  players: Player[];
  owner: string;
  gameState: GameState | null;
  lastRoundResult?: { finishedOrder: number[]; revolution: boolean };
  turnTimer?: NodeJS.Timeout;
  eventSeq: number;
  recentSfxEvents: Array<{ seq: number; evt: any }>;
  mvpSeq: number;
  recentMvpEvents: Array<{ seq: number; evt: any }>;
  matchHistory: Array<{ timestamp: number; scores: { name: string; score: number }[]; winner: string }>;
  chatHistory: Array<{ sender: string; message: string; timestamp: number }>;
}

const rooms = new Map<string, Room>();
const socketRoom = new Map<string, string>();
const socketClientKey = new Map<string, string>();
const lastEventAt = new Map<string, number>();

// 匹配系统
const matchMaker = new MatchMaker();
const matchCallbacks = new Map<string, (roomId: string) => void>();

matchMaker.on('matchFound', ({ roomId, players }) => {
  console.log(`[匹配] 房间 ${roomId} 匹配成功, 玩家: ${players.map(p => p.name).join(', ')}`);
  
  // 创建房间
  const room: Room = {
    id: roomId,
    players: players.map(p => ({
      id: '',
      name: p.name,
      ready: true,
      score: 0,
      connected: true,
      lastSeen: Date.now(),
      clientKey: p.clientKey,
      userId: p.id
    })),
    owner: players[0].id,
    gameState: null,
    eventSeq: 0,
    recentSfxEvents: [],
    mvpSeq: 0,
    recentMvpEvents: [],
    matchHistory: [],
    chatHistory: []
  };
  rooms.set(roomId, room);
  
  // 通知所有匹配到的玩家
  players.forEach(player => {
    const callback = matchCallbacks.get(player.id);
    if (callback) {
      callback(roomId);
      matchCallbacks.delete(player.id);
    }
  });
});

// 工具函数
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

// 清理空房间
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    const allDisconnected = room.players.every(p => !p.connected || p.isBot);
    const lastActivity = Math.max(...room.players.map(p => p.lastSeen));
    
    if (allDisconnected && now - lastActivity > 5 * 60 * 1000) {
      console.log(`[清理] 移除空房间: ${roomId}`);
      rooms.delete(roomId);
    }
  }
}, 60 * 1000);

// Socket 连接处理
io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id} 已连接`);
  
  // 快速匹配
  socket.on('quickMatch', (data: { playerCount: number; name: string; level?: number; clientKey?: string }) => {
    const { playerCount, name, level = 1, clientKey } = data;
    
    const playerId = (socket as any).user?.id || socket.id;
    const key = clientKey || newClientKey();
    socketClientKey.set(socket.id, key);
    
    // 注册回调
    matchCallbacks.set(playerId, (roomId) => {
      socket.join(roomId);
      socketRoom.set(socket.id, roomId);
      
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.clientKey === key);
        if (player) {
          player.id = socket.id;
          player.connected = true;
        }
        
        socket.emit('matchSuccess', { 
          roomId, 
          clientKey: key,
          players: room.players.map(p => ({ name: p.name, ready: p.ready }))
        });
        
        io.to(roomId).emit('roomUpdate', {
          players: room.players.map(p => ({ name: p.name, ready: p.ready, score: p.score }))
        });
      }
    });
    
    matchMaker.joinQueue({
      id: playerId,
      socketId: socket.id,
      name,
      level,
      clientKey: key,
      preferredPlayerCount: playerCount
    });
    
    socket.emit('matchingStarted', { position: matchMaker.getQueuePosition(playerId) });
  });
  
  // 取消匹配
  socket.on('cancelMatch', () => {
    const playerId = (socket as any).user?.id || socket.id;
    matchMaker.leaveQueue(playerId);
    matchCallbacks.delete(playerId);
    socket.emit('matchCancelled');
  });
  
  // 创建房间
  socket.on('createRoom', (data: { name: string; playerCount?: number; clientKey?: string }) => {
    const { name, playerCount = 3, clientKey } = data;
    
    if (socketRoom.has(socket.id)) {
      socket.emit('error', { message: '您已在房间中' });
      return;
    }
    
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const key = clientKey || newClientKey();
    
    const room: Room = {
      id: roomId,
      players: [{
        id: socket.id,
        name,
        ready: false,
        score: 0,
        connected: true,
        lastSeen: Date.now(),
        clientKey: key,
        userId: (socket as any).user?.id
      }],
      owner: socket.id,
      gameState: null,
      eventSeq: 0,
      recentSfxEvents: [],
      mvpSeq: 0,
      recentMvpEvents: [],
      matchHistory: [],
      chatHistory: []
    };
    
    rooms.set(roomId, room);
    socket.join(roomId);
    socketRoom.set(socket.id, roomId);
    socketClientKey.set(socket.id, key);
    
    socket.emit('roomCreated', { roomId, clientKey: key, playerCount });
    console.log(`[房间] ${name} 创建了房间 ${roomId}`);
  });
  
  // 加入房间
  socket.on('joinRoom', (data: { roomId: string; name: string; clientKey?: string }) => {
    const { roomId, name, clientKey } = data;
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: '房间不存在' });
      return;
    }
    
    if (room.players.length >= 4) {
      socket.emit('error', { message: '房间已满' });
      return;
    }
    
    if (room.gameState) {
      socket.emit('error', { message: '游戏已开始' });
      return;
    }
    
    const key = clientKey || newClientKey();
    
    room.players.push({
      id: socket.id,
      name,
      ready: false,
      score: 0,
      connected: true,
      lastSeen: Date.now(),
      clientKey: key,
      userId: (socket as any).user?.id
    });
    
    socket.join(roomId);
    socketRoom.set(socket.id, roomId);
    socketClientKey.set(socket.id, key);
    
    socket.emit('roomJoined', { 
      roomId, 
      clientKey: key,
      players: room.players.map(p => ({ name: p.name, ready: p.ready, score: p.score }))
    });
    
    io.to(roomId).emit('playerJoined', { 
      name,
      players: room.players.map(p => ({ name: p.name, ready: p.ready, score: p.score }))
    });
    
    console.log(`[房间] ${name} 加入了房间 ${roomId}`);
  });
  
  // 聊天消息
  socket.on('chatMessage', (data: { message: string }) => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    
    // 限制消息频率
    if (isRateLimited(socket.id, 500)) return;
    
    // 限制消息长度
    const message = data.message.substring(0, 100);
    
    const chatMsg = {
      sender: player.name,
      message,
      timestamp: Date.now()
    };
    
    room.chatHistory.push(chatMsg);
    if (room.chatHistory.length > 50) {
      room.chatHistory.shift();
    }
    
    io.to(roomId).emit('chatMessage', chatMsg);
  });
  
  // 发送表情
  socket.on('sendEmoji', (data: { emoji: string }) => {
    const roomId = socketRoom.get(socket.id);
    if (!roomId) return;
    
    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    
    if (isRateLimited(socket.id, 1000)) return;
    
    io.to(roomId).emit('emojiReceived', {
      sender: player.name,
      emoji: data.emoji,
      timestamp: Date.now()
    });
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    const roomId = socketRoom.get(socket.id);
    const playerId = (socket as any).user?.id || socket.id;
    
    // 取消匹配
    matchMaker.leaveQueue(playerId);
    matchCallbacks.delete(playerId);
    
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.connected = false;
          player.lastSeen = Date.now();
          
          io.to(roomId).emit('playerDisconnected', { name: player.name });
        }
      }
    }
    
    socketRoom.delete(socket.id);
    socketClientKey.delete(socket.id);
    console.log(`[断开] ${socket.id} 已断开`);
  });

  // TODO: 将原有的游戏逻辑事件处理器添加到这里
  // 包括: ready, startGame, play, pass, getTribute 等
});

// 启动服务器
httpServer.listen(PORT, () => {
  console.log(`
====================================
  要进服务器 v2.0
  环境: ${NODE_ENV}
  端口: ${PORT}
  数据库: ${DATABASE_URL ? 'PostgreSQL' : 'Memory'}
====================================
  `);
});

export { io, rooms, db };
