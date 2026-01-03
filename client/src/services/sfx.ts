type SfxEvt = {
  kind?: string
  patternType?: string
  isKingBomb?: boolean
  count?: number
  cardRank?: string // e.g. '3', '4', ..., 'K', 'A', '2', 'JOKER_SMALL', 'JOKER_BIG'
}

const BASE = `${import.meta.env.BASE_URL}assets/sounds`.replace(/\/+/g, '/')

// Simple SFX fallbacks
const MAP: Record<string, string> = {
  pass: 'sfx_pass.wav',
  qi: 'sfx_qi.wav',
  bomb: 'common/bomb.mp3',
  king_bomb: 'common/rocket.mp3',
  play_single: 'sfx_play_single.wav',
  play_pair: 'sfx_play_pair.wav',
  play_triple: 'sfx_play_triple.wav',
  play_straight: 'common/shunzi.mp3',
  play_double_sequence: 'common/continuous_pair.mp3',
  play_unknown: 'sfx_play_single.wav',
  // Common sounds
  deal: 'common/fapai.mp3',
  select: 'common/click_cards.mp3',
  button_click: 'common/audio_button_click.mp3',
  win: 'common/Victory.mp3',
  lose: 'common/Failure.mp3',
  coins: 'common/coins_fly.mp3',
  multiply: 'common/beishu.mp3',
}

// Voice files mapping (corrected)
// dan1-dan15: A=1, 2=2, 3=3, 4=4, 5=5, 6=6, 7=7, 8=8, 9=9, 10=10, J=11, Q=12, K=13, 小王=14, 大王=15
// dui1-dui13: A=1, 2=2, 3=3, ..., K=13
// tuple1-tuple13: A=1, 2=2, 3=3, ..., K=13
const RANK_TO_INDEX: Record<string, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13,
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
export function playSpecialSfx(type: 'bomb' | 'wangzha' | 'flower' | 'multiply' | 'plane' | 'star' | 'deal' | 'select' | 'win' | 'lose' | 'coins' | 'button') {
  const files: Record<string, string> = {
    bomb: 'common/bomb.mp3',
    wangzha: 'common/rocket.mp3',
    flower: 'voice/special_flower.ogg',
    multiply: 'common/beishu.mp3',
    plane: 'common/airplane_the_first_time.mp3',
    star: 'voice/special_star.ogg',
    deal: 'common/fapai.mp3',
    select: 'common/click_cards.mp3',
    win: 'common/Victory.mp3',
    lose: 'common/Failure.mp3',
    coins: 'common/coins_fly.mp3',
    button: 'common/audio_button_click.mp3'
  }
  
  const file = files[type]
  if (!file) return
  
  try {
    const audio = new Audio(`${BASE}/${file}`)
    audio.volume = 0.8
    void audio.play()
  } catch {}
}
