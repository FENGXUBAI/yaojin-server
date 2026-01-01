import { motion, AnimatePresence } from 'framer-motion'

export interface InteractionEvent {
  id: string
  senderId: string
  targetId: string
  type: string // 'tomato', 'bomb', 'flower', 'kiss'
  startRect: DOMRect
  endRect: DOMRect
}

const ITEMS: Record<string, string> = {
  tomato: '🍅',
  bomb: '💣',
  flower: '🌹',
  kiss: '💋',
  egg: '🥚'
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
  const emoji = ITEMS[type] || '❓'

  // Calculate center points
  const startX = startRect.left + startRect.width / 2
  const startY = startRect.top + startRect.height / 2
  const endX = endRect.left + endRect.width / 2
  const endY = endRect.top + endRect.height / 2

  return (
    <motion.div
      initial={{ x: startX, y: startY, scale: 0.5, opacity: 1, rotate: 0 }}
      animate={{ 
        x: endX, 
        y: endY, 
        scale: [1, 1.5, 1], 
        rotate: 720 
      }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      onAnimationComplete={onComplete}
      className="absolute text-4xl drop-shadow-lg"
    >
      {emoji}
    </motion.div>
  )
}
