/**
 * 网络联机模块
 * 使用 Socket.io 连接 Koyeb 服务器
 */
const Network = {
  // Koyeb 服务器地址
  SERVER_URL: 'https://wise-galliform-zanli-2885a498.koyeb.app',
  
  // Socket 连接
  socket: null,
  
  // 连接状态
  connected: false,
  
  // 当前房间
  room: null,
  
  // 当前玩家信息
  player: null,
  
  // 事件回调
  callbacks: {},
  
  /**
   * 连接服务器
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.socket && this.connected) {
        resolve();
        return;
      }
      
      console.log('正在连接服务器:', this.SERVER_URL);
      
      // 加载 socket.io 客户端
      if (typeof io === 'undefined') {
        reject(new Error('Socket.io 未加载'));
        return;
      }
      
      this.socket = io(this.SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      });
      
      this.socket.on('connect', () => {
        console.log('Socket 已连接:', this.socket.id);
        this.connected = true;
        this.emit('connected');
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('连接错误:', error.message);
        this.connected = false;
        this.emit('error', { message: '连接失败: ' + error.message });
        reject(error);
      });
      
      this.socket.on('disconnect', (reason) => {
        console.log('断开连接:', reason);
        this.connected = false;
        this.emit('disconnected', { reason });
      });
      
      // 游戏事件
      this.socket.on('roomState', (state) => {
        console.log('房间状态更新:', state);
        this.emit('roomState', state);
      });
      
      this.socket.on('roomUpdate', (state) => {
        console.log('房间更新:', state);
        this.emit('roomUpdate', state);
      });
      
      this.socket.on('privateState', (state) => {
        console.log('私有状态:', state);
        this.emit('privateState', state);
      });
      
      this.socket.on('gameState', (state) => {
        console.log('游戏状态:', state);
        this.emit('gameState', state);
      });
      
      this.socket.on('turnResult', (result) => {
        console.log('出牌结果:', result);
        this.emit('turnResult', result);
      });
      
      this.socket.on('gameOver', (result) => {
        console.log('游戏结束:', result);
        this.emit('gameOver', result);
      });
      
      this.socket.on('error', (error) => {
        console.error('服务器错误:', error);
        this.emit('error', error);
      });
      
      this.socket.on('chat', (message) => {
        this.emit('chat', message);
      });
      
      // 超时处理
      setTimeout(() => {
        if (!this.connected) {
          this.socket.disconnect();
          reject(new Error('连接超时'));
        }
      }, 12000);
    });
  },
  
  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.room = null;
    }
  },
  
  /**
   * 加入房间
   */
  join(room, name, clientKey = null) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('未连接服务器'));
        return;
      }
      
      this.socket.emit('join', { room, name, clientKey });
      
      // 等待 roomState 确认加入
      const handler = (state) => {
        this.room = room;
        this.player = { name, id: this.socket.id };
        this.off('roomState', handler);
        resolve(state);
      };
      
      this.on('roomState', handler);
      
      // 超时
      setTimeout(() => {
        this.off('roomState', handler);
        reject(new Error('加入房间超时'));
      }, 5000);
    });
  },
  
  /**
   * 离开房间
   */
  leave() {
    if (this.connected && this.room) {
      this.socket.emit('leave', { room: this.room });
      this.room = null;
    }
  },
  
  /**
   * 开始游戏
   */
  startGame() {
    if (this.connected && this.room) {
      this.socket.emit('start', { room: this.room });
    }
  },
  
  /**
   * 出牌
   */
  playCards(cardIndices) {
    if (this.connected && this.room) {
      this.socket.emit('play', { 
        room: this.room, 
        cardIndices 
      });
    }
  },
  
  /**
   * 不要/过
   */
  pass() {
    if (this.connected && this.room) {
      this.socket.emit('pass', { room: this.room });
    }
  },
  
  /**
   * 发送聊天消息
   */
  sendChat(message) {
    if (this.connected && this.room) {
      this.socket.emit('chat', { 
        room: this.room, 
        message 
      });
    }
  },
  
  /**
   * 设置 MVP 音效
   */
  setMvpSound(sound) {
    if (this.connected && this.room) {
      this.socket.emit('setMvpSound', { 
        room: this.room, 
        sound 
      });
    }
  },
  
  /**
   * 注册事件回调
   */
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  },
  
  /**
   * 移除事件回调
   */
  off(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  },
  
  /**
   * 触发事件
   */
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  },
  
  /**
   * 获取连接状态
   */
  isConnected() {
    return this.connected;
  },
  
  /**
   * 获取当前房间
   */
  getRoom() {
    return this.room;
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Network;
}
