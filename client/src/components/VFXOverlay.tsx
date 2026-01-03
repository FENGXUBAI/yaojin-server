import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pattern } from '@/types'
import { playSpecialSfx } from '@/services/sfx'

interface VFXOverlayProps {
  lastPlay: (Pattern & { by: number }) | null
}

// Particle component for explosion effects
function ExplosionParticles({ count = 20, color = 'yellow' }: { count?: number, color?: string }) {
  const particles = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2
    const distance = 100 + Math.random() * 150
    const size = 4 + Math.random() * 8
    const delay = Math.random() * 0.2
    return { angle, distance, size, delay, id: i }
  })

  const colorMap: Record<string, string> = {
    yellow: 'bg-yellow-400',
    red: 'bg-red-500',
    orange: 'bg-orange-500',
    white: 'bg-white',
  }

  return (
    <>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            scale: 0,
            opacity: 0
          }}
          transition={{ duration: 0.8, delay: p.delay, ease: 'easeOut' }}
          className={`absolute rounded-full ${colorMap[color] || 'bg-yellow-400'}`}
          style={{ width: p.size, height: p.size }}
        />
      ))}
    </>
  )
}

// Fire/Spark particles for bomb
function FireParticles({ count = 15 }: { count?: number }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 200,
    y: -50 - Math.random() * 150,
    size: 20 + Math.random() * 30,
    delay: Math.random() * 0.3,
    emoji: ['🔥', '💥', '✨', '⭐'][Math.floor(Math.random() * 4)]
  }))

  return (
    <>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            scale: [0, 1.5, 0],
            opacity: [0, 1, 0]
          }}
          transition={{ duration: 1, delay: p.delay, ease: 'easeOut' }}
          className="absolute text-2xl"
          style={{ fontSize: p.size }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </>
  )
}

export default function VFXOverlay({ lastPlay }: VFXOverlayProps) {
  const [effect, setEffect] = useState<{ type: 'zha' | 'hong' | 'wangzha', id: number } | null>(null)

  useEffect(() => {
    if (!lastPlay) return

    const timestamp = Date.now()

    if (lastPlay.type === 'TRIPLE') {
      setEffect({ type: 'zha', id: timestamp })
      playSpecialSfx('bomb')
    } else if (lastPlay.type === 'FOUR') {
      setEffect({ type: 'hong', id: timestamp })
      playSpecialSfx('bomb')
    } else if (lastPlay.type === 'PAIR' && lastPlay.extra?.isKingBomb) {
      setEffect({ type: 'wangzha', id: timestamp })
      playSpecialSfx('wangzha')
    }
  }, [lastPlay])

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {effect && (
          <motion.div
            key={effect.id}
            className="relative flex items-center justify-center"
            onAnimationComplete={() => setEffect(null)}
          >
            {/* Particle effects */}
            <div className="absolute">
              {effect.type === 'zha' && <ExplosionParticles count={15} color="orange" />}
              {effect.type === 'hong' && (
                <>
                  <ExplosionParticles count={25} color="red" />
                  <FireParticles count={12} />
                </>
              )}
              {effect.type === 'wangzha' && (
                <>
                  <ExplosionParticles count={40} color="yellow" />
                  <ExplosionParticles count={20} color="white" />
                  <FireParticles count={20} />
                </>
              )}
            </div>

            {/* Main text */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0], rotate: [0, -10, 10, 0] }}
              transition={{ duration: 1.5, times: [0, 0.2, 1] }}
              className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-red-600 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] relative z-10"
              style={{ 
                fontSize: effect.type === 'wangzha' ? '8rem' : effect.type === 'hong' ? '6rem' : '4rem',
                textShadow: '0 0 20px rgba(255, 200, 0, 0.8)'
              }}
            >
              {effect.type === 'zha' && '炸！'}
              {effect.type === 'hong' && '轰！！！'}
              {effect.type === 'wangzha' && '🚀 王炸 🚀'}
            </motion.div>

            {/* Shockwave ring */}
            {(effect.type === 'hong' || effect.type === 'wangzha') && (
              <motion.div
                initial={{ scale: 0, opacity: 0.8 }}
                animate={{ scale: 4, opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute w-32 h-32 rounded-full border-4 border-yellow-400"
                style={{ boxShadow: '0 0 30px rgba(255, 200, 0, 0.5)' }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Screen flash for Hong/Wangzha */}
      <AnimatePresence>
        {(effect?.type === 'hong' || effect?.type === 'wangzha') && (
           <motion.div
             key={`shake-${effect.id}`}
             className="absolute inset-0 bg-gradient-radial from-yellow-500/30 to-transparent"
             initial={{ opacity: 0 }}
             animate={{ opacity: [0, 0.6, 0] }}
             transition={{ duration: 0.5 }}
           />
        )}
      </AnimatePresence>
    </div>
  )
}
