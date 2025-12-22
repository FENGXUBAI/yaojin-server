/**
 * 游戏核心逻辑 - 微信小程序版本
 * 斗地主牌型检测和出牌提示
 */

// 牌值映射
const CARD_VALUES = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15, 'JOKER': 16, 'joker': 17
};

// 获取牌面值
function getCardValue(card) {
  if (!card) return 0;
  const rank = card.rank || card.value || card;
  if (typeof rank === 'number') return rank;
  return CARD_VALUES[rank] || 0;
}

// 获取牌面
function getCardRank(card) {
  return card.rank || card.value || card;
}

// 牌型枚举
const PatternType = {
  INVALID: 'invalid',
  SINGLE: 'single',
  PAIR: 'pair',
  TRIPLE: 'triple',
  TRIPLE_ONE: 'triple_one',
  TRIPLE_PAIR: 'triple_pair',
  STRAIGHT: 'straight',
  DOUBLE_STRAIGHT: 'double_straight',
  TRIPLE_STRAIGHT: 'triple_straight',
  AIRPLANE_SINGLE: 'airplane_single',
  AIRPLANE_PAIR: 'airplane_pair',
  FOUR_TWO: 'four_two',
  FOUR_PAIRS: 'four_pairs',
  BOMB: 'bomb',
  ROCKET: 'rocket'
};

// 按牌值分组
function groupByValue(cards) {
  const groups = {};
  for (const card of cards) {
    const value = getCardValue(card);
    if (!groups[value]) groups[value] = [];
    groups[value].push(card);
  }
  return groups;
}

// 检测牌型
function detectPattern(cards) {
  if (!cards || cards.length === 0) {
    return { type: PatternType.INVALID, value: 0 };
  }
  
  const n = cards.length;
  const groups = groupByValue(cards);
  const counts = Object.values(groups).map(g => g.length);
  const values = Object.keys(groups).map(Number).sort((a, b) => a - b);
  
  // 王炸
  if (n === 2) {
    const v1 = getCardValue(cards[0]);
    const v2 = getCardValue(cards[1]);
    if ((v1 === 16 && v2 === 17) || (v1 === 17 && v2 === 16)) {
      return { type: PatternType.ROCKET, value: 99, isBomb: true };
    }
  }
  
  // 单张
  if (n === 1) {
    return { type: PatternType.SINGLE, value: getCardValue(cards[0]) };
  }
  
  // 对子
  if (n === 2 && counts[0] === 2) {
    return { type: PatternType.PAIR, value: values[0] };
  }
  
  // 三张
  if (n === 3 && counts[0] === 3) {
    return { type: PatternType.TRIPLE, value: values[0] };
  }
  
  // 炸弹
  if (n === 4 && counts[0] === 4) {
    return { type: PatternType.BOMB, value: values[0], isBomb: true };
  }
  
  // 三带一
  if (n === 4) {
    const tripleValue = values.find(v => groups[v].length === 3);
    if (tripleValue && values.some(v => groups[v].length === 1)) {
      return { type: PatternType.TRIPLE_ONE, value: tripleValue };
    }
  }
  
  // 三带一对
  if (n === 5) {
    const tripleValue = values.find(v => groups[v].length === 3);
    const pairValue = values.find(v => groups[v].length === 2);
    if (tripleValue && pairValue) {
      return { type: PatternType.TRIPLE_PAIR, value: tripleValue };
    }
  }
  
  // 顺子 (5张或更多连续单张)
  if (n >= 5 && counts.every(c => c === 1)) {
    if (values.every(v => v <= 14)) { // 不能包含2和王
      const isConsecutive = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
      if (isConsecutive) {
        return { type: PatternType.STRAIGHT, value: Math.max(...values), length: n };
      }
    }
  }
  
  // 连对 (3对或更多连续对子)
  if (n >= 6 && n % 2 === 0 && counts.every(c => c === 2)) {
    if (values.every(v => v <= 14)) {
      const isConsecutive = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
      if (isConsecutive) {
        return { type: PatternType.DOUBLE_STRAIGHT, value: Math.max(...values), length: n / 2 };
      }
    }
  }
  
  // 飞机 (2个或更多连续三张)
  if (n >= 6 && n % 3 === 0) {
    const tripleValues = values.filter(v => groups[v].length >= 3).sort((a, b) => a - b);
    if (tripleValues.length >= 2 && tripleValues.every(v => v <= 14)) {
      const isConsecutive = tripleValues.every((v, i) => i === 0 || v === tripleValues[i - 1] + 1);
      if (isConsecutive && tripleValues.length * 3 === n) {
        return { type: PatternType.TRIPLE_STRAIGHT, value: Math.max(...tripleValues), length: tripleValues.length };
      }
    }
  }
  
  // 四带二
  if (n === 6) {
    const fourValue = values.find(v => groups[v].length === 4);
    if (fourValue) {
      return { type: PatternType.FOUR_TWO, value: fourValue };
    }
  }
  
  return { type: PatternType.INVALID, value: 0 };
}

// 判断是否能压过
function canBeat(myPattern, lastPattern) {
  if (!lastPattern || lastPattern.type === PatternType.INVALID) {
    return myPattern.type !== PatternType.INVALID;
  }
  
  // 王炸最大
  if (myPattern.type === PatternType.ROCKET) {
    return true;
  }
  if (lastPattern.type === PatternType.ROCKET) {
    return false;
  }
  
  // 炸弹可以压非炸弹
  if (myPattern.isBomb && !lastPattern.isBomb) {
    return true;
  }
  if (!myPattern.isBomb && lastPattern.isBomb) {
    return false;
  }
  
  // 同类型比大小
  if (myPattern.type === lastPattern.type) {
    // 检查长度（顺子、连对等）
    if (myPattern.length && lastPattern.length && myPattern.length !== lastPattern.length) {
      return false;
    }
    return myPattern.value > lastPattern.value;
  }
  
  return false;
}

// 获取出牌提示
function getHintOptions(hand, lastPattern) {
  const hints = [];
  
  if (!lastPattern || lastPattern.type === PatternType.INVALID) {
    // 自由出牌，返回最小的单张
    if (hand.length > 0) {
      const sorted = [...hand].sort((a, b) => getCardValue(a) - getCardValue(b));
      hints.push([sorted[0]]);
    }
    return hints;
  }
  
  // 根据上家牌型找能压过的牌
  const sorted = [...hand].sort((a, b) => getCardValue(a) - getCardValue(b));
  
  // 单张
  if (lastPattern.type === PatternType.SINGLE) {
    for (const card of sorted) {
      if (getCardValue(card) > lastPattern.value) {
        hints.push([card]);
        if (hints.length >= 3) break;
      }
    }
  }
  
  // 对子
  if (lastPattern.type === PatternType.PAIR) {
    const groups = groupByValue(sorted);
    for (const value of Object.keys(groups).sort((a, b) => a - b)) {
      if (groups[value].length >= 2 && Number(value) > lastPattern.value) {
        hints.push(groups[value].slice(0, 2));
        if (hints.length >= 3) break;
      }
    }
  }
  
  // 三张
  if (lastPattern.type === PatternType.TRIPLE) {
    const groups = groupByValue(sorted);
    for (const value of Object.keys(groups).sort((a, b) => a - b)) {
      if (groups[value].length >= 3 && Number(value) > lastPattern.value) {
        hints.push(groups[value].slice(0, 3));
        if (hints.length >= 3) break;
      }
    }
  }
  
  // 炸弹始终可选
  const groups = groupByValue(sorted);
  for (const value of Object.keys(groups)) {
    if (groups[value].length === 4) {
      const bombPattern = { type: PatternType.BOMB, value: Number(value), isBomb: true };
      if (canBeat(bombPattern, lastPattern)) {
        hints.push(groups[value]);
      }
    }
  }
  
  // 王炸
  const jokers = sorted.filter(c => getCardValue(c) >= 16);
  if (jokers.length === 2) {
    hints.push(jokers);
  }
  
  return hints;
}

module.exports = {
  PatternType,
  detectPattern,
  canBeat,
  getHintOptions,
  getCardValue,
  getCardRank
};
