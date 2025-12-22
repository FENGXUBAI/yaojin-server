/**
 * 音效管理
 */
const Sound = {
  // 音频缓存
  cache: {},
  
  // 是否启用
  enabled: true,
  
  // 音量
  volume: 1.0,
  
  // 音效路径
  PATHS: {
    // 牌型
    single: 'assets/sounds/sfx_play_single.wav',
    pair: 'assets/sounds/sfx_play_pair.wav',
    triple: 'assets/sounds/sfx_play_triple.wav',
    straight: 'assets/sounds/sfx_play_straight.wav',
    double_straight: 'assets/sounds/sfx_play_double_sequence.wav',
    bomb: 'assets/sounds/sfx_bomb.wav',
    hong: 'assets/sounds/sfx_bomb.wav',
    rocket: 'assets/sounds/sfx_king_bomb.wav',
    
    // UI
    select: 'assets/sounds/sfx_select.wav',
    pass: 'assets/sounds/sfx_pass.wav',
    my_turn: 'assets/sounds/sfx_start.wav',
    win: 'assets/sounds/sfx_high.wav',
    lose: 'assets/sounds/sfx_pass.wav',
    click: 'assets/sounds/sfx_select.wav',
    countdown: 'assets/sounds/sfx_qi.wav',
    
    // BGM
    bgm_menu: 'assets/sounds/bg.mp3',
    bgm_game: 'assets/sounds/bg.mp3'
  },
  
  /**
   * 初始化
   */
  init() {
    // 预加载常用音效
    this.preload(['select', 'pass', 'single', 'pair', 'bomb']);
  },
  
  /**
   * 预加载音效
   */
  preload(keys) {
    for (const key of keys) {
      if (this.PATHS[key] && !this.cache[key]) {
        const audio = new Audio(this.PATHS[key]);
        audio.load();
        this.cache[key] = audio;
      }
    }
  },
  
  /**
   * 播放音效
   */
  play(key) {
    if (!this.enabled) return;
    
    const path = this.PATHS[key];
    if (!path) {
      console.warn('Unknown sound:', key);
      return;
    }
    
    try {
      let audio = this.cache[key];
      if (!audio) {
        audio = new Audio(path);
        this.cache[key] = audio;
      } else {
        // 克隆以支持重叠播放
        audio = audio.cloneNode();
      }
      
      audio.volume = this.volume;
      audio.play().catch(e => {
        console.warn('Sound play failed:', e);
      });
      
      return audio;
    } catch (e) {
      console.error('Sound error:', e);
    }
  },
  
  /**
   * 根据牌型播放音效
   */
  playCard(pattern) {
    if (!pattern) return;
    
    const type = pattern.type;
    
    // 炸弹类型优先
    if (pattern.isBomb) {
      this.play('bomb');
      return;
    }
    
    // 根据类型播放
    switch (type) {
      case Patterns.TYPES.SINGLE:
        this.play('single');
        break;
      case Patterns.TYPES.PAIR:
        this.play('pair');
        break;
      case Patterns.TYPES.TRIPLE:
        this.play('triple');
        break;
      case Patterns.TYPES.STRAIGHT:
        this.play('straight');
        break;
      case Patterns.TYPES.DOUBLE_STRAIGHT:
        this.play('double_straight');
        break;
      default:
        this.play('single');
    }
  },
  
  /**
   * 播放BGM
   */
  playBGM(key) {
    if (!this.enabled) return;
    
    this.stopBGM();
    
    const path = this.PATHS[key];
    if (path) {
      this.bgm = new Audio(path);
      this.bgm.loop = true;
      this.bgm.volume = this.volume * 0.5;
      this.bgm.play().catch(e => console.warn('BGM play failed:', e));
    }
  },
  
  /**
   * 停止BGM
   */
  stopBGM() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }
  },
  
  /**
   * 设置启用状态
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopBGM();
    }
  },
  
  /**
   * 设置音量
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.bgm) {
      this.bgm.volume = this.volume * 0.5;
    }
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Sound;
}
