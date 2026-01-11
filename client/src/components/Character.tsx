import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import type { MouseEvent } from 'react'

interface CharacterProps {
  name: string
  isMe: boolean
  isTurn: boolean
  cardCount?: number
  isOut?: boolean
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
}

export default function Character({ name, isMe, isTurn, isOut, onClick }: CharacterProps) {
  // Generate pseudo-random avatar features based on name
  const nameSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const hairColor = ['#111827', '#4e342e', '#fbbf24', '#c2410c', '#475569'][nameSum % 5]
  const skinColor = ['#f8d9c0', '#e0ac69', '#f5cab5', '#d2b48c'][nameSum % 4]
  const shirtColor = isMe ? '#2563eb' : ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6'][nameSum % 4]
  const eyeColor = ['#111827', '#0f766e', '#1d4ed8', '#7c2d12'][nameSum % 4]
  const hasGlasses = nameSum % 3 === 0
  const hasBeard = nameSum % 4 === 0
  const accent = isMe ? '#60a5fa' : ['#fb7185', '#34d399', '#fbbf24', '#a78bfa'][nameSum % 4]

  return (
    <div className="relative flex flex-col items-center group cursor-pointer" onClick={onClick}>
      {/* Character Model */}
      <motion.div 
        animate={{ 
          y: isTurn ? [0, -6, 0] : 0,
          scale: isTurn ? 1.06 : 1
        }}
        transition={{ 
          y: { repeat: Infinity, duration: 2 },
          scale: { duration: 0.3 }
        }}
        className={clsx(
          'relative w-20 h-20 md:w-24 md:h-24',
          isOut ? 'opacity-60 saturate-0' : 'opacity-100'
        )}
      >
        {/* Avatar Card */}
        <div className={clsx(
          'w-full h-full rounded-2xl overflow-hidden relative',
          'shadow-[0_10px_25px_rgba(0,0,0,0.35)] border border-white/20',
          'bg-[radial-gradient(circle_at_30%_20%,_rgba(255,255,255,0.35),_transparent_55%),radial-gradient(circle_at_70%_80%,_rgba(255,255,255,0.18),_transparent_55%)]'
        )}>
          {/* Accent glow */}
          <div
            className={clsx(
              'absolute inset-0 pointer-events-none',
              isTurn ? 'opacity-100' : 'opacity-40'
            )}
            style={{
              background: `radial-gradient(circle at 50% 30%, ${accent}55, transparent 60%)`
            }}
          />

          {/* Avatar SVG */}
          <svg viewBox="0 0 100 100" className="w-full h-full relative">
            <defs>
              <linearGradient id={`shirt-${name}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={shirtColor} stopOpacity="1" />
                <stop offset="100%" stopColor={shirtColor} stopOpacity="0.75" />
              </linearGradient>
              <radialGradient id={`skin-${name}`} cx="45%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                <stop offset="35%" stopColor={skinColor} stopOpacity="1" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.08" />
              </radialGradient>
            </defs>

            {/* Backdrop */}
            <rect x="0" y="0" width="100" height="100" fill="#0f172a" opacity="0.08" />

            {/* Shirt */}
            <path d="M8,100 L92,100 L92,78 Q92,58 50,58 Q8,58 8,78 Z" fill={`url(#shirt-${name})`} />
            <path d="M8,82 Q50,70 92,82" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="3" />

            {/* Neck */}
            <rect x="42" y="50" width="16" height="18" rx="6" fill={skinColor} opacity="0.95" />

            {/* Head */}
            <ellipse cx="50" cy="40" rx="26" ry="28" fill={`url(#skin-${name})`} />

            {/* Hair */}
            <path d="M22,41 Q24,10 50,10 Q76,10 78,41 Q75,22 66,18 Q52,12 34,18 Q25,22 22,41 Z" fill={hairColor} />
            <path d="M26,30 Q50,18 74,30" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="5" strokeLinecap="round" />

            {/* Eyes */}
            <ellipse cx="40" cy="41" rx="5" ry="4" fill="#fff" opacity="0.9" />
            <ellipse cx="60" cy="41" rx="5" ry="4" fill="#fff" opacity="0.9" />
            <circle cx="40" cy="42" r="2.4" fill={eyeColor} />
            <circle cx="60" cy="42" r="2.4" fill={eyeColor} />
            <circle cx="39" cy="41" r="0.9" fill="#fff" />
            <circle cx="59" cy="41" r="0.9" fill="#fff" />

            {/* Blush */}
            <ellipse cx="33" cy="50" rx="5" ry="3" fill="#fb7185" opacity="0.22" />
            <ellipse cx="67" cy="50" rx="5" ry="3" fill="#fb7185" opacity="0.22" />

            {/* Glasses */}
            {hasGlasses && (
              <g opacity="0.65">
                <rect x="31" y="37" width="18" height="12" rx="5" fill="none" stroke="#111827" strokeWidth="2" />
                <rect x="51" y="37" width="18" height="12" rx="5" fill="none" stroke="#111827" strokeWidth="2" />
                <path d="M49,43 L51,43" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}

            {/* Mouth */}
            <path d="M42,56 Q50,62 58,56" fill="none" stroke="#111827" strokeOpacity="0.8" strokeWidth="2.5" strokeLinecap="round" />

            {/* Beard */}
            {hasBeard && (
              <path d="M38,60 Q50,68 62,60 Q60,74 50,75 Q40,74 38,60 Z" fill="#111827" opacity="0.18" />
            )}

            {/* Shine */}
            <path d="M22,36 Q30,18 44,14" stroke="#fff" strokeOpacity="0.22" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </div>

        {/* Status Ring */}
        {isTurn && (
          <>
            <div className="absolute -inset-1 rounded-2xl border-2 border-yellow-400 animate-ping opacity-65" />
            <div className="absolute -inset-1 rounded-2xl border border-yellow-200/30 shadow-[0_0_22px_rgba(234,179,8,0.6)]" />
          </>
        )}

        {/* Finished Badge */}
        {isOut && (
          <div className="absolute -right-3 -top-3 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-red-300 shadow-lg">
            已跑
          </div>
        )}

      </motion.div>

      {/* Name Tag */}
      <div className={clsx(
        "mt-2 px-3 py-0.5 rounded-full text-xs font-bold text-white shadow-md border border-white/10 transition-colors",
        isTurn ? "bg-yellow-600 ring-2 ring-yellow-400/50" : "bg-slate-800/80",
        isOut ? 'opacity-80' : 'opacity-100'
      )}>
        {name}
      </div>
    </div>
  )
}
