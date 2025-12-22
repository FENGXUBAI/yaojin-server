/**
 * 大厅页面 - HTTP API 版本
 */
const app = getApp();

Page({
  data: {
    userInfo: {},
    notice: '欢迎来到要进斗地主！',
    unreadMails: 0,
    pendingTasks: 0,
    
    // 房间相关
    showRoomModal: false,
    roomTab: 'create',
    newRoomName: '',
    playerCount: 3,
    joinRoomId: '',
    roomList: [],
    
    // 匹配相关
    isMatching: false,
    matchTime: 0
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    this.loadUserInfo();
  },

  // 检查登录状态
  checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      // 未登录，跳转登录页
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = app.globalData.userInfo || {
      nickname: '游客',
      avatarUrl: '',
      coins: 10000,
      diamonds: 0,
      level: 1
    };
    this.setData({ userInfo });
  },

  // 快速匹配 - 直接进入本地游戏
  quickMatch() {
    // 本地模式：直接进入与机器人对战
    wx.showModal({
      title: '快速开始',
      content: '进入机器人对战模式？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/game/game?mode=local' });
        }
      }
    });
  },

  // 取消匹配
  cancelMatch() {
    if (this.matchTimer) {
      clearInterval(this.matchTimer);
    }
    this.setData({ isMatching: false });
  },

  // 显示房间操作
  showRoomActions() {
    this.setData({ showRoomModal: true });
  },

  // 关闭房间模态框
  closeRoomModal() {
    this.setData({ showRoomModal: false });
  },

  // 切换房间标签
  switchRoomTab(e) {
    this.setData({ roomTab: e.currentTarget.dataset.tab });
  },

  // 输入房间名
  onRoomNameInput(e) {
    this.setData({ newRoomName: e.detail.value });
  },

  // 设置玩家数量
  setPlayerCount(e) {
    this.setData({ playerCount: Number(e.currentTarget.dataset.count) });
  },

  // 创建房间
  createRoom() {
    const name = this.data.newRoomName.trim() || `${this.data.userInfo.nickname}的房间`;
    
    wx.showLoading({ title: '创建中...' });
    
    app.createRoom(this.data.playerCount, this.data.userInfo.nickname)
      .then(result => {
        wx.hideLoading();
        this.setData({ showRoomModal: false });
        wx.navigateTo({ url: `/pages/game/game?roomId=${result.roomId}` });
      })
      .catch(err => {
        wx.hideLoading();
        // 服务器不可用时进入本地模式
        wx.showModal({
          title: '提示',
          content: '服务器暂时不可用，是否进入本地模式？',
          success: (res) => {
            if (res.confirm) {
              this.setData({ showRoomModal: false });
              wx.navigateTo({ url: '/pages/game/game?mode=local' });
            }
          }
        });
      });
  },

  // 输入加入房间号
  onJoinRoomInput(e) {
    this.setData({ joinRoomId: e.detail.value.toUpperCase() });
  },

  // 加入房间
  joinRoom() {
    if (!this.data.joinRoomId.trim()) {
      wx.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '加入中...' });
    
    app.joinRoom(this.data.joinRoomId.trim(), this.data.userInfo.nickname)
      .then(result => {
        wx.hideLoading();
        this.setData({ showRoomModal: false });
        wx.navigateTo({ url: `/pages/game/game?roomId=${result.roomId}` });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '加入失败', icon: 'none' });
      });
  },

  // 比赛场（待开发）
  showTournament() {
    wx.showToast({ title: '即将开放，敬请期待', icon: 'none' });
  },

  // 跳转排行榜
  goToRank() {
    wx.switchTab({ url: '/pages/rank/rank' });
  },

  // 跳转邮件
  goToMail() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  // 跳转商城
  goToShop() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  // 跳转任务
  goToTask() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '来要进斗地主一起玩！',
      path: '/pages/lobby/lobby'
    };
  }
});
