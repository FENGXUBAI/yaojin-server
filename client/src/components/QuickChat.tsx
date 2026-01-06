import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { QUICK_VOICES } from '@/services/quickVoice'

interface QuickChatProps {
  onSend: (msg: string, isEmoji: boolean) => void
}

const EMOJIS = ["😊", "😂", "😭", "😡", "👍", "🤝", "🌹", "☕", "💣", "🐷"]

export default function QuickChat({ onSend }: QuickChatProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSend = (msg: string, isEmoji: boolean) => {
    onSend(msg, isEmoji)
    setIsOpen(false)
  }

  return (
    <div className="relative pointer-events-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-14 right-0 w-64 bg-slate-800/95 backdrop-blur border border-slate-600 rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-3"
          >
            {/* Emojis */}
            <div className="grid grid-cols-5 gap-2">
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleSend(emoji, true)}
                  className="text-2xl hover:bg-slate-700 rounded p-1 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="h-px bg-slate-700" />

            {/* Phrases */}
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {QUICK_VOICES.map(({ label }) => (
                <button
                  key={label}
                  onClick={() => handleSend(label, false)}
                  className="text-left text-sm text-slate-200 hover:bg-slate-700 px-2 py-1.5 rounded transition-colors truncate"
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
