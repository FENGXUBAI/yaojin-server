/**
 * 牌型识别和比较
 */
const Patterns = {
  // 牌型类型
  TYPES: {
    INVALID: 'invalid',
    SINGLE: 'single',
    PAIR: 'pair',
    TRIPLE: 'triple',
    STRAIGHT: 'straight',       // 顺子
    DOUBLE_STRAIGHT: 'double_straight', // 连对
    BOMB: 'bomb',               // 炸弹 (4张)
    HONG: 'hong',               // 轰 (6张)
    ROCKET: 'rocket'            // 王炸
  },
  
  /**
   * 识别牌型
   */
  detect(cards) {
    if (!cards || cards.length === 0) {
      return { type: this.TYPES.INVALID };
    }
    
    const sorted = Cards.sortByValue(cards);
    const len = sorted.length;
    
    // 单张
    if (len === 1) {
      return {
        type: this.TYPES.SINGLE,
        value: sorted[0].value,
        cards: sorted
      };
    }
    
    // 对子
    if (len === 2 && sorted[0].value === sorted[1].value) {
      return {
        type: this.TYPES.PAIR,
        value: sorted[0].value,
        cards: sorted
      };
    }
    
    // 王炸
    if (len === 2 && sorted[0].isJoker && sorted[1].isJoker) {
      return {
        type: this.TYPES.ROCKET,
        value: 100,
        cards: sorted,
        isBomb: true
      };
    }
    
    // 三张
    if (len === 3 && this.isSameRank(sorted, 3)) {
      return {
        type: this.TYPES.TRIPLE,
        value: sorted[0].value,
        cards: sorted
      };
    }
    
    // 炸弹 (4张)
    if (len === 4 && this.isSameRank(sorted, 4)) {
      return {
        type: this.TYPES.BOMB,
        value: sorted[0].value,
        cards: sorted,
        isBomb: true,
        bombSize: 4
      };
    }
    
    // 顺子 (5张或更多连续单牌)
    if (len >= 5 && this.isStraight(sorted)) {
      return {
        type: this.TYPES.STRAIGHT,
        value: sorted[0].value,
        length: len,
        cards: sorted
      };
    }
    
    // 连对 (3对或更多连续对子)
    if (len >= 6 && len % 2 === 0 && this.isDoubleStraight(sorted)) {
      return {
        type: this.TYPES.DOUBLE_STRAIGHT,
        value: sorted[0].value,
        length: len / 2,
        cards: sorted
      };
    }
    
    // 轰 (6张相同)
    if (len === 6 && this.isSameRank(sorted, 6)) {
      return {
        type: this.TYPES.HONG,
        value: sorted[0].value,
        cards: sorted,
        isBomb: true,
        bombSize: 6
      };
    }
    
    // 更大的炸弹 (5张或更多相同)
    if (len >= 5 && this.isSameRank(sorted, len)) {
      return {
        type: this.TYPES.BOMB,
        value: sorted[0].value,
        cards: sorted,
        isBomb: true,
        bombSize: len
      };
    }
    
    return { type: this.TYPES.INVALID };
  },
  
  /**
   * 检查是否全是相同点数
   */
  isSameRank(cards, count) {
    if (cards.length < count) return false;
    const firstValue = cards[0].value;
    return cards.slice(0, count).every(c => c.value === firstValue);
  },
  
  /**
   * 检查是否是顺子
   * 要进规则: 
   * 1. 顺子可以包含2、3 (A23, 234, A23456等)
   * 2. 跟K相连的顺子最多带个A (QKA可以, QKA2不行)
   * 3. 不能包含王
   */
  isStraight(cards) {
    // 不能包含王
    if (cards.some(c => c.isJoker)) return false;
    
    // 获取所有可能的顺子值组合
    const possibleValues = cards.map(c => Cards.STRAIGHT_VALUES[c.rank] || []);
    
    // 尝试找到一种组合使得数值连续
    // 使用回溯法或简单的迭代
    const combinations = this.getCombinations(possibleValues);
    
    for (const combo of combinations) {
      // 排序
      combo.sort((a, b) => a - b);
      
      // 检查连续性
      let isConsecutive = true;
      for (let i = 1; i < combo.length; i++) {
        if (combo[i] - combo[i-1] !== 1) {
          isConsecutive = false;
          break;
        }
      }
      
      if (isConsecutive) {
        // 检查特殊规则: 不能同时包含K(13)和2(2或15)
        // 如果顺子包含K(13)，则不能包含2
        // 注意: 2的值可能是2或15。如果包含K(13)，那么2只能作为15出现(13,14,15)。
        // 但是规则说 "QKA2就不能出"。QKA2对应 12,13,14,15。
        // 所以如果包含13(K)和15(2)，则无效。
        // 如果包含13(K)和2(2)，则无效 (因为不连续，除非很长的顺子...但2,3...K是不可能的，因为2是2)
        // 实际上只要检查是否同时包含K和2即可
        const hasK = cards.some(c => c.rank === 'K');
        const has2 = cards.some(c => c.rank === '2');
        
        if (hasK && has2) {
          continue; // 这种组合无效，尝试下一个(虽然对于同一组牌，K和2的存在是固定的)
          // 如果这组牌里有K和2，那么无论怎么取值，都违反了"QKA2不能出"的规则
          // 除非有一种取值让它们不构成顺子？不，我们是在找合法的顺子组合。
          // 如果找到了连续组合，但包含K和2，那么这个顺子是不合法的。
          // 由于K和2的存在是物理牌决定的，所以只要有K和2，就不能组成顺子。
          return false;
        }
        
        return true;
      }
    }
    
    return false;
  },
  
  /**
   * 获取所有可能的组合
   */
  getCombinations(arrays) {
    if (arrays.length === 0) return [[]];
    const first = arrays[0];
    const rest = this.getCombinations(arrays.slice(1));
    const result = [];
    for (const val of first) {
      for (const r of rest) {
        result.push([val, ...r]);
      }
    }
    return result;
  },
  
  /**
   * 检查是否是连对
   * 要进规则: 同顺子规则
   */
  isDoubleStraight(cards) {
    // 不能包含王
    if (cards.some(c => c.isJoker)) return false;
    
    // 按Rank分组
    const groups = {};
    for (const c of cards) {
      if (!groups[c.rank]) groups[c.rank] = 0;
      groups[c.rank]++;
    }
    
    // 必须每种Rank都有2张
    const ranks = Object.keys(groups);
    if (ranks.some(r => groups[r] !== 2)) return false;
    
    // 将Ranks转换为单张牌进行顺子检测
    // 构造一个虚拟的手牌，每种Rank取一张
    const virtualHand = ranks.map(r => ({ rank: r, isJoker: false }));
    
    return this.isStraight(virtualHand);
  },
  
  /**
   * 比较两个牌型, 返回true表示pattern1能压过pattern2
   */
  canBeat(pattern1, pattern2) {
    if (!pattern1 || pattern1.type === this.TYPES.INVALID) {
      return false;
    }
    if (!pattern2 || pattern2.type === this.TYPES.INVALID) {
      return true;
    }
    
    // 王炸最大
    if (pattern1.type === this.TYPES.ROCKET) {
      return true;
    }
    if (pattern2.type === this.TYPES.ROCKET) {
      return false;
    }
    
    // 炸弹比较
    if (pattern1.isBomb && pattern2.isBomb) {
      // 先比较炸弹大小 (张数)
      if (pattern1.bombSize !== pattern2.bombSize) {
        return pattern1.bombSize > pattern2.bombSize;
      }
      // 再比较点数
      return pattern1.value > pattern2.value;
    }
    
    // 炸弹压普通牌
    if (pattern1.isBomb && !pattern2.isBomb) {
      return true;
    }
    if (!pattern1.isBomb && pattern2.isBomb) {
      return false;
    }
    
    // 相同类型比较
    if (pattern1.type !== pattern2.type) {
      return false;
    }
    
    // 顺子和连对需要长度相同
    if (pattern1.type === this.TYPES.STRAIGHT || 
        pattern1.type === this.TYPES.DOUBLE_STRAIGHT) {
      if (pattern1.length !== pattern2.length) {
        return false;
      }
    }
    
    return pattern1.value > pattern2.value;
  },
  
  /**
   * 获取提示 (找到能压过的牌)
   */
  getHints(hand, lastPattern) {
    const hints = [];
    
    if (!lastPattern || lastPattern.type === this.TYPES.INVALID) {
      // 自由出牌, 返回最小的单张
      const sorted = Cards.sortByValue(hand);
      if (sorted.length > 0) {
        hints.push([sorted[sorted.length - 1]]);
      }
      return hints;
    }
    
    // 根据上家牌型找能压过的牌
    const targetType = lastPattern.type;
    const targetValue = lastPattern.value;
    
    // 按点数分组
    const groups = this.groupByValue(hand);
    
    switch (targetType) {
      case this.TYPES.SINGLE:
        // 找更大的单张
        for (const [value, cards] of Object.entries(groups)) {
          if (parseInt(value) > targetValue) {
            hints.push([cards[0]]);
          }
        }
        break;
        
      case this.TYPES.PAIR:
        // 找更大的对子
        for (const [value, cards] of Object.entries(groups)) {
          if (cards.length >= 2 && parseInt(value) > targetValue) {
            hints.push(cards.slice(0, 2));
          }
        }
        break;
        
      case this.TYPES.STRAIGHT:
        // 找更大的顺子
        hints.push(...this.findStraights(hand, lastPattern.length, targetValue));
        break;
        
      case this.TYPES.DOUBLE_STRAIGHT:
        // 找更大的连对
        hints.push(...this.findDoubleStraights(hand, lastPattern.length, targetValue));
        break;
    }
    
    // 添加炸弹选项
    if (!lastPattern.isBomb) {
      hints.push(...this.findBombs(hand, 0));
    } else {
      hints.push(...this.findBombs(hand, targetValue, lastPattern.bombSize));
    }
    
    return hints;
  },
  
  /**
   * 按点数分组
   */
  groupByValue(cards) {
    const groups = {};
    for (const card of cards) {
      if (!groups[card.value]) {
        groups[card.value] = [];
      }
      groups[card.value].push(card);
    }
    return groups;
  },
  
  /**
   * 找顺子
   */
  findStraights(hand, length, minValue = 0) {
    const results = [];
    const sorted = hand.filter(c => c.value < 15).sort((a, b) => a.value - b.value);
    
    // 简化: 只找从某个起点开始的连续牌
    for (let i = 0; i <= sorted.length - length; i++) {
      const straight = [sorted[i]];
      let lastValue = sorted[i].value;
      
      for (let j = i + 1; j < sorted.length && straight.length < length; j++) {
        if (sorted[j].value === lastValue + 1) {
          straight.push(sorted[j]);
          lastValue = sorted[j].value;
        } else if (sorted[j].value === lastValue) {
          continue; // 跳过相同点数
        } else {
          break;
        }
      }
      
      if (straight.length === length && straight[straight.length - 1].value > minValue) {
        results.push(straight);
      }
    }
    
    return results;
  },
  
  /**
   * 找连对
   */
  findDoubleStraights(hand, pairCount, minValue = 0) {
    const results = [];
    const groups = this.groupByValue(hand);
    
    // 找有对子的点数
    const pairValues = Object.entries(groups)
      .filter(([v, cards]) => cards.length >= 2 && parseInt(v) < 15)
      .map(([v]) => parseInt(v))
      .sort((a, b) => a - b);
    
    // 找连续的对子
    for (let i = 0; i <= pairValues.length - pairCount; i++) {
      let valid = true;
      for (let j = 1; j < pairCount; j++) {
        if (pairValues[i + j] - pairValues[i + j - 1] !== 1) {
          valid = false;
          break;
        }
      }
      
      if (valid && pairValues[i + pairCount - 1] > minValue) {
        const cards = [];
        for (let j = 0; j < pairCount; j++) {
          cards.push(...groups[pairValues[i + j]].slice(0, 2));
        }
        results.push(cards);
      }
    }
    
    return results;
  },
  
  /**
   * 找炸弹
   */
  findBombs(hand, minValue = 0, minSize = 4) {
    const results = [];
    const groups = this.groupByValue(hand);
    
    // 找4张或更多相同的
    for (const [value, cards] of Object.entries(groups)) {
      const v = parseInt(value);
      if (cards.length >= 4 && (v > minValue || cards.length > minSize)) {
        results.push(cards.slice(0, Math.max(4, minSize)));
      }
    }
    
    // 王炸
    const jokers = hand.filter(c => c.isJoker);
    if (jokers.length === 2) {
      results.push(jokers);
    }
    
    return results;
  },
  
  /**
   * 获取牌型名称
   */
  getTypeName(typeOrPattern) {
    const type = typeof typeOrPattern === 'object' ? typeOrPattern.type : typeOrPattern;
    const names = {
      [this.TYPES.SINGLE]: '单张',
      [this.TYPES.PAIR]: '对子',
      [this.TYPES.TRIPLE]: '三张',
      [this.TYPES.STRAIGHT]: '顺子',
      [this.TYPES.DOUBLE_STRAIGHT]: '连对',
      [this.TYPES.BOMB]: '炸弹',
      [this.TYPES.HONG]: '轰',
      [this.TYPES.ROCKET]: '王炸'
    };
    return names[type] || '';
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Patterns;
}
