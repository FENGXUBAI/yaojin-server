import { Card, Suit, createDeck, formatCard, makeCard, normalRanks, shuffle, suits } from './cards';
import { Pattern, detectPattern, canBeat } from './patterns';

export interface GameState {
  playerCount: number; // 3 or 4
  hands: Card[][];
  currentPlayer: number; // index
  lastPlay: (Pattern & { by: number }) | null;
  passesInRow: number;
  lastPlayOwner: number | null;
  tablePlays: TablePlay[];
  finishedOrder: number[]; // players who have "跑了"
  revolution: boolean; // 是否革命（用于下一局先手与进贡）
}
export interface TablePlay {
  by: number;
  cards: Card[];
}

export type PlayAction = { type: 'play'; cards: Card[] };
export type PassAction = { type: 'pass' };
export type Action = PlayAction | PassAction;

export function dealHands(deck: Card[], playerCount: number): Card[][] {
  const shuffled = shuffle(deck);
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  for (let i = 0; i < shuffled.length; i++) {
    hands[i % playerCount].push(shuffled[i]);
  }
  // sort each hand by our single order descending (higher first)
  for (const h of hands) h.sort((a,b) => b.sortValue - a.sortValue);
  return hands;
}

export function findSpade4Owner(hands: Card[][]): number {
  for (let i = 0; i < hands.length; i++) {
    for (const c of hands[i]) {
      if (!c.isJoker && c.rank === '4' && c.suit === '♠') return i;
    }
  }
  return 0;
}

export function initGame(opts: { playerCount: number; deck?: Card[]; lastRoundResult?: { finishedOrder: number[]; revolution: boolean } }): GameState {
  const deck = opts.deck ?? createDeck();
  const hands = dealHands(deck, opts.playerCount);
  
  let firstPlayer = 0;
  if (!opts.lastRoundResult) {
    // 第一局：♠4 先手
    firstPlayer = findSpade4Owner(hands);
  } else {
    // 后续局
    const { finishedOrder, revolution } = opts.lastRoundResult;
    if (revolution) {
      // 革命：第一个跑了的人先出
      firstPlayer = finishedOrder[0];
    } else {
      // 无革命：最后一个跑了的人先出（即没跑掉的或者最后一名）
      // 注意：finishedOrder 包含所有跑了的人。如果是4人局，前3个跑了，第4个就是最后一名。
      // 如果所有人都跑了（理论上最后一个人不需要出牌就结束了，但逻辑上他是最后一名）
      // 规则说：最后一个跑了的人先出牌。
      // 实际上通常是“进贡者”先出，或者“上游”先出？
      // 用户规则：“之后的游戏如果没有革命则最后一个跑了的人先出牌，如果出现了革命则第一个跑了的人先出牌。”
      // 这里的“最后一个跑了的人”通常指最晚出完牌的人（下游）。
      firstPlayer = finishedOrder[finishedOrder.length - 1];
    }
  }

  return {
    playerCount: opts.playerCount,
    hands,
    currentPlayer: firstPlayer,
    lastPlay: null,
    passesInRow: 0,
    lastPlayOwner: null,
    tablePlays: [],
    finishedOrder: [],
    revolution: false,
  };
}

function removeCardsFromHand(hand: Card[], toRemove: Card[]): Card[] {
  const copy = [...hand];
  for (const r of toRemove) {
    const idx = copy.findIndex(c => c.rank === r.rank && c.suit === r.suit);
    if (idx >= 0) copy.splice(idx, 1);
  }
  return copy;
}

function nextActivePlayer(state: GameState, from: number): number {
  let i = (from + 1) % state.playerCount;
  // skip finished players
  while (state.finishedOrder.includes(i)) {
    i = (i + 1) % state.playerCount;
  }
  return i;
}

function activePlayersCount(state: GameState): number {
  return state.playerCount - state.finishedOrder.length;
}

function labelPlay(p: Pattern): string { return p.label; }

function isTwoFours(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  return cards.every(c => !c.isJoker && c.rank === '4');
}
function isThreeFours(cards: Card[]): boolean {
  if (cards.length !== 3) return false;
  return cards.every(c => !c.isJoker && c.rank === '4');
}

export function playTurn(state: GameState, action: Action): GameState {
  if (state.finishedOrder.includes(state.currentPlayer)) {
    // skip finished automatically
    return { ...state, currentPlayer: nextActivePlayer(state, state.currentPlayer) };
  }
  if (action.type === 'pass') {
    const next = nextActivePlayer(state, state.currentPlayer);
    let lastPlay = state.lastPlay;
    let passesInRow = state.passesInRow + 1;
    // if everyone except lastPlayOwner has passed and we return to owner
    // we DO NOT clear tablePlays here anymore, as requested.
    // Only clear when game ends or new game starts.
    let tablePlays = state.tablePlays ?? [];
    if (state.lastPlay && next === state.lastPlay.by && passesInRow >= activePlayersCount(state) - 1) {
      // tablePlays = []; // Don't clear table plays on trick end
      passesInRow = 0;
    }
    return { ...state, currentPlayer: next, lastPlay, passesInRow, tablePlays };
  }
  // play cards
  const hand = state.hands[state.currentPlayer];
  const pattern = detectPattern(action.cards);
  if (!pattern) {
    throw new Error('非法牌型');
  }

  // Check if we are starting a new trick (because everyone passed back to us)
  // BUT we must allow "Qi" logic to happen first if applicable.
  let effectiveLastPlay = state.lastPlay;
  if (state.lastPlay && state.lastPlay.by === state.currentPlayer) {
    // Everyone passed back to me.
    // I can either "Qi" (if valid) or start a new trick.
    // We temporarily keep effectiveLastPlay to check for Qi.
    // If Qi is NOT valid, we will set effectiveLastPlay to null later.
  }

  // 特殊起炸/起轰
  if (effectiveLastPlay) {
    if (effectiveLastPlay.type === 'TRIPLE' && isTwoFours(action.cards)) {
      // 两张4可以起炸：拿到上一炸到手里，当前出牌视为对子4
      const newHand = removeCardsFromHand(hand, action.cards);
      const captured = effectiveLastPlay.cards;
      newHand.push(...captured);
      const nextState: GameState = {
        ...state,
        hands: state.hands.map((h, idx) => idx === state.currentPlayer ? newHand.sort((a,b)=>b.sortValue-a.sortValue) : h),
        lastPlay: { type: 'PAIR', cards: action.cards, label: '起炸: 4对', strength: action.cards[0].sortValue, by: state.currentPlayer },
        lastPlayOwner: state.currentPlayer,
        passesInRow: 0,
        currentPlayer: nextActivePlayer(state, state.currentPlayer),
        tablePlays: [...(state.tablePlays ?? []), { by: state.currentPlayer, cards: action.cards }],
      };
      return nextState;
    }
    if (effectiveLastPlay.type === 'FOUR' && isThreeFours(action.cards)) {
      // 三张4可以起轰（包括王轰）：拿到上一轰到手里，当前出牌视为炸4
      const newHand = removeCardsFromHand(hand, action.cards);
      const captured = effectiveLastPlay.cards;
      newHand.push(...captured);
      const nextState: GameState = {
        ...state,
        hands: state.hands.map((h, idx) => idx === state.currentPlayer ? newHand.sort((a,b)=>b.sortValue-a.sortValue) : h),
        lastPlay: { type: 'TRIPLE', cards: action.cards, label: '起轰: 4炸', strength: action.cards[0].sortValue, by: state.currentPlayer },
        lastPlayOwner: state.currentPlayer,
        passesInRow: 0,
        currentPlayer: nextActivePlayer(state, state.currentPlayer),
        tablePlays: [...(state.tablePlays ?? []), { by: state.currentPlayer, cards: action.cards }],
      };
      return nextState;
    }
  }

  // 正常比较逻辑
  // If we are the owner of the last play (everyone passed), we start a new trick.
  // So we treat effectiveLastPlay as null for comparison purposes.
  let compareAgainst = effectiveLastPlay;
  if (compareAgainst && compareAgainst.by === state.currentPlayer) {
    compareAgainst = null;
  }

  if (compareAgainst) {
    // 王炸识别为PAIR，但对比视作轰
    const normalizedNext: Pattern = (pattern.type === 'PAIR' && pattern.extra?.isKingBomb)
      ? { ...pattern, type: 'FOUR', strength: Number.MAX_SAFE_INTEGER }
      : pattern;

    if (!canBeat(compareAgainst, normalizedNext)) {
      throw new Error('无法压过上一手');
    }
  }

  // remove played cards from hand
  const newHand = removeCardsFromHand(hand, action.cards);
  const newHands = state.hands.map((h, idx) => idx === state.currentPlayer ? newHand : h);

  // check finished
  let finishedOrder = state.finishedOrder;
  if (newHand.length === 0 && !finishedOrder.includes(state.currentPlayer)) {
    finishedOrder = [...finishedOrder, state.currentPlayer];
  }

  // Determine tablePlays: if starting a new trick (compareAgainst === null) reset table plays,
  // otherwise append to existing table plays.
  // BUT: User requested NOT to clear table plays on new trick (screen middle cards persist).
  // Only clear when game ends (all finished).
  // So we just append. Wait, if we just append, it gets too crowded?
  // User said: "四个人出完一轮之后，屏幕中间的牌不要清空，只有四个人都跑了之后在清空"
  // This implies all history of the game is visible? Or just the current round?
  // "四个人出完一轮" usually means a trick. "不要清空" means keep showing them.
  // Okay, so we NEVER clear tablePlays during the game.
  const newTablePlays = [...(state.tablePlays ?? []), { by: state.currentPlayer, cards: action.cards }];

  // Clear table plays only when game is over (everyone finished or all but one finished)
  let finalTablePlays = newTablePlays;
  if (finishedOrder.length >= state.playerCount) {
     finalTablePlays = [];
  }

  const next: GameState = {
    ...state,
    hands: newHands.map(h => h.sort((a,b)=>b.sortValue-a.sortValue)),
    lastPlay: { ...pattern, by: state.currentPlayer },
    lastPlayOwner: state.currentPlayer,
    passesInRow: 0,
    currentPlayer: nextActivePlayer(state, state.currentPlayer),
    finishedOrder,
    tablePlays: finalTablePlays,
  };
  return next;
}

// 进贡与革命逻辑（跨局）
export interface TributePlan {
  donorToReceiver: { donor: number; receiver: number; count: number }[];
  revolution: boolean;
}

export function checkRevolution(hands: Card[][], finishedOrder: number[]): boolean {
  // 革命逻辑：当需要进贡的一个人手里有了王轰，则这进贡的所有人都不需要进贡了
  // 需要进贡的人：
  // 4人局：第3名（给第2名），第4名（给第1名）。
  // 3人局：第3名（给第2名，第1名不需要进贡？规则只说了第3给第2，第4给第1。3人局通常是第3给第1？用户规则：“第三个跑了的人要把牌中最大的一张给第二个跑了的人...第四个跑了的人要把牌中最大的两张张给第一个跑了的人”）
  // 用户规则描述有点混淆，通常3人局是末游给上游。
  // 按照用户文字：“第三个跑了的人...给第二个...第四个...给第一个”。
  // 假设3人局只有前半句：第3给第2？这有点奇怪，通常是给第1。
  // 但严格按用户文字：
  // 3人局：finishedOrder[2] 是第三个跑了的人。他需要进贡。
  // 4人局：finishedOrder[2] 和 finishedOrder[3] 是需要进贡的人。
  
  // 检查这些“需要进贡的人”手里是否有王轰。
  // 注意：此时是“下一局开始随机分完牌的时候”。所以我们要检查的是新发的手牌。
  
  const playerCount = hands.length;
  const potentialDonors: number[] = [];
  if (playerCount >= 3) potentialDonors.push(finishedOrder[2]);
  if (playerCount >= 4) potentialDonors.push(finishedOrder[3]);

  for (const pIdx of potentialDonors) {
    // 检查 hands[pIdx] 是否有王轰 (大王 + 小王)
    const hasBig = hands[pIdx].some(c => c.rank === 'JOKER_BIG');
    const hasSmall = hands[pIdx].some(c => c.rank === 'JOKER_SMALL');
    if (hasBig && hasSmall) return true;
  }
  return false;
}

export function computeTributePlan(playerCount: number, finishedOrder: number[], isRevolution: boolean): TributePlan {
  if (isRevolution) {
    return { donorToReceiver: [], revolution: true };
  }
  
  const donors: { donor: number; receiver: number; count: number }[] = [];
  // 规则：“第三个跑了的人要把牌中最大的一张给第二个跑了的人”
  if (playerCount >= 3 && finishedOrder.length >= 3) {
    donors.push({ donor: finishedOrder[2], receiver: finishedOrder[1], count: 1 });
  }
  // 规则：“第四个跑了的人要把牌中最大的两张张给第一个跑了的人”
  if (playerCount >= 4 && finishedOrder.length >= 4) {
    donors.push({ donor: finishedOrder[3], receiver: finishedOrder[0], count: 2 });
  }
  
  return { donorToReceiver: donors, revolution: false };
}

// 执行进贡（自动）：把 donor 最大的牌给 receiver
export function applyTribute(hands: Card[][], plan: TributePlan): Card[][] {
  const newHands = hands.map(h => [...h]);
  
  for (const { donor, receiver, count } of plan.donorToReceiver) {
    // 找出 donor 最大的 count 张牌
    // 假设 hand 已经排好序（大到小）
    // 再次排序确保万一
    newHands[donor].sort((a,b) => b.sortValue - a.sortValue);
    
    const tributes = newHands[donor].slice(0, count);
    // 从 donor 移除
    newHands[donor] = newHands[donor].slice(count);
    // 给 receiver
    newHands[receiver].push(...tributes);
  }
  
  // 重新排序所有手牌
  for (let i = 0; i < newHands.length; i++) {
    newHands[i].sort((a,b) => b.sortValue - a.sortValue);
  }
  
  return newHands;
}

// 执行回贡（手动）：receiver 选择牌还给 donor
export function returnTribute(hands: Card[][], donor: number, receiver: number, cards: Card[]): Card[][] {
  const newHands = hands.map(h => [...h]);
  
  // 从 receiver 移除 cards
  const rHand = newHands[receiver];
  const newRHand = removeCardsFromHand(rHand, cards);
  if (newRHand.length !== rHand.length - cards.length) {
    throw new Error('回贡牌不在手牌中');
  }
  newHands[receiver] = newRHand;
  
  // 给 donor
  newHands[donor].push(...cards);
  
  // 排序
  newHands[donor].sort((a,b) => b.sortValue - a.sortValue);
  newHands[receiver].sort((a,b) => b.sortValue - a.sortValue);
  
  return newHands;
}

export { createDeck, formatCard };
