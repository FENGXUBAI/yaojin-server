/**
 * 工具函数
 */
const Utils = {
  /**
   * 生成随机ID
   */
  generateId() {
    return Math.random().toString(36).substr(2, 9);
  },
  
  /**
   * 洗牌算法 (Fisher-Yates)
   */
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  },
  
  /**
   * 延时函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  /**
   * 获取本地存储
   */
  getStorage(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  
  /**
   * 设置本地存储
   */
  setStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  },
  
  /**
   * 格式化数字
   */
  formatNumber(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toString();
  },
  
  /**
   * 震动反馈
   */
  vibrate(type = 'light') {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30, 10, 30]
      };
      navigator.vibrate(patterns[type] || patterns.light);
    }
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
