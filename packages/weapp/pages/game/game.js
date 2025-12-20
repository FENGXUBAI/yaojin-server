/**
 * 游戏页面逻辑
 */
const app = getApp();

// 导入游戏核心模块 (编译后从 game-core 复制过来)
const { detectPattern, canBeat, getHintOptions } = require('../../utils/game-core.js');

Page({
  data: {
    // 房间信息
    roomId: '',
    isOwner: false,
    multiplier: 1,
    
    // 玩家信息
    myInfo: {},
    myIndex: -1,
    opponents: [],
    
    // 游戏状态
    isMyTurn: false,
    timeLeft: 30,
    cannotPlay: false,
    passCountdown: 0,
    autoPlay: false,
    
    // 手牌
    myCards: [],
    selectedCards: {},
    
    // 场上的牌
    centerCards: [],
    playLabel: '',
    
    // 特效
    showBombEffect: false,
    bombText: '',
    
    // 聊天
    showChat: false,
    chatMessages: [],
    chatInput: '',
    lastMsgId: '',
    emojis: ['😀', '😂', '😭', '😡', '👍', '👎', '💣', '🤝'],
    quickPhrases: ['快点啊', '打得好', '你是猪吗', '合作愉快', '谢谢老板'],
    
    // 游戏结束
    showGameOver: false,
    finalScores: []
  },

  onLoad(options) {
    const roomId = options.roomId || '';
    this.setData({ roomId });
    
    // 连接服务器
    this.connectGame();
  },

  onUnload() {
    // 断开连接
    if (this.socketListener) {
      // 移除监听
    }
  },

  // 连接游戏服务器
  connectGame() {
    const socket = app.connectSocket();
    
    socket.onMessage((res) => {
      try {
        const { event, data } = JSON.parse(res.data);
        this.handleSocketEvent(event, data);
      } catch (e) {
        console.error('消息解析失败:', e);
      }
    });

    // 加入房间
    setTimeout(() => {
      app.sendMessage('joinRoom', {
        room: this.data.roomId,
        name: app.globalData.userInfo?.nickname || '游客',
        avatar: app.globalData.userInfo?.avatarUrl
      });
    }, 500);
  },

  // 处理服务器事件
  handleSocketEvent(event, data) {
    switch (event) {
      case 'roomState':
        this.handleRoomState(data);
        break;
      case 'gameStart':
        this.handleGameStart(data);
        break;
      case 'gameState':
        this.handleGameState(data);
        break;
      case 'privateState':
        this.handlePrivateState(data);
        break;
      case 'gameOver':
        this.handleGameOver(data);
        break;
      case 'sfxEvent':
        this.handleSfxEvent(data);
        break;
      case 'chatMessage':
        this.handleChatMessage(data);
        break;
      case 'timer':
        this.handleTimer(data);
        break;
      case 'error':
        wx.showToast({ title: data, icon: 'none' });
        break;
    }
  },

  // 处理房间状态
  handleRoomState(data) {
    const { players, owner } = data;
    const myId = app.globalData.userInfo?.id;
    
    const myIndex = players.findIndex(p => p.id === myId);
    const opponents = [];
    
    for (let i = 1; i < players.length; i++) {
      const idx = (myIndex + i) % players.length;
      opponents.push({
        ...players[idx],
        cardCount: data.handCounts?.[idx] || 0
      });
    }
    
    this.setData({
      myIndex,
      myInfo: players[myIndex] || {},
      opponents,
      isOwner: owner === myId
    });
  },

  // 游戏开始
  handleGameStart(state) {
    this.setData({
      showGameOver: false,
      multiplier: state.multiplier || 1,
      centerCards: [],
      playLabel: ''
    });
    
    // 播放开始音效
    app.playSFX('/sounds/start.mp3');
  },

  // 更新游戏状态
  handleGameState(state) {
    const isMyTurn = state.currentPlayer === this.data.myIndex && state.status === 'playing';
    
    // 更新中央出牌区
    let centerCards = [];
    let playLabel = '';
    
    if (state.lastPlay) {
      centerCards = this.formatCards(state.lastPlay.cards || []);
      playLabel = state.lastPlay.label || '';
    }
    
    // 更新对手牌数
    const opponents = this.data.opponents.map((opp, i) => {
      const realIndex = (this.data.myIndex + i + 1) % state.playerCount;
      return {
        ...opp,
        cardCount: state.handCounts?.[realIndex] || 0
      };
    });
    
    this.setData({
      isMyTurn,
      opponents,
      centerCards,
      playLabel,
      multiplier: state.multiplier || 1
    });

    // 轮到自己时震动提示
    if (isMyTurn) {
      wx.vibrateShort({ type: 'medium' });
    }
  },

  // 处理私有状态（手牌）
  handlePrivateState(data) {
    const myCards = this.formatCards(data.hand || []);
    this.setData({ myCards, selectedCards: {} });
  },

  // 格式化卡牌用于显示
  formatCards(cards) {
    return cards.map(c => ({
      ...c,
      displayRank: c.isJoker ? (c.rank === 'JOKER_BIG' ? '大王' : '小王') : c.rank,
      isRed: c.suit === '♥' || c.suit === '♦'
    }));
  },

  // 处理计时器
  handleTimer(data) {
    this.setData({ timeLeft: data.remaining || 30 });
  },

  // 选择/取消选择卡牌
  toggleCard(e) {
    const index = e.currentTarget.dataset.index;
    const selectedCards = { ...this.data.selectedCards };
    
    if (selectedCards[index]) {
      delete selectedCards[index];
    } else {
      selectedCards[index] = true;
    }
    
    this.setData({ selectedCards });
    app.playSFX('/sounds/select.mp3');
  },

  // 出牌
  handlePlay() {
    const selectedIndices = Object.keys(this.data.selectedCards).map(Number);
    if (selectedIndices.length === 0) {
      wx.showToast({ title: '请选择要出的牌', icon: 'none' });
      return;
    }
    
    const cards = selectedIndices.map(i => this.data.myCards[i]);
    
    app.sendMessage('action', {
      room: this.data.roomId,
      action: { type: 'play', cards }
    });
    
    this.setData({ selectedCards: {} });
  },

  // 不要/过
  handlePass() {
    if (this.data.cannotPlay && this.data.passCountdown > 0) {
      return; // 还在倒计时
    }
    
    app.sendMessage('action', {
      room: this.data.roomId,
      action: { type: 'pass' }
    });
    
    app.playSFX('/sounds/pass.mp3');
  },

  // 提示
  handleHint() {
    app.sendMessage('getHints', {
      room: this.data.roomId
    });
  },

  // 切换托管
  toggleAutoPlay() {
    this.setData({ autoPlay: !this.data.autoPlay });
  },

  // 处理音效事件
  handleSfxEvent(evt) {
    const { kind, patternType, isKingBomb } = evt;
    
    if (kind === 'play') {
      if (isKingBomb) {
        this.showBomb('王炸!', '毁天灭地');
        app.playSFX('/sounds/king_bomb.mp3');
      } else if (patternType === 'FOUR') {
        this.showBomb('炸弹!');
        app.playSFX('/sounds/bomb.mp3');
      } else {
        app.playSFX('/sounds/play.mp3');
      }
    } else if (kind === 'pass') {
      app.playSFX('/sounds/pass.mp3');
    }
  },

  // 显示炸弹特效
  showBomb(text, subText = '') {
    this.setData({
      showBombEffect: true,
      bombText: text + (subText ? '\n' + subText : '')
    });
    
    wx.vibrateShort({ type: 'heavy' });
    
    setTimeout(() => {
      this.setData({ showBombEffect: false });
    }, 2000);
  },

  // 游戏结束
  handleGameOver(data) {
    this.setData({
      showGameOver: true,
      finalScores: data.scores || []
    });
    
    wx.vibrateLong();
    app.playSFX('/sounds/game_over.mp3');
  },

  // 再来一局
  playAgain() {
    app.sendMessage('start', { room: this.data.roomId });
  },

  // 返回大厅
  backToLobby() {
    wx.navigateBack();
  },

  // 切换聊天面板
  toggleChat() {
    this.setData({ showChat: !this.data.showChat });
  },

  // 处理聊天消息
  handleChatMessage(data) {
    const chatMessages = [...this.data.chatMessages, data].slice(-50);
    this.setData({
      chatMessages,
      lastMsgId: `msg-${chatMessages.length - 1}`
    });
  },

  // 输入聊天内容
  onChatInput(e) {
    this.setData({ chatInput: e.detail.value });
  },

  // 发送聊天
  sendChat() {
    const message = this.data.chatInput.trim();
    if (!message) return;
    
    app.sendMessage('chatMessage', {
      room: this.data.roomId,
      message
    });
    
    this.setData({ chatInput: '' });
  },

  // 发送表情
  sendEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    app.sendMessage('chatMessage', {
      room: this.data.roomId,
      message: emoji,
      isEmoji: true
    });
  },

  // 发送快捷短语
  sendPhrase(e) {
    const phrase = e.currentTarget.dataset.phrase;
    app.sendMessage('chatMessage', {
      room: this.data.roomId,
      message: phrase
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '来耀金斗地主一起玩！',
      path: `/pages/game/game?roomId=${this.data.roomId}`,
      imageUrl: '/images/share-game.png'
    };
  }
});
