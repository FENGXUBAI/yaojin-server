"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.straightRing = exports.singleOrder = exports.suits = exports.normalRanks = void 0;
exports.makeCard = makeCard;
exports.createDeck = createDeck;
exports.shuffle = shuffle;
exports.formatCard = formatCard;
exports.compareSingleOrGroupByRank = compareSingleOrGroupByRank;
exports.straightStartValue = straightStartValue;
exports.nextInRing = nextInRing;
exports.findStraightRuns = findStraightRuns;
exports.normalRanks = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', '3'];
exports.suits = ['♠', '♥', '♦', '♣'];
// Singles/pairs/triple/four ordering: BIG_JOKER > SMALL_JOKER > 3 > 2 > A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4
exports.singleOrder = ['JOKER_BIG', 'JOKER_SMALL', '3', '2', 'A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4'];
const singleOrderMap = new Map(exports.singleOrder.map((r, i) => [r, exports.singleOrder.length - i]));
// Straight/Double Sequence ring order from smallest start to largest: 2 < 3 < 4 < ... < K < A
exports.straightRing = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const straightRingIndex = new Map(exports.straightRing.map((r, i) => [r, i]));
function makeCard(rank, suit) {
    const isJoker = rank === 'JOKER_BIG' || rank === 'JOKER_SMALL';
    const sortValue = singleOrderMap.get(rank) ?? 0;
    return { rank, suit, isJoker, sortValue };
}
function createDeck() {
    const deck = [];
    // Jokers
    deck.push(makeCard('JOKER_SMALL'));
    deck.push(makeCard('JOKER_BIG'));
    // Suited cards
    for (const s of exports.suits) {
        for (const r of exports.normalRanks) {
            deck.push(makeCard(r, s));
        }
    }
    return deck;
}
function shuffle(arr, seed) {
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
function formatCard(c) {
    if (c.isJoker)
        return c.rank === 'JOKER_BIG' ? '🃏大王' : '🃏小王';
    return `${c.suit}${c.rank}`;
}
function compareSingleOrGroupByRank(a, b) {
    const va = singleOrderMap.get(a) ?? 0;
    const vb = singleOrderMap.get(b) ?? 0;
    return va - vb; // positive means a > b
}
function straightStartValue(seq) {
    // Special rules: A-2-3 is maximum; Q-K-A is second
    const s = seq[0];
    const isA23 = seq.length >= 3 && seq[0] === 'A' && seq[1] === '2' && seq[2] === '3';
    const isQKA = seq.length >= 3 && seq[0] === 'Q' && seq[1] === 'K' && seq[2] === 'A';
    if (isA23)
        return 1000000;
    if (isQKA)
        return 999000;
    return (straightRingIndex.get(s) ?? -100) + seq.length * 0.001; // tie-breaker by length minimal
}
function nextInRing(r) {
    const i = straightRingIndex.get(r);
    if (i === undefined)
        return null;
    const j = (i + 1);
    return exports.straightRing[j] ?? null;
}
function findStraightRuns(ranks) {
    // ranks must be NormalRank strings present in hand (unique)
    const present = new Set(ranks);
    const runs = [];
    // Build runs based on straightRing order
    let i = 0;
    while (i < exports.straightRing.length) {
        const start = exports.straightRing[i];
        if (!present.has(start)) {
            i++;
            continue;
        }
        const run = [start];
        let cur = start;
        while (true) {
            const nxt = nextInRing(cur);
            if (!nxt)
                break;
            if (!present.has(nxt))
                break;
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
