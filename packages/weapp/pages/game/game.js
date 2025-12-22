/**
 * 游戏页面逻辑 - 单机版本（与机器人对战）
 * 美化版 - 包含音效和动画效果
 */
const app = getApp();

// 导入游戏核心模块
const { detectPattern, canBeat, getHintOptions, getCardValue } = require('../../utils/game-core.js');

// 导入音效模块
const sound = require('../../utils/sound.js');

// 生成一副牌
function generateDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const deck = [];
  
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank, id: `${suit}${rank}` });
    }
  }
  deck.push({ suit: '', rank: 'joker', id: 'joker' });
  deck.push({ suit: '', rank: 'JOKER', id: 'JOKER' });
  
  // 洗牌
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

// 发牌
function dealCards(deck) {
  const hands = [[], [], []];
  const landlordCards = [];
  
  for (let i = 0; i < 51; i++) {
    hands[i % 3].push(deck[i]);
  }
  for (let i = 51; i < 54; i++) {
    landlordCards.push(deck[i]);
  }
  
  // 排序
  for (const hand of hands) {
    hand.sort((a, b) => getCardValue(b) - getCardValue(a));
  }
  
  return { hands, landlordCards };
}

Page({
  data: {
    // 房间信息
    roomId: '',
    multiplier: 1,
    isOwner: true,
    
    // 玩家信息
    myIndex: 0,
    landlordIndex: 0,
    myInfo: {
      name: '我',
      coins: 1000,
      avatar: ''
    },
    opponents: [
      { name: '机器人A', cardCount: 17, isLandlord: false },
      { name: '机器人B', cardCount: 17, isLandlord: false }
    ],
    
    // 游戏状态
    isMyTurn: true,
    currentPlayer: 0,
    status: 'playing',
    timeLeft: 30,
    cannotPlay: false,
    autoPlay: false,
    
    // 手牌
    myCards: [],
    selectedCards: {},
    
    // 场上的牌
    centerCards: [],
    playLabel: '',
    lastPlayIndex: -1,
    lastPattern: null,
    
    // 特效
    showBombEffect: false,
    bombText: '',
    
    // 聊天
    showChat: false,
    chatInput: '',
    chatMessages: [],
    emojis: ['😊', '😂', '🤔', '😎', '👍', '👎', '💪', '🎉'],
    quickPhrases: ['快点啊', '不要走', '厉害', '打得好'],
    
    // 游戏结束
    showGameOver: false,
    isWin: false,
    finalScores: []
  },

  onLoad(options) {
    const roomId = options.roomId || 'LOCAL';
    this.setData({ roomId });
    
    // 开始本地游戏
    this.startLocalGame();
  },

  // 开始本地游戏
  startLocalGame() {
    const deck = generateDeck();
    const { hands, landlordCards } = dealCards(deck);
    
    // 玩家是地主
    const myCards = [...hands[0], ...landlordCards].sort((a, b) => getCardValue(b) - getCardValue(a));
    
    this.gameData = {
      hands: [myCards, hands[1], hands[2]],
      currentPlayer: 0,
      lastPlay: null,
      lastPlayIndex: -1
    };
    
    this.setData({
      myCards: myCards.map((c, i) => ({ ...c, index: i })),
      landlordIndex: 0,
      isMyTurn: true,
      opponents: [
        { name: '机器人A', cardCount: 17, isLandlord: false },
        { name: '机器人B', cardCount: 17, isLandlord: false }
      ]
    });
    
    wx.showToast({ title: '你是地主！', icon: 'none', duration: 1500 });
  },

  // 选中牌
  onSelectCard(e) {
    const index = e.currentTarget.dataset.index;
    const selected = { ...this.data.selectedCards };
    
    if (selected[index]) {
      delete selected[index];
    } else {
      selected[index] = true;
    }
    
    // 播放选牌音效
    sound.play('select');
    
    this.setData({ selectedCards: selected });
  },

  // 获取选中的牌
  getSelectedCards() {
    const indices = Object.keys(this.data.selectedCards).map(Number);
    return indices.map(i => this.data.myCards[i]).filter(Boolean);
  },

  // 出牌
  onPlayCards() {
    if (!this.data.isMyTurn) {
      wx.showToast({ title: '还没轮到你', icon: 'none' });
      return;
    }
    
    const selectedCards = this.getSelectedCards();
    if (selectedCards.length === 0) {
      wx.showToast({ title: '请选择要出的牌', icon: 'none' });
      return;
    }
    
    const pattern = detectPattern(selectedCards);
    if (pattern.type === 'invalid') {
      wx.showToast({ title: '无效的牌型', icon: 'none' });
      return;
    }
    
    // 检查是否能压过上家
    if (this.data.lastPattern && this.data.lastPlayIndex !== 0) {
      if (!canBeat(pattern, this.data.lastPattern)) {
        wx.showToast({ title: '压不过上家的牌', icon: 'none' });
        return;
      }
    }
    
    // 移除已出的牌
    const indices = Object.keys(this.data.selectedCards).map(Number).sort((a, b) => b - a);
    const newCards = [...this.data.myCards];
    for (const i of indices) {
      newCards.splice(i, 1);
    }
    
    // 更新显示
    this.setData({
      myCards: newCards.map((c, i) => ({ ...c, index: i })),
      selectedCards: {},
      centerCards: selectedCards,
      playLabel: this.getPatternLabel(pattern),
      isMyTurn: false,
      lastPattern: pattern,
      lastPlayIndex: 0
    });
    
    // 播放出牌音效
    sound.playCard(pattern.type);
    
    // 更新游戏数据
    this.gameData.hands[0] = newCards;
    this.gameData.lastPlay = { cards: selectedCards, pattern };
    this.gameData.lastPlayIndex = 0;
    
    // 炸弹特效
    if (pattern.isBomb) {
      this.showBombAnim(pattern.type === 'rocket' ? '王炸！' : '炸弹！');
    }
    
    // 检查胜负
    if (newCards.length === 0) {
      this.endGame(true);
      return;
    }
    
    // 机器人出牌
    setTimeout(() => this.botPlay(1), 1000);
  },

  // 不出
  onPass() {
    if (!this.data.isMyTurn) return;
    
    // 自己出的牌不能不要
    if (this.data.lastPlayIndex === 0 || this.data.lastPlayIndex === -1) {
      wx.showToast({ title: '你必须出牌', icon: 'none' });
      return;
    }
    
    // 播放过牌音效
    sound.play('pass');
    
    this.setData({
      isMyTurn: false,
      selectedCards: {}
    });
    
    // 机器人出牌
    setTimeout(() => this.botPlay(1), 800);
  },

  // 提示
  onHint() {
    if (!this.data.isMyTurn) return;
    
    const hints = getHintOptions(this.data.myCards, this.data.lastPlayIndex === 0 ? null : this.data.lastPattern);
    
    if (hints.length === 0) {
      wx.showToast({ title: '没有能出的牌', icon: 'none' });
      return;
    }
    
    // 选中提示的牌
    const hint = hints[0];
    const selected = {};
    for (const card of hint) {
      const idx = this.data.myCards.findIndex(c => c.id === card.id);
      if (idx >= 0) selected[idx] = true;
    }
    
    this.setData({ selectedCards: selected });
  },

  // 机器人出牌
  botPlay(botIndex) {
    const hand = this.gameData.hands[botIndex];
    
    // 检查是否需要跟牌
    const needToBeat = this.gameData.lastPlayIndex !== -1 && this.gameData.lastPlayIndex !== botIndex;
    
    let cardsToPlay = null;
    let pattern = null;
    
    if (needToBeat) {
      // 尝试找能压过的牌
      const hints = getHintOptions(hand, this.gameData.lastPlay?.pattern);
      if (hints.length > 0) {
        cardsToPlay = hints[0];
        pattern = detectPattern(cardsToPlay);
      }
    } else {
      // 自由出牌，出最小的单张
      if (hand.length > 0) {
        const sorted = [...hand].sort((a, b) => getCardValue(a) - getCardValue(b));
        cardsToPlay = [sorted[0]];
        pattern = detectPattern(cardsToPlay);
      }
    }
    
    // 更新对手牌数
    const opponents = [...this.data.opponents];
    
    if (cardsToPlay) {
      // 移除已出的牌
      for (const card of cardsToPlay) {
        const idx = hand.findIndex(c => c.id === card.id);
        if (idx >= 0) hand.splice(idx, 1);
      }
      
      opponents[botIndex - 1].cardCount = hand.length;
      
      this.gameData.lastPlay = { cards: cardsToPlay, pattern };
      this.gameData.lastPlayIndex = botIndex;
      
      this.setData({
        opponents,
        centerCards: cardsToPlay,
        playLabel: `机器人${botIndex === 1 ? 'A' : 'B'}: ${this.getPatternLabel(pattern)}`,
        lastPattern: pattern,
        lastPlayIndex: botIndex
      });
      
      // 炸弹特效
      if (pattern.isBomb) {
        this.showBombAnim(pattern.type === 'rocket' ? '王炸！' : '炸弹！');
      }
      
      // 检查机器人是否获胜
      if (hand.length === 0) {
        this.endGame(false);
        return;
      }
    } else {
      // 不出
      this.setData({
        centerCards: [],
        playLabel: `机器人${botIndex === 1 ? 'A' : 'B'}: 不出`
      });
    }
    
    // 下一个玩家
    const nextPlayer = (botIndex + 1) % 3;
    
    if (nextPlayer === 0) {
      // 轮到玩家
      this.setData({ isMyTurn: true });
      sound.play('my_turn');
      wx.vibrateShort({ type: 'medium' });
    } else {
      // 下一个机器人
      setTimeout(() => this.botPlay(nextPlayer), 1000);
    }
  },

  // 获取牌型名称
  getPatternLabel(pattern) {
    const labels = {
      single: '单张',
      pair: '对子',
      triple: '三张',
      triple_one: '三带一',
      triple_pair: '三带二',
      straight: '顺子',
      double_straight: '连对',
      triple_straight: '飞机',
      bomb: '炸弹',
      rocket: '王炸'
    };
    return labels[pattern.type] || '';
  },

  // 炸弹特效
  showBombAnim(text) {
    this.setData({ showBombEffect: true, bombText: text });
    // 音效在playCard中已播放
    wx.vibrateShort({ type: 'heavy' });
    setTimeout(() => {
      this.setData({ showBombEffect: false });
    }, 1500);
  },

  // 游戏结束
  endGame(isWin) {
    // 播放胜利/失败音效
    sound.play(isWin ? 'win' : 'lose');
    
    this.setData({
      showGameOver: true,
      isWin,
      finalScores: [
        { name: '你', score: isWin ? 100 : -50 },
        { name: '机器人A', score: isWin ? -50 : 50 },
        { name: '机器人B', score: isWin ? -50 : 50 }
      ]
    });
  },

  // 重新开始
  onRestart() {
    this.setData({
      showGameOver: false,
      selectedCards: {},
      centerCards: [],
      playLabel: '',
      lastPattern: null,
      lastPlayIndex: -1
    });
    this.startLocalGame();
  },

  // 返回大厅
  onBackToLobby() {
    wx.navigateBack();
  },

  // ========== WXML 事件绑定别名 ==========
  // 出牌按钮
  handlePlay() {
    this.onPlayCards();
  },

  // 不要按钮
  handlePass() {
    this.onPass();
  },

  // 提示按钮
  handleHint() {
    this.onHint();
  },

  // 选中/取消选中卡牌
  toggleCard(e) {
    this.onSelectCard(e);
  },

  // 再来一局
  playAgain() {
    this.onRestart();
  },

  // 返回大厅
  backToLobby() {
    this.onBackToLobby();
  },

  // 切换托管
  toggleAutoPlay() {
    const autoPlay = !this.data.autoPlay;
    this.setData({ autoPlay });
    wx.showToast({ title: autoPlay ? '已开启托管' : '已取消托管', icon: 'none' });
    if (autoPlay && this.data.isMyTurn) {
      this.autoPlayCard();
    }
  },

  // 自动出牌
  autoPlayCard() {
    const hints = getHintOptions(this.data.myCards, this.data.lastPattern);
    if (hints.length > 0) {
      // 选中提示的牌并出牌
      const selected = {};
      hints[0].forEach((_, i) => { selected[i] = true; });
      this.setData({ selectedCards: selected });
      setTimeout(() => this.onPlayCards(), 500);
    } else {
      this.onPass();
    }
  },

  // 聊天相关
  toggleChat() {
    this.setData({ showChat: !this.data.showChat });
  },

  sendEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    wx.showToast({ title: `发送: ${emoji}`, icon: 'none' });
  },

  sendPhrase(e) {
    const phrase = e.currentTarget.dataset.phrase;
    wx.showToast({ title: `发送: ${phrase}`, icon: 'none' });
  },

  onChatInput(e) {
    this.setData({ chatInput: e.detail.value });
  },

  sendChat() {
    const msg = this.data.chatInput;
    if (msg) {
      wx.showToast({ title: `发送: ${msg}`, icon: 'none' });
      this.setData({ chatInput: '' });
    }
  }
});
