type SfxEvt = {
  kind?: string
  patternType?: string
  isKingBomb?: boolean
  count?: number
}

const BASE = '/assets/sounds'

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

function pickFile(evt: any): string | null {
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
  if (patternType === 'TRIPLE') return MAP.play_triple
  if (patternType === 'STRAIGHT') return MAP.play_straight
  if (patternType === 'DOUBLE_SEQUENCE') return MAP.play_double_sequence

  return MAP.play_unknown
}

export function playSfx(evt: SfxEvt) {
  const file = pickFile(evt)
  if (!file) return

  try {
    const audio = new Audio(`${BASE}/${file}`)
    audio.volume = 0.6
    void audio.play()
  } catch {
    // Ignore autoplay / decode errors
  }
}
