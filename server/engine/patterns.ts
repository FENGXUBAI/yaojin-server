import { Card, NormalRank, Rank, compareSingleOrGroupByRank, formatCard, nextInRing, straightRing, straightStartValue } from './cards';

export type PatternType = 'SINGLE' | 'PAIR' | 'STRAIGHT' | 'DOUBLE_SEQUENCE' | 'TRIPLE' | 'FOUR';

export interface Pattern {
  type: PatternType;
  cards: Card[];
  label: string;
  strength: number; // for comparing same-type plays
  extra?: { isKingBomb?: boolean; straightLength?: number };
}

function allSameRank(cards: Card[]): Rank | null {
  if (cards.length === 0) return null;
  const r0 = cards[0].rank;
  for (const c of cards) if (c.rank !== r0) return null;
  return r0;
}

function countByRank(cards: Card[]): Map<Rank, Card[]> {
  const m = new Map<Rank, Card[]>();
  for (const c of cards) {
    const a = m.get(c.rank) ?? [];
    a.push(c);
    m.set(c.rank, a);
  }
  return m;
}

function isStraight(cards: Card[]): { ok: boolean; seq?: NormalRank[] } {
  if (cards.length < 3) return { ok: false };
  // jokers not allowed
  if (cards.some(c => c.isJoker)) return { ok: false };
  // unique ranks
  const ranks = Array.from(new Set(cards.map(c => c.rank as NormalRank)));
  if (ranks.length !== cards.length) return { ok: false };
  
  // Special case: A-2-3 (1-2-3)
  // Ranks must be exactly A, 2, 3
  if (cards.length === 3) {
    const hasA = ranks.includes('A');
    const has2 = ranks.includes('2');
    const has3 = ranks.includes('3');
    if (hasA && has2 && has3) {
      // Return sequence A, 2, 3 for strength calculation
      return { ok: true, seq: ['A', '2', '3'] };
    }
  }

  // sort by straight ring order
  const sorted = [...ranks].sort((a,b) => (straightRing.indexOf(a) - straightRing.indexOf(b)));
  
  // check consecutive
  for (let i = 0; i < sorted.length - 1; i++) {
    const nxt = nextInRing(sorted[i]);
    if (nxt !== sorted[i+1]) return { ok: false };
  }
  return { ok: true, seq: sorted };
}

function isDoubleSequence(cards: Card[]): { ok: boolean; seq?: NormalRank[] } {
  if (cards.length < 6 || cards.length % 2 !== 0) return { ok: false };
  if (cards.some(c => c.isJoker)) return { ok: false };
  // count by rank
  const m = countByRank(cards);
  const pairs: NormalRank[] = [];
  for (const [r, arr] of m.entries()) {
    if (arr.length !== 2) return { ok: false };
    pairs.push(r as NormalRank);
  }
  // sort and check consecutive between pair ranks
  const sorted = pairs.sort((a,b) => (straightRing.indexOf(a) - straightRing.indexOf(b)));
  for (let i = 0; i < sorted.length - 1; i++) {
    const nxt = nextInRing(sorted[i]);
    if (nxt !== sorted[i+1]) return { ok: false };
  }
  return { ok: true, seq: sorted };
}

export function detectPattern(cards: Card[]): Pattern | null {
  const arr = [...cards];
  arr.sort((a,b) => a.sortValue - b.sortValue);
  // SINGLE
  if (arr.length === 1) {
    const c = arr[0];
    const strength = c.sortValue;
    return { type: 'SINGLE', cards: arr, label: `单: ${formatCard(c)}`, strength };
  }
  // PAIR
  if (arr.length === 2) {
    // Check for King Bomb (Joker Pair)
    const isKingBomb = arr.every(c => c.isJoker);
    if (isKingBomb) {
      return { type: 'PAIR', cards: arr, label: '王炸', strength: Number.MAX_SAFE_INTEGER, extra: { isKingBomb: true } };
    }

    const same = allSameRank(arr);
    if (same) {
      const strength = arr[0].sortValue;
      return { type: 'PAIR', cards: arr, label: `对: ${formatCard(arr[0])} ${formatCard(arr[1])}`, strength, extra: { isKingBomb: false } };
    }
    return null;
  }
  // TRIPLE (炸)
  if (arr.length === 3) {
    const same = allSameRank(arr);
    if (same && !arr[0].isJoker) {
      const strength = arr[0].sortValue;
      return { type: 'TRIPLE', cards: arr, label: `炸: ${formatCard(arr[0])}*3`, strength };
    }
    // STRAIGHT
    const s = isStraight(arr);
    if (s.ok && s.seq) {
      const strength = straightStartValue(s.seq);
      return { type: 'STRAIGHT', cards: arr, label: `顺子(${arr.length}): ${arr.map(formatCard).join(' ')}`, strength, extra: { straightLength: arr.length } };
    }
    return null;
  }
  // FOUR (轰)
  if (arr.length === 4) {
    const same = allSameRank(arr);
    if (same && !arr[0].isJoker) {
      const strength = arr[0].sortValue;
      return { type: 'FOUR', cards: arr, label: `轰: ${formatCard(arr[0])}*4`, strength };
    }
  }
  // DOUBLE SEQUENCE
  const ds = isDoubleSequence(arr);
  if (ds.ok && ds.seq) {
    const strength = straightStartValue(ds.seq);
    return { type: 'DOUBLE_SEQUENCE', cards: arr, label: `连对(${arr.length/2}): ${arr.map(formatCard).join(' ')}`, strength, extra: { straightLength: arr.length / 2 } };
  }
  // STRAIGHT general >=3
  const st = isStraight(arr);
  if (st.ok && st.seq) {
    const strength = straightStartValue(st.seq);
    return { type: 'STRAIGHT', cards: arr, label: `顺子(${arr.length}): ${arr.map(formatCard).join(' ')}`, strength, extra: { straightLength: arr.length } };
  }
  return null;
}

export function canBeat(previous: Pattern, next: Pattern): boolean {
  // 逻辑五~九
  if (previous.type === 'SINGLE') {
    if (next.type === 'SINGLE') return next.strength > previous.strength;
    if (next.type === 'TRIPLE' || next.type === 'FOUR') return true; // 炸/轰大于单
    // 王炸（二王）作为PAIR在识别中，但出牌阶段应视为轰
    if (next.type === 'PAIR' && next.extra?.isKingBomb) return true;
    return false;
  }
  if (previous.type === 'PAIR') {
    if (next.type === 'PAIR' && !next.extra?.isKingBomb) return next.strength > previous.strength;
    if (next.type === 'TRIPLE' || next.type === 'FOUR') return true;
    if (next.type === 'PAIR' && next.extra?.isKingBomb) return true; // 王炸
    return false;
  }
  if (previous.type === 'STRAIGHT') {
    if (next.type === 'STRAIGHT' && (next.extra?.straightLength === previous.extra?.straightLength)) {
      return next.strength > previous.strength;
    }
    if (next.type === 'TRIPLE' || next.type === 'FOUR' || (next.type === 'PAIR' && next.extra?.isKingBomb)) return true;
    return false;
  }
  if (previous.type === 'TRIPLE') {
    if (next.type === 'TRIPLE') return next.strength > previous.strength;
    if (next.type === 'FOUR' || (next.type === 'PAIR' && next.extra?.isKingBomb)) return true;
    return false;
  }
  if (previous.type === 'FOUR') {
    // 轰只能被更大的轰或王轰（两王）压制
    if (next.type === 'FOUR') return next.strength > previous.strength;
    if (next.type === 'PAIR' && next.extra?.isKingBomb) return true;
    return false;
  }
  return false;
}
