export type QuickVoiceKey = string

export const QUICK_VOICES: Array<{ label: string; file: string }> = [
  { label: '不要走~决战到天亮', file: '不要走~决战到天亮.mp3' },
  { label: '你们可能不知道', file: '你们可能不知道.mp3' },
  { label: '你是MM还是哥哥~', file: '你是MM还是哥哥~.mp3' },
  { label: '全体起立', file: '全体起立.mp3' },
  { label: '卢本伟广场', file: '卢本伟广场.mp3' },
  { label: '当年陈刀仔', file: '当年陈刀仔.mp3' },
  { label: '得得得得得得得得得得得得', file: '得得得得得得得得得得得得.mp3' },
  { label: '快点啊，都的我花都谢了', file: '快点啊，都的我花都谢了.mp3' },
  { label: '玩游戏一定要笑', file: '玩游戏一定要笑.mp3' },
]

const BASE = `${import.meta.env.BASE_URL}assets/sounds/quickchat`.replace(/\/+/g, '/')

export function isQuickVoiceLabel(label: string): boolean {
  return QUICK_VOICES.some(v => v.label === label)
}

export function playQuickVoiceByLabel(label: string, volume: number = 0.85) {
  const voice = QUICK_VOICES.find(v => v.label === label)
  if (!voice) return

  try {
    const audio = new Audio(`${BASE}/${encodeURIComponent(voice.file)}`)
    audio.volume = Math.max(0, Math.min(1, volume))
    audio.play().catch(() => {})
  } catch {
    // ignore
  }
}
