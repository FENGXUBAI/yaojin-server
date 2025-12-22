/**
 * 耀金斗地主 - 游戏核心模块
 * 平台无关的纯TypeScript实现
 * 可用于: 浏览器、Node.js、微信小程序、React Native
 */

// === 类型定义 ===
export type Suit = '♠' | '♥' | '♦' | '♣';
export type NormalRank = '4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'|'2'|'3';
export type JokerRank = 'JOKER_SMALL' | 'JOKER_BIG';
export type Rank = NormalRank | JokerRank;

export interface Card {
  suit?: Suit;
  rank: Rank;
  isJoker: boolean;
  sortValue: number;
  isTribute?: boolean;
}

export interface Pattern {
  type: PatternType;
  cards: Card[];
  strength: number;
  label: string;
  by?: number;
  extra?: {
    isKingBomb?: boolean;
    [key: string]: any;
  };
}

export type PatternType = 
  | 'SINGLE' 
  | 'PAIR' 
  | 'TRIPLE' 
  | 'FOUR' 
  | 'STRAIGHT' 
  | 'DOUBLE_SEQUENCE';

export interface TablePlay {
  by: number;
  cards: Card[];
}

export interface PendingReturn {
  actionBy: number;
  returnTo: number;
  count: number;
}

export interface GameState {
  gameId: string;
  playerCount: number;
  hands: Card[][];
  currentPlayer: number;
  lastPlay: Pattern | null;
  lastPlayOwner: number;
  passesInRow: number;
  finishedOrder: number[];
  status: 'waiting' | 'playing' | 'tribute_return' | 'finished';
  tablePlays: TablePlay[];
  currentTrickPlays: TablePlay[];
  multiplier: number;
  revolution: boolean;
  pendingReturns: PendingReturn[];
}

export type PlayAction = { type: 'play'; cards: Card[] };
export type PassAction = { type: 'pass' };
export type ReturnTributeAction = { type: 'returnTribute'; cards: Card[] };
export type Action = PlayAction | PassAction | ReturnTributeAction;

// === 常量 ===
export const normalRanks: NormalRank[] = ['4','5','6','7','8','9','10','J','Q','K','A','2','3'];
export const suits: Suit[] = ['♠','♥','♦','♣'];
export const singleOrder: Rank[] = ['JOKER_BIG','JOKER_SMALL','3','2','A','K','Q','J','10','9','8','7','6','5','4'];

const singleOrderMap = new Map(singleOrder.map((r, i) => [r, singleOrder.length - i]));
export const straightRing: NormalRank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const straightRingIndex = new Map(straightRing.map((r, i) => [r, i]));

// === 卡牌工具函数 ===
export function makeCard(rank: Rank, suit?: Suit): Card {
  const isJoker = rank === 'JOKER_BIG' || rank === 'JOKER_SMALL';
  const sortValue = singleOrderMap.get(rank) ?? 0;
  return { rank, suit, isJoker, sortValue };
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  deck.push(makeCard('JOKER_SMALL'));
  deck.push(makeCard('JOKER_BIG'));
  for (const s of suits) {
    for (const r of normalRanks) {
      deck.push(makeCard(r, s));
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = [...arr];
  let random = Math.random;
  if (seed !== undefined) {
    let t = seed;
    random = () => {
      t = (t * 48271) % 0x7fffffff;
      return (t % 10000) / 10000;
    };
  }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function formatCard(c: Card): string {
  if (c.isJoker) return c.rank === 'JOKER_BIG' ? '🃏大王' : '🃏小王';
  return `${c.suit}${c.rank}`;
}

export function compareSingleOrGroupByRank(a: Rank, b: Rank): number {
  const va = singleOrderMap.get(a) ?? 0;
  const vb = singleOrderMap.get(b) ?? 0;
  return va - vb;
}

export function straightStartValue(seq: NormalRank[]): number {
  const s = seq[0];
  const isA23 = seq.length >= 3 && seq[0] === 'A' && seq[1] === '2' && seq[2] === '3';
  const isQKA = seq.length >= 3 && seq[0] === 'Q' && seq[1] === 'K' && seq[2] === 'A';
  if (isA23) return 1000000;
  if (isQKA) return 999000;
  return (straightRingIndex.get(s) ?? -100) + seq.length * 0.001;
}

export function nextInRing(r: NormalRank): NormalRank | null {
  const i = straightRingIndex.get(r);
  if (i === undefined) return null;
  const j = (i + 1);
  return straightRing[j] ?? null;
}

// === 牌型检测 ===
export function detectPattern(cards: Card[]): Pattern | null {
  if (!cards || cards.length === 0) return null;

  const sorted = [...cards].sort((a, b) => b.sortValue - a.sortValue);
  const len = sorted.length;

  // 王炸 (大小王)
  if (len === 2 && sorted.every(c => c.isJoker)) {
    return {
      type: 'PAIR',
      cards: sorted,
      strength: Number.MAX_SAFE_INTEGER,
      label: '王炸',
      extra: { isKingBomb: true }
    };
  }

  // 单张
  if (len === 1) {
    return {
      type: 'SINGLE',
      cards: sorted,
      strength: sorted[0].sortValue,
      label: formatCard(sorted[0])
    };
  }

  // 检查是否所有牌点数相同
  const allSameRank = sorted.every(c => c.rank === sorted[0].rank);

  // 对子
  if (len === 2 && allSameRank && !sorted[0].isJoker) {
    return {
      type: 'PAIR',
      cards: sorted,
      strength: sorted[0].sortValue,
      label: `对${sorted[0].rank}`
    };
  }

  // 三张
  if (len === 3 && allSameRank && !sorted[0].isJoker) {
    return {
      type: 'TRIPLE',
      cards: sorted,
      strength: sorted[0].sortValue,
      label: `三${sorted[0].rank}`
    };
  }

  // 炸弹 (四张相同)
  if (len === 4 && allSameRank && !sorted[0].isJoker) {
    return {
      type: 'FOUR',
      cards: sorted,
      strength: sorted[0].sortValue,
      label: `轰${sorted[0].rank}`
    };
  }

  // 顺子检测 (至少3张)
  if (len >= 3 && !sorted.some(c => c.isJoker)) {
    const straight = checkStraight(sorted);
    if (straight) return straight;
  }

  // 连对检测 (至少6张)
  if (len >= 6 && len % 2 === 0 && !sorted.some(c => c.isJoker)) {
    const doubleSeq = checkDoubleSequence(sorted);
    if (doubleSeq) return doubleSeq;
  }

  return null;
}

function checkStraight(cards: Card[]): Pattern | null {
  const ranks = cards.map(c => c.rank as NormalRank);
  const sortedByRing = [...ranks].sort((a, b) => {
    const ia = straightRingIndex.get(a) ?? -1;
    const ib = straightRingIndex.get(b) ?? -1;
    return ia - ib;
  });

  // 检查是否连续
  let isConsecutive = true;
  for (let i = 1; i < sortedByRing.length; i++) {
    const prev = straightRingIndex.get(sortedByRing[i - 1]);
    const curr = straightRingIndex.get(sortedByRing[i]);
    if (prev === undefined || curr === undefined || curr - prev !== 1) {
      isConsecutive = false;
      break;
    }
  }

  // 特殊处理 A-2-3
  const hasA = ranks.includes('A');
  const has2 = ranks.includes('2');
  const has3 = ranks.includes('3');
  const isA23 = cards.length === 3 && hasA && has2 && has3;

  if (isConsecutive || isA23) {
    const strength = straightStartValue(sortedByRing);
    return {
      type: 'STRAIGHT',
      cards,
      strength,
      label: `顺子${sortedByRing.join('-')}`
    };
  }

  return null;
}

function checkDoubleSequence(cards: Card[]): Pattern | null {
  // 统计每个点数的数量
  const rankCount = new Map<string, number>();
  for (const c of cards) {
    rankCount.set(c.rank, (rankCount.get(c.rank) ?? 0) + 1);
  }

  // 每个点数必须恰好2张
  for (const count of rankCount.values()) {
    if (count !== 2) return null;
  }

  const ranks = Array.from(rankCount.keys()) as NormalRank[];
  const sortedRanks = ranks.sort((a, b) => {
    const ia = straightRingIndex.get(a) ?? -1;
    const ib = straightRingIndex.get(b) ?? -1;
    return ia - ib;
  });

  // 检查是否连续
  for (let i = 1; i < sortedRanks.length; i++) {
    const prev = straightRingIndex.get(sortedRanks[i - 1]);
    const curr = straightRingIndex.get(sortedRanks[i]);
    if (prev === undefined || curr === undefined || curr - prev !== 1) {
      return null;
    }
  }

  const strength = straightStartValue(sortedRanks);
  return {
    type: 'DOUBLE_SEQUENCE',
    cards,
    strength,
    label: `连对${sortedRanks.join('-')}`
  };
}

// === 牌型比较 ===
export function canBeat(prev: Pattern, next: Pattern): boolean {
  // 王炸最大
  if (next.extra?.isKingBomb) return true;
  if (prev.extra?.isKingBomb) return false;

  // 炸弹可以炸任何非炸
  if (next.type === 'FOUR' && prev.type !== 'FOUR') return true;
  if (prev.type === 'FOUR' && next.type !== 'FOUR') return false;

  // 同类型比较
  if (prev.type !== next.type) return false;
  if (prev.cards.length !== next.cards.length) return false;

  return next.strength > prev.strength;
}

// === 游戏逻辑 ===
export function dealHands(deck: Card[], playerCount: number): Card[][] {
  const shuffled = shuffle(deck);
  const perPlayer = Math.floor(shuffled.length / playerCount);
  const hands: Card[][] = [];
  
  for (let i = 0; i < playerCount; i++) {
    const hand = shuffled.slice(i * perPlayer, (i + 1) * perPlayer);
    hands.push(hand.sort((a, b) => b.sortValue - a.sortValue));
  }
  
  return hands;
}

export function findSpade4Owner(hands: Card[][]): number {
  for (let i = 0; i < hands.length; i++) {
    if (hands[i].some(c => c.rank === '4' && c.suit === '♠')) {
      return i;
    }
  }
  return 0;
}

export function initGame(opts: { 
  playerCount: number; 
  deck?: Card[];
  lastRoundResult?: { finishedOrder: number[]; revolution: boolean };
}): GameState {
  const deck = opts.deck ?? createDeck();
  const hands = dealHands(deck, opts.playerCount);
  const gameId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  
  let firstPlayer = 0;
  if (!opts.lastRoundResult) {
    firstPlayer = findSpade4Owner(hands);
  } else {
    const { finishedOrder, revolution } = opts.lastRoundResult;
    if (revolution) {
      firstPlayer = finishedOrder[0];
    } else {
      firstPlayer = finishedOrder[finishedOrder.length - 1];
    }
  }

  return {
    gameId,
    playerCount: opts.playerCount,
    hands,
    currentPlayer: firstPlayer,
    lastPlay: null,
    lastPlayOwner: -1,
    passesInRow: 0,
    finishedOrder: [],
    status: 'playing',
    tablePlays: [],
    currentTrickPlays: [],
    multiplier: 1,
    revolution: false,
    pendingReturns: []
  };
}

function nextActivePlayer(state: GameState, from: number): number {
  let i = (from + 1) % state.playerCount;
  while (state.finishedOrder.includes(i)) {
    i = (i + 1) % state.playerCount;
  }
  return i;
}

function removeCardsFromHand(hand: Card[], toRemove: Card[]): Card[] {
  const copy = [...hand];
  for (const r of toRemove) {
    const idx = copy.findIndex(c => c.rank === r.rank && c.suit === r.suit);
    if (idx >= 0) copy.splice(idx, 1);
  }
  return copy;
}

export function playTurn(state: GameState, action: Action): GameState {
  if (state.finishedOrder.includes(state.currentPlayer)) {
    return { ...state, currentPlayer: nextActivePlayer(state, state.currentPlayer) };
  }

  // 过牌
  if (action.type === 'pass') {
    const next = nextActivePlayer(state, state.currentPlayer);
    const passesInRow = state.passesInRow + 1;
    
    // 如果所有人都pass，清空lastPlay
    const activePlayers = state.playerCount - state.finishedOrder.length;
    let lastPlay = state.lastPlay;
    let lastPlayOwner = state.lastPlayOwner;
    
    if (passesInRow >= activePlayers - 1 && next === lastPlayOwner) {
      lastPlay = null;
      lastPlayOwner = -1;
    }

    return {
      ...state,
      currentPlayer: next,
      passesInRow,
      lastPlay,
      lastPlayOwner,
      currentTrickPlays: passesInRow >= activePlayers - 1 ? [] : state.currentTrickPlays
    };
  }

  // 出牌
  if (action.type === 'play') {
    const hand = state.hands[state.currentPlayer];
    const pattern = detectPattern(action.cards);
    
    if (!pattern) {
      throw new Error('无效的牌型');
    }

    // 检查是否能压过
    if (state.lastPlay && state.lastPlayOwner !== state.currentPlayer) {
      if (!canBeat(state.lastPlay, pattern)) {
        throw new Error('无法压过上一手');
      }
    }

    // 从手牌中移除
    const newHand = removeCardsFromHand(hand, action.cards);
    const newHands = state.hands.map((h, idx) => 
      idx === state.currentPlayer ? newHand : h
    );

    // 检查是否出完
    let finishedOrder = [...state.finishedOrder];
    if (newHand.length === 0 && !finishedOrder.includes(state.currentPlayer)) {
      finishedOrder.push(state.currentPlayer);
    }

    // 计算倍数
    let multiplier = state.multiplier;
    if (pattern.type === 'FOUR') {
      multiplier *= 2;
    }
    if (pattern.extra?.isKingBomb) {
      multiplier *= 4;
    }

    const newTablePlays = [...state.tablePlays, { by: state.currentPlayer, cards: action.cards }];
    const newCurrentTrickPlays = [...state.currentTrickPlays, { by: state.currentPlayer, cards: action.cards }];

    // 检查游戏是否结束
    const status = finishedOrder.length >= state.playerCount ? 'finished' : 'playing';

    return {
      ...state,
      hands: newHands.map(h => h.sort((a, b) => b.sortValue - a.sortValue)),
      lastPlay: { ...pattern, by: state.currentPlayer },
      lastPlayOwner: state.currentPlayer,
      passesInRow: 0,
      currentPlayer: status === 'finished' ? state.currentPlayer : nextActivePlayer(state, state.currentPlayer),
      finishedOrder,
      tablePlays: newTablePlays,
      currentTrickPlays: newCurrentTrickPlays,
      multiplier,
      status
    };
  }

  return state;
}

// === AI 提示 ===
export function getHintOptions(hand: Card[], lastPlay: Pattern | null): Card[][] {
  const options: Card[][] = [];
  
  if (!lastPlay) {
    // 新一轮，可以出任何牌
    // 单张
    for (const c of hand) {
      options.push([c]);
    }
    // 对子
    const rankGroups = groupByRank(hand);
    for (const [rank, cards] of rankGroups) {
      if (cards.length >= 2) {
        options.push(cards.slice(0, 2));
      }
      if (cards.length >= 3) {
        options.push(cards.slice(0, 3));
      }
      if (cards.length >= 4) {
        options.push(cards.slice(0, 4));
      }
    }
  } else {
    // 需要压过上家
    const rankGroups = groupByRank(hand);
    
    switch (lastPlay.type) {
      case 'SINGLE':
        for (const c of hand) {
          if (c.sortValue > lastPlay.strength) {
            options.push([c]);
          }
        }
        break;
        
      case 'PAIR':
        if (lastPlay.extra?.isKingBomb) break;
        for (const [_, cards] of rankGroups) {
          if (cards.length >= 2 && cards[0].sortValue > lastPlay.strength) {
            options.push(cards.slice(0, 2));
          }
        }
        break;
        
      case 'TRIPLE':
        for (const [_, cards] of rankGroups) {
          if (cards.length >= 3 && cards[0].sortValue > lastPlay.strength) {
            options.push(cards.slice(0, 3));
          }
        }
        break;
        
      case 'FOUR':
        for (const [_, cards] of rankGroups) {
          if (cards.length >= 4 && cards[0].sortValue > lastPlay.strength) {
            options.push(cards.slice(0, 4));
          }
        }
        break;
    }
    
    // 炸弹始终可以出
    if (lastPlay.type !== 'FOUR' && !lastPlay.extra?.isKingBomb) {
      for (const [_, cards] of rankGroups) {
        if (cards.length >= 4) {
          options.push(cards.slice(0, 4));
        }
      }
    }
    
    // 王炸
    const jokers = hand.filter(c => c.isJoker);
    if (jokers.length === 2 && !lastPlay.extra?.isKingBomb) {
      options.push(jokers);
    }
  }
  
  return options;
}

function groupByRank(hand: Card[]): Map<string, Card[]> {
  const groups = new Map<string, Card[]>();
  for (const c of hand) {
    const key = c.rank;
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }
  return groups;
}

export function hasValidMove(hand: Card[], lastPlay: Pattern | null): boolean {
  return getHintOptions(hand, lastPlay).length > 0;
}

// === 导出版本 ===
export const VERSION = '1.0.0';
