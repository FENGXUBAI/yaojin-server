import { io, Socket } from 'socket.io-client'

class GameSocket {
  private socket: Socket | null = null
  private static instance: GameSocket
  private baseListenersBound = false

  private constructor() {}

  public static getInstance(): GameSocket {
    if (!GameSocket.instance) {
      GameSocket.instance = new GameSocket()
    }
    return GameSocket.instance
  }

  public connect(url: string = '/') {
    // Reuse existing socket instance to avoid creating parallel connections
    // that can cause the old (room owner) socket to disconnect immediately.
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect()
      }
      return
    }

    this.socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      // Keep connection alive across page navigation
      forceNew: false,
    })

    if (!this.baseListenersBound) {
      this.baseListenersBound = true

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id)
      })

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason)
      })

      this.socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err)
      })
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.baseListenersBound = false
    }
  }

  public emit(event: string, data?: any) {
    if (!this.socket) {
      console.warn('Socket not connected, cannot emit:', event)
      return
    }
    this.socket.emit(event, data)
  }

  public on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback)
  }

  public off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback)
  }

  public get id() {
    return this.socket?.id
  }

  public get connected() {
    return this.socket?.connected ?? false
  }
}

export const gameSocket = GameSocket.getInstance()
