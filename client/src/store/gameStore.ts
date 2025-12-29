import { create } from 'zustand'
import { gameSocket } from '@/services/socket'
import { Room, GameState, RoomStatePayload, Card, ChatMessage } from '@/types'
import { useUserStore } from './userStore'
import toast from 'react-hot-toast'
import { playSfx } from '@/services/sfx'

let listenersBound = false

interface GameStore {
  room: Room | null
  gameState: GameState | null
  isConnected: boolean
  clientKey: string | null
  chatMessages: ChatMessage[]
  
  // Actions
  connect: () => void
  disconnect: () => void
  createRoom: (playerCount: number) => Promise<string>
  joinRoom: (roomId: string) => Promise<void>
  quickMatch: (playerCount?: number) => Promise<string>
  leaveRoom: () => void
  startGame: () => void
  
  playCards: (cards: Card[]) => void
  pass: () => void
  sendChat: (message: string, isEmoji?: boolean) => void
  setTrusteeship: (enabled: boolean) => void
  
  // Event Handlers (internal use mostly)
  handleRoomState: (data: RoomStatePayload) => void
  handleGameState: (data: GameState) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  room: null,
  gameState: null,
  isConnected: false,
  clientKey: null,
  chatMessages: [],

  connect: () => {
    gameSocket.connect()

    // Setup listeners only once
    if (!listenersBound) {
      listenersBound = true

      gameSocket.on('connect', () => {
        set({ isConnected: true })
      })

      gameSocket.on('disconnect', () => {
        set({ isConnected: false })
      })

      gameSocket.on('roomState', (data: RoomStatePayload) => {
        get().handleRoomState(data)
      })

      gameSocket.on('gameState', (data: GameState) => {
        get().handleGameState(data)
      })

      gameSocket.on('privateState', (data: { myIndex: number, hand: Card[], gameState: GameState }) => {
        const { myIndex, hand, gameState: publicState } = data

        // Reconstruct hands array
        const hands = new Array(publicState.playerCount).fill([])
        hands[myIndex] = hand

        const fullState = {
          ...publicState,
          hands
        }

        set({ gameState: fullState })
      })

      gameSocket.on('error', (msg: string) => {
        toast.error(msg)
      })

      gameSocket.on('gameOver', () => {
        toast.success('游戏结束!', { icon: '🏁' })
        // 可以弹窗显示结算
      })

      gameSocket.on('sfxEvent', (evt: any) => {
        playSfx(evt)
      })

      gameSocket.on('chatMessage', (msg: ChatMessage) => {
        set(state => ({
          chatMessages: [...state.chatMessages.slice(-29), msg]
        }))
      })
    }
  },

  disconnect: () => {
    gameSocket.disconnect()
    set({ isConnected: false, room: null, gameState: null })
  },

  createRoom: async (playerCount: number) => {
    // Ensure socket exists early; emits will be buffered until connected.
    get().connect()

    const user = useUserStore.getState().user
    if (!user) throw new Error('未登录')

    const res = await fetch('/api/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount, playerName: user.nickname }),
    })
    
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '创建失败')
    }

    const data = await res.json()
    const serverPlayerCount = data.room?.playerCount ?? data.playerCount ?? playerCount
    
    // Pre-set room info so handleRoomState can use it
    set({ 
      clientKey: data.clientKey,
      room: {
        id: data.roomId,
        players: [],
        playerCount: serverPlayerCount,
        ownerId: '',
        status: 'waiting',
        gameState: null
      }
    })
    
    // Socket join
    gameSocket.emit('join', {
      room: data.roomId,
      name: user.nickname,
      clientKey: data.clientKey
    })

    return data.roomId
  },

  joinRoom: async (roomId: string) => {
    // Ensure socket exists early; emits will be buffered until connected.
    get().connect()

    const user = useUserStore.getState().user
    if (!user) throw new Error('未登录')

    // 1. HTTP Check & Get ClientKey
    const res = await fetch('/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerName: user.nickname }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '加入失败')
    }

    const data = await res.json()
    const serverPlayerCount = data.room?.playerCount ?? data.playerCount ?? 3
    
    // Pre-set room info
    set({ 
      clientKey: data.clientKey,
      room: {
        id: roomId,
        players: [],
        playerCount: serverPlayerCount,
        ownerId: '',
        status: 'waiting',
        gameState: null
      }
    })

    // 2. Socket Join
    gameSocket.emit('join', {
      room: data.roomId,
      name: user.nickname,
      clientKey: data.clientKey
    })
  },

  quickMatch: async (playerCount: number = 3) => {
    // Ensure socket exists early; emits will be buffered until connected.
    get().connect()

    const user = useUserStore.getState().user
    if (!user) throw new Error('未登录')

    const res = await fetch('/api/match/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount, playerName: user.nickname }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '匹配失败')
    }

    const data = await res.json()
    const serverPlayerCount = data.room?.playerCount ?? data.playerCount ?? playerCount
    
    // Pre-set room info
    set({ 
      clientKey: data.clientKey,
      room: {
        id: data.roomId,
        players: [],
        playerCount: serverPlayerCount,
        ownerId: '',
        status: 'waiting',
        gameState: null
      }
    })

    gameSocket.emit('join', {
      room: data.roomId,
      name: user.nickname,
      clientKey: data.clientKey
    })

    return data.roomId
  },

  leaveRoom: () => {
    const { room } = get()
    if (room) {
      gameSocket.emit('leave', { room: room.id })
    }
    set({ room: null, gameState: null, chatMessages: [] })
  },

  startGame: () => {
    const { room } = get()
    if (room) {
      gameSocket.emit('start', { room: room.id })
    }
  },

  playCards: (cards: Card[]) => {
    const { room } = get()
    if (room) {
      // 使用 action 事件
      gameSocket.emit('action', {
        room: room.id,
        action: { type: 'play', cards }
      })
    }
  },

  pass: () => {
    const { room } = get()
    if (room) {
      gameSocket.emit('action', {
        room: room.id,
        action: { type: 'pass' }
      })
    }
  },

  sendChat: (message: string, isEmoji: boolean = false) => {
    const { room } = get()
    if (room) {
      gameSocket.emit('chatMessage', { room: room.id, message, isEmoji })
    }
  },

  setTrusteeship: (enabled: boolean) => {
    const { room } = get()
    if (room) {
      gameSocket.emit('setTrusteeship', { room: room.id, enabled })
    }
  },

  handleRoomState: (data: RoomStatePayload) => {
    const currentRoom = get().room
    const roomId = currentRoom?.id || 'UNKNOWN'
    const playerCount = data.playerCount ?? data.gameState?.playerCount ?? currentRoom?.playerCount ?? data.players?.length ?? 3
    const prevHands = get().gameState?.hands
    const incomingGameState = data.gameState as any
    const normalizedGameState: GameState | null = incomingGameState
      ? {
          ...incomingGameState,
          hands:
            Array.isArray(incomingGameState.hands) && incomingGameState.hands.length > 0
              ? incomingGameState.hands
              : (prevHands && prevHands.length > 0
                  ? prevHands
                  : new Array(incomingGameState.playerCount ?? playerCount).fill([])),
        }
      : null
    
    console.log('[GameStore] handleRoomState:', { roomId, playerCount, players: data.players?.length })
    
    set({ 
      room: {
        id: roomId,
        playerCount: playerCount,
        players: data.players || [],
        ownerId: data.owner || '',
        status: normalizedGameState ? 'playing' : 'waiting',
        gameState: normalizedGameState
      },
      gameState: normalizedGameState
    })
  },

  handleGameState: (data: GameState) => {
    const currentGameState = get().gameState
    const room = get().room
    
    let hands = data.hands || []
    
    // If new state has no hands (public update), try to preserve my hand
    if ((!hands || hands.length === 0 || hands.every(h => !h || h.length === 0)) && currentGameState && currentGameState.hands && room) {
       // Find my index
       const myId = gameSocket.id
       const myIndex = room.players.findIndex(p => p.id === myId)
       
       if (myIndex !== -1 && currentGameState.hands[myIndex]) {
         // Initialize hands array if needed
         if (!hands || hands.length === 0) {
            hands = new Array(data.playerCount).fill([])
         }
         // Copy my hand
         const newHands = [...hands]
         newHands[myIndex] = currentGameState.hands[myIndex]
         hands = newHands
       }
    }
    
    set({ gameState: { ...data, hands } })
  }
}))
