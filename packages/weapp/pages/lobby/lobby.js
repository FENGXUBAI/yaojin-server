/**
 * 大厅页面
 */
const app = getApp();

Page({
  data: {
    userInfo: {},
    notice: '欢迎来到耀金斗地主！',
    unreadMails: 0,
    pendingTasks: 0,
    
    // 房间相关
    showRoomModal: false,
    roomTab: 'create',
    newRoomName: '',
    playerCount: 4,
    joinRoomId: '',
    roomList: [],
    
    // 匹配相关
    isMatching: false,
    matchTime: 0
  },

  onLoad() {
    this.loadUserInfo();
    this.connectServer();
  },

  onShow() {
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

  // 连接服务器
  connectServer() {
    const socket = app.connectSocket();
    
    socket.onMessage((res) => {
      try {
        const { event, data } = JSON.parse(res.data);
        this.handleEvent(event, data);
      } catch (e) {}
    });
  },

  // 处理服务器事件
  handleEvent(event, data) {
    switch (event) {
      case 'roomList':
        this.setData({ roomList: data });
        break;
      case 'matchFound':
        this.setData({ isMatching: false });
        wx.navigateTo({ url: `/pages/game/game?roomId=${data.roomId}` });
        break;
      case 'roomCreated':
        wx.navigateTo({ url: `/pages/game/game?roomId=${data.roomId}` });
        break;
      case 'joinedRoom':
        wx.navigateTo({ url: `/pages/game/game?roomId=${data.roomId}` });
        break;
    }
  },

  // 快速匹配
  quickMatch() {
    this.setData({ isMatching: true, matchTime: 0 });
    
    this.matchTimer = setInterval(() => {
      this.setData({ matchTime: this.data.matchTime + 1 });
    }, 1000);
    
    app.sendMessage('quickMatch', {});
  },

  // 取消匹配
  cancelMatch() {
    if (this.matchTimer) {
      clearInterval(this.matchTimer);
    }
    this.setData({ isMatching: false });
    app.sendMessage('cancelMatch', {});
  },

  // 显示房间操作
  showRoomActions() {
    this.setData({ showRoomModal: true });
    app.sendMessage('listRooms', {});
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
    app.sendMessage('createRoom', {
      name,
      maxPlayers: this.data.playerCount
    });
  },

  // 输入加入房间号
  onJoinRoomInput(e) {
    this.setData({ joinRoomId: e.detail.value });
  },

  // 加入房间
  joinRoom() {
    if (!this.data.joinRoomId.trim()) {
      wx.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }
    app.sendMessage('joinRoom', {
      room: this.data.joinRoomId.trim(),
      name: this.data.userInfo.nickname
    });
  },

  // 通过ID加入房间
  joinRoomById(e) {
    const roomId = e.currentTarget.dataset.id;
    app.sendMessage('joinRoom', {
      room: roomId,
      name: this.data.userInfo.nickname
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
      title: '来耀金斗地主一起玩！',
      path: '/pages/lobby/lobby'
    };
  }
});
