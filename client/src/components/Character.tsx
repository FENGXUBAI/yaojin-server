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

  const hairStyle = nameSum % 5 // 0..4
  const hasGlasses = nameSum % 6 === 0
  // keep cartoon cute; no beard
  const smileStyle = nameSum % 3 // 0..2
  const eyeStyle = nameSum % 3 // 0..2

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
        {/* Cartoon Avatar (chibi style) */}
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

          {/* Chibi SVG */}
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
              <radialGradient id={`shadow-${name}`} cx="50%" cy="70%" r="55%">
                <stop offset="0%" stopColor="#000" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Soft vignette */}
            <rect x="0" y="0" width="100" height="100" fill="#0f172a" opacity="0.06" />

            {/* Body (tiny) */}
            <path d="M18,100 C22,78 34,66 50,66 C66,66 78,78 82,100 Z" fill={`url(#shirt-${name})`} />
            <path d="M30,74 Q50,82 70,74" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="3" strokeLinecap="round" />

            {/* Neck + shadow */}
            <ellipse cx="50" cy="72" rx="18" ry="9" fill={`url(#shadow-${name})`} opacity="0.35" />
            <rect x="44" y="56" width="12" height="14" rx="6" fill={skinColor} opacity="0.98" />

            {/* Head (big, round) */}
            <circle cx="50" cy="42" r="28" fill={`url(#skin-${name})`} />
            <circle cx="50" cy="42" r="28" fill="none" stroke="#111827" strokeOpacity="0.12" strokeWidth="2" />

            {/* Hair styles (cartoon bangs) */}
            {hairStyle === 0 && (
              <path d="M22,40 Q26,18 50,16 Q74,18 78,40 Q70,30 62,30 Q50,28 38,30 Q30,30 22,40 Z" fill={hairColor} />
            )}
            {hairStyle === 1 && (
              <path d="M22,42 Q24,18 50,14 Q76,18 78,42 Q72,32 60,30 Q50,28 40,30 Q28,32 22,42 Z" fill={hairColor} />
            )}
            {hairStyle === 2 && (
              <path d="M20,44 Q22,18 50,14 Q78,18 80,44 Q72,28 62,28 Q50,28 38,28 Q28,28 20,44 Z" fill={hairColor} />
            )}
            {hairStyle === 3 && (
              <path d="M22,38 Q30,16 50,16 Q70,16 78,38 Q70,26 62,28 Q50,30 38,28 Q30,26 22,38 Z" fill={hairColor} />
            )}
            {hairStyle === 4 && (
              <path d="M22,40 Q30,14 50,14 Q70,14 78,40 Q74,28 66,26 Q50,22 34,26 Q26,28 22,40 Z" fill={hairColor} />
            )}

            {/* Hair outline */}
            <path d="M22,42 Q26,18 50,14 Q74,18 78,42" fill="none" stroke="#111827" strokeOpacity="0.12" strokeWidth="2" strokeLinecap="round" />

            {/* Brows (thicker, cute) */}
            <path d="M32,38 Q40,34 48,38" fill="none" stroke="#111827" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
            <path d="M52,38 Q60,34 68,38" fill="none" stroke="#111827" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />

            {/* Eyes (big & cute) */}
            {eyeStyle !== 2 && (
              <>
                <ellipse cx="40" cy="46" rx="8" ry="9" fill="#111827" opacity="0.92" />
                <ellipse cx="60" cy="46" rx="8" ry="9" fill="#111827" opacity="0.92" />
                <circle cx="38" cy="43" r="2.4" fill="#fff" opacity="0.95" />
                <circle cx="58" cy="43" r="2.4" fill="#fff" opacity="0.95" />
                <circle cx="41" cy="48" r="1.6" fill="#fff" opacity="0.65" />
                <circle cx="61" cy="48" r="1.6" fill="#fff" opacity="0.65" />
                <circle cx="40" cy="47" r="3" fill={eyeColor} opacity="0.25" />
                <circle cx="60" cy="47" r="3" fill={eyeColor} opacity="0.25" />
              </>
            )}
            {eyeStyle === 2 && (
              <>
                <path d="M32,46 Q40,40 48,46" fill="none" stroke="#111827" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
                <path d="M52,46 Q60,40 68,46" fill="none" stroke="#111827" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
              </>
            )}

            {/* Nose (tiny) */}
            <circle cx="50" cy="55" r="1.3" fill="#111827" opacity="0.25" />

            {/* Blush */}
            <ellipse cx="32" cy="54" rx="6" ry="3.2" fill="#fb7185" opacity="0.18" />
            <ellipse cx="68" cy="54" rx="6" ry="3.2" fill="#fb7185" opacity="0.18" />

            {/* Glasses */}
            {hasGlasses && (
              <g opacity="0.55">
                <rect x="29" y="40" width="20" height="14" rx="6" fill="none" stroke="#111827" strokeWidth="2" />
                <rect x="51" y="40" width="20" height="14" rx="6" fill="none" stroke="#111827" strokeWidth="2" />
                <path d="M49,47 L51,47" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}

            {/* Mouth */}
            {smileStyle === 0 && (
              <path d="M42,62 Q50,70 58,62" fill="none" stroke="#111827" strokeOpacity="0.65" strokeWidth="3" strokeLinecap="round" />
            )}
            {smileStyle === 1 && (
              <path d="M43,64 Q50,66 57,64" fill="none" stroke="#111827" strokeOpacity="0.60" strokeWidth="3" strokeLinecap="round" />
            )}
            {smileStyle === 2 && (
              <path d="M44,63 Q50,61 56,63" fill="none" stroke="#111827" strokeOpacity="0.60" strokeWidth="3" strokeLinecap="round" />
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
