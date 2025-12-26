export interface User {
  id: string
  nickname: string
  avatarUrl: string
  coins: number
  level: number
  token?: string
}

export interface Card {
  rank: string
  suit: string
  isJoker: boolean
  sortValue: number
}

export interface Player {
  id: string
  name: string
  ready: boolean
  score: number
  isBot?: boolean
  connected: boolean
  clientKey?: string
}

export interface Room {
  id: string
  players: Player[]
  playerCount: number
  ownerId: string
  status: 'waiting' | 'playing'
  gameState?: GameState | null
}

export interface Pattern {
  type: 'SINGLE' | 'PAIR' | 'TRIPLE' | 'FOUR' | 'STRAIGHT' | 'DOUBLE_SEQUENCE'
  cards: Card[]
  label: string
  strength: number
  extra?: any
}

export interface GameState {
  gameId: string
  playerCount: number
  hands: Card[][] // 客户端通常只收到自己的手牌，或者手牌数量
  handCounts?: number[] // 其他玩家的手牌数
  currentPlayer: number
  lastPlay: (Pattern & { by: number }) | null
  passesInRow: number
  lastPlayOwner: number | null
  tablePlays: { by: number; cards: Card[] }[]
  finishedOrder: number[]
  revolution: boolean
  status: 'playing' | 'tribute_return'
  multiplier: number
}

export interface RoomStatePayload {
  players: Player[]
  gameState: GameState | null
  owner: string
  matchHistory: any[]
}
