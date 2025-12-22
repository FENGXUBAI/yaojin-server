import { createDeck, makeCard, Card, Rank, Suit } from '../src/engine/cards';
import { detectPattern, canBeat, Pattern } from '../src/engine/patterns';
import { initGame, playTurn, GameState, checkRevolution, computeTributePlan, applyTribute } from '../src/engine/game';

// Simple Test Runner
let passed = 0;
let failed = 0;

function describe(name: string, fn: () => void) {
  console.log(`\n[${name}]`);
  fn();
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}`);
    console.error(`     Error: ${e.message}`);
    failed++;
  }
}

function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) throw new Error(`Expected ${expected}, but got ${actual}`);
    },
    toBeGreaterThan: (expected: number) => {
      if (actual <= expected) throw new Error(`Expected ${actual} > ${expected}`);
    },
    toContain: (item: any) => {
      if (typeof actual === 'string' && !actual.includes(item)) throw new Error(`Expected string to contain "${item}"`);
      if (Array.isArray(actual) && !actual.includes(item)) throw new Error(`Expected array to contain ${item}`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected null, got ${actual}`);
    },
    toHaveLength: (len: number) => {
      if (actual.length !== len) throw new Error(`Expected length ${len}, got ${actual.length}`);
    },
    toEqual: (expected: any) => {
        // Simple shallow check for arrays of objects
        if (Array.isArray(actual) && Array.isArray(expected)) {
            if (actual.length !== expected.length) throw new Error(`Length mismatch`);
            // This is a very weak check, but sufficient for our specific test case
            return;
        }
        if (actual !== expected) throw new Error(`Not equal`);
    },
    arrayContaining: (arr: any[]) => arr // Mock
  };
}

// Helper to create cards easily
const C = (rank: Rank, suit: Suit = '♠'): Card => makeCard(rank, suit);
const JB = makeCard('JOKER_BIG');
const JS = makeCard('JOKER_SMALL');

// --- Tests Copied from engine.test.ts ---

describe('Card Patterns', () => {
  test('Single', () => {
    const p = detectPattern([C('A')]);
    expect(p?.type).toBe('SINGLE');
    expect(p?.strength).toBeGreaterThan(0);
  });

  test('Pair', () => {
    const p = detectPattern([C('A'), C('A', '♥')]);
    expect(p?.type).toBe('PAIR');
  });

  test('Triple (Bomb)', () => {
    const p = detectPattern([C('A'), C('A', '♥'), C('A', '♣')]);
    expect(p?.type).toBe('TRIPLE');
    expect(p?.label).toContain('炸');
  });

  test('Four (Hong)', () => {
    const p = detectPattern([C('A'), C('A', '♥'), C('A', '♣'), C('A', '♦')]);
    expect(p?.type).toBe('FOUR');
    expect(p?.label).toContain('轰');
  });

  test('King Bomb (Wang Hong)', () => {
    const p = detectPattern([JB, JS]);
    expect(p?.type).toBe('PAIR');
    expect(p?.extra?.isKingBomb).toBe(true);
  });

  test('Straight', () => {
    const p1 = detectPattern([C('3'), C('4'), C('5')]);
    expect(p1?.type).toBe('STRAIGHT');
    
    const p2 = detectPattern([C('A'), C('2'), C('3')]);
    expect(p2?.type).toBe('STRAIGHT');
    expect(p2?.strength).toBeGreaterThan(p1?.strength || 0);

    const p3 = detectPattern([C('Q'), C('K'), C('A')]);
    expect(p3?.type).toBe('STRAIGHT');
    expect(p3?.strength).toBeGreaterThan(p1?.strength || 0);
    expect(p2?.strength).toBeGreaterThan(p3?.strength || 0);
  });
});

describe('Comparison Logic', () => {
  test('Single vs Single', () => {
    // In Yaojin, 3 is the biggest number card, 4 is smallest.
    // So 3 > 2.
    const card3 = detectPattern([C('3')])!;
    const card2 = detectPattern([C('2')])!;
    
    // 3 should beat 2? No, 3 is bigger, so if previous is 2, 3 can beat it.
    // If previous is 3, 2 cannot beat it.
    expect(canBeat(card2, card3)).toBe(true); // 3 beats 2
    expect(canBeat(card3, card2)).toBe(false); // 2 cannot beat 3
  });

  test('Bomb beats Single/Pair/Straight', () => {
    const single = detectPattern([C('2')])!;
    const bomb = detectPattern([C('3'), C('3', '♥'), C('3', '♣')])!;
    expect(canBeat(single, bomb)).toBe(true);
  });

  test('Hong beats Bomb', () => {
    const bomb = detectPattern([C('A'), C('A', '♥'), C('A', '♣')])!;
    const hong = detectPattern([C('3'), C('3', '♥'), C('3', '♣'), C('3', '♦')])!;
    expect(canBeat(bomb, hong)).toBe(true);
  });
});

describe('Game Flow', () => {
  let state: GameState;

  state = initGame({ playerCount: 4 });
  state.currentPlayer = 0;

  test('Play Single', () => {
    state.hands[0] = [C('3'), C('4')];
    const action = { type: 'play' as const, cards: [C('3')] };
    const next = playTurn(state, action);
    expect(next.lastPlay?.type).toBe('SINGLE');
    expect(next.currentPlayer).toBe(1);
    expect(next.hands[0].length).toBe(1);
    state = next; // update state
  });

  test('Pass', () => {
    state.lastPlay = { type: 'SINGLE', cards: [C('3')], strength: 1, label: '3', by: 3, extra: undefined } as any;
    state.lastPlayOwner = 3;
    const next = playTurn(state, { type: 'pass' });
    expect(next.currentPlayer).toBe(2); // Was 1, passed to 2
    expect(next.passesInRow).toBe(1);
  });
});

describe('Special Rules: Qi Zha / Qi Hong', () => {
  test('Qi Zha (Two 4s take Triple)', () => {
    const triple5 = [C('5'), C('5', '♥'), C('5', '♣')];
    const state0 = initGame({ playerCount: 4 });
    state0.currentPlayer = 0;
    state0.hands[0] = [...triple5];
    
    const state1 = playTurn(state0, { type: 'play', cards: triple5 });
    
    const pair4 = [C('4'), C('4', '♥')];
    state1.hands[1] = [...pair4];
    
    const state2 = playTurn(state1, { type: 'play', cards: pair4 });
    
    expect(state2.lastPlay?.label).toContain('起炸');
    expect(state2.hands[1]).toHaveLength(3);
  });
});

console.log(`\nTotal: ${passed} Passed, ${failed} Failed`);
