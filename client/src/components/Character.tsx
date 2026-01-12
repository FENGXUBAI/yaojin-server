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
  // Stable avatar traits derived from name (kept subtle / human-like)
  const nameSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const skinTones = ['#F6D7C3', '#E9B98F', '#F2C4B3', '#D7B08A']
  const hairTones = ['#111827', '#2B1D16', '#3B2F2F', '#4B5563']
  const eyeTones = ['#111827', '#0F766E', '#1D4ED8', '#7C2D12']
  const clothTones = isMe ? ['#2563EB', '#1D4ED8'] : ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  const skinColor = skinTones[nameSum % skinTones.length]
  const hairColor = hairTones[nameSum % hairTones.length]
  const eyeColor = eyeTones[nameSum % eyeTones.length]
  const shirtColor = clothTones[nameSum % clothTones.length]
  const accent = isMe ? '#93C5FD' : ['#FDA4AF', '#6EE7B7', '#FDE68A', '#C4B5FD'][nameSum % 4]

  const hairStyle = nameSum % 4 // 0..3
  const hasGlasses = nameSum % 5 === 0
  const hasBeard = nameSum % 6 === 0
  const smileStyle = nameSum % 3 // 0..2

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
        {/* Human-like Avatar (soft circle portrait) */}
        <div className={clsx(
          'w-full h-full rounded-full overflow-hidden relative',
          'shadow-[0_10px_24px_rgba(0,0,0,0.35)] border border-white/25',
          'bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_70%_85%,rgba(255,255,255,0.16),transparent_55%)]'
        )}>
          {/* Ambient background */}
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 30%, ${accent}55, transparent 55%), linear-gradient(180deg, rgba(15,23,42,0.20), rgba(15,23,42,0.05))`
            }}
          />

          {/* Portrait SVG */}
          <svg viewBox="0 0 100 100" className="w-full h-full relative">
            <defs>
              <radialGradient id={`skin-${name}`} cx="45%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.20" />
                <stop offset="38%" stopColor={skinColor} stopOpacity="1" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.10" />
              </radialGradient>
              <linearGradient id={`shirt-${name}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={shirtColor} stopOpacity="1" />
                <stop offset="100%" stopColor={shirtColor} stopOpacity="0.72" />
              </linearGradient>
              <radialGradient id={`shadow-${name}`} cx="50%" cy="65%" r="55%">
                <stop offset="0%" stopColor="#000" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Soft vignette */}
            <rect x="0" y="0" width="100" height="100" fill="#0f172a" opacity="0.06" />

            {/* Shoulders */}
            <path d="M10,100 C16,76 32,64 50,64 C68,64 84,76 90,100 Z" fill={`url(#shirt-${name})`} />

            {/* Collar */}
            <path d="M36,66 Q50,74 64,66" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" />

            {/* Neck + shadow */}
            <ellipse cx="50" cy="70" rx="18" ry="10" fill={`url(#shadow-${name})`} opacity="0.35" />
            <rect x="43" y="52" width="14" height="18" rx="7" fill={skinColor} opacity="0.98" />

            {/* Head */}
            <path d="M50,14 C33,14 24,27 24,42 C24,58 34,71 50,71 C66,71 76,58 76,42 C76,27 67,14 50,14 Z" fill={`url(#skin-${name})`} />

            {/* Ears */}
            <ellipse cx="23" cy="44" rx="4" ry="7" fill={skinColor} opacity="0.9" />
            <ellipse cx="77" cy="44" rx="4" ry="7" fill={skinColor} opacity="0.9" />

            {/* Hair styles */}
            {hairStyle === 0 && (
              <path d="M22,42 C22,22 35,10 50,10 C65,10 78,22 78,42 C75,26 66,20 50,18 C34,20 25,26 22,42 Z" fill={hairColor} />
            )}
            {hairStyle === 1 && (
              <path d="M22,44 C22,20 38,8 52,10 C66,12 78,26 76,44 C72,26 62,18 50,18 C36,18 27,26 22,44 Z" fill={hairColor} />
            )}
            {hairStyle === 2 && (
              <path d="M20,44 C20,20 36,8 50,8 C64,8 80,20 80,44 C76,30 66,22 50,22 C34,22 24,30 20,44 Z" fill={hairColor} />
            )}
            {hairStyle === 3 && (
              <path d="M22,44 C22,18 40,8 54,10 C68,12 78,26 76,44 C70,28 62,24 50,24 C38,24 28,28 22,44 Z" fill={hairColor} />
            )}

            {/* Brows */}
            <path d="M33,41 Q40,36 47,41" fill="none" stroke="#111827" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M53,41 Q60,36 67,41" fill="none" stroke="#111827" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />

            {/* Eyes */}
            <ellipse cx="40" cy="45" rx="6" ry="4" fill="#fff" opacity="0.95" />
            <ellipse cx="60" cy="45" rx="6" ry="4" fill="#fff" opacity="0.95" />
            <circle cx="40" cy="46" r="2.5" fill={eyeColor} />
            <circle cx="60" cy="46" r="2.5" fill={eyeColor} />
            <circle cx="39" cy="45" r="0.9" fill="#fff" />
            <circle cx="59" cy="45" r="0.9" fill="#fff" />

            {/* Nose */}
            <path d="M50,47 Q48,54 50,56" fill="none" stroke="#111827" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />

            {/* Blush */}
            <ellipse cx="32" cy="54" rx="6" ry="3.2" fill="#fb7185" opacity="0.18" />
            <ellipse cx="68" cy="54" rx="6" ry="3.2" fill="#fb7185" opacity="0.18" />

            {/* Glasses */}
            {hasGlasses && (
              <g opacity="0.55">
                <rect x="30" y="41" width="19" height="12" rx="5" fill="none" stroke="#111827" strokeWidth="2" />
                <rect x="51" y="41" width="19" height="12" rx="5" fill="none" stroke="#111827" strokeWidth="2" />
                <path d="M49,47 L51,47" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}

            {/* Mouth */}
            {smileStyle === 0 && (
              <path d="M42,60 Q50,66 58,60" fill="none" stroke="#111827" strokeOpacity="0.65" strokeWidth="2.6" strokeLinecap="round" />
            )}
            {smileStyle === 1 && (
              <path d="M43,62 Q50,64 57,62" fill="none" stroke="#111827" strokeOpacity="0.60" strokeWidth="2.6" strokeLinecap="round" />
            )}
            {smileStyle === 2 && (
              <path d="M44,60 Q50,63 56,60" fill="none" stroke="#111827" strokeOpacity="0.60" strokeWidth="2.6" strokeLinecap="round" />
            )}

            {/* Beard (very subtle) */}
            {hasBeard && (
              <path d="M38,62 Q50,72 62,62 Q61,76 50,77 Q39,76 38,62 Z" fill="#111827" opacity="0.10" />
            )}

            {/* Highlight */}
            <path d="M26,38 Q34,22 46,18" stroke="#fff" strokeOpacity="0.18" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </div>

        {/* Status Ring */}
        {isTurn && (
          <>
            <div className="absolute -inset-1 rounded-full border-2 border-yellow-400/80 animate-ping opacity-55" />
            <div className="absolute -inset-1 rounded-full border border-yellow-200/40 shadow-[0_0_24px_rgba(234,179,8,0.55)]" />
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
