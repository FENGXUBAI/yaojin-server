// pages/login/login.js
const app = getApp();

Page({
  data: {
    agreed: false
  },

  onLoad() {
    // 检查是否已登录
    const token = wx.getStorageSync('token');
    if (token) {
      wx.redirectTo({
        url: '/pages/index/index'
      });
    }
  },

  // 切换协议同意状态
  onToggleAgreement() {
    this.setData({
      agreed: !this.data.agreed
    });
  },

  // 微信登录
  async onWechatLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '登录中...' });

      // 1. 获取用户信息
      const userProfile = await this.getUserProfile();
      
      // 2. 获取登录 code
      const loginRes = await this.wxLogin();
      
      // 3. 发送到服务器换取 token
      const result = await this.serverLogin(loginRes.code, userProfile.userInfo);

      // 4. 保存登录状态
      wx.setStorageSync('token', result.token);
      wx.setStorageSync('userInfo', result.user);
      app.globalData.token = result.token;
      app.globalData.userInfo = result.user;

      wx.hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success' });

      // 5. 跳转首页
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/index/index'
        });
      }, 500);

    } catch (error) {
      wx.hideLoading();
      console.error('登录失败:', error);
      wx.showToast({ title: error.message || '登录失败', icon: 'none' });
    }
  },

  // 游客登录
  async onGuestLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '登录中...' });

      // 生成随机昵称
      const randomNum = Math.floor(Math.random() * 10000);
      const nickname = `玩家${randomNum}`;

      // 调用游客登录接口
      const result = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.apiUrl}/api/auth/guest`,
          method: 'POST',
          data: { nickname },
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data);
            } else {
              reject(new Error(res.data?.error || '请求失败'));
            }
          },
          fail: (err) => reject(err)
        });
      });

      // 保存登录状态
      wx.setStorageSync('token', result.token);
      wx.setStorageSync('userInfo', result.user);
      app.globalData.token = result.token;
      app.globalData.userInfo = result.user;

      wx.hideLoading();
      wx.showToast({ title: '登录成功', icon: 'success' });

      // 连接服务器
      app.connectServer();

      // 跳转首页
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/index/index'
        });
      }, 500);

    } catch (error) {
      wx.hideLoading();
      console.error('游客登录失败:', error);
      wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
    }
  },

  // 获取用户信息
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: resolve,
        fail: reject
      });
    });
  },

  // 微信登录获取 code
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });
  },

  // 服务器登录
  serverLogin(code, userInfo) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiUrl}/api/auth/wechat`,
        method: 'POST',
        data: {
          code,
          nickname: userInfo.nickName,
          avatarUrl: userInfo.avatarUrl
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.error || '登录失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 用户协议
  onUserAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '欢迎使用要进游戏！\n\n1. 本游戏仅供娱乐，禁止赌博行为\n2. 请文明游戏，尊重其他玩家\n3. 禁止使用外挂或作弊工具\n4. 游戏内虚拟物品不支持提现',
      showCancel: false
    });
  },

  // 隐私政策
  onPrivacyPolicy() {
    wx.showModal({
      title: '隐私政策',
      content: '我们重视您的隐私！\n\n我们收集的信息：\n- 微信昵称和头像\n- 游戏对战记录\n\n我们不会将您的个人信息分享给第三方。',
      showCancel: false
    });
  }
});
