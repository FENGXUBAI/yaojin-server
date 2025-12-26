import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'
import { Gamepad2, User } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const login = useUserStore(state => state.login)

  const handleLogin = async () => {
    if (!nickname.trim()) return
    await login(nickname)
    navigate('/lobby')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500/20 text-primary-500 mb-4">
            <Gamepad2 size={32} />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">要进</h1>
          <p className="text-slate-400">竞技扑克 · 随时开局</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="nickname" className="text-sm font-medium text-slate-300">
              你的昵称
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="请输入昵称"
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-white placeholder:text-slate-600"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={!nickname.trim()}
            className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-bold rounded-lg shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
          >
            开始游戏
          </button>
        </div>
      </div>
    </div>
  )
}
