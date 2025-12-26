import { Card as CardType } from '@/types'
import { clsx } from 'clsx'
import { motion } from 'framer-motion'

interface CardProps {
  card: CardType
  selected?: boolean
  onClick?: () => void
  scale?: number
  hidden?: boolean
}

const suitColors: Record<string, string> = {
  '♠': 'text-slate-800',
  '♣': 'text-slate-800',
  '♥': 'text-red-600',
  '♦': 'text-red-600',
}

export default function Card({ card, selected, onClick, scale = 1, hidden }: CardProps) {
  if (hidden) {
    return (
      <div 
        className="relative bg-blue-600 rounded-lg border-2 border-white shadow-md"
        style={{ width: 80 * scale, height: 112 * scale }}
      >
        <div className="absolute inset-2 border border-blue-400 rounded opacity-50 bg-pattern-grid" />
      </div>
    )
  }

  const isJoker = card.isJoker
  const colorClass = isJoker 
    ? (card.rank === 'JOKER_BIG' ? 'text-red-600' : 'text-slate-800')
    : suitColors[card.suit] || 'text-slate-800'

  const displayRank = isJoker ? (card.rank === 'JOKER_BIG' ? '大王' : '小王') : card.rank

  return (
    <motion.div
      layout
      initial={false}
      animate={{ y: selected ? -20 : 0 }}
      onClick={onClick}
      className={clsx(
        "relative bg-white rounded-lg shadow-md select-none cursor-pointer border border-slate-200 flex flex-col items-center justify-between p-1 transition-shadow hover:shadow-lg",
        colorClass
      )}
      style={{ width: 80 * scale, height: 112 * scale }}
    >
      {/* Top Left */}
      <div className="self-start flex flex-col items-center leading-none">
        <span className="font-bold text-lg">{isJoker ? 'J' : displayRank}</span>
        {!isJoker && <span className="text-lg">{card.suit}</span>}
      </div>

      {/* Center (Suit or Joker) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isJoker ? (
          <span className="text-4xl writing-vertical-rl">{card.rank === 'JOKER_BIG' ? '👹' : '🤡'}</span>
        ) : (
          <span className="text-4xl">{card.suit}</span>
        )}
      </div>

      {/* Bottom Right (Rotated) */}
      {!isJoker && (
        <div className="self-end flex flex-col items-center leading-none rotate-180">
          <span className="font-bold text-lg">{displayRank}</span>
          <span className="text-lg">{card.suit}</span>
        </div>
      )}
    </motion.div>
  )
}
