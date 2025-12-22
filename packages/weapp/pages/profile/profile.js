// pages/profile/profile.js - 个人中心
const app = getApp();

Page({
  data: {
    userInfo: {},
    winRate: '0%'
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo || {
      nickname: '游客',
      avatarUrl: '',
      coins: 10000,
      diamonds: 0,
      level: 1,
      wins: 0,
      total: 0,
      id: ''
    };
    
    const winRate = userInfo.total > 0 
      ? Math.round(userInfo.wins / userInfo.total * 100) + '%'
      : '0%';
    
    this.setData({ userInfo, winRate });
  },

  onGameRecord() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onAchievements() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onSettings() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  onAbout() {
    wx.showModal({
      title: '关于要进',
      content: '版本 1.0.0\n一款好玩的斗地主游戏',
      showCancel: false
    });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync();
          app.globalData.userInfo = null;
          app.globalData.token = null;
          wx.reLaunch({ url: '/pages/login/login' });
        }
      }
    });
  }
});