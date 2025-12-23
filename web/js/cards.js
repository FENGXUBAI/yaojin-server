/**
 * 扑克牌定义和工具函数
 * 要进规则: 3是主牌（最大）
 */
const Cards = {
  // 花色
  SUITS: ['♠', '♥', '♦', '♣'],
  
  // 点数 (按大小排序 - 要进规则)
  RANKS: ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3'],
  
  // 点数值映射 (要进规则: 3最大)
  RANK_VALUES: {
    '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15,
    '3': 18, // 3是主牌，最大
    'joker': 16, 'JOKER': 17
  },

  // 顺子数值映射 (用于检测顺子)
  // A可以当1或14, 2只能当2, 3只能当3 (根据用户规则: QKA2不能出, 但2-K可以出)
  STRAIGHT_VALUES: {
    'A': [1, 14],
    '2': [2],
    '3': [3],
    '4': [4], '5': [5], '6': [6], '7': [7], '8': [8], '9': [9],
    '10': [10], 'J': [11], 'Q': [12], 'K': [13]
  },
  
  /**
   * 生成一副牌
   */
  generateDeck() {
    const deck = [];
    
    // 普通牌
    for (const suit of this.SUITS) {
      for (const rank of this.RANKS) {
        const isRed = suit === '♥' || suit === '♦';
        deck.push({
          id: `${suit}${rank}`,
          suit,
          rank,
          displayRank: rank,
          value: this.RANK_VALUES[rank],
          isRed
        });
      }
    }
    
    // 大小王
    deck.push({
      id: 'joker',
      suit: '',
      rank: 'joker',
      displayRank: '小',
      value: 16,
      isJoker: true,
      isSmallJoker: true
    });
    
    deck.push({
      id: 'JOKER',
      suit: '',
      rank: 'JOKER',
      displayRank: '大',
      value: 17,
      isJoker: true,
      isBigJoker: true
    });
    
    return deck;
  },
  
  /**
   * 洗牌
   */
  shuffle(deck) {
    return Utils.shuffle(deck);
  },
  
  /**
   * 发牌 (3人游戏, 每人17张, 底牌3张)
   */
  deal(deck) {
    const shuffled = this.shuffle(deck);
    return {
      hands: [
        shuffled.slice(0, 17),
        shuffled.slice(17, 34),
        shuffled.slice(34, 51)
      ],
      landlordCards: shuffled.slice(51, 54)
    };
  },
  
  /**
   * 发牌 (要进规则, 每人13张, 剩2张)
   */
  dealYaojin(deck, playerCount = 4) {
    const shuffled = this.shuffle(deck);
    const cardsPerPlayer = Math.floor(54 / playerCount);
    const hands = [];
    
    for (let i = 0; i < playerCount; i++) {
      hands.push(shuffled.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer));
    }
    
    // 剩余牌 (如果有)
    const remaining = shuffled.slice(playerCount * cardsPerPlayer);
    
    return { hands, remaining };
  },
  
  /**
   * 按点数排序 (大到小)
   */
  sortByValue(cards) {
    return [...cards].sort((a, b) => b.value - a.value);
  },
  
  /**
   * 获取牌的值
   */
  getValue(card) {
    return this.RANK_VALUES[card.rank] || 0;
  },
  
  /**
   * 创建卡牌DOM元素
   */
  createCardElement(card, index = 0) {
    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.id = card.id;
    div.dataset.index = index;
    
    // 设置颜色类
    if (card.isRed || (card.isJoker && card.isBigJoker)) {
      div.classList.add('red');
    } else {
      div.classList.add('black');
    }
    
    if (card.isJoker) {
      // 王牌布局
      const text = card.isBigJoker ? 'JOKER' : 'joker';
      
      const topDiv = document.createElement('div');
      topDiv.className = 'card-top';
      topDiv.style.writingMode = 'vertical-rl';
      topDiv.style.textOrientation = 'upright';
      topDiv.style.fontSize = '10px';
      topDiv.style.letterSpacing = '2px';
      topDiv.textContent = text;
      
      const centerDiv = document.createElement('div');
      centerDiv.className = 'card-center';
      centerDiv.textContent = '🤡';
      
      const bottomDiv = document.createElement('div');
      bottomDiv.className = 'card-bottom';
      bottomDiv.style.writingMode = 'vertical-rl';
      bottomDiv.style.textOrientation = 'upright';
      bottomDiv.style.fontSize = '10px';
      bottomDiv.style.letterSpacing = '2px';
      bottomDiv.textContent = text;

      div.appendChild(topDiv);
      div.appendChild(centerDiv);
      div.appendChild(bottomDiv);
    } else {
      // 普通牌布局
      const rank = card.displayRank;
      const suit = card.suit;
      
      const topDiv = document.createElement('div');
      topDiv.className = 'card-top';
      topDiv.innerHTML = `<span>${rank}</span><span>${suit}</span>`;
      
      const centerDiv = document.createElement('div');
      centerDiv.className = 'card-center';
      centerDiv.textContent = suit;
      
      const bottomDiv = document.createElement('div');
      bottomDiv.className = 'card-bottom';
      bottomDiv.innerHTML = `<span>${rank}</span><span>${suit}</span>`;
      
      div.appendChild(topDiv);
      div.appendChild(centerDiv);
      div.appendChild(bottomDiv);
    }
    
    return div;
  },
  
  /**
   * 格式化牌为字符串
   */
  formatCard(card) {
    if (!card) return '';
    if (card.isJoker) {
      return card.isBigJoker ? '大王' : '小王';
    }
    return `${card.suit}${card.rank}`;
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Cards;
}
