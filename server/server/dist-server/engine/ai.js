"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHintOptions = getHintOptions;
exports.decideBotAction = decideBotAction;
const cards_1 = require("./cards");
const patterns_1 = require("./patterns");
const ai_analysis_1 = require("./ai_analysis");
function cardsKey(cards) {
    const s = [...cards]
        .map(c => { var _a; return `${c.rank}${(_a = c.suit) !== null && _a !== void 0 ? _a : ''}`; })
        .sort()
        .join('|');
    return s;
}
function rankCounts(hand) {
    var _a;
    const m = new Map();
    for (const c of hand) {
        const key = c.isJoker ? c.rank : c.rank;
        const arr = (_a = m.get(key)) !== null && _a !== void 0 ? _a : [];
        arr.push(c);
        m.set(key, arr);
    }
    for (const arr of m.values())
        arr.sort((a, b) => b.sortValue - a.sortValue);
    return m;
}
function scoreHintOption(hand, cards, lastPlay) {
    var _a, _b, _c, _d;
    const counts = rankCounts(hand);
    const pat = (0, patterns_1.detectPattern)(cards);
    const remainingAfter = hand.length - cards.length;
    const endgame = hand.length <= 5;
    let score = 0;
    // Prefer smaller response when beating; prefer larger combos when leading.
    score += lastPlay ? cards.length * 5 : -cards.length * 2;
    // Endgame: aggressively reduce cards
    if (endgame)
        score += remainingAfter * 20;
    // Immediate win is the top priority
    if (remainingAfter === 0)
        score -= 1000;
    // Penalize using bombs / special high-impact plays as late fallback
    if (pat) {
        const isKingBomb = pat.type === 'PAIR' && ((_a = pat.extra) === null || _a === void 0 ? void 0 : _a.isKingBomb);
        if (isKingBomb)
            score += 200;
        if (pat.type === 'FOUR')
            score += 120;
        if (pat.type === 'TRIPLE')
            score += 80;
    }
    // Penalize splitting strong groups
    const usedByRank = new Map();
    for (const c of cards) {
        const k = c.isJoker ? c.rank : c.rank;
        usedByRank.set(k, ((_b = usedByRank.get(k)) !== null && _b !== void 0 ? _b : 0) + 1);
    }
    for (const [r, used] of usedByRank.entries()) {
        const total = (_d = (_c = counts.get(r)) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 0;
        if (total >= 2 && used === 1)
            score += 15; // split pair/triple/quad
        if (total >= 3 && used === 2)
            score += 10; // split triple/quad
        if (total === 4 && used === 3)
            score += 10;
    }
    // Prefer keeping jokers unless necessary
    if (cards.some(c => c.isJoker))
        score += 25;
    // Slight preference for lower strength when responding (save big cards)
    if (lastPlay && pat)
        score += Math.floor(pat.strength / 10);
    return score;
}
function getHintOptions(hand, lastPlay) {
    var _a;
    if (!hand || hand.length === 0)
        return [];
    const counts = rankCounts(hand);
    const options = [];
    const seen = new Set();
    function addOption(cards) {
        var _a;
        const key = cardsKey(cards);
        if (seen.has(key))
            return;
        const pat = (0, patterns_1.detectPattern)(cards);
        if (!pat)
            return;
        // Normal legality
        if (!lastPlay) {
            seen.add(key);
            options.push(cards);
            return;
        }
        // Special Qi capture rules
        if (lastPlay.type === 'TRIPLE') {
            if (cards.length === 2 && cards.every(c => !c.isJoker && c.rank === '4')) {
                seen.add(key);
                options.push(cards);
                return;
            }
        }
        if (lastPlay.type === 'FOUR' || (lastPlay.type === 'PAIR' && ((_a = lastPlay.extra) === null || _a === void 0 ? void 0 : _a.isKingBomb))) {
            if (cards.length === 3 && cards.every(c => !c.isJoker && c.rank === '4')) {
                seen.add(key);
                options.push(cards);
                return;
            }
        }
        // Standard beat check
        if ((0, patterns_1.canBeat)(lastPlay, pat)) {
            seen.add(key);
            options.push(cards);
        }
    }
    // Singles
    for (const c of hand)
        addOption([c]);
    // Pairs/Triples/Fours by rank
    for (const arr of counts.values()) {
        const nonJokers = arr.filter(c => !c.isJoker);
        if (nonJokers.length >= 2)
            addOption(nonJokers.slice(0, 2));
        if (nonJokers.length >= 3)
            addOption(nonJokers.slice(0, 3));
        if (nonJokers.length === 4)
            addOption(nonJokers.slice(0, 4));
    }
    // King bomb (two jokers)
    const big = hand.find(c => c.rank === 'JOKER_BIG');
    const small = hand.find(c => c.rank === 'JOKER_SMALL');
    if (big && small)
        addOption([small, big]);
    // Straights
    const normalUniqueRanks = Array.from(new Set(hand.filter(c => !c.isJoker).map(c => c.rank)));
    const rankToCard = new Map();
    for (const c of hand) {
        if (!c.isJoker && !rankToCard.has(c.rank))
            rankToCard.set(c.rank, c);
    }
    const runs = (0, cards_1.findStraightRuns)(normalUniqueRanks);
    for (const run of runs) {
        if (run.length < 3)
            continue;
        for (let len = 3; len <= run.length; len++) {
            for (let start = 0; start + len <= run.length; start++) {
                const seq = run.slice(start, start + len);
                const cards = seq.map(r => rankToCard.get(r)).filter(Boolean);
                if (cards.length === len)
                    addOption(cards);
            }
        }
    }
    // Double sequences (连对)
    const pairRanks = Array.from(counts.entries())
        .filter(([r, arr]) => r !== 'JOKER_BIG' && r !== 'JOKER_SMALL' && arr.filter(c => !c.isJoker).length >= 2)
        .map(([r]) => r);
    const pairRuns = (0, cards_1.findStraightRuns)(pairRanks);
    for (const run of pairRuns) {
        if (run.length < 3)
            continue;
        for (let len = 3; len <= run.length; len++) {
            for (let start = 0; start + len <= run.length; start++) {
                const seq = run.slice(start, start + len);
                const cards = [];
                for (const r of seq) {
                    const arr = (_a = counts.get(r)) !== null && _a !== void 0 ? _a : [];
                    const nonJokers = arr.filter(c => !c.isJoker);
                    if (nonJokers.length < 2) {
                        cards.length = 0;
                        break;
                    }
                    cards.push(nonJokers[0], nonJokers[1]);
                }
                if (cards.length === len * 2)
                    addOption(cards);
            }
        }
    }
    // Sort by heuristic score; keep a reasonable number
    options.sort((a, b) => scoreHintOption(hand, a, lastPlay) - scoreHintOption(hand, b, lastPlay));
    return options.slice(0, 12);
}
function decideBotAction(state, playerIndex) {
    var _a, _b;
    const hand = state.hands[playerIndex];
    // Determine effective last play
    let effectiveLastPlay = state.lastPlay;
    if (state.lastPlay && state.lastPlay.by === playerIndex) {
        effectiveLastPlay = null; // I am leading
    }
    // Initialize Card Recorder (optional usage for future expansion)
    const recorder = new ai_analysis_1.CardRecorder();
    if (state.tablePlays) {
        state.tablePlays.forEach(tp => recorder.record(tp.cards));
    }
    recorder.record(hand);
    const options = getHintOptions(hand, effectiveLastPlay);
    if (options.length === 0) {
        return { type: 'pass' };
    }
    // Advanced AI Strategy
    // Helper to evaluate a move
    function evaluateMove(cards) {
        // Simulate hand after move
        const remainingHand = hand.filter(c => !cards.includes(c));
        const split = (0, ai_analysis_1.analyzeHandStructure)(remainingHand);
        let score = split.length * 100; // Fewer turns is better
        // Bonus for playing small cards
        const avgRank = cards.reduce((sum, c) => sum + c.sortValue, 0) / cards.length;
        score += avgRank; // Lower rank (smaller value) adds less to score -> preferred
        return score;
    }
    // 1. If Leading
    if (!effectiveLastPlay) {
        const currentSplit = (0, ai_analysis_1.analyzeHandStructure)(hand);
        if (currentSplit.length > 0) {
            // Sort patterns: play small non-bombs first
            const candidates = [...currentSplit];
            candidates.sort((a, b) => {
                var _a, _b;
                // Prefer non-bombs
                const aBomb = a.type === 'FOUR' || (a.type === 'PAIR' && ((_a = a.extra) === null || _a === void 0 ? void 0 : _a.isKingBomb)) || a.type === 'TRIPLE';
                const bBomb = b.type === 'FOUR' || (b.type === 'PAIR' && ((_b = b.extra) === null || _b === void 0 ? void 0 : _b.isKingBomb)) || b.type === 'TRIPLE';
                if (aBomb && !bBomb)
                    return 1;
                if (!aBomb && bBomb)
                    return -1;
                // Prefer lower strength
                return a.strength - b.strength;
            });
            return { type: 'play', cards: candidates[0].cards };
        }
        return { type: 'play', cards: options[0] };
    }
    // 2. If Following
    // Find best option that minimizes remaining turns
    let bestOption = options[0];
    let bestScore = Number.MAX_SAFE_INTEGER;
    for (const opt of options) {
        const score = evaluateMove(opt);
        if (score < bestScore) {
            bestScore = score;
            bestOption = opt;
        }
    }
    // Strategic Pass Check
    const isOpponentBomb = effectiveLastPlay.type === 'TRIPLE' || effectiveLastPlay.type === 'FOUR' || (effectiveLastPlay.type === 'PAIR' && ((_a = effectiveLastPlay.extra) === null || _a === void 0 ? void 0 : _a.isKingBomb));
    const myMovePattern = (0, patterns_1.detectPattern)(bestOption);
    const isMyBomb = myMovePattern.type === 'TRIPLE' || myMovePattern.type === 'FOUR' || (myMovePattern.type === 'PAIR' && ((_b = myMovePattern.extra) === null || _b === void 0 ? void 0 : _b.isKingBomb));
    if (!isOpponentBomb && isMyBomb) {
        // Opponent played normal, I am using a bomb.
        // Only do this if I am close to winning or opponent is close to winning.
        const opponentIdx = effectiveLastPlay.by;
        const opponentHandSize = state.hands[opponentIdx].length;
        const myHandSize = hand.length;
        if (opponentHandSize > 5 && myHandSize > 5) {
            return { type: 'pass' };
        }
    }
    return { type: 'play', cards: bestOption };
}
