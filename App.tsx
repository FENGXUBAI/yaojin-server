import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Audio } from 'expo-av';
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
const io = require('socket.io-client');
 
const { width, height } = Dimensions.get('window');

// Sound assets
const soundAssets = {
  select: require('./assets/sounds/select.mp3'),
  play: require('./assets/sounds/play.mp3'),
  pass: require('./assets/sounds/pass.mp3'),
  pair: require('./assets/sounds/pair.mp3'),
  deal: require('./assets/sounds/deal.mp3'),
  start: require('./assets/sounds/start.mp3'),
  duizi: require('./assets/sounds/duizi.mp3'),
  fapai: require('./assets/sounds/fapai.mp3'),
  bg: require('./assets/sounds/bg.mp3'),
};

type Screen = 'login' | 'lobby' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [nick, setNick] = useState('玩家');
  const [room, setRoom] = useState('');
  const [socket, setSocket] = useState<any>(null); // socket client (any to avoid missing type defs)
  const [myIndex, setMyIndex] = useState<number>(-1); // Add this
  const [players, setPlayers] = useState<any[]>([]); // Add this

  const [state, setState] = useState<GameState | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [serverUrl, setServerUrl] = useState('http://192.168.5.19:3000');

  function connectToServer() {
    if (socket) return;
    const newSocket = io(serverUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('roomUpdate', (data: any) => {
      setPlayers(data.players);
      if (data.gameState) {
        setState(data.gameState);
        setScreen('game');
      }
    });

    newSocket.on('gameStart', (gameState: any) => {
      setState(gameState);
      setScreen('game');
      playSound('start');
      setTimeout(() => playSound('fapai'), 1000);
    });

    newSocket.on('gameState', (gameState: any) => {
      setState(gameState);
      if (gameState && gameState.lastPlay) {
        if (gameState.lastPlay.type === 'PAIR') {
          playSound('duizi');
        } else {
          playSound('play');
        }
      } else {
        playSound('play');
      }
    });

    newSocket.on('error', (msg: any) => {
      Alert.alert('Error', String(msg));
    });
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

  const [bgSound, setBgSound] = useState<Audio.Sound | null>(null);

  // Sound helper
  async function playSound(name: keyof typeof soundAssets) {
    try {
      const { sound } = await Audio.Sound.createAsync(soundAssets[name]);
      await sound.playAsync();
    } catch (e) {
      console.log('Sound error:', e);
    }
  }

  async function playBGM() {
    try {
      if (bgSound) return;
      const { sound } = await Audio.Sound.createAsync(soundAssets['bg'], { isLooping: true });
      setBgSound(sound);
      await sound.playAsync();
    } catch (e) {
      console.log('BGM error:', e);
    }
  }

  async function stopBGM() {
    try {
      if (bgSound) {
        await bgSound.stopAsync();
        await bgSound.unloadAsync();
        setBgSound(null);
      }
    } catch (e) {
      console.log('Stop BGM error:', e);
    }
  }

  useEffect(() => {
    if (screen === 'lobby' || screen === 'game') {
      playBGM();
    } else {
      stopBGM();
    }
  }, [screen]);

  const [joined, setJoined] = useState(false);

  function joinRoom() {
    if (!socket) return;
    if (!room) { Alert.alert('请输入房间号'); return; }
    socket.emit('join', { room, name: nick });
    setJoined(true);
  }

  function handleStartGame() {
    if (!socket) return;
    socket.emit('start', { room });
  }

  function toggleSelect(cardId: string) {
    playSound('select');
    setSelectedIds(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      return [...prev, cardId];
    });
  }

  function handlePlay() {
    if (!state || myIndex === -1) return;
    const hand = state.hands[myIndex];
    const selectedCards = hand.filter((c, idx) => selectedIds.includes(String(idx)));
    if (selectedCards.length === 0) {
      Alert.alert('提示', '请选择要出的牌');
      return;
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
    socket?.emit('action', { room, action: { type: 'pass' } });
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
          selected && styles.cardSelected
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
            <GradientButton title="QQ 登录" onPress={() => { connectToServer(); setScreen('lobby'); }} colors={['#2196F3', '#1976D2']} style={{ width: 200, marginVertical: 8 }} />
            <GradientButton title="微信 登录" onPress={() => { connectToServer(); setScreen('lobby'); }} colors={['#4CAF50', '#388E3C']} style={{ width: 200, marginVertical: 8 }} />
          </View>
          <StatusBar style="light" />
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (screen === 'lobby') {
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
                  <GradientButton title="进入房间" onPress={joinRoom} colors={['#00BCD4', '#0097A7']} style={{ width: 120, marginHorizontal: 8 }} />
                </View>
              </>
            ) : (
              <>
                <Text style={{fontSize: 18, marginBottom: 10}}>房间: {room}</Text>
                <Text style={{fontSize: 16, marginBottom: 20}}>等待玩家... ({players.length}/4)</Text>
                {players.map((p, i) => (
                   <Text key={i} style={{marginBottom: 5}}>{p.name} {p.id === socket?.id ? '(我)' : ''}</Text>
                ))}
                <View style={{height: 20}} />
                <GradientButton title="开始游戏" onPress={handleStartGame} colors={['#FF9800', '#F57C00']} style={{ width: 120 }} />
              </>
            )}
            <TouchableOpacity onPress={() => { setScreen('login'); setJoined(false); }} style={{ marginTop: 20 }}>
              <Text style={{ color: '#fff', textDecorationLine: 'underline' }}>返回登录</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  // Game Screen
  if (!state) return null;

  const safeMyIndex = myIndex === -1 ? 0 : myIndex;
  const myHand = state.hands[safeMyIndex];
  
  // Helper to render other players
  const PlayerAvatar = ({ label, style, imageSource }: any) => (
    <View style={[styles.avatarContainer, style]}>
      <View style={styles.avatarCircle}>
        <Image source={imageSource || require('./image/avatar_default.png')} style={{ width: 64, height: 64, borderRadius: 32 }} />
      </View>
      <View style={styles.avatarLabel}>
        <Text style={styles.avatarText}>{label}</Text>
      </View>
    </View>
  );

  // Calculate relative positions
  const rightIdx = (safeMyIndex + 1) % state.playerCount;
  const topIdx = (safeMyIndex + 2) % state.playerCount;
  const leftIdx = (safeMyIndex + 3) % state.playerCount;

  const rightName = players[rightIdx]?.name || `玩家${rightIdx+1}`;
  const topName = players[topIdx]?.name || `玩家${topIdx+1}`;
  const leftName = players[leftIdx]?.name || `玩家${leftIdx+1}`;

  return (
    <ImageBackground source={require('./image/table_bg.jpg')} style={styles.bg} resizeMode="cover">
      <SafeAreaView style={styles.gameContainer}>
        
        {/* Header Info */}
        <View style={styles.header}>
          <Text style={styles.roomInfo}>房间: {room} | 底分: 100</Text>
        </View>

        {/* Opponents Layout */}
        {/* Top */}
        <PlayerAvatar label={topName} style={{ position: 'absolute', top: 50, alignSelf: 'center' }} />
        
        {/* Left */}
        <PlayerAvatar label={leftName} style={{ position: 'absolute', top: height * 0.35, left: 10 }} />
        
        {/* Right */}
        <PlayerAvatar label={rightName} style={{ position: 'absolute', top: height * 0.35, right: 10 }} />

        {/* Center Table Area - show recent table plays placed toward each player's side */}
        <View style={styles.tableArea}>
          { (state.tablePlays && state.tablePlays.length > 0) ? (
            <>
              {state.tablePlays.map((p, pi) => {
                // Calculate relative seat index
                // 0 (Me) -> 0
                // 1 (Right) -> 1
                // 2 (Top) -> 2
                // 3 (Left) -> 3
                // But p.by is absolute index.
                // We need relative index: (p.by - safeMyIndex + 4) % 4
                const relativeSeat = (p.by - safeMyIndex + 4) % 4;
                
                // seat offsets: 0=bottom(me), 1=right, 2=top, 3=left
                const seatOffsets = [ { x: 0, y: 80 }, { x: 120, y: 0 }, { x: 0, y: -100 }, { x: -120, y: 0 } ];
                const seat = seatOffsets[relativeSeat] || seatOffsets[0];
                
                return (
                  <View key={pi} style={{ position: 'absolute', left: '50%', top: '50%', width: 240, height: 160, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: seat.x }, { translateY: seat.y }] }}>
                    {p.cards.map((c, i) => {
                      const seed = (c.rank as any).toString().charCodeAt(0) + (c.suit ? c.suit.charCodeAt(0) : 0) + i + pi * 7;
                      const rotate = (seed % 50 - 25) + 'deg';
                      const translateX = (i - Math.floor(p.cards.length/2)) * 18 + (seed % 8 - 4);
                      const translateY = (seed % 10 - 5);
                      return (
                        <View key={i} style={{ position: 'absolute', transform: [{ translateX }, { translateY }, { rotate }], zIndex: i }}>
                          <CardView card={c} small />
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </>
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.5)' }}>等待出牌...</Text>
          )}
        </View>

        {/* Bottom area: left avatar, center larger hand */}
        <View style={styles.bottomAreaRow}>
          <View style={styles.bottomLeftAvatar}>
            <PlayerAvatar label={`${nick} (我)`} imageSource={require('./image/4.png')} />
          </View>

          <View style={styles.bottomCenterArea}>
            <View style={styles.actionRow}>
              {state.currentPlayer === safeMyIndex && (
                <>
                  <GradientButton title="不要" onPress={handlePass} colors={['#E91E63', '#C2185B']} style={{ width: 110, marginRight: 20 }} />
                  <GradientButton title="出牌" onPress={handlePlay} colors={['#4CAF50', '#388E3C']} style={{ width: 110 }} />
                </>
              )}
            </View>

            <View style={styles.handWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.handScrollContent}
              >
                {myHand.map((c, idx) => {
                  const id = String(idx);
                  const isSelected = selectedIds.includes(id);
                  // spacing and overlap tuned for larger cards
                  const cardContainerWidth = 56;
                  return (
                    <View key={idx} style={{ width: cardContainerWidth, height: 150, marginRight: idx === myHand.length - 1 ? 40 : 0 }}>
                      <View style={{ position: 'absolute', left: 0, bottom: 0 }}>
                        <CardView
                          card={c}
                          selected={isSelected}
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
  header: { position: 'absolute', top: 10, left: 20 },
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
  handScrollContent: { paddingHorizontal: 20, alignItems: 'flex-end', paddingBottom: 12 },

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
  cardTopLeft: { alignItems: 'center', alignSelf: 'flex-start' },
  cardRank: { fontSize: 18, fontWeight: 'bold' },
  cardSuit: { fontSize: 16 },
  cardCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  cardSuitLarge: { fontSize: 40, opacity: 0.2 },
  jokerText: { fontSize: 14, fontWeight: 'bold', transform: [{ rotate: '-45deg' }] },
});
