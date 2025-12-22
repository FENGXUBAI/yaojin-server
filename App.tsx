import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  LayoutAnimation,
  UIManager,
  Animated,
  Easing,
  Vibration,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createDeck,
  GameState,
  initGame,
  playTurn,
  PlayAction,
  PassAction,
} from './src/engine/game';
import { Card } from './src/engine/cards';
import { detectPattern } from './src/engine/patterns';
import io from 'socket.io-client';
 
const { width, height } = Dimensions.get('window');

// Sound assets
const soundAssets = {
  // Generated simple SFX (copyright-safe, can be regenerated via `npm run gen:sfx`)
  select: require('./assets/sounds/sfx_select.wav'),
  play: require('./assets/sounds/sfx_play_single.wav'),
  pass: require('./assets/sounds/sfx_pass.wav'),
  pair: require('./assets/sounds/sfx_play_pair.wav'),
  triple: require('./assets/sounds/sfx_play_triple.wav'),
  straight: require('./assets/sounds/sfx_play_straight.wav'),
  doubleSequence: require('./assets/sounds/sfx_play_double_sequence.wav'),
  bomb: require('./assets/sounds/sfx_bomb.wav'),
  kingBomb: require('./assets/sounds/sfx_king_bomb.wav'),
  joker: require('./assets/sounds/sfx_joker.wav'),
  high: require('./assets/sounds/sfx_high.wav'),
  deal: require('./assets/sounds/sfx_deal.wav'),
  start: require('./assets/sounds/sfx_start.wav'),
  qi: require('./assets/sounds/sfx_qi.wav'),

  // Legacy/other audio
  duizi: require('./assets/sounds/sfx_play_pair.wav'),
  fapai: require('./assets/sounds/sfx_deal.wav'),
  bg: require('./assets/sounds/bg.mp3'),
  login_bg: require('./assets/sounds/login_bg.ogg'), // New login bg
  call: require('./assets/sounds/sfx_qi.wav'),
  sandaiyidui: require('./assets/sounds/sfx_play_triple.wav'),
};

const Confetti = ({ count = 50 }: { count?: number }) => {
  const [particles] = useState(() => 
    Array.from({ length: count }).map(() => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(-20),
      rotate: new Animated.Value(0),
      color: ['#FFD700', '#FF5252', '#2196F3', '#4CAF50', '#9C27B0'][Math.floor(Math.random() * 5)],
      size: Math.random() * 10 + 5,
      speed: Math.random() * 2000 + 3000,
      delay: Math.random() * 1000,
    }))
  );

  useEffect(() => {
    particles.forEach(p => {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.delay(p.delay),
            Animated.timing(p.y, {
              toValue: height + 20,
              duration: p.speed,
              easing: Easing.linear,
              useNativeDriver: true,
            })
          ]),
          Animated.timing(p.rotate, {
            toValue: 1,
            duration: p.speed * 0.8,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { rotate: p.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              { rotateX: p.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }
            ]
          }}
        />
      ))}
    </View>
  );
};

type Screen = 'login' | 'lobby' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const screenRef = useRef<Screen>('login');
  const [nick, setNick] = useState('玩家' + Math.floor(Math.random() * 1000));
  const [room, setRoom] = useState('');
  const [socket, setSocket] = useState<any>(null); // socket client (any to avoid missing type defs)
  const [myIndex, setMyIndex] = useState<number>(-1); // Add this
  const [players, setPlayers] = useState<any[]>([]); // Add this
  const [owner, setOwner] = useState('');
  const [settlementData, setSettlementData] = useState<any>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [eventOverlay, setEventOverlay] = useState<{ text: string; subText?: string; color?: string; kind?: string } | null>(null);

  const lastSfxSeqRef = useRef<number>(0);
  const lastMvpSeqRef = useRef<number>(0);
  const serverMvpEnabledRef = useRef(false);
  const lastJoinWasAutoRef = useRef<boolean>(false);

  function randomClientKey() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  }
  const isMyTurnRef = useRef(false);

  function getOrCreateTabClientKey() {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
        const existing = window.sessionStorage.getItem('yaojin.tabClientKey') || '';
        if (existing) return existing;
        const created = randomClientKey();
        window.sessionStorage.setItem('yaojin.tabClientKey', created);
        return created;
      }
    } catch {}
    return undefined;
  }

  function loadLastSfxSeq(r: string) {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const v = window.localStorage.getItem(`yaojin.lastSfxSeq.${r}`);
        const n = v ? Number(v) : 0;
        return Number.isFinite(n) ? n : 0;
      }
    } catch {}
    return 0;
  }

  function loadLastMvpSeq(r: string) {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const v = window.localStorage.getItem(`yaojin.lastMvpSeq.${r}`);
        const n = v ? Number(v) : 0;
        return Number.isFinite(n) ? n : 0;
      }
    } catch {}
    return 0;
  }

  function saveLastMvpSeq(r: string, seq: number) {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`yaojin.lastMvpSeq.${r}`, String(seq));
      }
    } catch {}
  }

  function saveLastSfxSeq(r: string, seq: number) {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`yaojin.lastSfxSeq.${r}`, String(seq));
      }
    } catch {}
  }

  const [state, setState] = useState<GameState | null>(null);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [handCounts, setHandCounts] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mvpSound, setMvpSound] = useState<string>('normal_哈基米.mp3');
  const [showMvpModal, setShowMvpModal] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.6);
  const [sfxVolume, setSfxVolume] = useState(1.0);
  const [mvpVolume, setMvpVolume] = useState(1.0);
  const [victoryMessage, setVictoryMessage] = useState<{ name: string, sound: string } | null>(null);
  const mvpSoundObject = useRef<Audio.Sound | null>(null);
  const mvpSoundKeyRef = useRef<string>('');
  const mvpCacheRef = useRef<Map<string, Audio.Sound>>(new Map());
  const fadeTimersRef = useRef<{ bgm?: any; mvp?: any }>({});
  const [autoPlay, setAutoPlay] = useState(false); // 托管状态
  const autoPlayTimerRef = useRef<any>(null);
  
  // 聊天和表情系统
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{player: string, message: string, isEmoji?: boolean}>>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const emojis = ['😀', '😂', '😍', '😎', '😭', '😡', '👍', '👎', '💪', '🎉', '❤️', '🔥'];
  const mvpStopTimerRef = useRef<any>(null);

  const myHandRef = useRef<Card[]>([]);
  const hintCacheRef = useRef<{ key: string; options: Card[][]; nextIdx: number; pending: boolean; checking: boolean }>({
    key: '',
    options: [],
    nextIdx: 0,
    pending: false,
    checking: false,
  });

  useEffect(() => {
    myHandRef.current = myHand;
  }, [myHand]);

  const MVP_SOUNDS = [
    'dash_star.mp3',
    'normal_哈基米.mp3',
    '大东北_哈基米mp3.mp3',
    '悬疑哈基米.mp3',
    '打火机版哈基米.mp3',
    '无敌哈基米.mp3',
    '触摸能量_哈基米版.mp3',
    '误闯天家.mp3',
    '跳楼基.mp3'
  ];

  // Koyeb 云服务器地址
  const KOYEB_SERVER = 'https://wise-galliform-zanli-2885a498.koyeb.app';
  
  const [serverUrl, setServerUrl] = useState(
    Platform.OS === 'web' ? window.location.origin : KOYEB_SERVER
  );
  const [connecting, setConnecting] = useState(false);
  const [connectStatus, setConnectStatus] = useState('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  function addLog(msg: string) {
    console.log(msg);
    setDebugLog(prev => [msg, ...prev].slice(0, 5));
  }

  const [timer, setTimer] = useState<{ duration: number; startTime: number } | null>(null);
    const [timeLeft, setTimeLeft] = useState(30); // Local timer state

  const roomRef = useRef('');
  const ownerRef = useRef('');
  const playersRef = useRef<any[]>([]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    ownerRef.current = owner;
  }, [owner]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);


  useEffect(() => {
    if (!timer) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - timer.startTime;
      const remaining = Math.max(0, Math.ceil((timer.duration - elapsed) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [timer]);

  const [roomList, setRoomList] = useState<any[]>([]);
  const [showRoomList, setShowRoomList] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  function fetchRoomList() {
    if (!socket) return;
    socket.emit('listRooms');
  }

  function sortHand() {
    // Toggle sort order or just re-sort?
    // Currently hands are sorted by server.
    // Maybe sort by count (Pairs/Triples)?
    // For now, let's just re-apply default sort (Big to Small)
    setMyHand(prev => [...prev].sort((a, b) => {
        if (a.isJoker !== b.isJoker) return a.isJoker ? -1 : 1; // Joker first
        return b.sortValue - a.sortValue;
    }));
    playSound('select');
  }

  useEffect(() => {
    if (!socket) return;
    
    socket.on('roomList', (list: any[]) => {
      setRoomList(list);
      setShowRoomList(true);
    });

    socket.on('chatMessage', (msg: any) => {
      setChatMessages(prev => [...prev, msg].slice(-20)); // Keep last 20
      if (screenRef.current === 'game') {
          // Optional: Show toast or auto-open chat?
          // For now just update state
      }
    });

    return () => {
      socket.off('roomList');
      socket.off('chatMessage');
    };
  }, [socket]);

  async function connectToServer() {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    
    setConnecting(true);
    setConnectStatus('正在连接...');
    addLog(`开始连接: ${serverUrl}`);
    
    try {
      const newSocket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        extraHeaders: {
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "YaojinClient" // Try to bypass ngrok check
        }
      });
      
      // Monitor connection events
      newSocket.on('connect', () => {
        addLog('Socket已连接!');
        setConnecting(false);
        setConnectStatus('');
        setSocket(newSocket);
        if (screenRef.current === 'login') {
          setScreen('lobby');
        }

        // Web: auto re-join last room after refresh (per-tab)
        try {
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            const savedRoom = window.sessionStorage?.getItem('yaojin.room') || '';
            const savedNick = window.sessionStorage?.getItem('yaojin.nick') || '';
            const savedMvp = window.localStorage.getItem('yaojin.mvpSound') || '';
            const shouldAutoJoin = window.sessionStorage?.getItem('yaojin.autoJoin') === '1';

            if (savedRoom && savedNick && shouldAutoJoin) {
              setRoom(savedRoom);
              setNick(savedNick);
              if (savedMvp) setMvpSound(savedMvp);
                const savedClientKey = window.sessionStorage?.getItem('yaojin.tabClientKey') || '';
                const lastSfxSeq = loadLastSfxSeq(savedRoom);
                lastSfxSeqRef.current = lastSfxSeq;
                const lastMvpSeq = loadLastMvpSeq(savedRoom);
                lastMvpSeqRef.current = lastMvpSeq;
                lastJoinWasAutoRef.current = true;
                newSocket.emit('join', { room: savedRoom, name: savedNick, clientKey: savedClientKey || undefined, lastSfxSeq, lastMvpSeq });
              setJoined(true);
            }
          }
        } catch {
          // ignore
        }
      });

      newSocket.on('connect_error', (err: any) => {
        addLog(`连接错误: ${err.message}`);
        setConnecting(false);
        setConnectStatus('连接失败');
        Alert.alert('连接失败', err.message);
        newSocket.disconnect();
      });

      newSocket.on('disconnect', (reason: any) => {
        addLog(`断开连接: ${reason}`);
        if (reason === 'io server disconnect') {
          newSocket.connect();
        }
      });

      // Set a manual timeout just in case socket events don't fire
      setTimeout(() => {
        if (!newSocket.connected && newSocket.active) { // Check if still trying
             addLog('连接超时(前端检测)');
             setConnecting(false);
             setConnectStatus('超时');
             newSocket.disconnect();
             Alert.alert('提示', '连接超时，请检查服务器地址是否正确');
        }
      }, 12000);

      const applyRoomState = (data: any) => {
        console.log('Received roomState:', data);
        addLog(`房间更新: ${data.players.length}人, 房主: ${data.owner?.substring(0,4)}`);
        setPlayers(data.players);
        if (typeof data.owner === 'string') setOwner(data.owner);
        if (Array.isArray(data.matchHistory)) {
          setMatchHistory(data.matchHistory);
        }
        setDebugEnabled(Boolean(data.debugEnabled));
        if (data.gameState) {
          setState(data.gameState as any);
          if (Array.isArray(data.gameState.handCounts)) {
            setHandCounts(data.gameState.handCounts);
          }
          setScreen('game');
        }
      };

      // New authoritative room state
      newSocket.on('roomState', applyRoomState);
      // Back-compat
      newSocket.on('roomUpdate', applyRoomState);

      // Private state for this socket only (includes full hand)
      newSocket.on('privateState', (data: any) => {
        if (!data) return;
        if (typeof data.myIndex === 'number') setMyIndex(data.myIndex);
        if (Array.isArray(data.hand)) setMyHand(data.hand);
        if (data.gameState) {
          setState(data.gameState as any);
          if (Array.isArray(data.gameState.handCounts)) {
            setHandCounts(data.gameState.handCounts);
          }
        }
      });

      newSocket.on('hints', (data: any) => {
        const hintKey = String(data?.hintKey ?? '');
        if (!hintKey) return;
        const cache = hintCacheRef.current;
        if (cache.key !== hintKey) return; // stale response

        cache.options = Array.isArray(data?.options) ? data.options : [];
        cache.nextIdx = 0;
        const shouldApply = cache.pending;
        cache.pending = false;

        if (cache.checking) {
          cache.checking = false;
          setCannotPlay(cache.options.length === 0);
        }

        if (!shouldApply) return;
        if (!cache.options.length) {
          // No legal move: trusteeship passes; manual hint shows prompt.
          if (autoPlay) {
            autoPlayingRef.current = false;
            // Trusteeship: pass with a small delay to look natural.
            setTimeout(() => {
              try {
                playSound('pass', { force: true });
                suppressSfx('pass', 800);
                newSocket.emit('action', { room: roomRef.current || room, action: { type: 'pass' } });
              } catch {}
            }, 500);
            return;
          }
          Alert.alert('提示', '没有可用的提示');
          return;
        }

        applyHintSelection(cache.options[0]);
        cache.nextIdx = cache.options.length > 1 ? 1 : 0;

        if (autoPlay) {
          // After auto-selecting, try to play.
          setTimeout(() => {
            try {
              handlePlay();
            } finally {
              autoPlayingRef.current = false;
            }
          }, 450);
        }
      });

        newSocket.on('joinAck', (data: { room: string; name: string; clientKey: string; debugEnabled?: boolean }) => {
          // Per-tab identity: avoid multiple tabs sharing the same localStorage clientKey and kicking each other.
          try {
            if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
              if (data.clientKey) window.sessionStorage.setItem('yaojin.tabClientKey', data.clientKey);
            }
          } catch {
            // ignore
          }
          if (typeof data.debugEnabled === 'boolean') setDebugEnabled(data.debugEnabled);
        });
      
      newSocket.on('turnTimer', (data: { duration: number; startTime: number }) => {
          setTimer(data);
      });
      
      newSocket.on('gameStart', async (gameState: any) => {
        if (mvpSoundObject.current) {
            try {
                await mvpSoundObject.current.stopAsync();
                await mvpSoundObject.current.unloadAsync();
                mvpSoundObject.current = null;
            } catch(e) {}
        }
        setState(gameState);
        setScreen('game');
        setTimer(null);
        setSettlementData(null); // Clear settlement on new game
        setVictoryMessage(null);
        playSound('start');
        setTimeout(() => playSound('fapai'), 1000);
      });

      newSocket.on('gameState', (gameState: any) => {
        // Back-compat / fallback: some servers may still emit this
        setState(gameState as any);
        if (gameState && Array.isArray(gameState.handCounts)) {
          setHandCounts(gameState.handCounts);
        }

        // Vibration logic
        if (gameState && typeof myIndex === 'number' && myIndex !== -1) {
          const isMyTurn = gameState.currentPlayer === myIndex && gameState.status === 'playing';
          if (isMyTurn && !isMyTurnRef.current) {
            Vibration.vibrate(100); // Short vibration for turn
          }
          isMyTurnRef.current = isMyTurn;
        }
      });

      newSocket.on('gameOver', (data: { finishedOrder: number[], scores: any[], multiplier: number }) => {
        addLog('游戏结束');
        setSettlementData(data);
        Vibration.vibrate([0, 200, 100, 200]); // Victory/End pattern
      });

      newSocket.on('error', (msg: any) => {
        Alert.alert('Error', String(msg));
      });

      // 聊天消息接收
      newSocket.on('chatMessage', (data: { player: string, message: string, isEmoji?: boolean }) => {
        setChatMessages(prev => [...prev, data].slice(-20)); // 保留最近20条消息
      });

      newSocket.on('sfxEvent', (evt: any) => {
        if (!evt) return;
        const seq = typeof evt.seq === 'number' ? evt.seq : 0;
        if (seq > 0) {
          if (seq <= lastSfxSeqRef.current) return;
          lastSfxSeqRef.current = seq;
          const r = roomRef.current || room;
          if (r) saveLastSfxSeq(r, seq);
        }
        serverSfxEnabledRef.current = true;
        if (evt.kind === 'pass') {
          const sup = localSfxSuppressRef.current;
          if (!sup || sup.kind !== 'pass' || Date.now() >= sup.until) {
            playSound('pass');
          }
          return;
        }
        if (evt.kind === 'qi') {
          playSound('qi');
          showEventOverlay({ text: '起牌!', subText: '44 炸!', color: '#FF5252', kind: 'qi' }, 2000);
          Vibration.vibrate(300);
          return;
        }
        if (evt.kind === 'play') {
          const pType = String(evt.patternType ?? '');
          const isKingBomb = !!evt.isKingBomb;
          const hasJoker = !!evt.hasJoker;
          const hasA2 = !!evt.hasA2;
          const count = Number(evt.count ?? 0);

          if (isKingBomb) {
            playSound('kingBomb');
            showEventOverlay({ text: '王炸!', subText: '毁天灭地', color: '#D32F2F', kind: 'kingBomb' }, 2600);
            Vibration.vibrate(800);
            return;
          }
          if (pType === 'FOUR') {
            playSound('bomb');
            showEventOverlay({ text: '炸弹!', color: '#FF9800', kind: 'bomb' }, 1600);
            Vibration.vibrate(200);
            return;
          }
          if (pType === 'TRIPLE') {
            playSound('triple');
            return;
          }
          if (pType === 'DOUBLE_SEQUENCE') {
            playSound('doubleSequence');
            return;
          }
          if (pType === 'STRAIGHT') {
            playSound('straight');
            return;
          }
          if (pType === 'PAIR') {
            playSound('pair');
            return;
          }
          if (pType === 'SINGLE') {
            if (hasJoker) {
              playSound('joker');
              return;
            }
            if (hasA2) {
              playSound('high');
              return;
            }
            playSound('play');
            return;
          }

          // Unknown fallback
          if (count >= 5) playSound('straight');
          else playSound('play');
        }
      });

      newSocket.on('mvpEvent', async (evt: any) => {
        if (!evt) return;
        serverMvpEnabledRef.current = true;
        const seq = typeof evt.seq === 'number' ? evt.seq : 0;
        if (seq > 0) {
          if (seq <= lastMvpSeqRef.current) return;
          lastMvpSeqRef.current = seq;
          const r = roomRef.current || room;
          if (r) saveLastMvpSeq(r, seq);
        }

        const startedAt = typeof evt.startedAt === 'number' ? evt.startedAt : Date.now();
        const durationMs = typeof evt.durationMs === 'number' ? evt.durationMs : 10000;
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, durationMs - elapsed);
        if (remaining <= 0) return;

        // Reuse existing player logic by calling the legacy handler path
        const sound = String(evt.sound ?? '');
        if (!sound) return;
        const name = String(evt.name ?? '玩家');
        // Call the same playback routine with remaining duration
        // Stop Game BGM + play MVP with remaining time
        try {
          // Cancel any pending stop from a previous MVP
          if (mvpStopTimerRef.current) {
            clearTimeout(mvpStopTimerRef.current);
            mvpStopTimerRef.current = null;
          }

          if (bgSoundRef.current) {
            try {
              await fadeSound(bgSoundRef.current, bgmVolume, 0, 350, 'bgm');
              setTimeout(() => {
                bgSoundRef.current?.pauseAsync().catch(() => {});
              }, 380);
            } catch {}
          }

          // Stop previous MVP (keep cached ones loaded)
          if (mvpSoundObject.current) {
            try {
              await mvpSoundObject.current.stopAsync();
            } catch {}
            const prevKey = mvpSoundKeyRef.current;
            if (prevKey && !mvpCacheRef.current.has(prevKey)) {
              try {
                await mvpSoundObject.current.unloadAsync();
              } catch {}
            }
          }

          let soundObj = mvpCacheRef.current.get(sound);
          if (!soundObj) {
            const uri = `${serverUrl}/assets/MVP_sounds/${encodeURIComponent(sound)}`;
            const created = await Audio.Sound.createAsync({ uri }, { isLooping: true });
            soundObj = created.sound;
            mvpCacheRef.current.set(sound, soundObj);

            // cap cache size
            const maxCached = 3;
            if (mvpCacheRef.current.size > maxCached) {
              const oldestKey = mvpCacheRef.current.keys().next().value;
              if (oldestKey && oldestKey !== sound) {
                const old = mvpCacheRef.current.get(oldestKey);
                mvpCacheRef.current.delete(oldestKey);
                try {
                  await old?.unloadAsync();
                } catch {}
              }
            }
          }

          mvpSoundKeyRef.current = sound;
          mvpSoundObject.current = soundObj;

          try {
            await soundObj.setIsLoopingAsync(true);
            await soundObj.setPositionAsync(0);
            await soundObj.setVolumeAsync(0);
          } catch {}
          await soundObj.playAsync();
          fadeSound(soundObj, 0, mvpVolume, 350, 'mvp').catch(() => {});

          setVictoryMessage({ name, sound });

          mvpStopTimerRef.current = setTimeout(async () => {
            try {
              if (mvpSoundObject.current === soundObj) {
                try {
                  await fadeSound(soundObj, mvpVolume, 0, 350, 'mvp');
                } catch {}
                setTimeout(async () => {
                  try {
                    if (mvpSoundObject.current === soundObj) {
                      await soundObj.stopAsync();
                      mvpSoundObject.current = null;
                      mvpSoundKeyRef.current = '';
                      setVictoryMessage(null);

                      if (screenRef.current === 'game') {
                        if (bgSoundRef.current) {
                          try {
                            await bgSoundRef.current.setVolumeAsync(0);
                            await bgSoundRef.current.playAsync();
                            fadeSound(bgSoundRef.current, 0, bgmVolume, 350, 'bgm').catch(() => {});
                          } catch {
                            playBGM('game');
                          }
                        } else {
                          playBGM('game');
                        }
                      }
                    }
                  } catch {}
                }, 380);
              }
            } catch {}
          }, remaining);
        } catch (e) {
          console.log('Error playing MVP from mvpEvent:', e);
        }
      });

      newSocket.on('playMvpSound', async ({ sound, name, durationMs }: { sound: string; name?: string; durationMs?: number }) => {
        if (serverMvpEnabledRef.current) return;
        try {
          // Cancel any pending stop from a previous MVP
          if (mvpStopTimerRef.current) {
            clearTimeout(mvpStopTimerRef.current);
            mvpStopTimerRef.current = null;
          }

          // Fade out BGM then pause
          if (bgSoundRef.current) {
            try {
              await fadeSound(bgSoundRef.current, bgmVolume, 0, 350, 'bgm');
              setTimeout(() => {
                bgSoundRef.current?.pauseAsync().catch(() => {});
              }, 380);
            } catch {}
          }

          // Stop previous MVP (keep cached ones loaded)
          if (mvpSoundObject.current) {
            try {
              await mvpSoundObject.current.stopAsync();
            } catch {}
            const prevKey = mvpSoundKeyRef.current;
            if (prevKey && !mvpCacheRef.current.has(prevKey)) {
              try {
                await mvpSoundObject.current.unloadAsync();
              } catch {}
            }
          }

          // Get / load MVP sound
          let soundObj = mvpCacheRef.current.get(sound);
          if (!soundObj) {
            const uri = `${serverUrl}/assets/MVP_sounds/${encodeURIComponent(sound)}`;
            console.log('Playing MVP Sound:', uri);
            const created = await Audio.Sound.createAsync({ uri }, { isLooping: true });
            soundObj = created.sound;
            mvpCacheRef.current.set(sound, soundObj);

            // cap cache size
            const maxCached = 3;
            if (mvpCacheRef.current.size > maxCached) {
              const oldestKey = mvpCacheRef.current.keys().next().value;
              if (oldestKey && oldestKey !== sound) {
                const old = mvpCacheRef.current.get(oldestKey);
                mvpCacheRef.current.delete(oldestKey);
                try {
                  await old?.unloadAsync();
                } catch {}
              }
            }
          }

          mvpSoundKeyRef.current = sound;
          mvpSoundObject.current = soundObj;

          try {
            await soundObj.setIsLoopingAsync(true);
            await soundObj.setPositionAsync(0);
            await soundObj.setVolumeAsync(0);
          } catch {}
          await soundObj.playAsync();
          fadeSound(soundObj, 0, mvpVolume, 350, 'mvp').catch(() => {});

            const playerName = name || '玩家';
            setVictoryMessage({ name: playerName, sound: sound });

            // Stop after duration (default 15s)
            const ms = typeof durationMs === 'number' ? durationMs : 15000;
          mvpStopTimerRef.current = setTimeout(async () => {
              try {
                  if (mvpSoundObject.current === soundObj) { // Check if still same sound
                      try {
                        await fadeSound(soundObj, mvpVolume, 0, 350, 'mvp');
                      } catch {}
                      setTimeout(async () => {
                        try {
                          if (mvpSoundObject.current === soundObj) {
                            await soundObj.stopAsync();
                            // Keep cached loaded
                            mvpSoundObject.current = null;
                            mvpSoundKeyRef.current = '';
                            setVictoryMessage(null);

                            // Resume BGM with fade-in
                            if (screenRef.current === 'game') {
                              if (bgSoundRef.current) {
                                try {
                                  await bgSoundRef.current.setVolumeAsync(0);
                                  // resume after pause
                                  await bgSoundRef.current.playAsync();
                                  fadeSound(bgSoundRef.current, 0, bgmVolume, 350, 'bgm').catch(() => {});
                                } catch {
                                  playBGM('game');
                                }
                              } else {
                                playBGM('game');
                              }
                            }
                          }
                        } catch(e) {}
                      }, 380);
                  }
              } catch(e) {}
            }, ms);

        } catch (e) {
          console.log('Error playing MVP sound:', e);
        }
      });

    } catch (e: any) {
      addLog(`初始化异常: ${e.message}`);
      setConnecting(false);
      Alert.alert('错误', e.message);
    }
  }

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (socket && players.length > 0) {
      const idx = players.findIndex(p => p.id === socket.id);
      setMyIndex(idx);
    }
  }, [players, socket]);

  useEffect(() => {
    if (socket && room) {
      socket.emit('setMvpSound', { room, sound: mvpSound });

      // Web: persist preference
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('yaojin.mvpSound', mvpSound);
        }
      } catch {
        // ignore
      }
    }
  }, [mvpSound, socket, room]);

  const [bgSound, setBgSound] = useState<Audio.Sound | null>(null);
  const bgSoundRef = useRef<Audio.Sound | null>(null);
  const sfxCacheRef = useRef<Map<keyof typeof soundAssets, Audio.Sound>>(new Map());
  const bgCacheRef = useRef<Map<'bg'|'login_bg', Audio.Sound>>(new Map());
  const sfxLastAtRef = useRef<number>(0);
  const sfxMinIntervalMs = 70;
  const localSfxSuppressRef = useRef<{ kind: string; until: number } | null>(null);

  const autoPlayingRef = useRef(false);

  const [cannotPlay, setCannotPlay] = useState(false);

  const [passCountdown, setPassCountdown] = useState(0);
  const passTimerRef = useRef<any>(null);

  function clearFadeTimer(key: 'bgm' | 'mvp') {
    const t = fadeTimersRef.current[key];
    if (t) {
      clearInterval(t);
      fadeTimersRef.current[key] = undefined;
    }
  }

  async function fadeSound(sound: Audio.Sound, from: number, to: number, durationMs: number, key: 'bgm' | 'mvp') {
    clearFadeTimer(key);
    const steps = Math.max(1, Math.floor(durationMs / 50));
    const delta = (to - from) / steps;
    let current = from;
    try {
      await sound.setVolumeAsync(from);
    } catch {}
    fadeTimersRef.current[key] = setInterval(() => {
      current += delta;
      const v = to > from ? Math.min(to, current) : Math.max(to, current);
      sound.setVolumeAsync(v).catch(() => {});
      if (v === to) {
        clearFadeTimer(key);
      }
    }, 50);
  }

  // Sound helper
  function suppressSfx(kind: string, ms: number) {
    localSfxSuppressRef.current = { kind, until: Date.now() + ms };
  }

  async function playSound(name: keyof typeof soundAssets, opts?: { force?: boolean }) {
    try {
      const now = Date.now();
      if (!opts?.force && now - sfxLastAtRef.current < sfxMinIntervalMs) return;
      sfxLastAtRef.current = now;

      const cache = sfxCacheRef.current;
      let sound = cache.get(name);
      if (!sound) {
        const created = await Audio.Sound.createAsync(soundAssets[name]);
        sound = created.sound;
        cache.set(name, sound);
      }
      await sound.setVolumeAsync(sfxVolume);
      // replayAsync will restart from 0 even if it was played before
      await sound.replayAsync();
    } catch (e) {
      console.log('Sound error:', e);
    }
  }

  // Prewarm common SFX to reduce first-play stutter
  useEffect(() => {
    (async () => {
      const keys: (keyof typeof soundAssets)[] = ['play', 'pass', 'pair', 'triple', 'straight', 'doubleSequence', 'bomb', 'kingBomb', 'joker', 'high', 'deal', 'start', 'qi', 'duizi', 'call', 'fapai'];
      for (const k of keys) {
        try {
          const cache = sfxCacheRef.current;
          if (cache.has(k)) continue;
          const created = await Audio.Sound.createAsync(soundAssets[k]);
          const sound = created.sound;
          await sound.setVolumeAsync(0);
          cache.set(k, sound);
        } catch {}
      }
    })();
  }, []);

  // Preload local backgrounds + BGM (best-effort) to reduce first-enter stutter
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        } as any);
      } catch {}

      try {
        await Asset.loadAsync([
          require('./image/1.png'),
          require('./image/2.png'),
          require('./image/table_bg.jpg'),
        ]);
      } catch {}

      try {
        await ensureBgmLoaded('login_bg');
        await ensureBgmLoaded('bg');
      } catch {}
    })();
  }, []);

  async function ensureBgmLoaded(assetName: 'bg' | 'login_bg') {
    const cache = bgCacheRef.current;
    let sound = cache.get(assetName);
    if (sound) return sound;

    const created = await Audio.Sound.createAsync(soundAssets[assetName], { isLooping: true }, undefined, false);
    sound = created.sound;
    try {
      await sound.setIsLoopingAsync(true);
      await sound.setVolumeAsync(0);
    } catch {}
    cache.set(assetName, sound);
    return sound;
  }

  async function playBGM(type: 'login' | 'game') {
    try {
      const assetName = type === 'login' ? 'login_bg' : 'bg';
      const sound = await ensureBgmLoaded(assetName);

      // Stop previous channel (but keep cached loaded)
      if (bgSoundRef.current && bgSoundRef.current !== sound) {
        try {
          await bgSoundRef.current.pauseAsync();
          await bgSoundRef.current.setPositionAsync(0);
        } catch {}
      }

      bgSoundRef.current = sound;
      setBgSound(sound);

      try {
        await sound.setPositionAsync(0);
        await sound.setVolumeAsync(bgmVolume);
      } catch {}

      await sound.playAsync();
    } catch (e) {
      console.log('BGM error:', e);
    }
  }

  async function preloadMvpSound(soundFile: string) {
    if (!soundFile) return;
    if (mvpCacheRef.current.has(soundFile)) return;
    try {
      const uri = `${serverUrl}/assets/MVP_sounds/${encodeURIComponent(soundFile)}`;
      const created = await Audio.Sound.createAsync({ uri }, { isLooping: true }, undefined, false);
      const soundObj = created.sound;
      await soundObj.setVolumeAsync(0);
      // Keep loaded for quicker start later
      mvpCacheRef.current.set(soundFile, soundObj);

      // cap cache size
      const maxCached = 3;
      if (mvpCacheRef.current.size > maxCached) {
        const oldestKey = mvpCacheRef.current.keys().next().value;
        if (oldestKey && oldestKey !== soundFile) {
          const old = mvpCacheRef.current.get(oldestKey);
          mvpCacheRef.current.delete(oldestKey);
          try {
            await old?.unloadAsync();
          } catch {}
        }
      }
    } catch (e) {
      // ignore preload failures
    }
  }

  // Update volume of playing BGM/MVP when channel volumes change
  useEffect(() => {
      if (bgSoundRef.current) {
          bgSoundRef.current.setVolumeAsync(bgmVolume);
      }
      if (mvpSoundObject.current) {
          mvpSoundObject.current.setVolumeAsync(mvpVolume);
      }
      // Keep cached SFX volume in sync
      try {
        for (const s of sfxCacheRef.current.values()) {
          s.setVolumeAsync(sfxVolume);
        }
      } catch {}
  }, [bgmVolume, mvpVolume, sfxVolume]);

  // Preload my selected MVP sound
  useEffect(() => {
    preloadMvpSound(mvpSound);
  }, [mvpSound]);

  const sfxPrevRef = useRef<{ inited: boolean; trickLen: number; passesInRow: number; status: string | null }>({
    inited: false,
    trickLen: 0,
    passesInRow: 0,
    status: null,
  });
  const serverSfxEnabledRef = useRef(false);

  function playCardSfx(cards: Card[]) {
    const pat = detectPattern(cards);
    if (!pat) {
      playSound('play');
      return;
    }

    // Big plays / special
    if (pat.type === 'PAIR' && (pat as any).extra?.isKingBomb) {
      playSound('kingBomb');
      return;
    }

    if (pat.type === 'FOUR') {
      playSound('bomb');
      return;
    }

    if (pat.type === 'TRIPLE') {
      // Strong but not as loud as FOUR
      playSound('triple');
      return;
    }

    if (pat.type === 'DOUBLE_SEQUENCE') {
      playSound('doubleSequence');
      return;
    }

    if (pat.type === 'STRAIGHT') {
      playSound('straight');
      return;
    }

    if (pat.type === 'PAIR') {
      playSound('pair');
      return;
    }

// SINGLE: emphasize jokers / very high cards a bit, and play rank-specific sound if available
  if (pat.type === 'SINGLE') {
    const c = cards[0];
    if (c?.isJoker) {
      playSound('joker');
      return;
    }
    // Play rank-specific sound for numbered and face cards
    const rankSounds: { [key: string]: keyof typeof soundAssets } = {
      '3': 'play', '4': 'play', '5': 'play', '6': 'play', '7': 'play',
      '8': 'play', '9': 'play', '10': 'play', 'J': 'high', 'Q': 'high', 
      'K': 'high', 'A': 'high', '2': 'high'
    };
    const soundKey = rankSounds[c?.rank] || 'play';
    playSound(soundKey);
      return;
    }

    playSound('play');
  }

  // Global SFX: ensure every player's play/pass makes a sound.
  useEffect(() => {
    if (serverSfxEnabledRef.current) return;
    if (!state) return;
    const prev = sfxPrevRef.current;

    const trickLen = Array.isArray((state as any).currentTrickPlays) ? (state as any).currentTrickPlays.length : 0;
    const passesInRow = typeof (state as any).passesInRow === 'number' ? (state as any).passesInRow : 0;
    const status = (state as any).status ?? null;

    if (!prev.inited) {
      prev.inited = true;
      prev.trickLen = trickLen;
      prev.passesInRow = passesInRow;
      prev.status = status;
      return;
    }

    // New play(s)
    if (trickLen > prev.trickLen) {
      for (let i = prev.trickLen; i < trickLen; i++) {
        const play = (state as any).currentTrickPlays?.[i];
        const cards = play?.cards;
        if (Array.isArray(cards) && cards.length) {
          playCardSfx(cards);
        }
      }
    } else if (passesInRow > prev.passesInRow) {
      // Pass (remote or local)
      const sup = localSfxSuppressRef.current;
      if (sup && sup.kind === 'pass' && Date.now() < sup.until) {
        // suppressed
      } else {
        playSound('pass');
      }
    }

    prev.trickLen = trickLen;
    prev.passesInRow = passesInRow;
    prev.status = status;
  }, [state]);

  async function stopBGM() {
    try {
      if (bgSoundRef.current) {
        try {
          await bgSoundRef.current.pauseAsync();
          await bgSoundRef.current.setPositionAsync(0);
        } catch {}
        setBgSound(null);
        bgSoundRef.current = null;
      }
    } catch (e) {
      console.log('Stop BGM error:', e);
    }
  }

  useEffect(() => {
    if (screen === 'login' || screen === 'lobby') {
      playBGM('login');
    } else if (screen === 'game') {
      playBGM('game');
    } else {
      stopBGM();
    }
  }, [screen]);

  const [joined, setJoined] = useState(false);
  const joinedRef = useRef(false);

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  function joinRoom() {
    if (!socket) return;
    if (!room) { Alert.alert('请输入房间号'); return; }

    const clientKey: string | undefined = getOrCreateTabClientKey();

    const lastSfxSeq = loadLastSfxSeq(room);
    lastSfxSeqRef.current = lastSfxSeq;
    const lastMvpSeq = loadLastMvpSeq(room);
    lastMvpSeqRef.current = lastMvpSeq;
    lastJoinWasAutoRef.current = false;
    socket.emit('join', { room, name: nick, clientKey, lastSfxSeq, lastMvpSeq });
    setJoined(true);

    // Web: remember for refresh-reconnect (per-tab)
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (window.sessionStorage) {
          window.sessionStorage.setItem('yaojin.room', room);
          window.sessionStorage.setItem('yaojin.nick', nick);
          window.sessionStorage.setItem('yaojin.autoJoin', '1');
          if (clientKey) window.sessionStorage.setItem('yaojin.tabClientKey', clientKey);
        }
        // Keep preferences in localStorage, but avoid auto-joining across tabs.
        if (window.localStorage) {
          window.localStorage.setItem('yaojin.room', room);
          window.localStorage.setItem('yaojin.nick', nick);
          window.localStorage.setItem('yaojin.mvpSound', mvpSound);
          try { window.localStorage.removeItem('yaojin.autoJoin'); } catch {}
          try { window.localStorage.removeItem('yaojin.clientKey'); } catch {}
        }
      }
    } catch {
      // ignore
    }
  }
  const eventAnim = useRef(new Animated.Value(0)).current;
  const eventFlash = useRef(new Animated.Value(0)).current;
  const eventOverlayTimerRef = useRef<any>(null);

  function showEventOverlay(next: { text: string; subText?: string; color?: string; kind?: string }, ms: number) {
    if (eventOverlayTimerRef.current) {
      clearTimeout(eventOverlayTimerRef.current);
      eventOverlayTimerRef.current = null;
    }
    setEventOverlay(next);
    eventOverlayTimerRef.current = setTimeout(() => {
      setEventOverlay(null);
      eventOverlayTimerRef.current = null;
    }, ms);
  }

  useEffect(() => {
    if (eventOverlay) {
      eventAnim.setValue(0);
      eventFlash.setValue(0);
      Animated.sequence([
        Animated.spring(eventAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.delay(eventOverlay.kind === 'kingBomb' ? 1400 : 900),
        Animated.timing(eventAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();

      if (eventOverlay.kind === 'bomb' || eventOverlay.kind === 'kingBomb') {
        Animated.loop(
          Animated.sequence([
            Animated.timing(eventFlash, { toValue: 1, duration: 80, useNativeDriver: true }),
            Animated.timing(eventFlash, { toValue: 0, duration: 80, useNativeDriver: true }),
          ]),
          { iterations: eventOverlay.kind === 'kingBomb' ? 10 : 6 }
        ).start();
      }
    }
  }, [eventOverlay]);

  function sendChatMessage(message: string, isEmoji = false) {
    if (!socket || !message.trim()) return;
    socket.emit('chatMessage', { room, message: message.trim(), isEmoji });
    setChatInput('');
    setShowChatModal(false);
    setShowEmojiPicker(false);
  }

  function sendEmoji(emoji: string) {
    sendChatMessage(emoji, true);
  }

  function handleStartGame() {
    if (!socket) return;
    socket.emit('start', { room });
  }

  function toggleSelect(cardId: string) {
    playSound('select');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedIds(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      return [...prev, cardId];
    });
  }

  function handlePlay() {
    console.log('handlePlay called', { state: !!state, myIndex, currentPlayer: state?.currentPlayer });
    if (!state || myIndex === -1) return;
    if (!myHand || myHand.length === 0) {
      Alert.alert('提示', '手牌还在同步中，请稍后');
      return;
    }
    const selectedCards = myHand.filter((c, idx) => selectedIds.includes(String(idx)));
    if (selectedCards.length === 0) {
      Alert.alert('提示', '请选择要出的牌');
      return;
    }

    if (state.status === 'tribute_return') {
        const myReturn = state.pendingReturns?.find(p => p.actionBy === myIndex);
        if (myReturn) {
             if (selectedCards.length !== myReturn.count) {
                 Alert.alert('提示', `请选择 ${myReturn.count} 张牌回贡`);
                 return;
             }
             socket?.emit('action', { room, action: { type: 'returnTribute', cards: selectedCards } });
             setSelectedIds([]);
             return;
        }
    }

    try {
      const action: PlayAction = { type: 'play', cards: selectedCards };
      socket?.emit('action', { room, action });
      setSelectedIds([]);
    } catch (e: any) {
      Alert.alert('出牌失败', e.message || String(e));
    }
  }

  function handlePass() {
    if (!socket) return;
    if (!state || myIndex === -1) return;

    const isMyTurn = state.status === 'playing' && state.currentPlayer === myIndex;
    if (!isMyTurn) return;

    const clear = () => {
      if (passTimerRef.current) {
        clearInterval(passTimerRef.current);
        passTimerRef.current = null;
      }
    };

    const emitPass = () => {
      playSound('pass', { force: true });
      suppressSfx('pass', 800);
      socket.emit('action', { room, action: { type: 'pass' } });
    };

    // If truly no legal play, delay pass by 6 seconds to avoid accidental fast-tap.
    if (cannotPlay) {
      if (passCountdown > 0) return;
      clear();
      setPassCountdown(6);
      passTimerRef.current = setInterval(() => {
        setPassCountdown(prev => {
          if (prev <= 1) {
            clear();
            emitPass();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    clear();
    setPassCountdown(0);
    emitPass();
  }

  function handleHint() {
    if (!state || myIndex === -1) return;
    if (!myHand || myHand.length === 0) {
      Alert.alert('提示', '手牌还在同步中，请稍后');
      return;
    }
    if (!socket) return;

    const hintKey = buildHintKey();
    if (!hintKey) return;

    const cache = hintCacheRef.current;
    if (cache.key !== hintKey) {
      cache.key = hintKey;
      cache.options = [];
      cache.nextIdx = 0;
      cache.pending = false;
    }

    if (cache.options.length > 0) {
      const cards = cache.options[cache.nextIdx];
      cache.nextIdx = (cache.nextIdx + 1) % cache.options.length;
      applyHintSelection(cards);
      return;
    }

    cache.pending = true;
    socket.emit('getHints', { room, hintKey });
  }

  // When it's my turn, check whether I have any legal play (for 6s pass protection).
  useEffect(() => {
    if (!socket || !state || myIndex === -1) return;
    const isMyTurn = state.status === 'playing' && state.currentPlayer === myIndex;

    if (!isMyTurn) {
      setCannotPlay(false);
      if (passTimerRef.current) {
        clearInterval(passTimerRef.current);
        passTimerRef.current = null;
      }
      if (passCountdown !== 0) setPassCountdown(0);
      // 清除自动出牌计时器
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      return;
    }

    const hintKey = buildHintKey();
    if (!hintKey) return;

    const cache = hintCacheRef.current;
    if (cache.key !== hintKey) {
      cache.key = hintKey;
      cache.options = [];
      cache.nextIdx = 0;
      cache.pending = false;
    }
    cache.checking = true;
    socket.emit('getHints', { room, hintKey });
  }, [socket, state?.currentPlayer, state?.status, myIndex, room]);

  // Trusteeship: when enabled, auto-hint then auto-play on my turn.
  useEffect(() => {
    if (!autoPlay || !socket || !state || myIndex === -1) return;
    const isMyTurn = state.status === 'playing' && state.currentPlayer === myIndex;
    if (!isMyTurn) {
      autoPlayingRef.current = false;
      return;
    }
    if (autoPlayingRef.current) return;
    autoPlayingRef.current = true;

    const hintKey = buildHintKey();
    if (!hintKey) {
      autoPlayingRef.current = false;
      return;
    }

    const cache = hintCacheRef.current;
    if (cache.key !== hintKey) {
      cache.key = hintKey;
      cache.options = [];
      cache.nextIdx = 0;
      cache.pending = false;
    }

    // If we already have options cached, apply immediately.
    if (cache.options.length > 0) {
      const cards = cache.options[cache.nextIdx];
      cache.nextIdx = (cache.nextIdx + 1) % cache.options.length;
      applyHintSelection(cards);
      setTimeout(() => {
        try {
          handlePlay();
        } finally {
          autoPlayingRef.current = false;
        }
      }, 450);
      return;
    }

    cache.pending = true;
    socket.emit('getHints', { room, hintKey });
    // Safety release in case of network issues
    setTimeout(() => {
      autoPlayingRef.current = false;
    }, 2500);
  }, [autoPlay, socket, state?.currentPlayer, state?.status, myIndex, room]);

  function buildHandKey(hand: Card[]) {
    return [...hand]
      .map(c => `${c.rank}${c.suit ?? ''}`)
      .sort()
      .join('|');
  }

  function buildHintKey() {
    if (!state) return '';
    const handKey = buildHandKey(myHandRef.current);
    const last = state.lastPlay
      ? `${(state.lastPlay as any).by ?? 'x'}:${state.lastPlay.type}:${state.lastPlay.strength}`
      : 'none';
    const pending = state.status === 'tribute_return'
      ? String(state.pendingReturns?.find((p: any) => p.actionBy === myIndex)?.count ?? '')
      : '';
    return `${room}|${state.status}|${state.currentPlayer}|${state.passesInRow}|${last}|${pending}|${handKey}`;
  }

  function applyHintSelection(cards: Card[]) {
    const hand = myHandRef.current;
    if (!hand || !hand.length) return;
    const newSelected: string[] = [];
    const used = new Set<number>();
    for (const hc of cards) {
      const idx = hand.findIndex((c, i) => !used.has(i) && c.rank === hc.rank && c.suit === hc.suit);
      if (idx !== -1) {
        used.add(idx);
        newSelected.push(String(idx));
      }
    }
    if (newSelected.length !== cards.length) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedIds(newSelected);
    playSound('select');
  }

  // --- Components ---

  const GradientButton = ({ title, onPress, colors = ['#4c669f', '#3b5998', '#192f6a'], style }: any) => (
    <TouchableOpacity onPress={onPress} style={[styles.btnContainer, style]}>
      <LinearGradient colors={colors} style={styles.btnGradient}>
        <Text style={styles.btnText}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  const CardView = ({ card, selected, onPress, small = false }: { card: Card; selected?: boolean; onPress?: () => void; small?: boolean }) => {
    const isRed = card.suit === '♥' || card.suit === '♦';
    const color = isRed ? '#d00' : '#000';
    const isJoker = card.isJoker;
    
    // Joker display logic
    let displayRank: string = card.rank;
    let displaySuit = card.suit || '';
    
    if (isJoker) {
      displayRank = card.rank === 'JOKER_BIG' ? '大\n王' : '小\n王';
      displaySuit = '';
      // Big Joker usually red/color, Small Joker black/bw. Let's stick to red for Big, black for Small.
      if (card.rank === 'JOKER_BIG') {
         // color is already red? No, suit is undefined.
         // Force red for Big Joker
      }
    }
    
    const textColor = (isJoker && card.rank === 'JOKER_BIG') || isRed ? '#d32f2f' : '#333';

    return (
      <TouchableOpacity 
        activeOpacity={0.9} 
        onPress={onPress} 
        style={[
          styles.card, 
          small && styles.cardSmall,
          selected && styles.cardSelected,
          (card as any).isTribute && styles.cardTribute // Highlight tribute
        ]}
      >
        <View style={styles.cardTopLeft}>
          <Text style={[styles.cardRank, { color: textColor }, small && { fontSize: 12 }]}>{displayRank}</Text>
          {!isJoker && <Text style={[styles.cardSuit, { color: textColor }, small && { fontSize: 12 }]}>{displaySuit}</Text>}
        </View>
        
        {/* Center Suit (Large) */}
        {!isJoker && !small && (
          <View style={styles.cardCenter}>
             <Text style={[styles.cardSuitLarge, { color: textColor }]}>{displaySuit}</Text>
          </View>
        )}
        
        {/* Joker Center Text */}
        {isJoker && !small && (
           <View style={styles.cardCenter}>
             <Text style={[styles.jokerText, { color: textColor }]}>{card.rank === 'JOKER_BIG' ? 'JOKER' : 'joker'}</Text>
           </View>
        )}

        {/* Bottom Right (Inverted) - Optional, keeping simple for now */}
      </TouchableOpacity>
    );
  };

  // --- Screens ---

  if (screen === 'login') {
    return (
      <ImageBackground source={require('./image/1.png')} style={styles.bg} blurRadius={3}>
        <SafeAreaView style={styles.containerCenter}>
          <View style={styles.glassPanel}>
            <Text style={styles.title}>要进</Text>
            <TextInput 
              style={styles.input} 
              placeholder="输入昵称" 
              placeholderTextColor="#888"
              value={nick} 
              onChangeText={setNick} 
            />
            <TextInput 
              style={[styles.input, { fontSize: 12 }]} 
              placeholder="服务器地址 (http://...)" 
              placeholderTextColor="#888"
              value={serverUrl} 
              onChangeText={setServerUrl} 
            />
            <GradientButton title={connecting ? "连接中..." : "QQ 登录"} onPress={() => !connecting && connectToServer()} colors={connecting ? ['#999', '#777'] : ['#2196F3', '#1976D2']} style={{ width: 200, marginVertical: 8 }} />
            <GradientButton title={connecting ? "连接中..." : "微信 登录"} onPress={() => !connecting && connectToServer()} colors={connecting ? ['#999', '#777'] : ['#4CAF50', '#388E3C']} style={{ width: 200, marginVertical: 8 }} />
            
            {/* Debug Log View */}
            <View style={{ marginTop: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 5, width: '100%' }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>调试日志:</Text>
              {debugLog.map((log, i) => (
                <Text key={i} style={{ color: '#eee', fontSize: 10 }}>{log}</Text>
              ))}
            </View>

            {connecting && (
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={{ color: '#fff', marginTop: 5 }}>{connectStatus}</Text>
                <TouchableOpacity onPress={() => { setConnecting(false); socket?.disconnect(); addLog('用户取消'); }} style={{ marginTop: 10 }}>
                  <Text style={{ color: '#FF5252' }}>取消</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <StatusBar style="light" />
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (screen === 'lobby') {
    const ownerShort = owner ? owner.substring(0, 6) : '';
    const myShort = socket?.id ? socket.id.substring(0, 6) : '';

    return (
      <ImageBackground source={require('./image/2.png')} style={styles.bg} blurRadius={3}>
        <SafeAreaView style={styles.containerCenter}>
          <View style={styles.glassPanel}>
            <Text style={styles.title}>游戏大厅</Text>

            {!joined ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="输入房间号"
                  placeholderTextColor="#888"
                  value={room}
                  onChangeText={setRoom}
                  keyboardType="numeric"
                />
                <View style={styles.row}>
                  <GradientButton
                    title="进入房间"
                    onPress={joinRoom}
                    colors={['#00BCD4', '#0097A7']}
                    style={{ width: 120, marginHorizontal: 8 }}
                  />
                  <GradientButton
                    title="房间列表"
                    onPress={fetchRoomList}
                    colors={['#9C27B0', '#7B1FA2']}
                    style={{ width: 120, marginHorizontal: 8 }}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 18, marginBottom: 10, color: '#fff' }}>房间: {room}</Text>
                <Text style={{ fontSize: 12, color: '#ddd', marginBottom: 10 }}>
                  MyID: {myShort} | Owner: {ownerShort}
                </Text>
                <Text style={{ fontSize: 16, marginBottom: 12, color: '#fff' }}>等待玩家... ({players.length}/4)</Text>

                <View style={{ width: '100%', marginBottom: 10 }}>
                  {players.map((p, i) => (
                    <Text key={i} style={{ marginBottom: 6, color: '#fff' }}>
                      {p.name} {p.id === socket?.id ? '(我)' : ''} {p.id === owner ? '[房主]' : ''}
                      {p.score !== undefined ? ` [积分: ${p.score}]` : ''}
                    </Text>
                  ))}
                </View>

                <View style={styles.row}>
                  <GradientButton
                    title="MVP音效"
                    onPress={() => setShowMvpModal(true)}
                    colors={['#9C27B0', '#7B1FA2']}
                    style={{ width: 120, marginHorizontal: 5 }}
                  />
                  <GradientButton
                    title="战绩记录"
                    onPress={() => setShowHistory(true)}
                    colors={['#607D8B', '#455A64']}
                    style={{ width: 120, marginHorizontal: 5 }}
                  />
                </View>

                {socket && socket.id === owner ? (
                  <GradientButton
                    title="开始游戏"
                    onPress={handleStartGame}
                    colors={['#FF9800', '#F57C00']}
                    style={{ width: 160, marginTop: 12 }}
                  />
                ) : (
                  <Text style={{ fontSize: 16, color: '#ddd', marginTop: 12 }}>等待房主开始游戏...</Text>
                )}
              </>
            )}

            <TouchableOpacity
              onPress={() => {
                try {
                  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.setItem('yaojin.autoJoin', '0');
                  }
                } catch {
                  // ignore
                }
                setScreen('login');
                setJoined(false);
              }}
              style={{ marginTop: 20 }}
            >
              <Text style={{ color: '#fff', textDecorationLine: 'underline' }}>返回登录</Text>
            </TouchableOpacity>
          </View>

          <Modal visible={showRoomList} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>房间列表</Text>
                <ScrollView style={{ maxHeight: 300, width: '100%' }}>
                  {roomList.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#666', margin: 20 }}>暂无活跃房间</Text>
                  ) : (
                    roomList.map((r, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.modalItem}
                        onPress={() => {
                          setRoom(String(r.id ?? ''));
                          setShowRoomList(false);
                        }}
                      >
                        <View>
                          <Text style={styles.modalItemText}>房间: {String(r.id ?? '')}</Text>
                          <Text style={{ fontSize: 12, color: '#888' }}>房主: {String(r.ownerName ?? '')}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: r.status === 'playing' ? '#f44336' : '#4CAF50' }}>
                            {r.status === 'playing' ? '游戏中' : '等待中'}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#666' }}>{Number(r.playerCount ?? 0)}人</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowRoomList(false)}>
                  <Text style={styles.modalCloseText}>关闭</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={showHistory} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>战绩记录 (最近10场)</Text>
                <ScrollView style={{ maxHeight: 300, width: '100%' }}>
                  {matchHistory.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#666', margin: 20 }}>暂无战绩</Text>
                  ) : (
                    matchHistory
                      .slice(-10)
                      .slice()
                      .reverse()
                      .map((h, i) => (
                        <View key={i} style={styles.modalItem}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                            <Text style={{ fontSize: 12, color: '#888' }}>{new Date(h.timestamp).toLocaleTimeString()}</Text>
                            <Text style={{ fontSize: 12, color: '#FF5252', fontWeight: 'bold' }}>胜: {h.winner}</Text>
                          </View>
                          <View style={{ marginTop: 5 }}>
                            {(h.scores || []).map((s: any, si: number) => (
                              <Text key={si} style={{ fontSize: 12, color: '#333' }}>
                                {s.name}: {s.score}
                              </Text>
                            ))}
                          </View>
                        </View>
                      ))
                  )}
                </ScrollView>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowHistory(false)}>
                  <Text style={styles.modalCloseText}>关闭</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Modal visible={showMvpModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>选择你的MVP音效</Text>
                <ScrollView style={{ maxHeight: 300, width: '100%' }}>
                  {MVP_SOUNDS.map((sound, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.modalItem, mvpSound === sound && styles.modalItemSelected]}
                      onPress={() => {
                        setMvpSound(sound);
                        setShowMvpModal(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, mvpSound === sound && { color: '#fff' }]}>{sound}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowMvpModal(false)}>
                  <Text style={styles.modalCloseText}>关闭</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  // Game Screen
  if (!state) return null;

  const safeMyIndex = myIndex === -1 ? 0 : myIndex;
  const myHandView = myHand;
  
  // Helper to render other players
  const PlayerAvatar = ({ label, style, imageSource, score, idx }: any) => {
    const isCurrent = state.currentPlayer === idx;
    const cardCount = idx === safeMyIndex ? (myHandView?.length || 0) : (handCounts[idx] ?? 0);
    
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isCurrent) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                    Animated.timing(scaleAnim, { toValue: 1, duration: 800, useNativeDriver: true })
                ])
            ).start();
        } else {
            scaleAnim.setValue(1);
        }
    }, [isCurrent]);

    return (
      <View style={[styles.avatarContainer, style]}>
        <Animated.View style={[styles.avatarCircle, isCurrent && { borderColor: '#FFD700', borderWidth: 3 }, { transform: [{ scale: scaleAnim }] }]}>
          <Image source={imageSource || require('./image/avatar_default.png')} style={{ width: 64, height: 64, borderRadius: 32 }} />
        </Animated.View>
        <View style={{ position: 'absolute', right: -5, top: 0, backgroundColor: '#f44336', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
             <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>{cardCount}</Text>
        </View>
        <View style={styles.avatarLabel}>
          <Text style={styles.avatarText}>{label}{isCurrent ? ` ${timeLeft}s` : ''}</Text>
          {score !== undefined && <Text style={[styles.avatarText, { fontSize: 12, color: '#FFD700', fontWeight: 'bold' }]}>💰{score}</Text>}
        </View>
      </View>
    );
  };

  // Calculate relative positions
  const rightIdx = (safeMyIndex + 1) % state.playerCount;
  const topIdx = state.playerCount === 4 ? (safeMyIndex + 2) % state.playerCount : -1;
  const leftIdx = state.playerCount === 4 ? (safeMyIndex + 3) % state.playerCount : (safeMyIndex + 2) % state.playerCount;

  const rightName = players[rightIdx]?.name || `玩家${rightIdx+1}`;
  const topName = topIdx !== -1 ? (players[topIdx]?.name || `玩家${topIdx+1}`) : '';
  const leftName = players[leftIdx]?.name || `玩家${leftIdx+1}`;
  
  const myScore = players[safeMyIndex]?.score;
  const rightScore = players[rightIdx]?.score;
  const topScore = topIdx !== -1 ? players[topIdx]?.score : undefined;
  const leftScore = players[leftIdx]?.score;

  return (
    <ImageBackground source={require('./image/table_bg.jpg')} style={styles.bg} resizeMode="cover">
      <SafeAreaView style={styles.gameContainer}>
        
        {/* Event Overlay */}
        {eventOverlay && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 1000, pointerEvents: 'none' }}>
                <Animated.View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      backgroundColor: eventOverlay.color || '#000',
                      opacity: eventFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }),
                    },
                  ]}
                />
                <Animated.View style={{ 
                    alignItems: 'center',
                    transform: [
                        { scale: eventAnim },
                        { rotate: eventAnim.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '0deg'] }) }
                    ],
                    opacity: eventAnim
                }}>
                    <Text style={{ fontSize: 60, fontWeight: 'bold', color: eventOverlay.color || '#fff', textShadowColor: 'black', textShadowRadius: 10 }}>{eventOverlay.text}</Text>
                    {eventOverlay.subText && <Text style={{ fontSize: 24, color: '#fff', marginTop: 10, textShadowColor: 'black', textShadowRadius: 5 }}>{eventOverlay.subText}</Text>}
                </Animated.View>
            </View>
        )}

        {/* Chat Overlay */}
        {showChat && (
          <View style={{ position: 'absolute', bottom: 100, left: 20, width: 300, height: 320, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 10, padding: 10, zIndex: 999 }}>
             <ScrollView ref={ref => ref?.scrollToEnd()} style={{ flex: 1, marginBottom: 5 }}>
               {chatMessages.map((msg, i) => (
                 <Text key={i} style={{ color: '#fff', marginBottom: 4 }}>
                   <Text style={{ color: '#FFD700' }}>{msg.player}:</Text> {msg.message}
                 </Text>
               ))}
             </ScrollView>
             
             {/* Quick Chat / Emojis */}
             <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 5, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)', paddingTop: 5 }}>
               {['😀', '😂', '😭', '😡', '👍', '👎', '💣', '🤝', '快点啊', '打得好', '你是猪吗', '合作愉快', '谢谢老板'].map((txt, i) => (
                 <TouchableOpacity key={i} onPress={() => sendChatMessage(txt, txt.length <= 2)} style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, margin: 2 }}>
                   <Text style={{ color: '#fff', fontSize: 12 }}>{txt}</Text>
                 </TouchableOpacity>
               ))}
             </View>

             <View style={{ flexDirection: 'row', marginTop: 5 }}>
               <TextInput 
                 style={{ flex: 1, backgroundColor: '#fff', borderRadius: 4, paddingHorizontal: 5, height: 30 }}
                 value={chatInput}
                 onChangeText={setChatInput}
                 placeholder="输入消息..."
                 onSubmitEditing={() => sendChatMessage(chatInput)}
               />
               <TouchableOpacity onPress={() => sendChatMessage(chatInput)} style={{ marginLeft: 5, backgroundColor: '#2196F3', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 4 }}>
                 <Text style={{ color: '#fff' }}>发送</Text>
               </TouchableOpacity>
             </View>
             <TouchableOpacity onPress={() => setShowChat(false)} style={{ position: 'absolute', top: -10, right: -10, backgroundColor: '#f44336', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
               <Text style={{ color: '#fff', fontWeight: 'bold' }}>×</Text>
             </TouchableOpacity>
          </View>
        )}

        {/* Chat Toggle Button */}
        <TouchableOpacity onPress={() => setShowChat(!showChat)} style={{ position: 'absolute', bottom: 120, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 }}>
           <Text style={{ color: '#fff' }}>💬 聊天</Text>
        </TouchableOpacity>

        {/* Sort Button */}
        <TouchableOpacity onPress={sortHand} style={{ position: 'absolute', bottom: 120, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 }}>
           <Text style={{ color: '#fff' }}>🔃 理牌</Text>
        </TouchableOpacity>

        {/* Header Info */}
        <View style={styles.header}>
          <Text style={styles.roomInfo}>房间: {room} | 底分: 1000 | 倍数: x{(state as any).multiplier || 1}</Text>
           {debugEnabled && (
            <TouchableOpacity onPress={() => socket?.emit('debug_win', { room })} style={{ marginLeft: 10, backgroundColor: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 4 }}>
              <Text style={{ color: '#FF5252', fontSize: 10 }}>⚡直接获胜</Text>
            </TouchableOpacity>
           )}
          <TouchableOpacity onPress={() => setShowMvpModal(true)} style={{ marginLeft: 10, backgroundColor: 'rgba(156, 39, 176, 0.6)', padding: 4, borderRadius: 4 }}>
             <Text style={{ color: '#fff', fontSize: 10 }}>🎵MVP音效</Text>
          </TouchableOpacity>
           <TouchableOpacity onPress={() => setAutoPlay(v => !v)} style={{ marginLeft: 10, backgroundColor: autoPlay ? 'rgba(156, 39, 176, 0.6)' : 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 4 }}>
             <Text style={{ color: '#fff', fontSize: 10 }}>{autoPlay ? '🤖托管中' : '🤖托管'}</Text>
           </TouchableOpacity>
          {/* Volume Control */}
          <View style={{ marginLeft: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, paddingHorizontal: 8 }}>
             <Text style={{ color: '#fff', fontSize: 12, marginRight: 8 }}>音量</Text>

             <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
               <Text style={{ color: '#fff', fontSize: 11, marginRight: 4 }}>BGM</Text>
               <TouchableOpacity onPress={() => setBgmVolume(Math.max(0, bgmVolume - 0.1))} style={{ padding: 5 }}><Text style={{color:'#fff'}}>-</Text></TouchableOpacity>
               <Text style={{ color: '#fff', width: 34, textAlign: 'center' }}>{Math.round(bgmVolume * 100)}%</Text>
               <TouchableOpacity onPress={() => setBgmVolume(Math.min(1, bgmVolume + 0.1))} style={{ padding: 5 }}><Text style={{color:'#fff'}}>+</Text></TouchableOpacity>
             </View>

             <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
               <Text style={{ color: '#fff', fontSize: 11, marginRight: 4 }}>SFX</Text>
               <TouchableOpacity onPress={() => setSfxVolume(Math.max(0, sfxVolume - 0.1))} style={{ padding: 5 }}><Text style={{color:'#fff'}}>-</Text></TouchableOpacity>
               <Text style={{ color: '#fff', width: 34, textAlign: 'center' }}>{Math.round(sfxVolume * 100)}%</Text>
               <TouchableOpacity onPress={() => setSfxVolume(Math.min(1, sfxVolume + 0.1))} style={{ padding: 5 }}><Text style={{color:'#fff'}}>+</Text></TouchableOpacity>
             </View>

             <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <Text style={{ color: '#fff', fontSize: 11, marginRight: 4 }}>MVP</Text>
               <TouchableOpacity onPress={() => setMvpVolume(Math.max(0, mvpVolume - 0.1))} style={{ padding: 5 }}><Text style={{color:'#fff'}}>-</Text></TouchableOpacity>
               <Text style={{ color: '#fff', width: 34, textAlign: 'center' }}>{Math.round(mvpVolume * 100)}%</Text>
               <TouchableOpacity onPress={() => setMvpVolume(Math.min(1, mvpVolume + 0.1))} style={{ padding: 5 }}><Text style={{color:'#fff'}}>+</Text></TouchableOpacity>
             </View>
          </View>
        </View>

        {/* Opponents Layout */}
        {/* Top - Only for 4 players */}
        {state.playerCount === 4 && (
           <PlayerAvatar label={topName} score={topScore} idx={topIdx} style={{ position: 'absolute', top: 50, alignSelf: 'center' }} />
        )}
        
        {/* Left */}
        <PlayerAvatar label={leftName} score={leftScore} idx={leftIdx} style={{ position: 'absolute', top: height * 0.35, left: 10 }} />
        
        {/* Right */}
        <PlayerAvatar label={rightName} score={rightScore} idx={rightIdx} style={{ position: 'absolute', top: height * 0.35, right: 10 }} />

        {/* Center Table Area - show current trick plays */}
        <View style={styles.tableArea}>
          <View style={{ position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>
              {state.lastPlay
                ? `${players[state.lastPlay.by]?.name || `玩家${state.lastPlay.by + 1}`} 上手：${state.lastPlay.label}`
                : '自由出牌'}
            </Text>
          </View>
          { ((state as any).currentTrickPlays && (state as any).currentTrickPlays.length > 0) ? (
            <>
              {(state as any).currentTrickPlays.map((p: any, pi: number) => {
                // Determine position based on player index relative to me
                let posStyle: any = {};
                if (p.by === safeMyIndex) {
                    posStyle = { bottom: 100, alignSelf: 'center' };
                } else if (p.by === rightIdx) {
                    posStyle = { right: 140, top: '40%' };
                } else if (p.by === leftIdx) {
                    posStyle = { left: 140, top: '40%' };
                } else if (p.by === topIdx) {
                    posStyle = { top: 160, alignSelf: 'center' };
                }
                return (
                  <View key={pi} style={[{ position: 'absolute', flexDirection: 'row', transform: [{ scale: 1.5 }] }, posStyle]}>
                    {p.cards.map((c: Card, ci: number) => (
                      <View key={ci} style={{ marginLeft: ci === 0 ? 0 : -20, zIndex: ci }}>
                         <CardView card={c} small={true} /> 
                      </View>
                    ))}
                  </View>
                );
              })}
            </>
          ) : null}
        </View>


        {/* Bottom area: left avatar, center larger hand */}
        <View style={styles.bottomAreaRow}>
          <View style={styles.bottomLeftAvatar}>
            <PlayerAvatar label={`${nick} (我)`} score={myScore} idx={safeMyIndex} imageSource={require('./image/4.png')} />
          </View>

          <View style={styles.bottomCenterArea}>
            <View style={styles.actionRow}>
              {(() => {
                  const isMyTurn = state.status === 'playing' && state.currentPlayer === safeMyIndex;
                  const isMyReturn = state.status === 'tribute_return' && state.pendingReturns?.some(p => p.actionBy === safeMyIndex);
                  
                  if (isMyTurn) {
                      const passTitle = passCountdown > 0 ? `不要(${passCountdown})` : '不要';
                      return (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8 }}>
                            <View style={{ alignItems: 'center', marginHorizontal: 4 }}>
                              <Text style={{ color: 'white', fontSize: 12, marginBottom: 4 }}>{cannotPlay ? '无牌可出' : `${timeLeft}s`}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
                            <View style={{ marginHorizontal: 4 }}>
                              <GradientButton title={passTitle} onPress={handlePass} colors={['#E91E63', '#C2185B']} style={{ width: 88 }} />
                            </View>
                            <View style={{ marginHorizontal: 4 }}>
                              <GradientButton title="提示" onPress={handleHint} colors={['#FFC107', '#FFA000']} style={{ width: 88 }} />
                            </View>
                            <View style={{ marginHorizontal: 4 }}>
                              <GradientButton title="出牌" onPress={handlePlay} colors={['#4CAF50', '#388E3C']} style={{ width: 88 }} />
                            </View>
                            <View style={{ marginHorizontal: 4 }}>
                              <GradientButton 
                                title={autoPlay ? '取消托管' : '托管'} 
                                onPress={() => setAutoPlay(!autoPlay)} 
                                colors={autoPlay ? ['#9E9E9E', '#616161'] : ['#2196F3', '#1976D2']} 
                                style={{ width: 88 }} 
                              />
                            </View>
                          </View>
                        </>
                      );
                  } else if (isMyReturn) {
                      return (
                          <View style={{ alignItems: 'center' }}>
                            <Text style={{ color: 'white', fontWeight: 'bold', marginBottom: 4 }}>请选择牌回贡</Text>
                            <GradientButton title="回贡" onPress={handlePlay} colors={['#FF9800', '#F57C00']} style={{ width: 110 }} />
                          </View>
                      );
                  } else {
                      return null;
                  }
              })()}
            </View>

            <View style={styles.handWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.handScrollContent}
              >
                {myHandView.map((c, idx) => {
                  const id = String(idx);
                  // spacing and overlap tuned for larger cards
                  const cardContainerWidth = 56;
                  return (
                    <View key={idx} style={{ width: cardContainerWidth, height: 150, marginRight: idx === myHandView.length - 1 ? 40 : 0 }}>
                      <View style={{ position: 'absolute', left: 0, bottom: 0 }}>
                        <CardView
                          card={c}
                          selected={selectedIds.includes(id)}
                          onPress={() => toggleSelect(id)}
                        />
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

          </View>
        </View>

        <StatusBar style="light" hidden={true} />

        {/* Settlement Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={!!settlementData}
          onRequestClose={() => {}}
        >
          <View style={styles.modalOverlay}>
            {settlementData && settlementData.finishedOrder[0] === safeMyIndex && <Confetti count={100} />}
            <View style={[styles.modalContent, { backgroundColor: '#fff', borderWidth: 2, borderColor: '#FFD700' }]}>
              <Text style={styles.modalTitle}>本局结算</Text>
              <Text style={styles.modalSubtitle}>倍数: x{settlementData?.multiplier || 1}</Text>
              
              <View style={styles.scoreList}>
                {settlementData?.scores?.map((s: any, i: number) => {
                   const p = playersRef.current.find(pl => pl.id === s.id);
                   const name = p ? p.name : '玩家';
                   const isWinner = settlementData.finishedOrder[0] === playersRef.current.findIndex(pl => pl.id === s.id);
                   return (
                     <View key={i} style={styles.scoreRow}>
                       <Text style={[styles.scoreText, isWinner && styles.winnerText]}>{name}</Text>
                       <Text style={[styles.scoreText, isWinner && styles.winnerText]}>{s.score}</Text>
                     </View>
                   );
                })}
              </View>

              <View style={{ marginTop: 20 }}>
                 {socket && socket.id === ownerRef.current ? (
                    <GradientButton title="下一局" onPress={() => {
                        socket.emit('start', { room: roomRef.current });
                    }} colors={['#FF9800', '#F57C00']} style={{ width: 140 }} />
                 ) : (
                    <Text style={{ color: '#666' }}>等待房主开始下一局...</Text>
                 )}
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showMvpModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>选择你的MVP音效</Text>
                <ScrollView style={{ maxHeight: 300, width: '100%' }}>
                  {MVP_SOUNDS.map((sound, i) => (
                    <TouchableOpacity 
                      key={i} 
                      style={[styles.modalItem, mvpSound === sound && styles.modalItemSelected]}
                      onPress={() => {
                        setMvpSound(sound);
                        setShowMvpModal(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, mvpSound === sound && { color: '#fff' }]}>{sound}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowMvpModal(false)}>
                  <Text style={styles.modalCloseText}>关闭</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%' },
  containerCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  glassPanel: {
    width: '85%',
    padding: 24,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#333', marginBottom: 24 },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  row: { flexDirection: 'row', justifyContent: 'center' },
  
  // Button Styles
  btnContainer: { borderRadius: 25, overflow: 'hidden', elevation: 3 },
  btnGradient: { paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Game Styles
  gameContainer: { flex: 1 },
  header: { position: 'absolute', top: 10, left: 20, flexDirection: 'row', alignItems: 'center', zIndex: 100 },
  roomInfo: { color: '#fff', fontSize: 14, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 },
  
  avatarContainer: { alignItems: 'center' },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ddd', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarLabel: { marginTop: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, borderRadius: 4 },
  avatarText: { color: '#fff', fontSize: 14 },

  tableArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  bottomAreaRow: { width: '100%', paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20 },
  bottomLeftAvatar: { width: 90, alignItems: 'center', justifyContent: 'flex-end' },
  bottomCenterArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  actionRow: { flexDirection: 'row', marginBottom: 10, zIndex: 10 },
  
  handWrapper: { height: 180, width: '100%' },
  handScrollContent: { paddingHorizontal: 20, alignItems: 'flex-end', paddingBottom: 12, flexGrow: 1, justifyContent: 'center', flexDirection: 'row' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', elevation: 5 },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  modalSubtitle: { fontSize: 16, color: '#666', marginBottom: 20 },
  modalItem: { width: '100%', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  modalItemSelected: { backgroundColor: '#9C27B0', borderRadius: 10, borderBottomWidth: 0 },
  modalItemText: { fontSize: 16, color: '#333' },
  modalCloseBtn: { marginTop: 20, padding: 10 },
  modalCloseText: { fontSize: 16, color: '#999' },
  scoreList: { width: '100%', marginBottom: 20 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  scoreText: { fontSize: 18, color: '#333' },
  winnerText: { color: '#FF9800', fontWeight: 'bold' },

  // Card Styles
  card: {
    width: 96,
    height: 130,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'space-between',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  cardSmall: { width: 48, height: 70 },
  cardSelected: { transform: [{ translateY: -26 }] },
  cardTribute: { borderColor: '#FFD700', borderWidth: 3, shadowColor: '#FFD700', shadowOpacity: 0.8, shadowRadius: 10, elevation: 10 },
  cardTopLeft: { alignItems: 'center', alignSelf: 'flex-start' },
  cardRank: { fontSize: 18, fontWeight: 'bold' },
  cardSuit: { fontSize: 16 },
  cardCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  cardSuitLarge: { fontSize: 40, opacity: 0.2 },
  jokerText: { fontSize: 14, fontWeight: 'bold', transform: [{ rotate: '-45deg' }] },
});
