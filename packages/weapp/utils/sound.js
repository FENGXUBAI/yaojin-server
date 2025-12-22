/**
 * 音效管理模块 - 要进游戏
 * 统一管理所有游戏音效的播放
 */

// 音效缓存
const audioCache = {};

// 音效路径映射
const SOUND_PATHS = {
  // 出牌音效
  play_single: '/assets/sounds/sfx_play_single.wav',
  play_pair: '/assets/sounds/sfx_play_pair.wav',
  play_triple: '/assets/sounds/sfx_play_triple.wav',
  play_straight: '/assets/sounds/sfx_play_straight.wav',
  
  // 特殊牌型
  bomb: '/assets/sounds/sfx_bomb.wav',
  king_bomb: '/assets/sounds/sfx_king_bomb.wav',
  
  // 游戏事件
  deal: '/assets/sounds/sfx_deal.wav',
  pass: '/assets/sounds/sfx_pass.wav',
  win: '/assets/sounds/sfx_start.wav',  // 使用start作为胜利音效
  lose: '/assets/sounds/sfx_pass.wav',  // 暂用pass音效
  my_turn: '/assets/sounds/sfx_qi.wav',
  
  // 按钮
  click: '/assets/sounds/select.mp3',
  select: '/assets/sounds/sfx_select.wav',
  
  // 警告
  warning: '/assets/sounds/sfx_high.wav',
  timeout: '/assets/sounds/sfx_high.wav'
};

// 是否启用音效
let soundEnabled = true;

// 音量（0-1）
let volume = 0.8;

/**
 * 初始化音效系统
 */
function init() {
  try {
    // 读取用户设置
    const settings = wx.getStorageSync('gameSettings') || {};
    soundEnabled = settings.soundEnabled !== false;
    volume = typeof settings.volume === 'number' ? settings.volume : 0.8;
  } catch (e) {
    console.warn('读取音效设置失败', e);
  }
}

/**
 * 创建或获取缓存的音频上下文
 */
function getAudioContext(name) {
  if (!audioCache[name]) {
    const path = SOUND_PATHS[name];
    if (!path) {
      console.warn(`未知音效: ${name}`);
      return null;
    }
    
    const audio = wx.createInnerAudioContext();
    audio.src = path;
    audio.obeyMuteSwitch = false; // 即使静音也播放
    audioCache[name] = audio;
  }
  return audioCache[name];
}

/**
 * 播放音效
 * @param {string} name - 音效名称
 * @param {Object} options - 选项 { volume, loop }
 */
function play(name, options = {}) {
  if (!soundEnabled) return;
  
  try {
    const audio = getAudioContext(name);
    if (!audio) return;
    
    // 设置音量
    audio.volume = options.volume ?? volume;
    
    // 设置循环
    audio.loop = options.loop ?? false;
    
    // 从头开始播放
    audio.stop();
    audio.seek(0);
    audio.play();
    
    return audio;
  } catch (e) {
    console.warn(`播放音效失败: ${name}`, e);
  }
}

/**
 * 根据牌型播放出牌音效
 * @param {string} patternType - 牌型类型
 */
function playCard(patternType) {
  switch (patternType) {
    case 'rocket':
    case 'wangzha':
      play('king_bomb');
      break;
    case 'bomb':
    case 'zha':
    case 'hong':
      play('bomb');
      break;
    case 'straight':
    case 'shunzi':
    case 'liandui':
    case 'double_straight':
      play('play_straight');
      break;
    case 'triple':
    case 'triple_one':
    case 'triple_pair':
    case 'triple_straight':
      play('play_triple');
      break;
    case 'pair':
    case 'duizi':
      play('play_pair');
      break;
    case 'single':
    case 'dan':
    default:
      play('play_single');
      break;
  }
}

/**
 * 停止所有音效
 */
function stopAll() {
  for (const name in audioCache) {
    try {
      audioCache[name].stop();
    } catch (e) {}
  }
}

/**
 * 释放所有音频资源
 */
function destroy() {
  for (const name in audioCache) {
    try {
      audioCache[name].destroy();
    } catch (e) {}
  }
  Object.keys(audioCache).forEach(k => delete audioCache[k]);
}

/**
 * 设置音效开关
 */
function setEnabled(enabled) {
  soundEnabled = enabled;
  if (!enabled) {
    stopAll();
  }
  // 保存设置
  try {
    const settings = wx.getStorageSync('gameSettings') || {};
    settings.soundEnabled = enabled;
    wx.setStorageSync('gameSettings', settings);
  } catch (e) {}
}

/**
 * 设置音量
 */
function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  // 保存设置
  try {
    const settings = wx.getStorageSync('gameSettings') || {};
    settings.volume = volume;
    wx.setStorageSync('gameSettings', settings);
  } catch (e) {}
}

/**
 * 获取当前设置
 */
function getSettings() {
  return { enabled: soundEnabled, volume };
}

// 初始化
init();

module.exports = {
  play,
  playCard,
  stopAll,
  destroy,
  setEnabled,
  setVolume,
  getSettings,
  SOUNDS: Object.keys(SOUND_PATHS)
};
