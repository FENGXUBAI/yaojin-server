/**
 * 游戏逻辑
 */
const Game = {
  // 游戏状态
  state: null,
  
  // 选中的牌
  selectedCards: new Set(),
  
  // AI思考延迟
  AI_DELAY: 1000,
  
  // 上一局结果（用于进贡）
  lastRoundResult: null,
  
  /**
   * 初始化游戏
   */
  init(playerName = '玩家') {
    const deck = Cards.generateDeck();
    const { hands } = Cards.deal(deck);
    
    // 初始化状态
    this.state = {
      status: 'playing',
      currentPlayer: 0,
      players: [
        { name: playerName, hand: Cards.sortByValue(hands[0]), isHuman: true },
        { name: '机器人A', hand: Cards.sortByValue(hands[1]), isHuman: false },
        { name: '机器人B', hand: Cards.sortByValue(hands[2]), isHuman: false }
      ],
      lastPlay: null,
      lastPlayIndex: -1,
      passCount: 0,
      finishedOrder: [],
      multiplier: 1,
      tributePhase: null // 进贡阶段状态
    };
    
    // 如果有上一局结果，处理进贡
    if (this.lastRoundResult && this.lastRoundResult.finishedOrder.length >= 3) {
      this.processTribute();
    } else {
      // 第一局：找♠4先手
      this.state.currentPlayer = this.findSpade4Owner();
    }
    
    this.selectedCards.clear();
    return this.state;
  },
  
  /**
   * 找♠4持有者
   */
  findSpade4Owner() {
    for (let i = 0; i < this.state.players.length; i++) {
      const hand = this.state.players[i].hand;
      if (hand.some(c => c.rank === '4' && c.suit === '♠')) {
        return i;
      }
    }
    return 0;
  },
  
  /**
   * 检查是否革命（需要进贡的人有王轰）
   */
  checkRevolution() {
    if (!this.lastRoundResult) return false;
    const finishedOrder = this.lastRoundResult.finishedOrder;
    if (finishedOrder.length < 3) return false;
    
    // 第三名需要进贡
    const donorIdx = finishedOrder[2];
    const donorHand = this.state.players[donorIdx].hand;
    
    // 检查是否有王轰（大王 + 小王）
    const hasBig = donorHand.some(c => c.isJoker && c.rank === 'JOKER_BIG');
    const hasSmall = donorHand.some(c => c.isJoker && c.rank === 'JOKER_SMALL');
    
    return hasBig && hasSmall;
  },
  
  /**
   * 处理进贡逻辑
   */
  processTribute() {
    const finishedOrder = this.lastRoundResult.finishedOrder;
    
    // 检查革命
    if (this.checkRevolution()) {
      console.log('革命！不需要进贡');
      // 革命：第一名先出
      this.state.currentPlayer = finishedOrder[0];
      return;
    }
    
    // 第三名给第二名最大的1张牌
    const donorIdx = finishedOrder[2]; // 第三名
    const receiverIdx = finishedOrder[1]; // 第二名
    
    // 设置进贡阶段状态（等待进贡）
    this.state.tributePhase = {
      type: 'pay', // 进贡阶段
      payFrom: donorIdx, // 谁进贡
      payTo: receiverIdx, // 给谁
      count: 1 // 进贡几张
    };
    
    // 如果进贡者是AI，自动处理
    if (!this.state.players[donorIdx].isHuman) {
      this.aiPayTribute(donorIdx, receiverIdx);
    }
  },
  
  /**
   * AI进贡逻辑
   */
  aiPayTribute(fromIdx, toIdx) {
    const hand = this.state.players[fromIdx].hand;
    // AI选择最大的牌进贡
    const tributeCard = hand[0]; // 已排序，第一张最大
    
    if (tributeCard) {
      hand.shift(); // 移除最大的牌
      tributeCard.isTribute = true;
      this.state.players[toIdx].hand.push(tributeCard);
      this.state.players[toIdx].hand = Cards.sortByValue(this.state.players[toIdx].hand);
      
      // 进入回贡阶段
      this.state.tributePhase = {
        type: 'return',
        returnFrom: toIdx,
        returnTo: fromIdx,
        tributeCard: tributeCard
      };
      
      // 如果回贡者是AI，自动处理
      if (!this.state.players[toIdx].isHuman) {
        this.aiReturnTribute(toIdx, fromIdx);
      }
    }
  },
  
  /**
   * 玩家进贡
   */
  payTribute(cardId) {
    if (!this.state.tributePhase || this.state.tributePhase.type !== 'pay') {
      return { success: false, message: '不在进贡阶段' };
    }
    
    const { payFrom, payTo } = this.state.tributePhase;
    if (payFrom !== 0) {
      return { success: false, message: '不是你进贡' };
    }
    
    const hand = this.state.players[0].hand;
    const cardIdx = hand.findIndex(c => c.id === cardId);
    if (cardIdx < 0) {
      return { success: false, message: '选择的牌不在手牌中' };
    }
    
    const card = hand[cardIdx];
    // 验证是否是最大的牌
    // 检查手牌中是否有比这张牌大的
    const maxVal = hand[0].value;
    if (card.value < maxVal) {
      return { success: false, message: '必须进贡最大的牌' };
    }
    
    // 执行进贡
    hand.splice(cardIdx, 1);
    card.isTribute = true;
    this.state.players[payTo].hand.push(card);
    this.state.players[payTo].hand = Cards.sortByValue(this.state.players[payTo].hand);
    
    // 进入回贡阶段
    this.state.tributePhase = {
      type: 'return',
      returnFrom: payTo,
      returnTo: payFrom,
      tributeCard: card
    };
    
    // 如果回贡者是AI，自动处理
    if (!this.state.players[payTo].isHuman) {
      this.aiReturnTribute(payTo, payFrom);
    }
    
    return { success: true, message: '进贡成功' };
  },
  
  /**
   * AI回贡逻辑
   */
  aiReturnTribute(fromIdx, toIdx) {
    const hand = this.state.players[fromIdx].hand;
    // AI选择最小的牌回贡
    const returnCard = hand[hand.length - 1];
    if (returnCard) {
      hand.pop();
      this.state.players[toIdx].hand.push(returnCard);
      this.state.players[toIdx].hand = Cards.sortByValue(this.state.players[toIdx].hand);
    }
    this.state.tributePhase = null;
  },
  
  /**
   * 玩家回贡
   */
  returnTribute(cardId) {
    if (!this.state.tributePhase || this.state.tributePhase.type !== 'return') {
      return { success: false, message: '不在回贡阶段' };
    }
    
    const { returnFrom, returnTo } = this.state.tributePhase;
    if (returnFrom !== 0) {
      return { success: false, message: '不是你回贡' };
    }
    
    const hand = this.state.players[0].hand;
    const cardIdx = hand.findIndex(c => c.id === cardId);
    if (cardIdx < 0) {
      return { success: false, message: '选择的牌不在手牌中' };
    }
    
    const returnCard = hand.splice(cardIdx, 1)[0];
    this.state.players[returnTo].hand.push(returnCard);
    this.state.players[returnTo].hand = Cards.sortByValue(this.state.players[returnTo].hand);
    
    this.state.tributePhase = null;
    return { success: true, message: '回贡成功' };
  },
  
  /**
   * 获取当前玩家
   */
  getCurrentPlayer() {
    return this.state.players[this.state.currentPlayer];
  },
  
  /**
   * 玩家出牌
   */
  playCards(cardIds) {
    if (this.state.currentPlayer !== 0) {
      return { success: false, message: '还没轮到你' };
    }
    
    const player = this.state.players[0];
    const cards = cardIds.map(id => player.hand.find(c => c.id === id)).filter(Boolean);
    
    if (cards.length === 0) {
      return { success: false, message: '请选择要出的牌' };
    }
    
    const pattern = Patterns.detect(cards);
    if (pattern.type === Patterns.TYPES.INVALID) {
      return { success: false, message: '无效的牌型' };
    }
    
    // 检查是否能压过上家
    if (this.state.lastPlay && this.state.lastPlayIndex !== 0) {
      if (!Patterns.canBeat(pattern, this.state.lastPlay)) {
        return { success: false, message: '压不过上家的牌' };
      }
    }
    
    // 移除已出的牌
    for (const card of cards) {
      const idx = player.hand.findIndex(c => c.id === card.id);
      if (idx >= 0) player.hand.splice(idx, 1);
    }
    
    this.state.lastPlay = pattern;
    this.state.lastPlayIndex = 0;
    this.state.passCount = 0;
    
    // 炸弹加倍
    if (pattern.isBomb) {
      this.state.multiplier *= 2;
    }
    
    // 检查是否出完
    if (player.hand.length === 0) {
      this.state.finishedOrder.push(0);
      if (this.checkGameOver()) {
        return { 
          success: true, 
          pattern, 
          gameOver: true, 
          isWin: true 
        };
      }
    }
    
    this.selectedCards.clear();
    this.nextPlayer();
    
    return { success: true, pattern };
  },
  
  /**
   * 玩家不要
   */
  pass() {
    if (this.state.currentPlayer !== 0) {
      return { success: false, message: '还没轮到你' };
    }
    
    // 必须出牌的情况
    if (this.state.lastPlayIndex === -1 || this.state.lastPlayIndex === 0) {
      return { success: false, message: '你必须出牌' };
    }
    
    this.state.passCount++;
    this.selectedCards.clear();
    this.nextPlayer();
    
    return { success: true };
  },
  
  /**
   * 获取提示
   */
  getHint() {
    const player = this.state.players[0];
    const lastPattern = (this.state.lastPlayIndex === 0 || this.state.lastPlayIndex === -1) 
      ? null 
      : this.state.lastPlay;
    
    return Patterns.getHints(player.hand, lastPattern);
  },
  
  /**
   * 切换到下一个玩家
   */
  nextPlayer() {
    let nextIdx = (this.state.currentPlayer + 1) % 3;
    
    // 跳过已完成的玩家
    let attempts = 0;
    while (this.state.finishedOrder.includes(nextIdx) && attempts < 3) {
      nextIdx = (nextIdx + 1) % 3;
      attempts++;
    }
    
    // 检查是否所有人都pass了
    if (this.state.passCount >= 2) {
      // 轮到出最后一手牌的人, 他可以自由出牌
      this.state.lastPlay = null;
      this.state.lastPlayIndex = -1;
      this.state.passCount = 0;
    }
    
    this.state.currentPlayer = nextIdx;
  },
  
  /**
   * AI出牌
   */
  async aiTurn() {
    const playerIdx = this.state.currentPlayer;
    const player = this.state.players[playerIdx];
    
    if (player.isHuman || this.state.finishedOrder.includes(playerIdx)) {
      return null;
    }
    
    await Utils.sleep(this.AI_DELAY);
    
    // 获取可出的牌
    const lastPattern = (this.state.lastPlayIndex === -1 || this.state.lastPlayIndex === playerIdx) 
      ? null 
      : this.state.lastPlay;
    
    const hints = Patterns.getHints(player.hand, lastPattern);
    
    if (hints.length === 0) {
      // 不出
      this.state.passCount++;
      this.nextPlayer();
      return { type: 'pass', playerIdx };
    }
    
    // 选择第一个提示
    const cards = hints[0];
    const pattern = Patterns.detect(cards);
    
    // 移除已出的牌
    for (const card of cards) {
      const idx = player.hand.findIndex(c => c.id === card.id);
      if (idx >= 0) player.hand.splice(idx, 1);
    }
    
    this.state.lastPlay = pattern;
    this.state.lastPlayIndex = playerIdx;
    this.state.passCount = 0;
    
    // 炸弹加倍
    if (pattern.isBomb) {
      this.state.multiplier *= 2;
    }
    
    // 检查是否出完
    let gameOver = false;
    if (player.hand.length === 0) {
      this.state.finishedOrder.push(playerIdx);
      gameOver = this.checkGameOver();
    }
    
    this.nextPlayer();
    
    return {
      type: 'play',
      playerIdx,
      cards,
      pattern,
      gameOver
    };
  },
  
  /**
   * 检查游戏是否结束
   */
  checkGameOver() {
    // 只剩一个人没出完就结束
    const remaining = [0, 1, 2].filter(i => !this.state.finishedOrder.includes(i));
    if (remaining.length <= 1) {
      if (remaining.length === 1) {
        this.state.finishedOrder.push(remaining[0]);
      }
      this.state.status = 'finished';
      return true;
    }
    return false;
  },
  
  /**
   * 获取游戏结果
   */
  getResult() {
    const isWin = this.state.finishedOrder[0] === 0;
    const scores = this.state.players.map((p, i) => {
      const rank = this.state.finishedOrder.indexOf(i);
      let score = 0;
      if (rank === 0) score = 100 * this.state.multiplier;
      else if (rank === 1) score = 0;
      else score = -50 * this.state.multiplier;
      
      return { name: p.name, score, rank: rank + 1 };
    });
    
    // 保存这一局结果用于下一局进贡
    this.lastRoundResult = {
      finishedOrder: [...this.state.finishedOrder],
      multiplier: this.state.multiplier
    };
    
    return { isWin, scores, multiplier: this.state.multiplier };
  },
  
  /**
   * 切换选中状态
   */
  toggleSelectCard(cardId) {
    if (this.selectedCards.has(cardId)) {
      this.selectedCards.delete(cardId);
    } else {
      this.selectedCards.add(cardId);
    }
    return Array.from(this.selectedCards);
  },
  
  /**
   * 清空选中
   */
  clearSelection() {
    this.selectedCards.clear();
  },
  
  /**
   * 选中提示的牌
   */
  selectHint(hint) {
    this.selectedCards.clear();
    for (const card of hint) {
      this.selectedCards.add(card.id);
    }
    return Array.from(this.selectedCards);
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Game;
}
