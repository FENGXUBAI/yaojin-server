"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPattern = detectPattern;
exports.canBeat = canBeat;
const cards_1 = require("./cards");
function allSameRank(cards) {
    if (cards.length === 0)
        return null;
    const r0 = cards[0].rank;
    for (const c of cards)
        if (c.rank !== r0)
            return null;
    return r0;
}
function countByRank(cards) {
    var _a;
    const m = new Map();
    for (const c of cards) {
        const a = (_a = m.get(c.rank)) !== null && _a !== void 0 ? _a : [];
        a.push(c);
        m.set(c.rank, a);
    }
    return m;
}
function isStraight(cards) {
    if (cards.length < 3)
        return { ok: false };
    // jokers not allowed
    if (cards.some(c => c.isJoker))
        return { ok: false };
    // unique ranks
    const ranks = Array.from(new Set(cards.map(c => c.rank)));
    if (ranks.length !== cards.length)
        return { ok: false };
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
    const sorted = [...ranks].sort((a, b) => (cards_1.straightRing.indexOf(a) - cards_1.straightRing.indexOf(b)));
    // check consecutive
    for (let i = 0; i < sorted.length - 1; i++) {
        const nxt = (0, cards_1.nextInRing)(sorted[i]);
        if (nxt !== sorted[i + 1])
            return { ok: false };
    }
    return { ok: true, seq: sorted };
}
function isDoubleSequence(cards) {
    if (cards.length < 6 || cards.length % 2 !== 0)
        return { ok: false };
    if (cards.some(c => c.isJoker))
        return { ok: false };
    // count by rank
    const m = countByRank(cards);
    const pairs = [];
    for (const [r, arr] of m.entries()) {
        if (arr.length !== 2)
            return { ok: false };
        pairs.push(r);
    }
    // sort and check consecutive between pair ranks
    const sorted = pairs.sort((a, b) => (cards_1.straightRing.indexOf(a) - cards_1.straightRing.indexOf(b)));
    for (let i = 0; i < sorted.length - 1; i++) {
        const nxt = (0, cards_1.nextInRing)(sorted[i]);
        if (nxt !== sorted[i + 1])
            return { ok: false };
    }
    return { ok: true, seq: sorted };
}
function detectPattern(cards) {
    const arr = [...cards];
    arr.sort((a, b) => a.sortValue - b.sortValue);
    // SINGLE
    if (arr.length === 1) {
        const c = arr[0];
        const strength = c.sortValue;
        return { type: 'SINGLE', cards: arr, label: `单: ${(0, cards_1.formatCard)(c)}`, strength };
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
            return { type: 'PAIR', cards: arr, label: `对: ${(0, cards_1.formatCard)(arr[0])} ${(0, cards_1.formatCard)(arr[1])}`, strength, extra: { isKingBomb: false } };
        }
        return null;
    }
    // TRIPLE (炸)
    if (arr.length === 3) {
        const same = allSameRank(arr);
        if (same && !arr[0].isJoker) {
            const strength = arr[0].sortValue;
            return { type: 'TRIPLE', cards: arr, label: `炸: ${(0, cards_1.formatCard)(arr[0])}*3`, strength };
        }
        // STRAIGHT
        const s = isStraight(arr);
        if (s.ok && s.seq) {
            const strength = (0, cards_1.straightStartValue)(s.seq);
            return { type: 'STRAIGHT', cards: arr, label: `顺子(${arr.length}): ${arr.map(cards_1.formatCard).join(' ')}`, strength, extra: { straightLength: arr.length } };
        }
        return null;
    }
    // FOUR (轰)
    if (arr.length === 4) {
        const same = allSameRank(arr);
        if (same && !arr[0].isJoker) {
            const strength = arr[0].sortValue;
            return { type: 'FOUR', cards: arr, label: `轰: ${(0, cards_1.formatCard)(arr[0])}*4`, strength };
        }
    }
    // DOUBLE SEQUENCE
    const ds = isDoubleSequence(arr);
    if (ds.ok && ds.seq) {
        const strength = (0, cards_1.straightStartValue)(ds.seq);
        return { type: 'DOUBLE_SEQUENCE', cards: arr, label: `连对(${arr.length / 2}): ${arr.map(cards_1.formatCard).join(' ')}`, strength, extra: { straightLength: arr.length / 2 } };
    }
    // STRAIGHT general >=3
    const st = isStraight(arr);
    if (st.ok && st.seq) {
        const strength = (0, cards_1.straightStartValue)(st.seq);
        return { type: 'STRAIGHT', cards: arr, label: `顺子(${arr.length}): ${arr.map(cards_1.formatCard).join(' ')}`, strength, extra: { straightLength: arr.length } };
    }
    return null;
}
function canBeat(previous, next) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // 逻辑五~九
    if (previous.type === 'SINGLE') {
        if (next.type === 'SINGLE')
            return next.strength > previous.strength;
        if (next.type === 'TRIPLE' || next.type === 'FOUR')
            return true; // 炸/轰大于单
        // 王炸（二王）作为PAIR在识别中，但出牌阶段应视为轰
        if (next.type === 'PAIR' && ((_a = next.extra) === null || _a === void 0 ? void 0 : _a.isKingBomb))
            return true;
        return false;
    }
    if (previous.type === 'PAIR') {
        if (next.type === 'PAIR' && !((_b = next.extra) === null || _b === void 0 ? void 0 : _b.isKingBomb))
            return next.strength > previous.strength;
        if (next.type === 'TRIPLE' || next.type === 'FOUR')
            return true;
        if (next.type === 'PAIR' && ((_c = next.extra) === null || _c === void 0 ? void 0 : _c.isKingBomb))
            return true; // 王炸
        return false;
    }
    if (previous.type === 'STRAIGHT') {
        if (next.type === 'STRAIGHT' && (((_d = next.extra) === null || _d === void 0 ? void 0 : _d.straightLength) === ((_e = previous.extra) === null || _e === void 0 ? void 0 : _e.straightLength))) {
            return next.strength > previous.strength;
        }
        if (next.type === 'TRIPLE' || next.type === 'FOUR' || (next.type === 'PAIR' && ((_f = next.extra) === null || _f === void 0 ? void 0 : _f.isKingBomb)))
            return true;
        return false;
    }
    if (previous.type === 'TRIPLE') {
        if (next.type === 'TRIPLE')
            return next.strength > previous.strength;
        if (next.type === 'FOUR' || (next.type === 'PAIR' && ((_g = next.extra) === null || _g === void 0 ? void 0 : _g.isKingBomb)))
            return true;
        return false;
    }
    if (previous.type === 'FOUR') {
        // 轰只能被更大的轰或王轰（两王）压制
        if (next.type === 'FOUR')
            return next.strength > previous.strength;
        if (next.type === 'PAIR' && ((_h = next.extra) === null || _h === void 0 ? void 0 : _h.isKingBomb))
            return true;
        return false;
    }
    return false;
}
