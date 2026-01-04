/**
 * BGM 播放器服务
 * 支持大厅/游戏中/胜利/失败等场景的背景音乐
 */

type BGMScene = 'lobby' | 'game' | 'win' | 'lose' | 'none'

const BASE = `${import.meta.env.BASE_URL}assets/sounds/bgm`.replace(/\/+/g, '/')

// BGM 文件映射（可根据实际文件调整）
const BGM_FILES: Record<BGMScene, string | null> = {
  lobby: 'lobby.mp3',
  game: 'game.mp3',
  win: 'win.mp3',
  lose: 'lose.mp3',
  none: null,
}

// 场景音量配置
const VOLUME_CONFIG: Record<BGMScene, number> = {
  lobby: 0.3,
  game: 0.2,
  win: 0.5,
  lose: 0.4,
  none: 0,
}

class BGMPlayer {
  private audio: HTMLAudioElement | null = null
  private currentScene: BGMScene = 'none'
  private enabled: boolean = true
  private volume: number = 0.3
  private fadeInterval: number | null = null

  constructor() {
    // 从 localStorage 读取用户偏好
    if (typeof window !== 'undefined') {
      const savedEnabled = localStorage.getItem('bgm_enabled')
      const savedVolume = localStorage.getItem('bgm_volume')
      if (savedEnabled !== null) this.enabled = savedEnabled === 'true'
      if (savedVolume !== null) this.volume = parseFloat(savedVolume)
    }
  }

  /**
   * 播放指定场景的 BGM
   */
  play(scene: BGMScene) {
    if (!this.enabled || scene === 'none') {
      this.stop()
      return
    }

    // 如果已经在播放同一场景，不重复
    if (this.currentScene === scene && this.audio && !this.audio.paused) {
      return
    }

    const file = BGM_FILES[scene]
    if (!file) {
      this.stop()
      return
    }

    // 淡出当前音乐
    this.fadeOut(() => {
      this.currentScene = scene
      this.audio = new Audio(`${BASE}/${file}`)
      this.audio.loop = scene === 'lobby' || scene === 'game' // 大厅和游戏中循环
      this.audio.volume = 0

      // 处理加载错误（文件不存在时静默失败）
      this.audio.onerror = () => {
        console.warn(`BGM file not found: ${file}`)
      }

      // 播放并淡入
      this.audio.play().then(() => {
        this.fadeIn(VOLUME_CONFIG[scene] * this.volume)
      }).catch(() => {
        // 自动播放被阻止，等用户交互后再播放
      })
    })
  }

  /**
   * 停止播放
   */
  stop() {
    this.fadeOut(() => {
      if (this.audio) {
        this.audio.pause()
        this.audio.currentTime = 0
        this.audio = null
      }
      this.currentScene = 'none'
    })
  }

  /**
   * 暂停
   */
  pause() {
    if (this.audio) {
      this.audio.pause()
    }
  }

  /**
   * 恢复
   */
  resume() {
    if (this.audio && this.enabled) {
      this.audio.play().catch(() => {})
    }
  }

  /**
   * 设置是否启用 BGM
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    localStorage.setItem('bgm_enabled', String(enabled))
    if (!enabled) {
      this.stop()
    }
  }

  /**
   * 获取是否启用
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 设置音量 (0-1)
   */
  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol))
    localStorage.setItem('bgm_volume', String(this.volume))
    if (this.audio) {
      this.audio.volume = VOLUME_CONFIG[this.currentScene] * this.volume
    }
  }

  /**
   * 获取当前音量
   */
  getVolume(): number {
    return this.volume
  }

  /**
   * 获取当前场景
   */
  getCurrentScene(): BGMScene {
    return this.currentScene
  }

  // 淡入效果
  private fadeIn(targetVolume: number) {
    if (!this.audio) return
    this.clearFade()
    
    let vol = 0
    this.fadeInterval = window.setInterval(() => {
      vol += 0.02
      if (vol >= targetVolume) {
        vol = targetVolume
        this.clearFade()
      }
      if (this.audio) this.audio.volume = vol
    }, 50)
  }

  // 淡出效果
  private fadeOut(callback?: () => void) {
    if (!this.audio || this.audio.volume === 0) {
      callback?.()
      return
    }
    
    this.clearFade()
    
    let vol = this.audio.volume
    this.fadeInterval = window.setInterval(() => {
      vol -= 0.05
      if (vol <= 0) {
        vol = 0
        this.clearFade()
        callback?.()
      }
      if (this.audio) this.audio.volume = vol
    }, 30)
  }

  private clearFade() {
    if (this.fadeInterval !== null) {
      clearInterval(this.fadeInterval)
      this.fadeInterval = null
    }
  }
}

// 单例导出
export const bgmPlayer = new BGMPlayer()
export type { BGMScene }
