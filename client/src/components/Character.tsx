import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import type { MouseEvent } from 'react'

interface CharacterProps {
  name: string
  isMe: boolean
  isTurn: boolean
  cardCount: number
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
}

export default function Character({ name, isMe, isTurn, cardCount, onClick }: CharacterProps) {
  // Generate pseudo-random avatar features based on name
  const nameSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const hairColor = ['#1a1a1a', '#5d4037', '#e6c200', '#d84315', '#607d8b'][nameSum % 5]
  const skinColor = ['#f8d9c0', '#e0ac69', '#f5cab5', '#d2b48c'][nameSum % 4]
  const shirtColor = isMe ? '#3b82f6' : ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][nameSum % 4]

  return (
    <div className="relative flex flex-col items-center group cursor-pointer" onClick={onClick}>
      {/* Character Model */}
      <motion.div 
        animate={{ 
          y: isTurn ? [0, -5, 0] : 0,
          scale: isTurn ? 1.05 : 1
        }}
        transition={{ 
          y: { repeat: Infinity, duration: 2 },
          scale: { duration: 0.3 }
        }}
        className="relative w-20 h-20 md:w-24 md:h-24"
      >
        {/* Avatar SVG */}
        <div className="w-full h-full rounded-full border-4 border-white shadow-lg overflow-hidden relative bg-slate-200">
           <svg viewBox="0 0 100 100" className="w-full h-full">
             <defs>
               <linearGradient id={`grad-${name}`} x1="0%" y1="0%" x2="0%" y2="100%">
                 <stop offset="0%" stopColor={shirtColor} stopOpacity="1" />
                 <stop offset="100%" stopColor={shirtColor} stopOpacity="0.8" />
               </linearGradient>
             </defs>
             
             {/* Background/Shirt */}
             <path d="M10,100 L90,100 L90,80 Q90,60 50,60 Q10,60 10,80 Z" fill={`url(#grad-${name})`} />
             
             {/* Neck */}
             <rect x="40" y="50" width="20" height="20" fill={skinColor} />
             
             {/* Head */}
             <ellipse cx="50" cy="40" rx="25" ry="28" fill={skinColor} />
             
             {/* Hair (Simple) */}
             <path d="M25,40 Q25,10 50,10 Q75,10 75,40 L75,30 Q75,5 50,5 Q25,5 25,30 Z" fill={hairColor} />
             
             {/* Eyes */}
             <circle cx="40" cy="40" r="3" fill="#333" />
             <circle cx="60" cy="40" r="3" fill="#333" />
             
             {/* Smile */}
             <path d="M40,52 Q50,58 60,52" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />
           </svg>
        </div>

        {/* Status Ring */}
        {isTurn && (
          <div className="absolute -inset-1 rounded-full border-2 border-yellow-400 animate-ping opacity-75" />
        )}

        {/* Hand Cards Visual */}
        {cardCount > 0 && (
          <div className="absolute -right-2 top-0 bg-slate-800 text-white text-xs font-bold px-2 py-0.5 rounded-full border border-white/30 shadow-sm z-10 flex items-center gap-1">
             <div className="w-2 h-3 bg-white rounded-[1px] transform rotate-12" />
             {cardCount}
          </div>
        )}
      </motion.div>

      {/* Name Tag */}
      <div className={clsx(
        "mt-2 px-3 py-0.5 rounded-full text-xs font-bold text-white shadow-md border border-white/10 transition-colors",
        isTurn ? "bg-yellow-600 ring-2 ring-yellow-400/50" : "bg-slate-800/80"
      )}>
        {name}
      </div>
    </div>
  )
}
