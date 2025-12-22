# 耀金斗地主 - 游戏架构设计文档

## 一、项目目标

1. **多平台支持**: Web端、微信小程序、移动App
2. **实时多人对战**: 支持同时多个房间、多人游戏
3. **可扩展架构**: 便于后续添加新功能

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                         客户端                               │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Web (React)   │  微信小程序      │   React Native App      │
│   react-native- │  使用原生框架    │   iOS / Android         │
│   web           │  + game-core    │   + game-core           │
└────────┬────────┴────────┬────────┴────────┬────────────────┘
         │                 │                 │
         └─────────────────┴─────────────────┘
                           │
                    Socket.IO / WebSocket
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                       服务器端                               │
├─────────────────────────────────────────────────────────────┤
│  Express + Socket.IO Server                                  │
│  ├── 房间管理 (Room Manager)                                 │
│  ├── 玩家管理 (Player Manager)                               │
│  ├── 游戏引擎 (Game Engine) ← 共享核心                       │
│  ├── AI引擎 (AI Engine)                                      │
│  └── 数据存储 (Database Layer)                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                       数据层                                 │
├─────────────────────────────────────────────────────────────┤
│  Redis (会话/房间缓存)  │  PostgreSQL/MySQL (持久化数据)     │
└─────────────────────────────────────────────────────────────┘
```

## 三、模块划分

### 1. 游戏核心模块 (game-core)
**路径**: `/packages/game-core/`
- 纯JavaScript/TypeScript，不依赖任何框架
- 可在浏览器、Node.js、微信小程序中运行
- 包含:
  - 牌型检测 (patterns.ts)
  - 游戏状态管理 (game.ts)
  - AI逻辑 (ai.ts)
  - 卡牌数据结构 (cards.ts)

### 2. 服务器模块 (server)
**路径**: `/packages/server/`
- 房间管理与匹配系统
- 实时通信 (Socket.IO)
- 用户认证 (JWT)
- 数据持久化

### 3. Web客户端 (web-client)
**路径**: `/packages/web-client/`
- React Native Web
- 响应式设计

### 4. 微信小程序 (weapp)
**路径**: `/packages/weapp/`
- 原生小程序框架
- WebSocket通信
- 微信登录集成

## 四、数据库设计

### 用户表 (users)
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  open_id VARCHAR(128) UNIQUE,        -- 微信OpenID
  union_id VARCHAR(128),              -- 微信UnionID
  nickname VARCHAR(64) NOT NULL,
  avatar_url TEXT,
  coins INT DEFAULT 10000,            -- 游戏币
  diamonds INT DEFAULT 0,             -- 钻石
  level INT DEFAULT 1,
  exp INT DEFAULT 0,
  total_games INT DEFAULT 0,
  wins INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 游戏记录表 (game_records)
```sql
CREATE TABLE game_records (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(64),
  players JSONB,                      -- 玩家信息数组
  winner_id INT REFERENCES users(id),
  multiplier INT DEFAULT 1,
  scores JSONB,                       -- 各玩家得分
  game_data JSONB,                    -- 完整对局数据(可选)
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 好友关系表 (friendships)
```sql
CREATE TABLE friendships (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  friend_id INT REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, blocked
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);
```

## 五、API 设计

### REST API (用户相关)
```
POST   /api/auth/login          微信登录
POST   /api/auth/guest          游客登录
GET    /api/user/profile        获取个人信息
PUT    /api/user/profile        更新个人信息
GET    /api/user/records        获取对局记录
GET    /api/leaderboard         排行榜
GET    /api/friends             好友列表
POST   /api/friends/add         添加好友
```

### Socket.IO Events (游戏相关)
```typescript
// 客户端 -> 服务器
'createRoom'     // 创建房间
'joinRoom'       // 加入房间
'leaveRoom'      // 离开房间
'ready'          // 准备
'start'          // 开始游戏
'action'         // 游戏操作
'chatMessage'    // 聊天消息
'quickMatch'     // 快速匹配
'inviteFriend'   // 邀请好友

// 服务器 -> 客户端
'roomState'      // 房间状态
'gameStart'      // 游戏开始
'gameState'      // 游戏状态更新
'privateState'   // 私有状态(手牌)
'gameOver'       // 游戏结束
'sfxEvent'       // 音效事件
'chatMessage'    // 聊天消息
'matchFound'     // 匹配成功
```

## 六、微信小程序适配要点

### 1. 登录流程
```
用户点击登录 -> wx.login() -> 获取code -> 发送到服务器
-> 服务器调用微信API -> 获取openid -> 返回JWT token
```

### 2. 音效处理
```javascript
// 微信小程序音频API
const audioContext = wx.createInnerAudioContext();
audioContext.src = 'path/to/sound.mp3';
audioContext.play();
```

### 3. WebSocket连接
```javascript
// 微信小程序WebSocket
const socket = wx.connectSocket({ url: 'wss://your-server.com' });
socket.onMessage((data) => { /* 处理消息 */ });
socket.send({ data: JSON.stringify(message) });
```

### 4. 分享功能
```javascript
wx.showShareMenu({ withShareTicket: true });
Page({
  onShareAppMessage() {
    return {
      title: '来斗地主啊！',
      path: `/pages/game/game?roomId=${roomId}`,
      imageUrl: '/images/share.png'
    };
  }
});
```

## 七、部署架构

### 生产环境
```
                    ┌─────────────┐
                    │   Nginx     │
                    │   (反向代理) │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
    │ Server 1│      │ Server 2│      │ Server 3│
    │ (Node)  │      │ (Node)  │      │ (Node)  │
    └────┬────┘      └────┬────┘      └────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         ┌────┴────┐              ┌────┴────┐
         │  Redis  │              │PostgreSQL│
         │ (集群)  │              │  (主从)  │
         └─────────┘              └─────────┘
```

## 八、开发路线图

### Phase 1: 基础优化 (1-2周)
- [ ] 重构项目为 monorepo 结构
- [ ] 抽取游戏核心到独立包
- [ ] 添加用户认证系统
- [ ] 数据库集成

### Phase 2: 微信小程序 (2-3周)
- [ ] 创建小程序项目
- [ ] 适配UI组件
- [ ] 集成微信登录
- [ ] 适配音效系统
- [ ] 分享功能

### Phase 3: 功能完善 (2-3周)
- [ ] 快速匹配系统
- [ ] 好友系统
- [ ] 排行榜
- [ ] 充值系统(可选)

### Phase 4: 上线准备 (1-2周)
- [ ] 性能优化
- [ ] 安全审计
- [ ] 微信审核准备
- [ ] 域名备案(如需)
