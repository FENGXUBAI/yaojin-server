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
    app.quickMatch(3, this.data.userInfo?.nickname || '玩家')
      .then(result => {
        this.clearMatchingTimer();
        this.setData({ isMatching: false });
        if (result.roomId) {
          wx.navigateTo({
            url: `/pages/game/game?roomId=${result.roomId}`
          });
        }
      })
      .catch(err => {
        this.clearMatchingTimer();
        this.setData({ isMatching: false });
        wx.showToast({ title: err.message || '匹配失败', icon: 'none' });
      });
  },

  // 取消匹配
  onCancelMatch() {
    this.clearMatchingTimer();
    this.setData({ isMatching: false });
  },

  clearMatchingTimer() {
    if (this.matchingTimer) {
      clearInterval(this.matchingTimer);
      this.matchingTimer = null;
    }
  },

  // 创建房间
  onCreateRoom() {
    wx.showLoading({ title: '创建中...' });

    app.createRoom(3, this.data.userInfo?.nickname || '玩家')
      .then(result => {
        wx.hideLoading();
        wx.navigateTo({
          url: `/pages/lobby/lobby?roomId=${result.roomId}&isOwner=true`
        });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '创建失败', icon: 'none' });
      });
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

    wx.showLoading({ title: '加入中...' });

    app.joinRoom(roomId, this.data.userInfo?.nickname || '玩家')
      .then(result => {
        wx.hideLoading();
        this.setData({ showJoinModal: false });
        wx.navigateTo({
          url: `/pages/lobby/lobby?roomId=${result.roomId}&isOwner=false`
        });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '加入失败', icon: 'none' });
      });
  },

  // 检查连接
  checkConnection() {
    return app.globalData.isConnected;
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
