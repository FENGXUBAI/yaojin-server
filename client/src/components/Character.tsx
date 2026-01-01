import { motion } from 'framer-motion'
import { clsx } from 'clsx'

interface CharacterProps {
  name: string
  isMe: boolean
  isTurn: boolean
  cardCount: number
  onClick?: () => void
}

export default function Character({ name, isMe, isTurn, cardCount, onClick }: CharacterProps) {
  return (
    <div className="relative flex flex-col items-center group cursor-pointer" onClick={onClick}>
      {/* Character Model (Simple SVG Representation) */}
      <motion.div 
        animate={{ 
          y: isTurn ? [0, -5, 0] : 0,
          scale: isTurn ? 1.05 : 1
        }}
        transition={{ 
          y: { repeat: Infinity, duration: 2 },
          scale: { duration: 0.3 }
        }}
        className="relative w-24 h-32"
      >
        {/* Body */}
        <svg viewBox="0 0 100 130" className="w-full h-full drop-shadow-xl">
          <defs>
            <linearGradient id={`grad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={isMe ? "#60a5fa" : "#f87171"} />
              <stop offset="100%" stopColor={isMe ? "#2563eb" : "#dc2626"} />
            </linearGradient>
          </defs>
          
          {/* Head */}
          <circle cx="50" cy="25" r="18" fill={`url(#grad-${name})`} stroke="white" strokeWidth="2" />
          
          {/* Body */}
          <path d="M20,50 Q50,130 80,50 L70,120 L30,120 L20,50 Z" fill={`url(#grad-${name})`} stroke="white" strokeWidth="2" />
          
          {/* Arms */}
          <path d="M20,55 Q5,80 15,100" fill="none" stroke={`url(#grad-${name})`} strokeWidth="6" strokeLinecap="round" />
          <path d="M80,55 Q95,80 85,100" fill="none" stroke={`url(#grad-${name})`} strokeWidth="6" strokeLinecap="round" />
        </svg>

        {/* Hand Cards Visual */}
        {cardCount > 0 && (
          <div className="absolute top-16 -right-4 w-12 h-12">
             <div className="relative w-full h-full">
               {[...Array(Math.min(3, Math.ceil(cardCount / 5)))].map((_, i) => (
                 <div 
                   key={i}
                   className="absolute w-6 h-8 bg-white border border-slate-300 rounded-sm shadow-sm"
                   style={{ 
                     transform: `rotate(${i * 10 - 10}deg) translateX(${i * 2}px)`,
                     left: i * 2,
                     top: i * 1
                   }}
                 />
               ))}
             </div>
          </div>
        )}
      </motion.div>

      {/* Name Tag */}
      <div className={clsx(
        "mt-1 px-2 py-0.5 rounded text-xs font-bold text-white shadow-md border border-white/20",
        isTurn ? "bg-yellow-600 animate-pulse" : "bg-slate-800/80"
      )}>
        {name}
      </div>
    </div>
  )
}
