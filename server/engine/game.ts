import { Card, Suit, createDeck, formatCard, makeCard, nextInRing, normalRanks, shuffle, straightRing, straightStartValue, suits, findStraightRuns } from './cards';
import { Pattern, detectPattern, canBeat } from './patterns';

export interface GameState {
  gameId: string; // unique per round, used for client cache/reset and event scoping
  playerCount: number; // 3 or 4
  hands: Card[][];
  currentPlayer: number; // index
  lastPlay: (Pattern & { by: number }) | null;
  passesInRow: number;
  lastPlayOwner: number | null;
  tablePlays: TablePlay[];
  currentTrickPlays: TablePlay[]; // Plays in the current trick
  finishedOrder: number[]; // players who have "跑了"
  revolution: boolean; // 是否革命（用于下一局先手与进贡）
  status: 'playing' | 'tribute_return';
  pendingReturns: { actionBy: number; returnTo: number; count: number }[];
  multiplier: number; // Current game score multiplier
}
export interface TablePlay {
  by: number;
  cards: Card[];
}

export type PlayAction = { type: 'play'; cards: Card[] };
export type PassAction = { type: 'pass' };
export type ReturnTributeAction = { type: 'returnTribute'; cards: Card[] };
export type Action = PlayAction | PassAction | ReturnTributeAction;

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
  const gameId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let hands = dealHands(deck, opts.playerCount);
  
  let firstPlayer = 0;
  let revolution = false;
  const pendingReturns: { actionBy: number; returnTo: number; count: number }[] = [];

  if (!opts.lastRoundResult) {
    // 第一局：♠4 先手
    firstPlayer = findSpade4Owner(hands);
  } else {
    // 后续局
    const { finishedOrder } = opts.lastRoundResult;
    
    // Check Revolution
    revolution = checkRevolution(hands, finishedOrder);
    
    // Compute Tribute
    const plan = computeTributePlan(opts.playerCount, finishedOrder, revolution);
    
    // Apply Tribute (Donor -> Receiver)
    hands = applyTribute(hands, plan);
    
    // Prepare Manual Return Tribute
    for (const { donor, receiver, count } of plan.donorToReceiver) {
        pendingReturns.push({ actionBy: receiver, returnTo: donor, count });
    }
    
    // Re-sort all hands
    for (const h of hands) h.sort((a,b) => b.sortValue - a.sortValue);

    if (revolution) {
      // 革命：第一个跑了的人先出 (Winner)
      firstPlayer = finishedOrder[0];
    } else {
      // 无革命：最后一个跑了的人先出 (Loser)
      firstPlayer = finishedOrder[finishedOrder.length - 1];
    }
  }

  return {
    gameId,
    playerCount: opts.playerCount,
    hands,
    currentPlayer: firstPlayer,
    lastPlay: null,
    passesInRow: 0,
    lastPlayOwner: null,
    tablePlays: [],
    currentTrickPlays: [],
    finishedOrder: [],
    revolution,
    status: pendingReturns.length > 0 ? 'tribute_return' : 'playing',
    pendingReturns,
    multiplier: 1,
  };
}

function removeCardsFromHand(hand: Card[], toRemove: Card[]): Card[] {
  const copy = [...hand];
  for (const r of toRemove) {
    const idx = copy.findIndex(c => c.rank === r.rank && c.suit === r.suit);
    if (idx < 0) {
      throw new Error('非法操作：出牌不在手牌中');
    }
    copy.splice(idx, 1);
  }
  return copy;
}

function nextActivePlayer(state: GameState, from: number): number {
  if (state.finishedOrder.length >= state.playerCount) return -1;
  let i = (from + 1) % state.playerCount;
  let count = 0;
  // skip finished players
  while (state.finishedOrder.includes(i)) {
    i = (i + 1) % state.playerCount;
    count++;
    if (count > state.playerCount) return -1; // Safety break
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
  // Intentionally no console spam here; server already logs key lifecycle events.
  if (state.finishedOrder.includes(state.currentPlayer)) {
    // skip finished automatically
    return { ...state, currentPlayer: nextActivePlayer(state, state.currentPlayer) };
  }
  if (action.type === 'pass') {
    const next = nextActivePlayer(state, state.currentPlayer);
    let lastPlay = state.lastPlay;
    let lastPlayOwner = state.lastPlayOwner;
    let passesInRow = state.passesInRow + 1;
    // if everyone except lastPlayOwner has passed and we return to owner
    // we DO NOT clear tablePlays here anymore, as requested.
    // Only clear when game ends or new game starts.
    let tablePlays = state.tablePlays ?? [];
    let currentTrickPlays = state.currentTrickPlays ?? [];

    if (state.lastPlay && next === state.lastPlay.by && passesInRow >= activePlayersCount(state) - 1) {
      // Trick ends: clear lastPlay so the owner leads freely next.
      // Keep tablePlays history for UI/record.
      lastPlay = null;
      lastPlayOwner = null;
      passesInRow = 0;
      currentTrickPlays = [];
    }

    return { ...state, currentPlayer: next, lastPlay, lastPlayOwner, passesInRow, tablePlays, currentTrickPlays };
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
    let capturedCards: Card[] | null = null;
    let captureType: 'PAIR' | 'TRIPLE' | null = null;
    let captureLabel = '';

    if (effectiveLastPlay.type === 'TRIPLE' && isTwoFours(action.cards)) {
      // 两张4可以起炸
      capturedCards = effectiveLastPlay.cards;
      captureType = 'PAIR';
      captureLabel = '起炸: 4对';
    }
    
    // 起轰：三张4可以起轰（包括王轰）
    const isHong = effectiveLastPlay.type === 'FOUR';
    const isKingBomb = effectiveLastPlay.type === 'PAIR' && effectiveLastPlay.extra?.isKingBomb;
    
    if ((isHong || isKingBomb) && isThreeFours(action.cards)) {
      // 三张4可以起轰
      capturedCards = effectiveLastPlay.cards;
      captureType = 'TRIPLE';
      captureLabel = '起轰: 4炸';
    }

    if (capturedCards && captureType) {
      const newHand = removeCardsFromHand(hand, action.cards);
      newHand.push(...capturedCards);
      
      // Remove captured cards from tablePlays
      // We need to find the TablePlay that corresponds to effectiveLastPlay
      // effectiveLastPlay has 'by' and 'cards'.
      // We look for a TablePlay with same 'by' and same cards.
      const newTablePlays = (state.tablePlays ?? []).filter(tp => {
          if (tp.by !== effectiveLastPlay!.by) return true;
          // Check if cards match
          if (tp.cards.length !== capturedCards!.length) return true;
          // Simple check: compare first card rank/suit (assuming unique enough or exact object match if ref kept)
          // Since we reconstruct objects, we compare content.
          const match = tp.cards.every((c, i) => c.rank === capturedCards![i].rank && c.suit === capturedCards![i].suit);
          return !match;
      });

      // Add the new play (the 4s)
      newTablePlays.push({ by: state.currentPlayer, cards: action.cards });

      // Update currentTrickPlays for Capture
      // Remove captured cards from currentTrickPlays
      const newCurrentTrickPlays = (state.currentTrickPlays ?? []).filter(tp => {
          if (tp.by !== effectiveLastPlay!.by) return true;
          if (tp.cards.length !== capturedCards!.length) return true;
          const match = tp.cards.every((c, i) => c.rank === capturedCards![i].rank && c.suit === capturedCards![i].suit);
          return !match;
      });
      newCurrentTrickPlays.push({ by: state.currentPlayer, cards: action.cards });

      // Update Multiplier for Capture (Qi)
      let newMultiplier = state.multiplier;
      if (captureType === 'TRIPLE') { // Qi Hong (3 fours)
          newMultiplier *= 4; 
      } else if (captureType === 'PAIR') { // Qi Zha (2 fours)
          newMultiplier *= 2;
      }

      const nextState: GameState = {
        ...state,
        hands: state.hands.map((h, idx) => idx === state.currentPlayer ? newHand.sort((a,b)=>b.sortValue-a.sortValue) : h),
        lastPlay: { type: captureType, cards: action.cards, label: captureLabel, strength: action.cards[0].sortValue, by: state.currentPlayer },
        lastPlayOwner: state.currentPlayer,
        passesInRow: 0,
        currentPlayer: nextActivePlayer(state, state.currentPlayer),
        tablePlays: newTablePlays,
        currentTrickPlays: newCurrentTrickPlays,
        multiplier: newMultiplier,
      };
      return nextState;
    }
  }

  // 正常比较逻辑
  // If we are the owner of the last play (everyone passed), we start a new trick.
  // So we treat effectiveLastPlay as null for comparison purposes.
  let compareAgainst = effectiveLastPlay;
  let isNewTrick = false;
  if (compareAgainst) {
    const isOwner = compareAgainst.by === state.currentPlayer;
    const ownerFinished = state.finishedOrder.includes(compareAgainst.by);
    const everyonePassed = state.passesInRow >= activePlayersCount(state) - 1;
    
    if (isOwner || (ownerFinished && everyonePassed)) {
      compareAgainst = null;
      isNewTrick = true;
    }
  } else {
      isNewTrick = true;
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

  // Game End Check
  if (state.playerCount - finishedOrder.length <= 1) {
    const all = Array.from({length: state.playerCount}, (_, i) => i);
    const remaining = all.find(p => !finishedOrder.includes(p));
    if (remaining !== undefined) {
      finishedOrder = [...finishedOrder, remaining];
    }
  }

  const newTablePlays = [...(state.tablePlays ?? []), { by: state.currentPlayer, cards: action.cards }];

  let newCurrentTrickPlays = isNewTrick ? [] : [...(state.currentTrickPlays ?? [])];
  newCurrentTrickPlays.push({ by: state.currentPlayer, cards: action.cards });

  // Clear table plays only when game is over
  let finalTablePlays = newTablePlays;
  if (finishedOrder.length >= state.playerCount) {
     finalTablePlays = [];
     newCurrentTrickPlays = [];
  }

  // Calculate next player
  const tempStateForNext = { ...state, finishedOrder };
  let nextPlayer = -1;
  if (finishedOrder.length < state.playerCount) {
      nextPlayer = nextActivePlayer(tempStateForNext, state.currentPlayer);
  }
  
  // Update Multiplier
  let newMultiplier = state.multiplier;
  if (pattern.type === 'FOUR') {
      newMultiplier *= 2; // Bomb x2
  } else if (pattern.type === 'PAIR' && pattern.extra?.isKingBomb) {
      newMultiplier *= 4; // King Bomb x4
  }
  // Check for "Hong" (4 fours) - if pattern is FOUR of 4s
  if (pattern.type === 'FOUR' && pattern.cards[0].rank === '4') {
      newMultiplier *= 2; // Additional x2 for 4s bomb (Total x4)
  }

  const next: GameState = {
    ...state,
    hands: newHands,
    lastPlay: { ...pattern, by: state.currentPlayer },
    lastPlayOwner: state.currentPlayer,
    passesInRow: 0,
    currentPlayer: nextPlayer,
    finishedOrder,
    tablePlays: finalTablePlays,
    currentTrickPlays: newCurrentTrickPlays,
    multiplier: newMultiplier,
  };
  return next;
}

export function forceWin(state: GameState, playerIndex: number): GameState {
  // Empty hand
  const newHands = state.hands.map((h, i) => i === playerIndex ? [] : h);
  
  // Add to finishedOrder
  let finishedOrder = [...state.finishedOrder];
  if (!finishedOrder.includes(playerIndex)) {
    finishedOrder.push(playerIndex);
  }

  // Check if game should end (auto-finish last player)
  if (state.playerCount - finishedOrder.length <= 1) {
    const all = Array.from({length: state.playerCount}, (_, i) => i);
    const remaining = all.find(p => !finishedOrder.includes(p));
    if (remaining !== undefined) {
      finishedOrder.push(remaining);
    }
  }

  // Determine next player if game not over
  let nextPlayer = state.currentPlayer;
  if (finishedOrder.length < state.playerCount) {
      // If current player was the one who forced win, pass turn to next active
      if (state.currentPlayer === playerIndex) {
          nextPlayer = nextActivePlayer({ ...state, finishedOrder }, playerIndex);
      }
  } else {
      nextPlayer = -1;
  }

  return {
    ...state,
    hands: newHands,
    finishedOrder,
    currentPlayer: nextPlayer,
    passesInRow: 0, // Reset passes
    lastPlay: null, // Reset last play to allow next player to lead freely? Or keep it? 
                    // If I force win, I'm "out". The next player should probably start fresh or continue?
                    // Simpler: Reset to free play for next person.
    lastPlayOwner: null, 
    tablePlays: [], // Clear table
    currentTrickPlays: [],
  };
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
    // Mark as tribute
    tributes.forEach(c => c.isTribute = true);

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

export function resolveReturnTribute(state: GameState, playerId: number, cards: Card[]): GameState {
    if (state.status !== 'tribute_return') throw new Error('Not in tribute return phase');
    
    const pendingIdx = state.pendingReturns.findIndex(p => p.actionBy === playerId);
    if (pendingIdx === -1) throw new Error('You do not need to return tribute');
    
    const pending = state.pendingReturns[pendingIdx];
    if (cards.length !== pending.count) throw new Error(`Must return exactly ${pending.count} cards`);
    
    // Use existing returnTribute helper
    const newHands = returnTribute(state.hands, pending.returnTo, pending.actionBy, cards);
    
    // Remove from pendingReturns
    const newPending = [...state.pendingReturns];
    newPending.splice(pendingIdx, 1);
    
    const nextStatus = newPending.length === 0 ? 'playing' : 'tribute_return';
    
    // If phase ended, clear all tribute flags
    if (nextStatus === 'playing') {
        for (const h of newHands) {
            for (const c of h) {
                delete c.isTribute;
            }
        }
    }
    
    return {
        ...state,
        hands: newHands,
        pendingReturns: newPending,
        status: nextStatus
    };
}

export function hasValidMove(hand: Card[], lastPlay: Pattern | null): boolean {
  if (!lastPlay) return hand.length > 0; // Free turn, any card is valid (if hand not empty)

  // Check for Bomb (Four) or King Bomb - they can beat almost anything
  // King Bomb
  const hasBig = hand.some(c => c.rank === 'JOKER_BIG');
  const hasSmall = hand.some(c => c.rank === 'JOKER_SMALL');
  if (hasBig && hasSmall) return true;

  // Four (Bomb)
  const counts = new Map<string, number>();
  for (const c of hand) {
      if (!c.isJoker) counts.set(c.rank, (counts.get(c.rank) || 0) + 1);
  }
  
  // Check for "Qi" (Capture) possibilities
  if (lastPlay) {
      // Pair of 4s can capture Triple
      if (lastPlay.type === 'TRIPLE') {
          const fours = counts.get('4') || 0;
          if (fours >= 2) return true;
      }
      // Triple 4s can capture Bomb (Four) or King Bomb
      if (lastPlay.type === 'FOUR' || (lastPlay.type === 'PAIR' && lastPlay.extra?.isKingBomb)) {
          const fours = counts.get('4') || 0;
          if (fours >= 3) return true;
      }
  }

  // Iterate all ranks to find bombs and check strength against lastPlay
  for (const [rank, count] of counts.entries()) {
      if (count === 4) {
          // Construct a temp pattern
          const bombStrength = makeCard(rank as any).sortValue;
          if (lastPlay.type === 'FOUR') {
              if (bombStrength > lastPlay.strength) return true;
          } else if (lastPlay.type === 'PAIR' && lastPlay.extra?.isKingBomb) {
              // Bomb cannot beat King Bomb
          } else {
              return true; // Bomb beats anything else
          }
      }
  }

  // If lastPlay is King Bomb, nothing can beat it (except maybe special rules? No, King Bomb is max).
  if (lastPlay.type === 'PAIR' && lastPlay.extra?.isKingBomb) return false;

  // Check same type
  if (lastPlay.type === 'SINGLE') {
      // Check if any single card > strength
      return hand.some(c => c.sortValue > lastPlay.strength);
  }
  if (lastPlay.type === 'PAIR') {
      // Check if any pair > strength
      for (const [rank, count] of counts.entries()) {
          if (count >= 2) {
              const s = makeCard(rank as any).sortValue;
              if (s > lastPlay.strength) return true;
          }
      }
  }
  if (lastPlay.type === 'TRIPLE') {
      // Check if any triple > strength
      for (const [rank, count] of counts.entries()) {
          if (count >= 3) {
              const s = makeCard(rank as any).sortValue;
              if (s > lastPlay.strength) return true;
          }
      }
  }
  // STRAIGHT / DOUBLE_SEQUENCE: check if we can form a same-length sequence with higher strength.
  if (lastPlay.type === 'STRAIGHT' && lastPlay.extra?.straightLength) {
    const len = lastPlay.extra.straightLength;
    const normalUniqueRanks = Array.from(counts.keys());
    const runs = findStraightRuns(normalUniqueRanks);
    for (const run of runs) {
      if (run.length < len) continue;
      for (let start = 0; start + len <= run.length; start++) {
        const seq = run.slice(start, start + len) as any;
        const strength = straightStartValue(seq);
        if (strength > lastPlay.strength) return true;
      }
    }
    return false;
  }

  if (lastPlay.type === 'DOUBLE_SEQUENCE' && lastPlay.extra?.straightLength) {
    const pairLen = lastPlay.extra.straightLength;
    // Reuse outer counts map
    const pairRanks = Array.from(counts.entries())
      .filter(([r, n]) => n >= 2)
      .map(([r]) => r);
    const runs = findStraightRuns(pairRanks);
    for (const run of runs) {
      if (run.length < pairLen) continue;
      for (let start = 0; start + pairLen <= run.length; start++) {
        const seq = run.slice(start, start + pairLen) as any;
        const strength = straightStartValue(seq);
        if (strength > lastPlay.strength) return true;
      }
    }
    return false;
  }

  return false;
}

export { createDeck, formatCard };
