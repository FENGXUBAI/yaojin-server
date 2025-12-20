export type Suit = '♠' | '♥' | '♦' | '♣';
export type NormalRank = '4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A'|'2'|'3';
export type JokerRank = 'JOKER_SMALL' | 'JOKER_BIG';
export type Rank = NormalRank | JokerRank;

export interface Card {
  suit?: Suit; // Jokers have no suit
  rank: Rank;
  isJoker: boolean;
  sortValue: number; // for singles/pairs/triple/four ordering
  isTribute?: boolean; // Highlight for tribute
}

export const normalRanks: NormalRank[] = ['4','5','6','7','8','9','10','J','Q','K','A','2','3'];
export const suits: Suit[] = ['♠','♥','♦','♣'];

// Singles/pairs/triple/four ordering: BIG_JOKER > SMALL_JOKER > 3 > 2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4
export const singleOrder: Rank[] = ['JOKER_BIG','JOKER_SMALL','3','2','A','K','Q','J','10','9','8','7','6','5','4'];
const singleOrderMap = new Map(singleOrder.map((r, i) => [r, singleOrder.length - i]));

// Straight/Double Sequence ring order from smallest start to largest: 2 < 3 < 4 < ... < K < A
export const straightRing: NormalRank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const straightRingIndex = new Map(straightRing.map((r, i) => [r, i]));

export function makeCard(rank: Rank, suit?: Suit): Card {
  const isJoker = rank === 'JOKER_BIG' || rank === 'JOKER_SMALL';
  const sortValue = singleOrderMap.get(rank) ?? 0;
  return { rank, suit, isJoker, sortValue };
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  // Jokers
  deck.push(makeCard('JOKER_SMALL'));
  deck.push(makeCard('JOKER_BIG'));
  // Suited cards
  for (const s of suits) {
    for (const r of normalRanks) {
      deck.push(makeCard(r, s));
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  // Fisher-Yates; optional seed for reproducibility
  const a = [...arr];
  let random = Math.random;
  if (seed !== undefined) {
    let t = seed;
    random = () => {
      // simple LCG
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
  return va - vb; // positive means a > b
}

export function straightStartValue(seq: NormalRank[]): number {
  // Special rules: A-2-3 is maximum; Q-K-A is second
  const s = seq[0];
  const isA23 = seq.length >= 3 && seq[0] === 'A' && seq[1] === '2' && seq[2] === '3';
  const isQKA = seq.length >= 3 && seq[0] === 'Q' && seq[1] === 'K' && seq[2] === 'A';
  if (isA23) return 1000000;
  if (isQKA) return 999000;
  return (straightRingIndex.get(s) ?? -100) + seq.length * 0.001; // tie-breaker by length minimal
}

export function nextInRing(r: NormalRank): NormalRank | null {
  const i = straightRingIndex.get(r);
  if (i === undefined) return null;
  const j = (i + 1);
  return straightRing[j] ?? null;
}

export function findStraightRuns(ranks: string[]): string[][] {
  // ranks must be NormalRank strings present in hand (unique)
  const present = new Set(ranks);
  const runs: string[][] = [];

  // Build runs based on straightRing order
  let i = 0;
  while (i < straightRing.length) {
    const start = straightRing[i];
    if (!present.has(start)) {
      i++;
      continue;
    }
    const run: string[] = [start];
    let cur = start;
    while (true) {
      const nxt = nextInRing(cur);
      if (!nxt) break;
      if (!present.has(nxt)) break;
      run.push(nxt);
      cur = nxt;
    }
    runs.push(run);
    i += run.length;
  }

  // Special A-2-3 presence: if A,2,3 exist we also allow that as a run
  if (present.has('A') && present.has('2') && present.has('3')) {
    runs.push(['A', '2', '3']);
  }

  return runs;
}
