// pages/rank/rank.js - 排行榜
const app = getApp();

Page({
  data: {
    rankType: 'wins',
    rankList: []
  },

  onLoad() {
    this.loadRankList();
  },

  onShow() {
    this.loadRankList();
  },

  // 切换排行榜类型
  switchRankType(e) {
    const rankType = e.currentTarget.dataset.type;
    this.setData({ rankType });
    this.loadRankList();
  },

  // 加载排行榜（模拟数据）
  loadRankList() {
    // 模拟排行数据
    const mockData = [
      { nickname: '牌神', score: 9999, winRate: '85%' },
      { nickname: '王者归来', score: 8888, winRate: '78%' },
      { nickname: '斗地主高手', score: 7777, winRate: '72%' },
      { nickname: '快乐玩家', score: 6666, winRate: '68%' },
      { nickname: '新手上路', score: 5555, winRate: '55%' },
      { nickname: '休闲娱乐', score: 4444, winRate: '50%' },
      { nickname: '天天向上', score: 3333, winRate: '45%' },
      { nickname: '默默无闻', score: 2222, winRate: '40%' },
      { nickname: '初出茅庐', score: 1111, winRate: '35%' },
      { nickname: '菜鸟一只', score: 888, winRate: '30%' }
    ];
    
    this.setData({ rankList: mockData });
  },

  onPullDownRefresh() {
    this.loadRankList();
    wx.stopPullDownRefresh();
  }
});