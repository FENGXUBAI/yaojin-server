import { Card, Rank, singleOrder, straightRing, nextInRing, formatCard } from './cards';
import { Pattern, detectPattern } from './patterns';

// Helper to count cards by rank
function countRanks(hand: Card[]) {
  const counts = new Map<Rank, Card[]>();
  for (const c of hand) {
    const r = c.isJoker ? c.rank : c.rank;
    const list = counts.get(r) ?? [];
    list.push(c);
    counts.set(r, list);
  }
  return counts;
}

// A "HandSplit" is a list of patterns that exhaust the hand
export type HandSplit = Pattern[];

// Evaluate how "good" a split is. Lower score is better (usually fewer hands).
// We can also weight bombs higher or lower depending on strategy.
function scoreSplit(split: HandSplit): number {
  let score = split.length * 100; // Base cost per turn
  for (const p of split) {
    if (p.type === 'FOUR') score -= 50; // Bombs are good
    if (p.type === 'PAIR' && p.extra?.isKingBomb) score -= 80; // King bomb is very good
    if (p.type === 'STRAIGHT') score -= (p.cards.length - 3) * 5; // Long straights are efficient
    if (p.type === 'DOUBLE_SEQUENCE') score -= (p.cards.length/2 - 3) * 10;
  }
  return score;
}

// Recursive function to find best split
// This is computationally expensive, so we need to be careful.
// We can use a greedy approach with backtracking for specific patterns.
export function analyzeHandStructure(hand: Card[]): HandSplit {
  if (hand.length === 0) return [];

  // Optimization: If hand is small, try full search?
  // For now, let's implement a heuristic-based greedy splitter that tries to find
  // the longest/biggest patterns first.
  
  // 1. Identify all possible patterns in the hand
  // 2. Pick the "best" one, remove cards, recurse
  // 3. Backtrack if needed (maybe limited depth)
  
  // Simplified approach:
  // Priority: King Bomb > Four > Double Sequence > Straight > Triple > Pair > Single
  
  const counts = countRanks(hand);
  const sortedRanks = [...counts.keys()].sort((a,b) => {
      // Sort by count desc, then by value desc
      const ca = counts.get(a)!.length;
      const cb = counts.get(b)!.length;
      if (ca !== cb) return cb - ca;
      // Value sort
      return singleOrder.indexOf(a) - singleOrder.indexOf(b); // lower index is higher value
  });

  // Check King Bomb
  const big = hand.find(c => c.rank === 'JOKER_BIG');
  const small = hand.find(c => c.rank === 'JOKER_SMALL');
  if (big && small) {
      const rest = hand.filter(c => c !== big && c !== small);
      const p = detectPattern([big, small]);
      if (p) return [p, ...analyzeHandStructure(rest)];
  }

  // Check Fours
  for (const r of sortedRanks) {
      const cards = counts.get(r)!;
      if (cards.length === 4) {
          const p = detectPattern(cards);
          if (p) {
              const rest = hand.filter(c => !cards.includes(c));
              return [p, ...analyzeHandStructure(rest)];
          }
      }
  }

  // Check Double Sequences (3+ pairs)
    const pairRanks: Rank[] = [...counts.keys()].filter(r => (counts.get(r as Rank)?.length ?? 0) >= 2 && r !== 'JOKER_BIG' && r !== 'JOKER_SMALL') as Rank[];
    // Sort by straight order (ascending)
    pairRanks.sort((a,b) => straightRing.indexOf(a as any) - straightRing.indexOf(b as any));

    // Find longest run of pairs
    let bestRun: Rank[] = [];
    let currentRun: Rank[] = [];
  
  for (let i = 0; i < pairRanks.length; i++) {
      const r = pairRanks[i];
      if (currentRun.length === 0) {
          currentRun.push(r);
      } else {
          const prev = currentRun[currentRun.length - 1];
          if (nextInRing(prev as any) === r) {
              currentRun.push(r);
          } else {
              if (currentRun.length >= 3 && currentRun.length > bestRun.length) {
                  bestRun = [...currentRun];
              }
              currentRun = [r];
          }
      }
  }
  if (currentRun.length >= 3 && currentRun.length > bestRun.length) {
      bestRun = [...currentRun];
  }
  
  if (bestRun.length >= 3) {
      // Found a double sequence
      const cardsToRemove: Card[] = [];
      for (const r of bestRun) {
          const c = counts.get(r as Rank)!;
          cardsToRemove.push(c[0], c[1]);
      }
      const p = detectPattern(cardsToRemove);
      if (p) {
          const rest = hand.filter(c => !cardsToRemove.includes(c));
          return [p, ...analyzeHandStructure(rest)];
      }
  }

  // Fallback: Just group by rank
  const split: HandSplit = [];
  const remaining = [...hand];
  
  // Extract Triples
  for (const r of sortedRanks) {
      const cards = remaining.filter(c => (c.isJoker ? c.rank : c.rank) === r);
      if (cards.length === 3) {
          const p = detectPattern(cards);
          if (p) {
              split.push(p);
              for(const c of cards) {
                  const idx = remaining.indexOf(c);
                  if(idx>=0) remaining.splice(idx,1);
              }
          }
      }
  }
  
  // Extract Pairs
  for (const r of sortedRanks) {
      const cards = remaining.filter(c => (c.isJoker ? c.rank : c.rank) === r);
      if (cards.length >= 2) {
          // Take 2
          const pair = cards.slice(0, 2);
          const p = detectPattern(pair);
          if (p) {
              split.push(p);
              for(const c of pair) {
                  const idx = remaining.indexOf(c);
                  if(idx>=0) remaining.splice(idx,1);
              }
          }
      }
  }

  // Singles
  for (const c of remaining) {
      const p = detectPattern([c]);
      if (p) split.push(p);
  }

  return split;
}

// A class to track played cards and estimate probabilities
export class CardRecorder {
  private playedCounts = new Map<Rank, number>();
  private totalCounts = new Map<Rank, number>();

  constructor() {
    // Initialize totals
    // 1 deck: 4 of each normal rank, 1 of each joker
    for (const r of singleOrder) {
        if (r === 'JOKER_BIG' || r === 'JOKER_SMALL') {
            this.totalCounts.set(r, 1);
        } else {
            this.totalCounts.set(r, 4);
        }
        this.playedCounts.set(r, 0);
    }
  }

  record(cards: Card[]) {
    for (const c of cards) {
        const r = c.isJoker ? c.rank : c.rank;
        this.playedCounts.set(r, (this.playedCounts.get(r) ?? 0) + 1);
    }
  }

  getRemaining(rank: Rank): number {
      return (this.totalCounts.get(rank) ?? 0) - (this.playedCounts.get(rank) ?? 0);
  }

  // Is a rank likely to be a bomb? (e.g. no one has played it yet)
  isBombPossible(rank: Rank): boolean {
      return this.getRemaining(rank) === 4;
  }
  
  // Get all ranks that are strictly higher than the given rank and have at least N cards remaining
  getHigherCandidates(rank: Rank, count: number): Rank[] {
      const idx = singleOrder.indexOf(rank);
      const candidates: Rank[] = [];
      // Iterate over ranks higher than 'rank' (lower index)
      for (let i = 0; i < idx; i++) {
          const r = singleOrder[i];
          if (this.getRemaining(r) >= count) {
              candidates.push(r);
          }
      }
      return candidates;
  }
}
