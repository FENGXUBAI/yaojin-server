import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pattern } from '@/types'

interface VFXOverlayProps {
  lastPlay: (Pattern & { by: number }) | null
}

export default function VFXOverlay({ lastPlay }: VFXOverlayProps) {
  const [effect, setEffect] = useState<{ type: 'zha' | 'hong' | 'wangzha', id: number } | null>(null)

  useEffect(() => {
    if (!lastPlay) return

    const timestamp = Date.now()

    if (lastPlay.type === 'TRIPLE') {
      setEffect({ type: 'zha', id: timestamp })
    } else if (lastPlay.type === 'FOUR') {
      setEffect({ type: 'hong', id: timestamp })
    } else if (lastPlay.type === 'PAIR' && lastPlay.extra?.isKingBomb) {
      setEffect({ type: 'wangzha', id: timestamp })
    }
  }, [lastPlay])

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {effect && (
          <motion.div
            key={effect.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0], rotate: [0, -10, 10, 0] }}
            transition={{ duration: 1.5, times: [0, 0.2, 1] }}
            onAnimationComplete={() => setEffect(null)}
            className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-red-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]"
            style={{ 
              fontSize: effect.type === 'wangzha' ? '8rem' : effect.type === 'hong' ? '6rem' : '4rem',
              textShadow: '0 0 20px rgba(255, 200, 0, 0.8)'
            }}
          >
            {effect.type === 'zha' && '炸！'}
            {effect.type === 'hong' && '轰！！！'}
            {effect.type === 'wangzha' && '🚀 王炸 🚀'}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Screen Shake for Hong/Wangzha */}
      <AnimatePresence>
        {(effect?.type === 'hong' || effect?.type === 'wangzha') && (
           <motion.div
             key={`shake-${effect.id}`}
             className="absolute inset-0 bg-white/20"
             initial={{ opacity: 0 }}
             animate={{ opacity: [0, 0.5, 0], x: [-10, 10, -10, 10, 0] }}
             transition={{ duration: 0.5 }}
           />
        )}
      </AnimatePresence>
    </div>
  )
}
