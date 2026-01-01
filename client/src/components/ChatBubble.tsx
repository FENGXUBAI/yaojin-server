import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface ChatBubbleProps {
  message: string
  isEmoji?: boolean
  onComplete?: () => void
}

export default function ChatBubble({ message, isEmoji, onComplete }: ChatBubbleProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 3000)
    return () => clearTimeout(timer)
  }, [message, onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className={`absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none
            ${isEmoji ? 'text-4xl drop-shadow-md' : 'bg-white text-slate-900 px-3 py-1.5 rounded-2xl rounded-bl-none shadow-lg border border-slate-200 text-sm font-medium'}
          `}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
