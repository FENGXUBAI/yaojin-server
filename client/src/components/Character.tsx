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
  const nameSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)

  const gradientPairs: Array<[string, string]> = isMe
    ? [
        ['#60A5FA', '#A78BFA'],
        ['#22D3EE', '#60A5FA'],
        ['#34D399', '#60A5FA'],
      ]
    : [
        ['#FB7185', '#A78BFA'],
        ['#F97316', '#A855F7'],
        ['#22D3EE', '#3B82F6'],
        ['#34D399', '#F59E0B'],
        ['#FDE047', '#FB7185'],
        ['#A78BFA', '#60A5FA'],
      ]

  const [g1, g2] = gradientPairs[nameSum % gradientPairs.length]
  const gradient = `linear-gradient(135deg, ${g1}, ${g2})`

  const getAvatarFontPx = (text: string) => {
    // 头像内必须展示完整昵称；这里仅做“自适应字号”，不截断。
    const n = [...text].length
    if (n <= 2) return 22
    if (n <= 4) return 16
    if (n <= 6) return 13
    if (n <= 8) return 11
    if (n <= 12) return 10
    return 9
  }

  const avatarFontPx = getAvatarFontPx(name)

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
        {/* Round gradient avatar with full custom name inside */}
        <div
          className={clsx(
            'w-full h-full rounded-full overflow-hidden relative',
            'shadow-[0_10px_24px_rgba(0,0,0,0.35)] border border-white/25'
          )}
          style={{ background: gradient }}
        >
          {/* light sheen */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.35),transparent_55%),radial-gradient(circle_at_70%_85%,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20" />

          <div
            className="absolute inset-0 flex items-center justify-center text-white font-black tracking-wide text-center px-2"
            style={{
              fontSize: `${avatarFontPx}px`,
              lineHeight: 1.05,
              textShadow: '0 2px 8px rgba(0,0,0,0.45)'
            }}
          >
            <span className="break-all">
              {name}
            </span>
          </div>
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
