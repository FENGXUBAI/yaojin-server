import { motion } from 'framer-motion'
import { Player } from '@/types'

interface GameOverModalProps {
  results: {
    finishedOrder: number[]
    scores: { id: string, score: number }[]
    multiplier: number
  }
  players: Player[]
  myId: string
  onClose: () => void
}

export default function GameOverModal({ results, players, myId, onClose }: GameOverModalProps) {
  const myRank = results.finishedOrder.indexOf(players.findIndex(p => p.id === myId)) + 1
  const isVictory = myRank === 1 || (players.length === 4 && myRank <= 2) // Simple logic

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border-2 border-yellow-500 rounded-xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
      >
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-900/20 to-transparent pointer-events-none" />
        
        <div className="relative z-10 text-center">
          <motion.div 
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            className={`text-6xl font-black mb-6 ${isVictory ? 'text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'text-slate-400'}`}
          >
            {isVictory ? 'VICTORY' : 'DEFEAT'}
          </motion.div>

          <div className="text-xl text-slate-300 mb-8 font-mono">
            倍率: <span className="text-yellow-400 font-bold">x{results.multiplier}</span>
          </div>

          <div className="space-y-3 mb-8">
            {results.finishedOrder.map((playerIdx, rank) => {
              const player = players[playerIdx]
              if (!player) return null
              const score = results.scores.find(s => s.id === player.id)?.score || 0
              const isMe = player.id === myId
              
              return (
                <div key={player.id} className={`flex items-center justify-between p-3 rounded-lg ${isMe ? 'bg-white/10 border border-white/20' : 'bg-black/20'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${rank === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-white'}`}>
                      {rank + 1}
                    </div>
                    <span className={isMe ? 'text-white font-bold' : 'text-slate-400'}>
                      {player.name}
                    </span>
                  </div>
                  <div className="font-mono text-yellow-400">
                    💰 {score}
                  </div>
                </div>
              )
            })}
            {/* Show remaining players who didn't finish if any */}
            {players.map((p, idx) => {
                if (results.finishedOrder.includes(idx)) return null
                const score = results.scores.find(s => s.id === p.id)?.score || 0
                const isMe = p.id === myId
                return (
                    <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg ${isMe ? 'bg-white/10 border border-white/20' : 'bg-black/20'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-slate-800 text-slate-500">
                          -
                        </div>
                        <span className={isMe ? 'text-white font-bold' : 'text-slate-400'}>
                          {p.name}
                        </span>
                      </div>
                      <div className="font-mono text-yellow-400">
                        💰 {score}
                      </div>
                    </div>
                )
            })}
          </div>

          <button 
            onClick={onClose}
            className="px-8 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-bold rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            继续游戏
          </button>
        </div>
      </motion.div>
    </div>
  )
}
