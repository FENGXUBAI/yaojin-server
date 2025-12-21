/**
 * 要进 - 微信小程序入口
 */

// 服务器地址配置 - 已部署到 Koyeb
const API_URL = 'https://wise-galliform-zanli-2885a498.koyeb.app';

App({
  globalData: {
    userInfo: null,
    token: null,
    apiUrl: API_URL,
    appName: '要进',
    isConnected: false,
    matchCallback: null,
    roomCallback: null,
    errorCallback: null,
    messageHandlers: {}
  },

  onLaunch() {
    console.log('小程序启动');
    
    // 检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      this.globalData.isConnected = true;
    }
  },

  // HTTP 请求封装（带认证）
  request(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.apiUrl}${options.url}`,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Content-Type': 'application/json',
          'Authorization': this.globalData.token ? `Bearer ${this.globalData.token}` : ''
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.error || `请求失败 (${res.statusCode})`));
          }
        },
        fail: (err) => {
          console.error('请求失败:', err);
          reject(new Error(err.errMsg || '网络请求失败'));
        }
      });
    });
  },

  // 游客登录
  guestLogin(nickname) {
    return this.request({
      url: '/api/auth/guest',
      method: 'POST',
      data: { nickname: nickname || undefined }
    });
  },

  // 微信登录
  wechatLogin(code, nickname, avatarUrl) {
    return this.request({
      url: '/api/auth/wechat',
      method: 'POST',
      data: { code, nickname, avatarUrl }
    });
  },

  // 获取用户信息
  getUserProfile() {
    return this.request({
      url: '/api/user/profile',
      method: 'GET'
    });
  },

  // 注册事件处理器
  on(eventName, handler) {
    this.globalData.messageHandlers[eventName] = handler;
  },

  // 移除事件处理器
  off(eventName) {
    delete this.globalData.messageHandlers[eventName];
  },

  // 发送事件（当前为 HTTP 方式，可扩展）
  emit(eventName, data) {
    console.log(`发送事件: ${eventName}`, data);
    // 这里可以扩展为 HTTP API 调用或 WebSocket 事件
    // 暂时只记录日志
    return true;
  },

  // 快速匹配（HTTP 轮询版本）
  quickMatch(playerCount = 3, playerName = '玩家') {
    return this.request({
      url: '/api/match/quick',
      method: 'POST',
      data: { playerCount, playerName }
    });
  },

  // 创建房间
  createRoom(playerCount = 3, playerName = '玩家') {
    return this.request({
      url: '/api/room/create',
      method: 'POST',
      data: { playerCount, playerName }
    });
  },

  // 加入房间
  joinRoom(roomId, playerName = '玩家') {
    return this.request({
      url: '/api/room/join',
      method: 'POST',
      data: { roomId, playerName }
    });
  }
});
