import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { MessageCircle, Smile } from 'lucide-react'

const QUICK_MESSAGES = [
  '快点吧，等到花儿都谢了🌷',
  '你是GG还是MM？',
  '大家好，很高兴见到各位～',
  '不要走，决战到天亮！',
  '各位再见，下次再一起玩~',
  '不好意思，我要离开了',
]

const EMOJIS = ['😀', '😂', '🤣', '😊', '😎', '🥳', '😭', '😡', '👍', '👎', '👏', '🙏', '💪', '🤝', '❤️', '💔', '🔥', '💣', '🎉', '🏆']

export default function ChatPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'quick' | 'emoji'>('quick')
  const { sendChat, chatMessages } = useGameStore()

  const handleSend = (msg: string, isEmoji: boolean = false) => {
    sendChat(msg, isEmoji)
    setOpen(false)
  }

  return (
    <>
      {/* Floating Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-36 right-4 z-30 w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
      >
        <MessageCircle size={22} />
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-52 right-4 z-40 w-64 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => setTab('quick')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'quick' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              快捷消息
            </button>
            <button
              onClick={() => setTab('emoji')}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'emoji' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Smile size={16} className="inline mr-1" /> 表情
            </button>
          </div>

          {/* Content */}
          <div className="p-2 max-h-52 overflow-y-auto">
            {tab === 'quick' ? (
              <div className="space-y-1">
                {QUICK_MESSAGES.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(m)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded transition-colors"
                  >
                    {m}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {EMOJIS.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(e, true)}
                    className="text-2xl hover:scale-125 transition-transform"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages Overlay (Bottom Left) */}
      <div className="fixed bottom-36 left-4 z-30 w-56 space-y-1 pointer-events-none">
        {chatMessages.slice(-5).map((msg, i) => (
          <div
            key={i}
            className={`px-3 py-1 rounded-lg text-sm backdrop-blur-sm animate-fade-in ${msg.isEmoji ? 'text-3xl bg-transparent' : 'bg-slate-800/80 text-slate-200'}`}
          >
            {!msg.isEmoji && <span className="font-bold text-primary-400 mr-1">{msg.sender}:</span>}
            {msg.message}
          </div>
        ))}
      </div>
    </>
  )
}
