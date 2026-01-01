import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { useUserStore } from '@/store/userStore'
import { gameSocket } from '@/services/socket'
import toast from 'react-hot-toast'
import Card from '@/components/Card'
import VFXOverlay from '@/components/VFXOverlay'
import Character from '@/components/Character'
import ChatBubble from '@/components/ChatBubble'
import GameOverModal from '@/components/GameOverModal'
import InteractionLayer, { InteractionEvent } from '@/components/InteractionLayer'
import { Bot, Clock, X } from 'lucide-react'
import { motion } from 'framer-motion'

function CountdownTimer({ durationMs, startTime }: { durationMs: number, startTime: number }) {
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    const update = () => {
      const remainingMs = Math.max(0, durationMs - (Date.now() - startTime))
      const remainingSec = Math.ceil(remainingMs / 1000)
      setTimeLeft(remainingSec)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [durationMs, startTime])

  if (timeLeft <= 0) return null

  return (
    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800/90 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg border border-slate-600 z-20">
      <Clock size={14} className="text-yellow-400" />
      <span className={timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}>{timeLeft}s</span>
    </div>
  )
}

// Pseudo-random helper for stable scattering
const getStableRandom = (seed: number) => {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { room, gameState, turnTimer, joinRoom, leaveRoom, isConnected, playCards, pass, startGame, setTrusteeship } = useGameStore()
  const user = useUserStore(state => state.user)
  const [selectedCards, setSelectedCards] = useState<number[]>([]) // Indices of selected cards
  const [selectedTributeCards, setSelectedTributeCards] = useState<number[]>([])
  const [selectedReturnCards, setSelectedReturnCards] = useState<number[]>([])
  
  // New Features State
  const [gameOverData, setGameOverData] = useState<any>(null)
  const [interactions, setInteractions] = useState<InteractionEvent[]>([])
  const [chatBubbles, setChatBubbles] = useState<{ playerId: string, message: string, isEmoji: boolean, id: number }[]>([])
  const [interactionMenuTarget, setInteractionMenuTarget] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{x: number, y: number} | null>(null)
  
  // Refs for positioning
  const playerRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const onGameOver = (data: any) => {
      setGameOverData(data)
    }

    const onInteraction = (data: { senderId: string, targetId: string, type: string }) => {
      const senderEl = playerRefs.current[data.senderId]
      const targetEl = playerRefs.current[data.targetId]
      
      if (senderEl && targetEl) {
        const startRect = senderEl.getBoundingClientRect()
        const endRect = targetEl.getBoundingClientRect()
        
        setInteractions(prev => [...prev, {
          id: Date.now().toString() + Math.random(),
          senderId: data.senderId,
          targetId: data.targetId,
          type: data.type,
          startRect,
          endRect
        }])
      } else {
        console.warn('Interaction missing refs:', { senderId: data.senderId, targetId: data.targetId, refs: Object.keys(playerRefs.current) })
      }
    }

    const onChatMessage = (data: { player: string, message: string, isEmoji: boolean }) => {
      const player = room?.players.find(p => p.name === data.player)
      if (player) {
        setChatBubbles(prev => [...prev, { 
          playerId: player.id, 
          message: data.message, 
          isEmoji: data.isEmoji,
          id: Date.now() 
        }])
      }
    }

    gameSocket.on('gameOver', onGameOver)
    gameSocket.on('interaction', onInteraction)
    gameSocket.on('chatMessage', onChatMessage)

    return () => {
      gameSocket.off('gameOver', onGameOver)
      gameSocket.off('interaction', onInteraction)
      gameSocket.off('chatMessage', onChatMessage)
    }
  }, [room])

  const sendInteraction = (type: string) => {
    if (interactionMenuTarget && room) {
      gameSocket.emit('interaction', { room: room.id, targetId: interactionMenuTarget, type })
      setInteractionMenuTarget(null)
      setMenuPosition(null)
    }
  }

  const handleCharacterClick = (playerId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // Don't show menu for self if desired, but usually allowed
    if (playerId === gameSocket.id) return 

    const rect = e.currentTarget.getBoundingClientRect()
    // Position menu to the right of the character by default, or left if too close to edge
    const x = rect.right + 10 > window.innerWidth - 200 ? rect.left - 210 : rect.right + 10
    const y = rect.top
    
    setInteractionMenuTarget(playerId)
    setMenuPosition({ x, y })
  }

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
    const player = room.players[idx]
    if (!player) return null
    return { player, index: idx }
  }

  // Toggle card selection
  const toggleCard = (index: number) => {
    setSelectedCards(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const handlePlay = () => {
    if (!gameState || myIndex === -1) return
    const hand = gameState.hands?.[myIndex] ?? []
    if (hand.length === 0) {
      toast.error('手牌尚未同步，请稍候')
      return
    }
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
  const myHand = isPlaying && myIndex !== -1 ? (gameState.hands?.[myIndex] ?? []) : []
  const isMyTurn = isPlaying && gameState.currentPlayer === myIndex

  const pendingTribute = isPlaying ? gameState.pendingTributes?.find(p => p.actionBy === myIndex) : undefined
  const pendingReturn = isPlaying ? gameState.pendingReturns?.find(p => p.actionBy === myIndex) : undefined
  const isTributePhase = isPlaying && gameState.status === 'tribute'
  const isReturnPhase = isPlaying && gameState.status === 'tribute_return'

  const toggleTributeCard = (index: number) => {
    setSelectedTributeCards(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const toggleReturnCard = (index: number) => {
    setSelectedReturnCards(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const handleSubmitTribute = () => {
    if (!isPlaying || !pendingTribute || myIndex === -1) return
    const cards = selectedTributeCards.map(i => myHand[i]).filter(Boolean)
    if (cards.length !== pendingTribute.count) {
      toast.error(`请选择 ${pendingTribute.count} 张进贡牌`)
      return
    }
    gameSocket.emit('action', { room: room.id, action: { type: 'tribute', cards } })
    setSelectedTributeCards([])
  }

  const handleSubmitReturn = () => {
    if (!isPlaying || !pendingReturn || myIndex === -1) return
    const cards = selectedReturnCards.map(i => myHand[i]).filter(Boolean)
    if (cards.length !== pendingReturn.count) {
      toast.error(`请选择 ${pendingReturn.count} 张回贡牌`)
      return
    }
    gameSocket.emit('action', { room: room.id, action: { type: 'returnTribute', cards } })
    setSelectedReturnCards([])
  }

  // Check trusteeship status of current player
  const myPlayer = myIndex !== -1 ? room.players[myIndex] : null
  const isTrusteeship = !!myPlayer?.isTrusteeship

  const toggleTrusteeship = () => {
    setTrusteeship(!isTrusteeship)
  }

  // Layout for 3 players: My(Bottom), Right(Next), Left(Prev)
  // Layout for 4 players: My(Bottom), Right, Top, Left
  const rightPlayer = getPlayerAtOffset(1)
  const topPlayer = room.playerCount === 4 ? getPlayerAtOffset(2) : null
  const leftPlayer = room.playerCount === 4 ? getPlayerAtOffset(3) : getPlayerAtOffset(2)

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col overflow-hidden" onClick={() => {
      setInteractionMenuTarget(null)
      setMenuPosition(null)
    }}>
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
          {isPlaying && (
            <button
              onClick={toggleTrusteeship}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${isTrusteeship ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              <Bot size={16} /> {isTrusteeship ? '托管中' : '托管'}
            </button>
          )}
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
            <div className="relative w-full h-full">
              {/* Table Plays (Scattered) */}
              {gameState.tablePlays?.map((play, idx) => {
                // Generate stable random position
                const seed = idx * 1337 + play.by
                const randX = getStableRandom(seed)
                const randY = getStableRandom(seed + 1)
                const randRot = getStableRandom(seed + 2)
                
                // Scatter range: +/- 150px X, +/- 80px Y
                const x = (randX - 0.5) * 300
                const y = (randY - 0.5) * 160
                const rot = (randRot - 0.5) * 60 // +/- 30 deg

                return (
                  <div 
                    key={`${play.by}-${idx}`} 
                    className="absolute left-1/2 top-1/2 flex flex-col items-center transition-all duration-500" 
                    style={{ 
                      transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rot}deg)`,
                      zIndex: idx 
                    }}
                  >
                     <div className="flex -space-x-8">
                       {play.cards.map((c, i) => (
                         <Card key={i} card={c} scale={0.6} hideBottomInfo={true} /> 
                       ))}
                     </div>
                  </div>
                )
              })}
              
              <VFXOverlay lastPlay={gameState.lastPlay} />
            </div>
          )}
        </div>

        {/* Players Layout */}
        
        {/* Top Player (if 4 players) */}
        {topPlayer && (
          <div 
            ref={el => { if (el) playerRefs.current[topPlayer.player.id] = el }}
            className="absolute top-16 left-1/2 -translate-x-1/2 flex flex-col items-center z-30 pointer-events-auto"
          >
            {/* Chat Bubble */}
            {chatBubbles.filter(b => b.playerId === topPlayer.player.id).slice(-1).map(b => (
              <ChatBubble key={b.id} message={b.message} isEmoji={b.isEmoji} />
            ))}

            {isPlaying && gameState.currentPlayer === topPlayer.index && turnTimer && (
              <CountdownTimer durationMs={turnTimer.durationMs} startTime={turnTimer.startTime} />
            )}
            
            <Character 
              name={topPlayer.player.name}
              isMe={false}
              isTurn={!!(isPlaying && gameState.currentPlayer === topPlayer.index)}
              cardCount={isPlaying ? (gameState.handCounts?.[topPlayer.index] ?? 0) : 0}
              onClick={(e) => handleCharacterClick(topPlayer.player.id, e)}
            />

            <div className="text-xs text-yellow-400 mt-0.5 font-bold bg-black/40 px-2 rounded-full backdrop-blur-sm border border-yellow-500/30">
              💰 {topPlayer.player.score}
            </div>
            
            {topPlayer.player.isTrusteeship && (
              <div className="absolute -right-8 top-0 bg-yellow-600 text-white text-xs px-1 rounded animate-pulse">
                <Bot size={12} />
              </div>
            )}
          </div>
        )}

        {/* Left Player */}
        {leftPlayer && (
          <div 
            ref={el => { if (el) playerRefs.current[leftPlayer.player.id] = el }}
            className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-auto"
          >
            {/* Chat Bubble */}
            {chatBubbles.filter(b => b.playerId === leftPlayer.player.id).slice(-1).map(b => (
              <ChatBubble key={b.id} message={b.message} isEmoji={b.isEmoji} />
            ))}

            {isPlaying && gameState.currentPlayer === leftPlayer.index && turnTimer && (
              <CountdownTimer durationMs={turnTimer.durationMs} startTime={turnTimer.startTime} />
            )}
            
            <Character 
              name={leftPlayer.player.name}
              isMe={false}
              isTurn={!!(isPlaying && gameState.currentPlayer === leftPlayer.index)}
              cardCount={isPlaying ? (gameState.handCounts?.[leftPlayer.index] ?? 0) : 0}
              onClick={(e) => handleCharacterClick(leftPlayer.player.id, e)}
            />

            <div className="text-xs text-yellow-400 mt-0.5 font-bold bg-black/40 px-2 rounded-full backdrop-blur-sm border border-yellow-500/30">
              💰 {leftPlayer.player.score}
            </div>

            {leftPlayer.player.isTrusteeship && (
              <div className="absolute -right-8 top-0 bg-yellow-600 text-white text-xs px-1 rounded animate-pulse">
                <Bot size={12} />
              </div>
            )}
          </div>
        )}

        {/* Right Player */}
        {rightPlayer && (
          <div 
            ref={el => { if (el) playerRefs.current[rightPlayer.player.id] = el }}
            className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center z-30 pointer-events-auto"
          >
            {/* Chat Bubble */}
            {chatBubbles.filter(b => b.playerId === rightPlayer.player.id).slice(-1).map(b => (
              <ChatBubble key={b.id} message={b.message} isEmoji={b.isEmoji} />
            ))}

            {isPlaying && gameState.currentPlayer === rightPlayer.index && turnTimer && (
              <CountdownTimer durationMs={turnTimer.durationMs} startTime={turnTimer.startTime} />
            )}
            
            <Character 
              name={rightPlayer.player.name}
              isMe={false}
              isTurn={!!(isPlaying && gameState.currentPlayer === rightPlayer.index)}
              cardCount={isPlaying ? (gameState.handCounts?.[rightPlayer.index] ?? 0) : 0}
              onClick={(e) => handleCharacterClick(rightPlayer.player.id, e)}
            />

            <div className="text-xs text-yellow-400 mt-0.5 font-bold bg-black/40 px-2 rounded-full backdrop-blur-sm border border-yellow-500/30">
              💰 {rightPlayer.player.score}
            </div>

            {rightPlayer.player.isTrusteeship && (
              <div className="absolute -left-8 top-0 bg-yellow-600 text-white text-xs px-1 rounded animate-pulse">
                <Bot size={12} />
              </div>
            )}
          </div>
        )}

        {/* My Hand (Bottom) */}
        <div 
          className="absolute bottom-0 left-0 right-0 pb-4 pt-12 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent flex flex-col items-center z-20"
        >
          
          {/* My Character (Small, for interaction target) */}
          <div 
            ref={el => { if (el && gameSocket.id) playerRefs.current[gameSocket.id] = el }}
            className="absolute bottom-4 left-4 opacity-80 hover:opacity-100 transition-opacity pointer-events-auto"
          >
             <Character 
               name="我"
               isMe={true}
               isTurn={!!isMyTurn}
               cardCount={0} 
               onClick={(e) => gameSocket.id && handleCharacterClick(gameSocket.id, e)}
             />
             {/* My Chat Bubble */}
             {gameSocket.id && chatBubbles.filter(b => b.playerId === gameSocket.id).slice(-1).map(b => (
                <ChatBubble key={b.id} message={b.message} isEmoji={b.isEmoji} />
             ))}
          </div>

          {/* Multiplier */}
          {isPlaying && (
             <div className="absolute bottom-8 right-8 text-red-500 font-black text-4xl drop-shadow-lg animate-pulse z-30 pointer-events-none select-none" style={{ textShadow: '0 0 10px rgba(255,0,0,0.5)' }}>
               x{gameState.multiplier}
             </div>
          )}

          {/* My Timer */}
          {isMyTurn && turnTimer && (
            <div className="relative mb-8">
               <CountdownTimer durationMs={turnTimer.durationMs} startTime={turnTimer.startTime} />
            </div>
          )}

          {/* Tribute / Return UI */}
          {isPlaying && (isTributePhase || isReturnPhase) && (
            <div className="mb-4 pointer-events-auto">
              {isTributePhase && (
                <div className="text-center">
                  {pendingTribute ? (
                    <div className="space-y-2">
                      <div className="text-white font-bold">进贡阶段：请选择 {pendingTribute.count} 张最大牌并确认</div>
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => setSelectedTributeCards([])}
                          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-full font-bold"
                        >
                          重选
                        </button>
                        <button
                          onClick={handleSubmitTribute}
                          className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-full font-bold"
                        >
                          确认进贡
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-300">等待其他玩家进贡…</div>
                  )}
                </div>
              )}

              {isReturnPhase && (
                <div className="text-center">
                  {pendingReturn ? (
                    <div className="space-y-2">
                      <div className="text-white font-bold">回贡阶段：请选择 {pendingReturn.count} 张牌并确认</div>
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => setSelectedReturnCards([])}
                          className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-full font-bold"
                        >
                          重选
                        </button>
                        <button
                          onClick={handleSubmitReturn}
                          className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-full font-bold"
                        >
                          确认回贡
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-300">等待其他玩家回贡…</div>
                  )}
                </div>
              )}
            </div>
          )}

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
          <div className="flex -space-x-8 hover:-space-x-4 transition-all duration-300 px-4 overflow-x-auto max-w-full pb-4 pt-4 min-h-[160px] items-end pointer-events-auto">
            {myHand.map((card, idx) => (
              <motion.div 
                key={`${card.rank}-${card.suit}-${idx}`} 
                className="relative origin-bottom"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                whileHover={{ y: -24 }}
              >
                <Card 
                  card={card} 
                  selected={
                    (isTributePhase ? selectedTributeCards.includes(idx) : false) ||
                    (isReturnPhase ? selectedReturnCards.includes(idx) : false) ||
                    (!isTributePhase && !isReturnPhase ? selectedCards.includes(idx) : false)
                  }
                  onClick={() => {
                    if (isTributePhase) return toggleTributeCard(idx)
                    if (isReturnPhase) return toggleReturnCard(idx)
                    return toggleCard(idx)
                  }}
                  scale={1.1}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Interaction Layer */}
      <InteractionLayer 
        events={interactions} 
        onComplete={(id) => setInteractions(prev => prev.filter(i => i.id !== id))} 
      />

      {/* Game Over Modal */}
      {gameOverData && room && gameSocket.id && (
        <GameOverModal 
          results={gameOverData} 
          players={room.players} 
          myId={gameSocket.id} 
          onClose={() => setGameOverData(null)} 
        />
      )}

      {/* Interaction Menu (Absolute Positioned) */}
      {interactionMenuTarget && menuPosition && (
        <div 
          className="fixed z-[60] animate-in fade-in zoom-in duration-200"
          style={{ left: menuPosition.x, top: menuPosition.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-slate-800/90 backdrop-blur p-3 rounded-xl border border-slate-600 shadow-2xl flex flex-col gap-2">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-1">
               <span className="text-xs font-bold text-slate-300">互动</span>
               <button onClick={() => setInteractionMenuTarget(null)} className="text-slate-400 hover:text-white"><X size={14}/></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['tomato', 'bomb', 'flower', 'kiss', 'egg'].map(item => (
                <button 
                  key={item}
                  onClick={() => sendInteraction(item)}
                  className="text-2xl p-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg transition-transform hover:scale-110 active:scale-95"
                  title={item}
                >
                  {{ tomato: '🍅', bomb: '💣', flower: '🌹', kiss: '💋', egg: '🥚' }[item]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
