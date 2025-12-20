// pages/index/index.js
const app = getApp();

Page({
  data: {
    showJoinModal: false,
    roomId: '',
    isMatching: false,
    matchingTime: 0,
    userInfo: null
  },

  onLoad() {
    // 检查登录状态
    this.checkLogin();
  },

  onShow() {
    // 更新用户信息
    this.setData({
      userInfo: app.globalData.userInfo
    });
  },

  // 检查登录状态
  checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }
    
    this.setData({
      userInfo: app.globalData.userInfo
    });
  },

  // 快速匹配
  onQuickMatch() {
    if (!this.checkConnection()) return;
    
    this.setData({
      isMatching: true,
      matchingTime: 0
    });

    // 开始计时
    this.matchingTimer = setInterval(() => {
      this.setData({
        matchingTime: this.data.matchingTime + 1
      });
    }, 1000);

    // 发送匹配请求
    app.globalData.socket.send({
      data: JSON.stringify({
        type: 'quickMatch',
        data: {
          playerCount: 3,
          name: this.data.userInfo?.nickname || '玩家',
          level: this.data.userInfo?.level || 1
        }
      })
    });

    // 监听匹配成功
    app.globalData.matchCallback = (roomId) => {
      this.clearMatchingTimer();
      this.setData({ isMatching: false });
      
      wx.navigateTo({
        url: `/pages/game/game?roomId=${roomId}`
      });
    };
  },

  // 取消匹配
  onCancelMatch() {
    this.clearMatchingTimer();
    this.setData({ isMatching: false });

    if (app.globalData.socket) {
      app.globalData.socket.send({
        data: JSON.stringify({
          type: 'cancelMatch'
        })
      });
    }
  },

  clearMatchingTimer() {
    if (this.matchingTimer) {
      clearInterval(this.matchingTimer);
      this.matchingTimer = null;
    }
  },

  // 创建房间
  onCreateRoom() {
    if (!this.checkConnection()) return;

    wx.showLoading({ title: '创建中...' });

    app.globalData.socket.send({
      data: JSON.stringify({
        type: 'createRoom',
        data: {
          name: this.data.userInfo?.nickname || '玩家',
          playerCount: 3
        }
      })
    });

    // 监听房间创建成功
    app.globalData.roomCallback = (roomId) => {
      wx.hideLoading();
      wx.navigateTo({
        url: `/pages/lobby/lobby?roomId=${roomId}&isOwner=true`
      });
    };
  },

  // 显示加入房间弹窗
  onJoinRoom() {
    this.setData({
      showJoinModal: true,
      roomId: ''
    });
  },

  // 输入房间号
  onRoomIdInput(e) {
    this.setData({
      roomId: e.detail.value.toUpperCase()
    });
  },

  // 取消加入
  onCancelJoin() {
    this.setData({
      showJoinModal: false,
      roomId: ''
    });
  },

  // 确认加入
  onConfirmJoin() {
    const roomId = this.data.roomId.trim();
    if (!roomId) {
      wx.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }

    if (!this.checkConnection()) return;

    wx.showLoading({ title: '加入中...' });

    app.globalData.socket.send({
      data: JSON.stringify({
        type: 'joinRoom',
        data: {
          roomId: roomId,
          name: this.data.userInfo?.nickname || '玩家'
        }
      })
    });

    // 监听加入成功
    app.globalData.roomCallback = (roomId) => {
      wx.hideLoading();
      this.setData({ showJoinModal: false });
      wx.navigateTo({
        url: `/pages/lobby/lobby?roomId=${roomId}&isOwner=false`
      });
    };

    // 监听错误
    app.globalData.errorCallback = (msg) => {
      wx.hideLoading();
      wx.showToast({ title: msg, icon: 'none' });
    };
  },

  // 检查连接
  checkConnection() {
    if (!app.globalData.isConnected) {
      wx.showToast({ title: '正在连接服务器...', icon: 'loading' });
      app.connectServer();
      return false;
    }
    return true;
  },

  // 跳转个人中心
  onProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },

  // 跳转排行榜
  onRank() {
    wx.navigateTo({
      url: '/pages/rank/rank'
    });
  },

  // 跳转设置
  onSettings() {
    wx.showToast({ title: '设置功能开发中', icon: 'none' });
  },

  onUnload() {
    this.clearMatchingTimer();
  }
});
