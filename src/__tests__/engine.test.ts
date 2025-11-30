import { createDeck, makeCard, Card, Rank, Suit } from '../engine/cards';
import { detectPattern, canBeat, Pattern } from '../engine/patterns';
import { initGame, playTurn, GameState, checkRevolution, computeTributePlan, applyTribute } from '../engine/game';

// Helper to create cards easily
const C = (rank: Rank, suit: Suit = '♠'): Card => makeCard(rank, suit);
const JB = makeCard('JOKER_BIG');
const JS = makeCard('JOKER_SMALL');

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
    // In detection it is PAIR with extra.isKingBomb
    expect(p?.type).toBe('PAIR');
    expect(p?.extra?.isKingBomb).toBe(true);
  });

  test('Straight', () => {
    // 3,4,5
    const p1 = detectPattern([C('3'), C('4'), C('5')]);
    expect(p1?.type).toBe('STRAIGHT');
    
    // A,2,3 (Biggest)
    const p2 = detectPattern([C('A'), C('2'), C('3')]);
    expect(p2?.type).toBe('STRAIGHT');
    expect(p2?.strength).toBeGreaterThan(p1?.strength || 0);

    // Q,K,A (Second Biggest)
    const p3 = detectPattern([C('Q'), C('K'), C('A')]);
    expect(p3?.type).toBe('STRAIGHT');
    expect(p3?.strength).toBeGreaterThan(p1?.strength || 0);
    expect(p2?.strength).toBeGreaterThan(p3?.strength || 0);
  });

  test('Double Sequence (Lian Dui)', () => {
    const cards = [C('3'), C('3', '♥'), C('4'), C('4', '♥'), C('5'), C('5', '♥')];
    const p = detectPattern(cards);
    expect(p?.type).toBe('DOUBLE_SEQUENCE');
  });
});

describe('Comparison Logic', () => {
  test('Single vs Single', () => {
    const small = detectPattern([C('3')])!;
    const big = detectPattern([C('2')])!;
    expect(canBeat(small, big)).toBe(true);
    expect(canBeat(big, small)).toBe(false);
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

  test('King Bomb beats Hong', () => {
    const hong = detectPattern([C('2'), C('2', '♥'), C('2', '♣'), C('2', '♦')])!;
    const kingBomb = detectPattern([JB, JS])!;
    // King Bomb is detected as PAIR but treated as FOUR/MAX in game logic usually, 
    // but let's check canBeat handles the raw pattern
    expect(canBeat(hong, kingBomb)).toBe(true);
  });
});

describe('Game Flow', () => {
  let state: GameState;

  beforeEach(() => {
    state = initGame({ playerCount: 4 });
    // Force P0 to be current player for easier testing
    state.currentPlayer = 0;
  });

  test('Play Single', () => {
    // Give P0 a 3
    state.hands[0] = [C('3'), C('4')];
    const action = { type: 'play' as const, cards: [C('3')] };
    const next = playTurn(state, action);
    expect(next.lastPlay?.type).toBe('SINGLE');
    expect(next.currentPlayer).toBe(1);
    expect(next.hands[0].length).toBe(1);
  });

  test('Pass', () => {
    state.lastPlay = { type: 'SINGLE', cards: [C('3')], strength: 1, label: '3', by: 3 };
    state.lastPlayOwner = 3;
    const next = playTurn(state, { type: 'pass' });
    expect(next.currentPlayer).toBe(1);
    expect(next.passesInRow).toBe(1);
  });

  test('Round Reset after passes', () => {
    state.lastPlay = { type: 'SINGLE', cards: [C('3')], strength: 1, label: '3', by: 0 };
    state.lastPlayOwner = 0;
    state.currentPlayer = 1;
    
    let s = playTurn(state, { type: 'pass' }); // P1 pass
    s = playTurn(s, { type: 'pass' }); // P2 pass
    s = playTurn(s, { type: 'pass' }); // P3 pass
    
    // Now back to P0, lastPlay should be cleared
    expect(s.currentPlayer).toBe(0);
    expect(s.lastPlay).toBeNull();
    expect(s.passesInRow).toBe(0);
  });
});

describe('Special Rules: Qi Zha / Qi Hong', () => {
  test('Qi Zha (Two 4s take Triple)', () => {
    // P0 plays Triple 5s
    const triple5 = [C('5'), C('5', '♥'), C('5', '♣')];
    const state0 = initGame({ playerCount: 4 });
    state0.currentPlayer = 0;
    state0.hands[0] = [...triple5];
    
    const state1 = playTurn(state0, { type: 'play', cards: triple5 });
    
    // P1 has two 4s
    const pair4 = [C('4'), C('4', '♥')];
    state1.hands[1] = [...pair4];
    
    // P1 plays two 4s to take the triple
    const state2 = playTurn(state1, { type: 'play', cards: pair4 });
    
    expect(state2.lastPlay?.label).toContain('起炸');
    expect(state2.hands[1]).toHaveLength(3); // Took 3 cards
    expect(state2.hands[1]).toEqual(expect.arrayContaining(triple5));
  });
});

describe('Tribute & Revolution', () => {
  test('Revolution Check', () => {
    // 4 players. Finished order: 0, 1, 2, 3.
    // Donors are P2 and P3.
    // Give P2 a King Bomb
    const hands = [[], [], [JB, JS], []] as Card[][];
    const finishedOrder = [0, 1, 2, 3];
    
    const isRev = checkRevolution(hands, finishedOrder);
    expect(isRev).toBe(true);
  });

  test('Apply Tribute', () => {
    // P2 gives 1 to P1
    // P3 gives 2 to P0
    const plan = {
      revolution: false,
      donorToReceiver: [
        { donor: 2, receiver: 1, count: 1 },
        { donor: 3, receiver: 0, count: 2 }
      ]
    };
    
    const hands = [
      [], // P0
      [], // P1
      [C('3'), C('A')], // P2 (A is biggest)
      [C('3'), C('K'), C('2')] // P3 (2, K are biggest)
    ] as Card[][];
    
    // Ensure sorted for test setup logic assumption (though applyTribute sorts too)
    hands.forEach(h => h.sort((a,b) => b.sortValue - a.sortValue));

    const newHands = applyTribute(hands, plan);
    
    // P2 gave A to P1
    expect(newHands[2]).toHaveLength(1);
    expect(newHands[2][0].rank).toBe('3');
    expect(newHands[1]).toHaveLength(1);
    expect(newHands[1][0].rank).toBe('A');
    
    // P3 gave 2, K to P0
    expect(newHands[3]).toHaveLength(1);
    expect(newHands[3][0].rank).toBe('3');
    expect(newHands[0]).toHaveLength(2);
    expect(newHands[0].map(c => c.rank)).toContain('2');
    expect(newHands[0].map(c => c.rank)).toContain('K');
  });
});
