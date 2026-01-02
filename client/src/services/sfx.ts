type SfxEvt = {
  kind?: string
  patternType?: string
  isKingBomb?: boolean
  count?: number
  cardRank?: string // e.g. '3', '4', ..., 'K', 'A', '2', 'JOKER_SMALL', 'JOKER_BIG'
}

const BASE = '/assets/sounds'

// Simple SFX fallbacks
const MAP: Record<string, string> = {
  pass: 'sfx_pass.wav',
  qi: 'sfx_qi.wav',
  bomb: 'sfx_bomb.wav',
  king_bomb: 'sfx_king_bomb.wav',
  play_single: 'sfx_play_single.wav',
  play_pair: 'sfx_play_pair.wav',
  play_triple: 'sfx_play_triple.wav',
  play_straight: 'sfx_play_straight.wav',
  play_double_sequence: 'sfx_play_double_sequence.wav',
  play_unknown: 'sfx_play_single.wav',
}

// Voice files mapping (from DouDZ)
// dan1-dan15: single card voices (3=1, 4=2, ..., K=11, A=12, 2=13, 小王=14, 大王=15)
// dui1-dui13: pair voices (3=1, ..., 2=13)
// tuple1-tuple13: triple/bomb voices (3=1, ..., 2=13)
const RANK_TO_INDEX: Record<string, number> = {
  '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8,
  'J': 9, 'Q': 10, 'K': 11, 'A': 12, '2': 13,
  'JOKER_SMALL': 14, 'JOKER_BIG': 15
}

// Random buyao voice (1-3)
function randomBuyao(): string {
  const n = Math.floor(Math.random() * 3) + 1
  return `voice/buyao${n}.ogg`
}

// Pick voice file based on event
function pickVoiceFile(evt: any): string | null {
  const kind = evt?.kind
  
  if (kind === 'pass') {
    return randomBuyao()
  }
  
  if (kind === 'qi') {
    // 起炸/起轰 - use special bomb sound
    return 'voice/special_bomb.ogg'
  }
  
  if (kind !== 'play') return null

  const patternType: string | undefined = evt?.patternType ?? evt?.pattern?.type
  const isKingBomb = !!(evt?.isKingBomb ?? evt?.pattern?.extra?.isKingBomb)
  const cardRank = evt?.cardRank

  // King bomb (王炸)
  if (patternType === 'PAIR' && isKingBomb) {
    return 'voice/wangzha.ogg'
  }

  // Bomb/Hong (炸弹/轰)
  if (patternType === 'FOUR' || patternType === 'TRIPLE') {
    const idx = cardRank ? RANK_TO_INDEX[cardRank] : null
    if (patternType === 'FOUR' && idx && idx <= 13) {
      // 轰 uses tuple voice (same as triple in DouDZ)
      return `voice/tuple${idx}.ogg`
    }
    if (patternType === 'TRIPLE' && idx && idx <= 13) {
      return `voice/tuple${idx}.ogg`
    }
    // Fallback
    return 'voice/zhadan.ogg'
  }

  // Straight (顺子)
  if (patternType === 'STRAIGHT') {
    return 'voice/shunzi.ogg'
  }

  // Double sequence (连对)
  if (patternType === 'DOUBLE_SEQUENCE') {
    return 'voice/liandui.ogg'
  }

  // Pair (对子)
  if (patternType === 'PAIR') {
    const idx = cardRank ? RANK_TO_INDEX[cardRank] : null
    if (idx && idx <= 13) {
      return `voice/dui${idx}.ogg`
    }
    return null // fallback to simple sfx
  }

  // Single (单张)
  if (patternType === 'SINGLE') {
    const idx = cardRank ? RANK_TO_INDEX[cardRank] : null
    if (idx && idx <= 15) {
      return `voice/dan${idx}.ogg`
    }
    return null
  }

  return null
}

// Simple SFX fallback
function pickSimpleSfx(evt: any): string | null {
  const kind = evt?.kind
  if (kind === 'pass') return MAP.pass
  if (kind === 'qi') return MAP.qi
  if (kind !== 'play') return null

  const patternType: string | undefined = evt?.patternType ?? evt?.pattern?.type
  const isKingBomb = !!(evt?.isKingBomb ?? evt?.pattern?.extra?.isKingBomb)

  if (patternType === 'FOUR') return MAP.bomb
  if (patternType === 'PAIR' && isKingBomb) return MAP.king_bomb
  if (patternType === 'SINGLE') return MAP.play_single
  if (patternType === 'PAIR') return MAP.play_pair
  if (patternType === 'TRIPLE') return MAP.bomb
  if (patternType === 'STRAIGHT') return MAP.play_straight
  if (patternType === 'DOUBLE_SEQUENCE') return MAP.play_double_sequence

  return MAP.play_unknown
}

export function playSfx(evt: SfxEvt) {
  // Try voice first, then fallback to simple SFX
  const voiceFile = pickVoiceFile(evt)
  
  if (voiceFile) {
    try {
      const audio = new Audio(`${BASE}/${voiceFile}`)
      audio.volume = 0.7
      void audio.play()
    } catch {
      // Voice failed, try simple SFX
      const simpleFile = pickSimpleSfx(evt)
      if (simpleFile) {
        try {
          const fallback = new Audio(`${BASE}/${simpleFile}`)
          fallback.volume = 0.6
          void fallback.play()
        } catch {}
      }
    }
    return
  }

  // No voice available, use simple SFX
  const file = pickSimpleSfx(evt)
  if (!file) return

  try {
    const audio = new Audio(`${BASE}/${file}`)
    audio.volume = 0.6
    void audio.play()
  } catch {
    // Ignore autoplay / decode errors
  }
}

// Play special effect sound (for bomb VFX etc)
export function playSpecialSfx(type: 'bomb' | 'wangzha' | 'flower' | 'multiply' | 'plane' | 'star') {
  const files: Record<string, string> = {
    bomb: 'voice/special_bomb.ogg',
    wangzha: 'voice/special_bomb_wangzha.ogg',
    flower: 'voice/special_flower.ogg',
    multiply: 'voice/special_multiply.ogg',
    plane: 'voice/special_plane.ogg',
    star: 'voice/special_star.ogg'
  }
  
  const file = files[type]
  if (!file) return
  
  try {
    const audio = new Audio(`${BASE}/${file}`)
    audio.volume = 0.8
    void audio.play()
  } catch {}
}
