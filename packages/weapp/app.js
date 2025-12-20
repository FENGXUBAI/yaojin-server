/**
 * 要进 - 微信小程序入口
 */

// 服务器地址配置 - 已部署到 Koyeb
const SERVER_URL = 'wss://wise-galliform-zanli-2885a498.koyeb.app';
const API_URL = 'https://wise-galliform-zanli-2885a498.koyeb.app';

App({
  globalData: {
    userInfo: null,
    token: null,
    socket: null,
    serverUrl: SERVER_URL,
    apiUrl: API_URL,
    appName: '要进',
    isConnected: false,
    matchCallback: null,
    roomCallback: null,
    errorCallback: null
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
      
      // 自动连接服务器
      this.connectServer();
    }
  },

  // 连接服务器
  connectServer() {
    if (this.globalData.socket) {
      return;
    }

    const socket = wx.connectSocket({
      url: this.globalData.serverUrl,
      success: () => {
        console.log('WebSocket 连接中...');
      },
      fail: (err) => {
        console.error('WebSocket 连接失败:', err);
      }
    });

    socket.onOpen(() => {
      console.log('WebSocket 已连接');
      this.globalData.isConnected = true;
      this.globalData.socket = socket;
    });

    socket.onMessage((res) => {
      try {
        const data = JSON.parse(res.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('消息解析失败:', e);
      }
    });

    socket.onClose(() => {
      console.log('WebSocket 已断开');
      this.globalData.isConnected = false;
      this.globalData.socket = null;
      
      // 5秒后重连
      setTimeout(() => {
        if (this.globalData.token) {
          this.connectServer();
        }
      }, 5000);
    });

    socket.onError((err) => {
      console.error('WebSocket 错误:', err);
    });
  },

  // 处理服务器消息
  handleMessage(data) {
    const { type, payload } = data;
    
    switch (type) {
      case 'matchSuccess':
        if (this.globalData.matchCallback) {
          this.globalData.matchCallback(payload.roomId);
        }
        break;
        
      case 'roomCreated':
      case 'roomJoined':
        if (this.globalData.roomCallback) {
          this.globalData.roomCallback(payload.roomId);
        }
        break;
        
      case 'error':
        if (this.globalData.errorCallback) {
          this.globalData.errorCallback(payload.message);
        }
        wx.showToast({ title: payload.message, icon: 'none' });
        break;
    }
  },

  // 发送消息
  sendMessage(type, data) {
    if (!this.globalData.socket || !this.globalData.isConnected) {
      wx.showToast({ title: '未连接服务器', icon: 'none' });
      return false;
    }
    
    this.globalData.socket.send({
      data: JSON.stringify({ type, data })
    });
    return true;
  },

  // HTTP 请求封装
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
            reject(new Error(res.data?.error || '请求失败'));
          }
        },
        fail: reject
      });
    });
  }
});
