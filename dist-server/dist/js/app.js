/**
 * 要进扑克 - 主应用
 */
const App = {
  // 当前屏幕
  currentScreen: 'loading',
  
  // 用户信息
  user: null,
  
  // 当前提示索引
  hintIndex: 0,
  hints: [],
  
  // 联机模式
  isOnline: false,
  roomPlayers: [],
  myHand: [],
  myIndex: -1,
  gameState: null,
  
  /**
   * 初始化应用
   */
  init() {
    // 初始化音效
    Sound.init();
    
    // 绑定事件
    this.bindEvents();
    
    // 加载用户信息
    this.loadUser();
    
    // 设置网络事件
    this.setupNetworkEvents();
    
    // 模拟加载
    setTimeout(() => {
      this.showScreen(this.user ? 'lobby' : 'login');
    }, 1500);
  },
  
  /**
   * 设置网络事件
   */
  setupNetworkEvents() {
    Network.on('roomState', (state) => this.onRoomState(state));
    Network.on('roomUpdate', (state) => this.onRoomState(state));
    Network.on('privateState', (state) => this.onPrivateState(state));
    Network.on('gameState', (state) => this.onGameState(state));
    Network.on('turnResult', (result) => this.onTurnResult(result));
    Network.on('gameOver', (result) => this.onGameOver(result));
    Network.on('error', (err) => this.onNetworkError(err));
    Network.on('disconnected', () => this.onDisconnected());
  },
  
  /**
   * 绑定事件
   */
  bindEvents() {
    // 登录页 - 快速开始
    document.getElementById('quick-start-btn')?.addEventListener('click', () => {
      this.quickStartFromLogin();
    });
    
    // 登录页 - 创建房间
    document.getElementById('create-room-btn')?.addEventListener('click', () => {
      this.showRoomModal('create');
    });
    
    // 登录页 - 加入房间
    document.getElementById('join-room-btn')?.addEventListener('click', () => {
      this.showRoomModal('join');
    });
    
    // 大厅 - 快速开始（单机）
    document.getElementById('mode-quick')?.addEventListener('click', () => {
      this.startGame();
    });
    
    // 大厅 - 好友房间（联机）
    document.getElementById('mode-friend')?.addEventListener('click', () => {
      this.showModal('room-modal');
    });
    
    // 游戏控制
    document.getElementById('btn-play')?.addEventListener('click', () => {
      this.playCards();
    });
    
    document.getElementById('btn-pass')?.addEventListener('click', () => {
      this.pass();
    });
    
    document.getElementById('btn-hint')?.addEventListener('click', () => {
      this.hint();
    });
    
    // 模态框关闭
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close')) {
          this.closeAllModals();
        }
      });
    });
    
    // 阻止模态框内容区域点击冒泡
    document.querySelectorAll('.modal-content').forEach(el => {
      el.addEventListener('click', e => e.stopPropagation());
    });
    
    // 房间标签切换
    document.querySelectorAll('.room-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.room-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const tabId = 'tab-' + tab.dataset.tab;
        document.getElementById(tabId)?.classList.add('active');
      });
    });
    
    // 加入房间
    document.getElementById('btn-join-room')?.addEventListener('click', () => {
      this.joinRoom();
    });
    
    // 创建房间
    document.getElementById('btn-create-room')?.addEventListener('click', () => {
      this.createRoom();
    });
    
    // 开始游戏（房主）
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.startOnlineGame();
    });
    
    // 离开房间
    document.getElementById('btn-leave-room')?.addEventListener('click', () => {
      this.leaveRoom();
    });
    
    // 游戏结束弹窗
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      this.closeAllModals();
      if (this.isOnline) {
        // 联机模式等待下一局
      } else {
        this.startGame();
      }
    });
    
    document.getElementById('btn-back-lobby')?.addEventListener('click', () => {
      this.closeAllModals();
      if (this.isOnline) {
        this.leaveRoom();
      }
      this.showScreen('lobby');
    });
    
    // 规则按钮
    document.getElementById('action-rule')?.addEventListener('click', () => {
      this.showModal('rules-modal');
    });
    
    // 导航
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const target = item.dataset.page;
        if (target) {
          document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
          item.classList.add('active');
        }
      });
    });
  },
  
  /**
   * 显示屏幕
   */
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    
    const screen = document.getElementById(screenId + '-screen');
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = screenId;
    }
    
    // 显示/隐藏导航
    const nav = document.querySelector('.nav');
    if (nav) {
      nav.style.display = (screenId === 'lobby' || screenId === 'profile') ? 'flex' : 'none';
    }
  },
  
  /**
   * 显示模态框
   */
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },
  
  /**
   * 关闭所有模态框
   */
  closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('active');
    });
  },
  
  /**
   * 加载用户
   */
  loadUser() {
    const saved = Utils.getStorage('user');
    if (saved) {
      this.user = saved;
      this.updateUserUI();
    }
  },
  
  /**
   * 保存用户
   */
  saveUser() {
    if (this.user) {
      Utils.setStorage('user', this.user);
    }
  },
  
  /**
   * 更新用户界面
   */
  updateUserUI() {
    if (!this.user) return;
    
    // 更新大厅用户信息
    document.querySelectorAll('.user-name').forEach(el => {
      el.textContent = this.user.name;
    });
    
    document.querySelectorAll('.user-coins').forEach(el => {
      el.textContent = this.user.coins;
    });
    
    document.querySelectorAll('.user-level').forEach(el => {
      el.textContent = `Lv.${this.user.level}`;
    });
  },
  
  /**
   * 登录
   */
  login() {
    const nicknameInput = document.querySelector('#loginScreen input[type="text"]');
    const nickname = nicknameInput?.value?.trim();
    
    if (!nickname) {
      alert('请输入昵称');
      return;
    }
    
    this.user = {
      id: Utils.generateId(),
      name: nickname,
      level: 1,
      coins: 1000,
      exp: 0,
      wins: 0,
      losses: 0
    };
    
    this.saveUser();
    this.updateUserUI();
    this.showScreen('lobby');
    Sound.play('click');
  },
  
  /**
   * 游客登录
   */
  guestLogin() {
    this.user = {
      id: Utils.generateId(),
      name: '游客' + Math.floor(Math.random() * 10000),
      level: 1,
      coins: 500,
      exp: 0,
      wins: 0,
      losses: 0
    };
    
    this.saveUser();
    this.updateUserUI();
    this.showScreen('lobby');
    Sound.play('click');
  },
  
  /**
   * 从登录页快速开始
   */
  quickStartFromLogin() {
    const nicknameInput = document.getElementById('nickname-input');
    const nickname = nicknameInput?.value?.trim() || '玩家' + Math.floor(Math.random() * 10000);
    
    this.user = {
      id: Utils.generateId(),
      name: nickname,
      level: 1,
      coins: 1000,
      exp: 0,
      wins: 0,
      losses: 0
    };
    
    this.saveUser();
    this.updateUserUI();
    Sound.play('click');
    
    // 直接开始游戏
    this.startGame();
  },
  
  /**
   * 显示房间模态框
   */
  showRoomModal(mode) {
    const nicknameInput = document.getElementById('nickname-input');
    const nickname = nicknameInput?.value?.trim() || '玩家' + Math.floor(Math.random() * 10000);
    
    this.user = {
      id: Utils.generateId(),
      name: nickname,
      level: 1,
      coins: 1000,
      exp: 0,
      wins: 0,
      losses: 0
    };
    
    this.saveUser();
    this.updateUserUI();
    
    // 显示房间模态框
    this.showModal('room-modal');
    
    // 切换到对应标签
    if (mode === 'create') {
      document.querySelector('.room-tab[data-tab="create"]')?.click();
    } else if (mode === 'join') {
      document.querySelector('.room-tab[data-tab="join"]')?.click();
    }
  },
  
  /**
   * 开始游戏
   */
  startGame() {
    Sound.play('click');
    this.showScreen('game');
    
    // 初始化游戏
    Game.init(this.user?.name || '玩家');
    
    // 渲染界面
    this.renderGame();
    
    // 播放游戏BGM
    // Sound.playBGM('bgm_game');
    
    // 如果不是玩家回合，触发AI
    if (Game.state.currentPlayer !== 0) {
      this.runAI();
    } else {
      Sound.play('my_turn');
    }
  },
  
  /**
   * 渲染游戏界面
   */
  renderGame() {
    const state = Game.state;
    
    // 渲染玩家手牌
    this.renderHand();
    
    // 渲染对手牌数
    this.renderOpponents();
    
    // 渲染出牌区
    this.renderPlayArea();
    
    // 更新按钮状态
    this.updateButtons();
    
    // 更新当前玩家指示
    this.updateTurnIndicator();
  },
  
  /**
   * 渲染玩家手牌
   */
  renderHand() {
    const container = document.getElementById('hand-cards');
    if (!container) {
      console.error('hand-cards container not found');
      return;
    }
    
    container.innerHTML = '';
    
    const hand = Game.state.players[0].hand;
    hand.forEach((card, index) => {
      const cardEl = Cards.createCardElement(card);
      cardEl.style.animationDelay = `${index * 0.03}s`;
      
      if (Game.selectedCards.has(card.id)) {
        cardEl.classList.add('selected');
      }
      
      cardEl.addEventListener('click', () => {
        this.onCardClick(card);
      });
      
      container.appendChild(cardEl);
    });
    
    // 更新手牌数量
    const countEl = document.getElementById('hand-count');
    if (countEl) countEl.textContent = hand.length;
  },
  
  /**
   * 渲染对手
   */
  renderOpponents() {
    const state = Game.state;
    
    // 上方对手 (玩家1 - 机器人A)
    const topArea = document.getElementById('opponent-top');
    if (topArea) {
      const count1 = state.players[1].hand.length;
      const countEl = topArea.querySelector('.count-num');
      if (countEl) countEl.textContent = count1;
      const nameEl = topArea.querySelector('.player-name');
      if (nameEl) nameEl.textContent = state.players[1].name;
    }
    
    // 左边对手 (玩家2 - 机器人B)
    const leftArea = document.getElementById('opponent-left');
    if (leftArea) {
      const count2 = state.players[2].hand.length;
      const countEl = leftArea.querySelector('.count-num');
      if (countEl) countEl.textContent = count2;
      const nameEl = leftArea.querySelector('.player-name');
      if (nameEl) nameEl.textContent = state.players[2].name;
    }
  },
  
  /**
   * 渲染出牌区
   */
  renderPlayArea() {
    const container = document.getElementById('center-cards');
    if (!container) {
      console.error('center-cards container not found');
      return;
    }
    
    container.innerHTML = '';
    
    if (Game.state.lastPlay) {
      const cards = Game.state.lastPlay.cards;
      cards.forEach((card, index) => {
        const cardEl = Cards.createCardElement(card);
        cardEl.classList.add('played');
        cardEl.style.animationDelay = `${index * 0.05}s`;
        container.appendChild(cardEl);
      });
    }
    
    // 显示出牌标签
    const label = document.getElementById('play-label');
    if (label) {
      if (Game.state.lastPlay && Game.state.lastPlayIndex >= 0) {
        const playerName = Game.state.players[Game.state.lastPlayIndex].name;
        const typeName = Patterns.getTypeName(Game.state.lastPlay.type);
        label.textContent = `${playerName}: ${typeName}`;
        label.classList.remove('hidden');
      } else {
        label.classList.add('hidden');
      }
    }
    
    // 更新倍数
    const multiplierEl = document.getElementById('game-multiplier');
    if (multiplierEl) multiplierEl.textContent = Game.state.multiplier;
  },
  
  /**
   * 更新按钮状态
   */
  updateButtons() {
    const isMyTurn = Game.state.currentPlayer === 0;
    const canPass = Game.state.lastPlayIndex !== -1 && Game.state.lastPlayIndex !== 0;
    
    const actionBtns = document.getElementById('action-buttons');
    const playBtn = document.getElementById('btn-play');
    const passBtn = document.getElementById('btn-pass');
    const hintBtn = document.getElementById('btn-hint');
    
    // 显示/隐藏操作按钮
    if (actionBtns) {
      if (isMyTurn) {
        actionBtns.classList.remove('hidden');
      } else {
        actionBtns.classList.add('hidden');
      }
    }
    
    if (playBtn) {
      playBtn.disabled = !isMyTurn || Game.selectedCards.size === 0;
    }
    
    if (passBtn) {
      passBtn.disabled = !isMyTurn || !canPass;
    }
    
    if (hintBtn) {
      hintBtn.disabled = !isMyTurn;
    }
    
    // 更新计时器显示
    const timerSection = document.getElementById('timer-section');
    if (timerSection) {
      if (isMyTurn) {
        timerSection.classList.remove('hidden');
      } else {
        timerSection.classList.add('hidden');
      }
    }
  },
  
  /**
   * 更新回合指示
   */
  updateTurnIndicator() {
    const currentIdx = Game.state.currentPlayer;
    
    // 移除所有active
    document.querySelectorAll('.opponent-area').forEach(el => {
      el.classList.remove('current-turn');
      el.querySelector('.turn-indicator')?.classList.add('hidden');
    });
    document.querySelector('.player-bottom-area')?.classList.remove('current-turn');
    
    // 添加当前玩家标识
    if (currentIdx === 0) {
      document.querySelector('.player-bottom-area')?.classList.add('current-turn');
    } else if (currentIdx === 1) {
      const area = document.getElementById('opponent-top');
      area?.classList.add('current-turn');
      area?.querySelector('.turn-indicator')?.classList.remove('hidden');
    } else {
      const area = document.getElementById('opponent-left');
      area?.classList.add('current-turn');
      area?.querySelector('.turn-indicator')?.classList.remove('hidden');
    }
  },
  
  /**
   * 点击卡牌
   */
  onCardClick(card) {
    if (Game.state.currentPlayer !== 0) return;
    
    Game.toggleSelectCard(card.id);
    Sound.play('select');
    this.renderHand();
    this.updateButtons();
    
    // 重置提示
    this.hintIndex = 0;
    this.hints = [];
  },
  
  /**
   * 出牌
   */
  playCards() {
    const result = Game.playCards(Array.from(Game.selectedCards));
    
    if (!result.success) {
      alert(result.message);
      return;
    }
    
    // 播放音效
    Sound.playCard(result.pattern);
    Utils.vibrate(50);
    
    // 更新界面
    this.renderGame();
    
    // 重置提示
    this.hintIndex = 0;
    this.hints = [];
    
    // 检查游戏结束
    if (result.gameOver) {
      setTimeout(() => this.showGameResult(), 500);
      return;
    }
    
    // AI回合
    this.runAI();
  },
  
  /**
   * 不要
   */
  pass() {
    const result = Game.pass();
    
    if (!result.success) {
      alert(result.message);
      return;
    }
    
    Sound.play('pass');
    this.renderGame();
    
    // AI回合
    this.runAI();
  },
  
  /**
   * 提示
   */
  hint() {
    if (this.hints.length === 0) {
      this.hints = Game.getHint();
      this.hintIndex = 0;
    }
    
    if (this.hints.length === 0) {
      // 没有可出的牌
      return;
    }
    
    // 循环显示提示
    const hint = this.hints[this.hintIndex];
    Game.selectHint(hint);
    
    Sound.play('select');
    this.renderHand();
    this.updateButtons();
    
    // 下一个提示
    this.hintIndex = (this.hintIndex + 1) % this.hints.length;
  },
  
  /**
   * 运行AI
   */
  async runAI() {
    while (Game.state.status === 'playing' && Game.state.currentPlayer !== 0) {
      const result = await Game.aiTurn();
      
      if (result) {
        if (result.type === 'play') {
          Sound.playCard(result.pattern);
        } else {
          Sound.play('pass');
        }
        
        this.renderGame();
        
        if (result.gameOver) {
          setTimeout(() => this.showGameResult(), 500);
          return;
        }
      }
    }
    
    // 轮到玩家
    if (Game.state.currentPlayer === 0) {
      Sound.play('my_turn');
      this.renderGame();
    }
  },
  
  /**
   * 显示游戏结果
   */
  showGameResult() {
    const result = Game.getResult();
    const modal = document.getElementById('game-over-modal');
    
    if (modal) {
      const header = document.getElementById('result-header');
      const scoreChange = document.getElementById('score-change');
      const rankings = document.getElementById('final-rankings');
      
      if (header) {
        header.innerHTML = `
          <span class="result-icon">${result.isWin ? '🏆' : '😢'}</span>
          <h2 class="result-title">${result.isWin ? '胜利!' : '失败'}</h2>
        `;
      }
      
      if (scoreChange) {
        const myScore = result.scores[0]?.score || 0;
        scoreChange.innerHTML = `
          <span class="score-value ${myScore >= 0 ? 'positive' : 'negative'}">${myScore >= 0 ? '+' : ''}${myScore}</span>
          <span class="score-label">金币</span>
        `;
      }
      
      if (rankings) {
        rankings.innerHTML = result.scores.map((s, i) => `
          <div class="ranking-item ${i === 0 ? 'first' : ''}">
            <span class="rank">#${s.rank}</span>
            <span class="name">${s.name}</span>
            <span class="score ${s.score >= 0 ? 'positive' : 'negative'}">
              ${s.score >= 0 ? '+' : ''}${s.score}
            </span>
          </div>
        `).join('');
      }
      
      // 播放音效
      Sound.play(result.isWin ? 'win' : 'lose');
      
      modal.classList.remove('hidden');
      
      // 更新用户数据
      if (this.user) {
        if (result.isWin) {
          this.user.wins++;
          this.user.coins += result.scores[0].score;
          this.user.exp += 20;
        } else {
          this.user.losses++;
          this.user.coins = Math.max(0, this.user.coins + (result.scores.find(s => s.name === this.user.name)?.score || 0));
          this.user.exp += 5;
        }
        
        // 升级检测
        if (this.user.exp >= this.user.level * 100) {
          this.user.exp -= this.user.level * 100;
          this.user.level++;
        }
        
        this.saveUser();
      }
    }
  },
  
  // ==================== 联机功能 ====================
  
  /**
   * 创建房间
   */
  async createRoom() {
    const nickInput = document.getElementById('create-nick-input');
    const nick = nickInput?.value?.trim() || this.user?.name || '玩家';
    
    if (!nick) {
      alert('请输入昵称');
      return;
    }
    
    try {
      // 连接服务器
      await Network.connect();
      
      // 生成随机房间号
      const roomId = String(Math.floor(1000 + Math.random() * 9000));
      
      // 加入房间
      await Network.join(roomId, nick);
      
      this.isOnline = true;
      this.closeAllModals();
      
      // 显示等待弹窗
      document.getElementById('waiting-room-id').textContent = roomId;
      this.showModal('waiting-modal');
      
    } catch (err) {
      alert('连接失败: ' + err.message);
    }
  },
  
  /**
   * 加入房间
   */
  async joinRoom() {
    const roomInput = document.getElementById('room-id-input');
    const nickInput = document.getElementById('room-nick-input');
    
    const roomId = roomInput?.value?.trim();
    const nick = nickInput?.value?.trim() || this.user?.name || '玩家';
    
    if (!roomId || roomId.length !== 4) {
      alert('请输入4位房间号');
      return;
    }
    
    if (!nick) {
      alert('请输入昵称');
      return;
    }
    
    try {
      await Network.connect();
      await Network.join(roomId, nick);
      
      this.isOnline = true;
      this.closeAllModals();
      
      document.getElementById('waiting-room-id').textContent = roomId;
      this.showModal('waiting-modal');
      
    } catch (err) {
      alert('加入失败: ' + err.message);
    }
  },
  
  /**
   * 离开房间
   */
  leaveRoom() {
    Network.leave();
    Network.disconnect();
    this.isOnline = false;
    this.roomPlayers = [];
    this.closeAllModals();
  },
  
  /**
   * 开始联机游戏
   */
  startOnlineGame() {
    Network.startGame();
  },
  
  /**
   * 房间状态更新
   */
  onRoomState(state) {
    this.roomPlayers = state.players || [];
    this.updateWaitingUI();
    
    // 如果有游戏状态，进入游戏
    if (state.gameState) {
      this.gameState = state.gameState;
      this.closeAllModals();
      this.showScreen('game');
      this.renderOnlineGame();
    }
  },
  
  /**
   * 私有状态（手牌）
   */
  onPrivateState(state) {
    if (state && typeof state === 'object') {
      if ('number' === typeof state) {
        // 可能是手牌数量
      } else if (Array.isArray(state)) {
        this.myHand = state;
      } else if (state.hand) {
        this.myHand = state.hand;
      }
    }
    this.renderOnlineGame();
  },
  
  /**
   * 游戏状态更新
   */
  onGameState(state) {
    this.gameState = state;
    this.renderOnlineGame();
  },
  
  /**
   * 出牌结果
   */
  onTurnResult(result) {
    if (result.pattern) {
      Sound.playCard(result.pattern);
    }
  },
  
  /**
   * 游戏结束
   */
  onGameOver(result) {
    // 显示结果
    this.showOnlineResult(result);
  },
  
  /**
   * 网络错误
   */
  onNetworkError(err) {
    console.error('网络错误:', err);
    alert(err.message || '网络错误');
  },
  
  /**
   * 断开连接
   */
  onDisconnected() {
    if (this.isOnline) {
      alert('与服务器断开连接');
      this.isOnline = false;
      this.showScreen('lobby');
    }
  },
  
  /**
   * 更新等待界面
   */
  updateWaitingUI() {
    const playerList = document.getElementById('waiting-players');
    const startBtn = document.getElementById('btn-start-game');
    const waitingText = document.getElementById('waiting-text');
    
    if (playerList) {
      playerList.innerHTML = this.roomPlayers.map((p, i) => `
        <div class="player-item ${i === 0 ? 'owner' : ''}">
          <div class="player-avatar">${p.name?.charAt(0) || '?'}</div>
          <div class="player-info">
            <div class="player-name">${p.name || '玩家'}</div>
            <div class="player-status">${i === 0 ? '房主' : '已加入'}</div>
          </div>
        </div>
      `).join('');
      
      // 空位
      for (let i = this.roomPlayers.length; i < 3; i++) {
        playerList.innerHTML += `<div class="player-slot">等待玩家加入...</div>`;
      }
    }
    
    // 判断是否是房主
    const isOwner = this.roomPlayers.length > 0 && 
                    Network.socket && 
                    this.roomPlayers[0]?.id === Network.socket.id;
    
    if (startBtn) {
      startBtn.disabled = this.roomPlayers.length < 2;
      startBtn.style.display = isOwner ? 'block' : 'none';
    }
    
    if (waitingText) {
      if (isOwner) {
        waitingText.textContent = this.roomPlayers.length >= 2 
          ? '人数足够，可以开始游戏！' 
          : '等待其他玩家加入...';
      } else {
        waitingText.textContent = '等待房主开始游戏...';
      }
    }
  },
  
  /**
   * 渲染联机游戏
   */
  renderOnlineGame() {
    // TODO: 实现联机游戏界面渲染
    // 使用 this.gameState, this.myHand, this.roomPlayers
    console.log('渲染联机游戏', this.gameState, this.myHand);
  },
  
  /**
   * 显示联机结果
   */
  showOnlineResult(result) {
    // TODO: 显示联机游戏结果
    console.log('游戏结果', result);
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
