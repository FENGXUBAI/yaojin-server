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
  
  /**
   * 初始化游戏
   */
  init(playerName = '玩家') {
    const deck = Cards.generateDeck();
    const { hands } = Cards.deal(deck);
    
    // 玩家是第一个
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
      multiplier: 1
    };
    
    this.selectedCards.clear();
    return this.state;
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
