import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { useUserStore } from '@/store/userStore'
import { gameSocket } from '@/services/socket'
import toast from 'react-hot-toast'
import Card from '@/components/Card'

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { room, gameState, joinRoom, leaveRoom, isConnected, playCards, pass, startGame } = useGameStore()
  const user = useUserStore(state => state.user)
  const [selectedCards, setSelectedCards] = useState<number[]>([]) // Indices of selected cards

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }

    if (!room || room.id !== roomId) {
      if (roomId) {
        joinRoom(roomId).catch(err => {
          toast.error(err.message)
          navigate('/lobby')
        })
      }
    }
  }, [roomId, user, room, joinRoom, navigate])

  const handleLeave = () => {
    leaveRoom()
    navigate('/lobby')
  }

  // Calculate relative positions
  const myIndex = useMemo(() => {
    if (!room || !gameSocket.id) return -1
    return room.players.findIndex(p => p.id === gameSocket.id)
  }, [room, gameSocket.id])

  const getPlayerAtOffset = (offset: number) => {
    if (!room || myIndex === -1) return null
    const idx = (myIndex + offset) % room.playerCount
    return { player: room.players[idx], index: idx }
  }

  // Toggle card selection
  const toggleCard = (index: number) => {
    setSelectedCards(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const handlePlay = () => {
    if (!gameState || myIndex === -1) return
    const hand = gameState.hands[myIndex]
    const cardsToPlay = selectedCards.map(i => hand[i]).filter(Boolean)
    if (cardsToPlay.length === 0) {
      toast.error('请选择要出的牌')
      return
    }
    playCards(cardsToPlay)
    setSelectedCards([])
  }

  const handlePass = () => {
    pass()
    setSelectedCards([])
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-pulse">正在进入房间...</div>
      </div>
    )
  }

  const isOwner = room.ownerId === gameSocket.id
  const isPlaying = room.status === 'playing' && gameState
  const myHand = isPlaying && myIndex !== -1 ? gameState.hands[myIndex] : []
  const isMyTurn = isPlaying && gameState.currentPlayer === myIndex

  // Layout for 3 players: My(Bottom), Right(Next), Left(Prev)
  // Layout for 4 players: My(Bottom), Right, Top, Left
  const rightPlayer = getPlayerAtOffset(1)
  const topPlayer = room.playerCount === 4 ? getPlayerAtOffset(2) : null
  const leftPlayer = room.playerCount === 4 ? getPlayerAtOffset(3) : getPlayerAtOffset(2)

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 bg-slate-800/80 backdrop-blur border-b border-slate-700 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <button onClick={handleLeave} className="text-slate-400 hover:text-white transition-colors">
            <span className="mr-1">←</span> 退出
          </button>
          <span className="font-bold text-white">房间: {room.id}</span>
          <span className="text-xs px-2 py-0.5 bg-slate-700 rounded text-slate-300">
            {room.playerCount}人局
          </span>
        </div>
        <div className="flex items-center gap-4">
          {!isPlaying && isOwner && (
            <button 
              onClick={startGame}
              disabled={room.players.length < room.playerCount}
              className="px-4 py-1 bg-primary-600 hover:bg-primary-500 text-white rounded-full text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              开始游戏
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-slate-400">{isConnected ? '已连接' : '断开'}</span>
          </div>
        </div>
      </div>

      {/* Game Table */}
      <div className="flex-1 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900">
        
        {/* Center Info / Table Plays */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {!isPlaying ? (
            <div className="text-center space-y-4 pointer-events-auto">
              <div className="text-2xl font-bold text-slate-500">等待玩家准备...</div>
              <div className="text-slate-600">
                当前人数: {room.players.length} / {room.playerCount}
              </div>
              {isOwner && room.players.length < room.playerCount && (
                <div className="text-primary-500 animate-pulse">等待更多玩家加入</div>
              )}
            </div>
          ) : (
            <div className="relative w-full h-full max-w-4xl max-h-[600px]">
              {/* Current Last Play (Center) */}
              {gameState.lastPlay && (
                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
                   <div className="bg-black/40 px-4 py-1 rounded-full text-white mb-2 backdrop-blur-sm border border-white/10">
                     {gameState.lastPlay.label}
                   </div>
                   <div className="flex -space-x-8">
                     {gameState.lastPlay.cards.map((c, i) => (
                       <Card key={i} card={c} scale={0.8} />
                     ))}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Players Layout */}
        
        {/* Top Player (if 4 players) */}
        {topPlayer && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center mb-2 shadow-lg">
              {topPlayer.player.name[0]}
            </div>
            <div className="text-white text-sm bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
              {topPlayer.player.name}
            </div>
            <div className="mt-2 flex -space-x-1">
              {/* Card Backs */}
              {Array.from({ length: 5 }).map((_, i) => ( // Mock count
                <div key={i} className="w-6 h-8 bg-blue-600 rounded border border-white/20 shadow-sm" />
              ))}
            </div>
          </div>
        )}

        {/* Left Player */}
        {leftPlayer && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center mb-2 shadow-lg">
              {leftPlayer.player.name[0]}
            </div>
            <div className="text-white text-sm bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
              {leftPlayer.player.name}
            </div>
            <div className="mt-2 flex flex-col -space-y-6">
              {/* Vertical Card Backs */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-8 h-6 bg-blue-600 rounded border border-white/20 shadow-sm" />
              ))}
            </div>
          </div>
        )}

        {/* Right Player */}
        {rightPlayer && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center mb-2 shadow-lg">
              {rightPlayer.player.name[0]}
            </div>
            <div className="text-white text-sm bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
              {rightPlayer.player.name}
            </div>
            <div className="mt-2 flex flex-col -space-y-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="w-8 h-6 bg-blue-600 rounded border border-white/20 shadow-sm" />
              ))}
            </div>
          </div>
        )}

        {/* My Hand (Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 pb-4 pt-12 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex flex-col items-center z-20">
          {/* Action Buttons */}
          {isMyTurn && (
            <div className="flex gap-4 mb-6 animate-bounce-slow pointer-events-auto">
              <button 
                onClick={handlePass}
                className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-full font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                不要
              </button>
              <button 
                onClick={() => setSelectedCards([])}
                className="px-6 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-full font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                重选
              </button>
              <button 
                onClick={handlePlay}
                disabled={selectedCards.length === 0}
                className="px-8 py-2 bg-gradient-to-r from-primary-500 to-orange-600 hover:from-primary-400 hover:to-orange-500 text-white rounded-full font-bold shadow-lg shadow-orange-500/30 transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
              >
                出牌
              </button>
            </div>
          )}

          {/* Hand Cards */}
          <div className="flex -space-x-8 hover:-space-x-4 transition-all duration-300 px-4 overflow-x-auto max-w-full pb-4 pt-4 min-h-[160px] items-end">
            {myHand.map((card, idx) => (
              <div key={`${card.rank}-${card.suit}-${idx}`} className="relative transition-transform hover:-translate-y-6 origin-bottom">
                <Card 
                  card={card} 
                  selected={selectedCards.includes(idx)}
                  onClick={() => toggleCard(idx)}
                  scale={1.1}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
