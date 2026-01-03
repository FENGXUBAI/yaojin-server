import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

export interface InteractionEvent {
  id: string
  senderId: string
  targetId: string
  type: string // 'tomato', 'bomb', 'flower', 'kiss'
  startRect: DOMRect
  endRect: DOMRect
}

const ITEMS: Record<string, { emoji: string; splatEmojis?: string[]; splatColor?: string }> = {
  tomato: { emoji: '🍅', splatEmojis: ['💥', '🔴', '🟠'], splatColor: 'rgba(255, 0, 0, 0.6)' },
  bomb: { emoji: '💣', splatEmojis: ['💥', '🔥', '💨'], splatColor: 'rgba(255, 165, 0, 0.7)' },
  flower: { emoji: '🌹', splatEmojis: ['💕', '✨', '💖'] },
  kiss: { emoji: '💋', splatEmojis: ['💕', '💗', '❤️'] },
  egg: { emoji: '🥚', splatEmojis: ['💥', '🟡', '🍳'], splatColor: 'rgba(255, 255, 0, 0.5)' }
}

export default function InteractionLayer({ events, onComplete }: { events: InteractionEvent[], onComplete: (id: string) => void }) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      <AnimatePresence>
        {events.map(evt => (
          <Projectile key={evt.id} event={evt} onComplete={() => onComplete(evt.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function Projectile({ event, onComplete }: { event: InteractionEvent, onComplete: () => void }) {
  const { startRect, endRect, type } = event
  const item = ITEMS[type] || { emoji: '❓' }
  const [phase, setPhase] = useState<'flying' | 'impact' | 'done'>('flying')

  // Calculate center points
  const startX = startRect.left + startRect.width / 2
  const startY = startRect.top + startRect.height / 2
  const endX = endRect.left + endRect.width / 2
  const endY = endRect.top + endRect.height / 2

  useEffect(() => {
    // After flying animation, show impact
    const flyTimer = setTimeout(() => setPhase('impact'), 500)
    // After impact animation, complete
    const impactTimer = setTimeout(() => {
      setPhase('done')
      onComplete()
    }, 1200)
    
    return () => {
      clearTimeout(flyTimer)
      clearTimeout(impactTimer)
    }
  }, [onComplete])

  return (
    <>
      {/* Flying projectile */}
      {phase === 'flying' && (
        <motion.div
          initial={{ x: startX, y: startY, scale: 0.3, opacity: 1, rotate: 0 }}
          animate={{ 
            x: endX, 
            y: endY, 
            scale: 1.2, 
            rotate: 720 
          }}
          transition={{ duration: 0.5, ease: "easeIn" }}
          className="absolute text-5xl drop-shadow-lg z-[200]"
          style={{ transform: 'translate(-50%, -50%)' }}
        >
          {item.emoji}
        </motion.div>
      )}

      {/* Impact effect */}
      {phase === 'impact' && (
        <>
          {/* Splat background */}
          {item.splatColor && (
            <motion.div
              initial={{ x: endX, y: endY, scale: 0, opacity: 0.8 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute rounded-full z-[199]"
              style={{ 
                width: 60, 
                height: 60, 
                backgroundColor: item.splatColor,
                transform: 'translate(-50%, -50%)',
                filter: 'blur(8px)'
              }}
            />
          )}
          
          {/* Main impact emoji */}
          <motion.div
            initial={{ x: endX, y: endY, scale: 1.5, opacity: 1 }}
            animate={{ scale: 2.5, opacity: 0, rotate: 45 }}
            transition={{ duration: 0.6 }}
            className="absolute text-5xl z-[201]"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            {item.emoji}
          </motion.div>

          {/* Splat particles */}
          {item.splatEmojis?.map((emoji, i) => {
            const angle = (i / item.splatEmojis!.length) * Math.PI * 2
            const distance = 60 + Math.random() * 40
            return (
              <motion.div
                key={i}
                initial={{ x: endX, y: endY, scale: 0.5, opacity: 1 }}
                animate={{ 
                  x: endX + Math.cos(angle) * distance, 
                  y: endY + Math.sin(angle) * distance,
                  scale: 0,
                  opacity: 0 
                }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="absolute text-2xl z-[200]"
                style={{ transform: 'translate(-50%, -50%)' }}
              >
                {emoji}
              </motion.div>
            )
          })}
        </>
      )}
    </>
  )
}
