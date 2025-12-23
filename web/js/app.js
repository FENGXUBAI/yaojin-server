/**
 * 要进扑克 - 主应用
 */
const App = {
  // 当前屏幕
  currentScreen: 'loading',
  
  // 用户信息
  user: null,
  
  // 游戏状态
  isOnline: false,
  
  /**
   * 初始化应用
   */
  init() {
    // 初始化音效
    if (window.Sound) Sound.init();
    
    // 绑定事件
    this.bindEvents();
    
    // 加载用户信息
    this.loadUser();
    
    // 模拟加载
    setTimeout(() => {
      this.showScreen(this.user ? 'lobby' : 'login');
    }, 1500);
  },
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // --- 登录页 ---
    this.bindClick('quick-start-btn', () => this.quickStart());
    this.bindClick('create-room-btn', () => this.showRoomModal('create'));
    this.bindClick('join-room-btn', () => this.showRoomModal('join'));
    
    // --- 大厅页 ---
    this.bindClick('mode-quick', () => this.startGame('local'));
    this.bindClick('mode-friend', () => this.showRoomModal('create')); // 暂时都弹窗
    this.bindClick('settings-btn', () => this.showNotification('设置功能开发中...'));
    
    // --- 游戏页 ---
    this.bindClick('exit-game-btn', () => this.confirmExit());
    this.bindClick('game-settings-btn', () => this.showNotification('设置功能开发中...'));
    
    // 游戏操作
    this.bindClick('btn-play', () => this.playCards());
    this.bindClick('btn-pass', () => this.pass());
    this.bindClick('btn-hint', () => this.hint());
    this.bindClick('btn-prepare', () => this.prepare());
    
    // --- 弹窗 ---
    this.bindClick('close-room-modal', () => this.hideModal('room-modal'));
    this.bindClick('confirm-create-btn', () => this.createRoom());
    this.bindClick('confirm-join-btn', () => this.joinRoom());
    this.bindClick('result-confirm-btn', () => {
      this.hideModal('result-modal');
      this.prepare();
    });
    
    // 房间弹窗Tab切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchRoomTab(tab);
      });
    });
  },
  
  bindClick(id, handler) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', handler);
    }
  },
  
  /**
   * 切换屏幕
   */
  showScreen(screenId) {
    // 隐藏所有屏幕
    document.querySelectorAll('.screen').forEach(el => {
      el.classList.remove('active');
    });
    
    // 显示目标屏幕
    const target = document.getElementById(`${screenId}-screen`);
    if (target) {
      target.classList.add('active');
      this.currentScreen = screenId;
    }
    
    // 如果是大厅，更新用户信息
    if (screenId === 'lobby') {
      this.updateLobbyUI();
    }
  },
  
  /**
   * 加载用户
   */
  loadUser() {
    const saved = localStorage.getItem('yaojin_user');
    if (saved) {
      try {
        this.user = JSON.parse(saved);
      } catch (e) {
        console.error('Load user failed', e);
      }
    }
  },
  
  saveUser() {
    if (this.user) {
      localStorage.setItem('yaojin_user', JSON.stringify(this.user));
    }
  },
  
  /**
   * 快速开始 (登录页)
   */
  quickStart() {
    const input = document.getElementById('nickname-input');
    const name = input.value.trim() || '玩家' + Math.floor(Math.random() * 1000);
    
    this.user = {
      id: Date.now().toString(),
      name: name,
      coins: 1000
    };
    this.saveUser();
    this.showScreen('lobby');
  },
  
  /**
   * 更新大厅UI
   */
  updateLobbyUI() {
    if (!this.user) return;
    document.getElementById('lobby-username').textContent = this.user.name;
    document.getElementById('lobby-userid').textContent = `ID: ${this.user.id.slice(-6)}`;
    document.getElementById('lobby-avatar').textContent = this.user.name[0];
  },
  
  /**
   * 显示房间弹窗
   */
  showRoomModal(tab) {
    this.showModal('room-modal');
    this.switchRoomTab(tab);
  },
  
  switchRoomTab(tab) {
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // 更新内容显示
    document.getElementById('create-room-form').classList.toggle('active', tab === 'create');
    document.getElementById('join-room-form').classList.toggle('active', tab === 'join');
  },
  
  /**
   * 开始游戏
   */
  startGame(mode) {
    this.isOnline = (mode === 'online');
    this.showScreen('game');
    
    // 初始化游戏逻辑
    Game.init(this.user.name);
    
    // 渲染初始界面
    this.renderGame();
    
    // 如果不是玩家先手，触发AI
    if (Game.state.currentPlayer !== 0) {
      this.runAI();
    } else {
      this.showNotification('轮到你了');
    }
  },
  
  /**
   * 渲染游戏界面 (核心)
   */
  renderGame() {
    const state = Game.state;
    if (!state) return;
    
    // 1. 渲染手牌
    this.renderHand();
    
    // 2. 渲染对手信息
    this.renderOpponents();
    
    // 3. 渲染出牌区
    this.renderPlayArea();
    
    // 4. 更新按钮状态
    this.updateButtons();
    
    // 5. 更新自身信息
    document.getElementById('my-name').textContent = this.user.name;
    document.getElementById('my-score').textContent = `💰 ${this.user.coins}`;
    document.getElementById('my-avatar').textContent = this.user.name[0];
  },
  
  /**
   * 渲染手牌
   */
  renderHand() {
    const container = document.getElementById('hand-cards');
    container.innerHTML = '';
    
    const hand = Game.state.players[0].hand;
    hand.forEach((card, index) => {
      const el = Cards.createCardElement(card, index);
      
      // 选中状态
      if (Game.selectedCards.has(card.id)) {
        el.classList.add('selected');
      }
      
      // 点击事件
      el.addEventListener('click', () => this.onCardClick(card));
      
      container.appendChild(el);
    });
  },
  
  /**
   * 渲染对手
   */
  renderOpponents() {
    const players = Game.state.players;
    
    // 机器人A (Top) - Index 1
    this.updateOpponentUI('top', players[1]);
    
    // 机器人B (Left) - Index 2
    this.updateOpponentUI('left', players[2]);
    
    // 如果有第四人...
  },
  
  updateOpponentUI(position, player) {
    const el = document.getElementById(`opponent-${position}`);
    if (!el || !player) return;
    
    el.querySelector('.name').textContent = player.name;
    el.querySelector('.card-count-badge').textContent = player.hand.length;
    
    // 高亮当前出牌者
    const isCurrent = Game.state.players.indexOf(player) === Game.state.currentPlayer;
    el.querySelector('.turn-indicator').classList.toggle('hidden', !isCurrent);
  },
  
  /**
   * 渲染出牌区
   */
  renderPlayArea() {
    // 清空所有出牌区
    ['self', 'top', 'left', 'right'].forEach(pos => {
      const el = document.getElementById(`last-played-${pos}`);
      if (el) el.innerHTML = '';
    });
    
    // 显示最后出的牌
    if (Game.state.lastPlay && Game.state.lastPlayIndex !== -1) {
      const idx = Game.state.lastPlayIndex;
      let pos = 'self';
      if (idx === 1) pos = 'top';
      if (idx === 2) pos = 'left';
      
      const container = document.getElementById(`last-played-${pos}`);
      if (container) {
        Game.state.lastPlay.cards.forEach(card => {
          container.appendChild(Cards.createCardElement(card));
        });
      }
    }
  },
  
  /**
   * 更新按钮
   */
  updateButtons() {
    const isMyTurn = Game.state.currentPlayer === 0;
    const actionBar = document.getElementById('action-bar');
    
    // 隐藏所有按钮
    Array.from(actionBar.children).forEach(btn => btn.classList.add('hidden'));
    
    if (isMyTurn) {
      const playBtn = document.getElementById('btn-play');
      const passBtn = document.getElementById('btn-pass');
      const hintBtn = document.getElementById('btn-hint');
      
      playBtn.classList.remove('hidden');
      hintBtn.classList.remove('hidden');
      
      // 如果必须出牌（比如我是先手，或者上一轮大家都不要），则不能不要
      const mustPlay = !Game.state.lastPlay || Game.state.lastPlayIndex === 0;
      if (!mustPlay) {
        passBtn.classList.remove('hidden');
      }
    }
  },
  
  /**
   * 点击卡牌
   */
  onCardClick(card) {
    if (Game.selectedCards.has(card.id)) {
      Game.selectedCards.delete(card.id);
    } else {
      Game.selectedCards.add(card.id);
    }
    this.renderHand();
  },
  
  /**
   * 出牌
   */
  playCards() {
    const selected = Array.from(Game.selectedCards);
    if (selected.length === 0) {
      this.showNotification('请选择要出的牌');
      return;
    }
    
    // 尝试出牌
    const result = Game.play(selected);
    if (result.success) {
      if (window.Sound) Sound.play('card_play');
      this.renderGame();
      
      // 检查游戏结束
      if (Game.checkGameOver()) {
        this.onGameOver();
      } else {
        this.runAI();
      }
    } else {
      this.showNotification(result.message || '出牌不符合规则');
    }
  },
  
  /**
   * 不要
   */
  pass() {
    const result = Game.pass();
    if (result.success) {
      if (window.Sound) Sound.play('pass');
      this.renderGame();
      this.runAI();
    } else {
      this.showNotification('你必须出牌');
    }
  },
  
  /**
   * 提示
   */
  hint() {
    const hintCards = Game.getHint();
    if (hintCards) {
      Game.selectedCards.clear();
      hintCards.forEach(id => Game.selectedCards.add(id));
      this.renderHand();
    } else {
      this.showNotification('没有大过上家的牌');
    }
  },
  
  /**
   * 运行AI
   */
  runAI() {
    setTimeout(() => {
      if (Game.state.currentPlayer === 0) return; // 轮到玩家了
      
      Game.playAI();
      this.renderGame();
      
      if (Game.checkGameOver()) {
        this.onGameOver();
      } else {
        // 如果还是AI回合（比如连出），继续
        if (Game.state.currentPlayer !== 0) {
          this.runAI();
        } else {
          this.showNotification('轮到你了');
        }
      }
    }, 1000);
  },
  
  /**
   * 游戏结束
   */
  onGameOver() {
    const winner = Game.state.winner;
    const isWin = winner === 0;
    
    const title = document.getElementById('result-title');
    title.textContent = isWin ? '胜利!' : '失败';
    title.style.color = isWin ? 'var(--primary)' : 'var(--text-muted)';
    
    if (window.Sound) Sound.play(isWin ? 'win' : 'lose');
    
    // 显示分数
    const scoresDiv = document.getElementById('result-scores');
    scoresDiv.innerHTML = '';
    
    Game.state.players.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = `score-row ${i === winner ? 'winner' : ''}`;
      row.innerHTML = `
        <span>${p.name}</span>
        <span>${i === winner ? '+100' : '-50'}</span>
      `;
      scoresDiv.appendChild(row);
    });
    
    this.showModal('result-modal');
  },
  
  /**
   * 准备（下一局）
   */
  prepare() {
    this.startGame('local');
  },
  
  /**
   * 退出游戏
   */
  confirmExit() {
    if (confirm('确定要退出游戏吗？')) {
      this.showScreen('lobby');
    }
  },
  
  // --- 辅助功能 ---
  
  showModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
  },
  
  hideModal(id) {
    document.getElementById(id)?.classList.add('hidden');
  },
  
  showNotification(msg, duration = 2000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

// 启动应用
window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
