import { create } from 'zustand'
import { gameSocket } from '@/services/socket'
import { Room, GameState, RoomStatePayload, Card } from '@/types'
import { useUserStore } from './userStore'
import toast from 'react-hot-toast'

interface GameStore {
  room: Room | null
  gameState: GameState | null
  isConnected: boolean
  clientKey: string | null
  
  // Actions
  connect: () => void
  disconnect: () => void
  createRoom: (playerCount: number) => Promise<string>
  joinRoom: (roomId: string) => Promise<void>
  quickMatch: () => Promise<string>
  leaveRoom: () => void
  startGame: () => void
  
  playCards: (cards: Card[]) => void
  pass: () => void
  
  // Event Handlers (internal use mostly)
  handleRoomState: (data: RoomStatePayload) => void
  handleGameState: (data: GameState) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  room: null,
  gameState: null,
  isConnected: false,
  clientKey: null,

  connect: () => {
    gameSocket.connect()
    
    // Setup listeners
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
  },

  disconnect: () => {
    gameSocket.disconnect()
    set({ isConnected: false, room: null, gameState: null })
  },

  createRoom: async (playerCount: number) => {
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
    set({ clientKey: data.clientKey })
    
    // Socket join
    gameSocket.emit('join', {
      room: data.roomId,
      name: user.nickname,
      clientKey: data.clientKey
    })

    return data.roomId
  },

  joinRoom: async (roomId: string) => {
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
    set({ clientKey: data.clientKey })

    // 2. Socket Join
    gameSocket.emit('join', {
      room: data.roomId,
      name: user.nickname,
      clientKey: data.clientKey
    })
  },

  quickMatch: async () => {
    const user = useUserStore.getState().user
    if (!user) throw new Error('未登录')

    const res = await fetch('/api/match/quick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerCount: 3, playerName: user.nickname }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '匹配失败')
    }

    const data = await res.json()
    set({ clientKey: data.clientKey })

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
    set({ room: null, gameState: null })
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

  handleRoomState: (data: RoomStatePayload) => {
    const currentRoom = get().room
    set({ 
      room: {
        id: currentRoom?.id || 'UNKNOWN',
        playerCount: currentRoom?.playerCount ?? 3,
        ...(currentRoom || {}),
        players: data.players,
        ownerId: data.owner,
        status: data.gameState ? 'playing' : 'waiting',
        gameState: data.gameState
      },
      gameState: data.gameState
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
