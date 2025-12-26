import { useNavigate } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'
import { useGameStore } from '@/store/gameStore'
import { LogOut, Plus, Play, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

export default function Lobby() {
  const navigate = useNavigate()
  const user = useUserStore(state => state.user)
  const logout = useUserStore(state => state.logout)
  const { createRoom, joinRoom, quickMatch } = useGameStore()
  const [roomIdInput, setRoomIdInput] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/')
    }
  }, [user, navigate])

  const handleCreateRoom = async () => {
    try {
      const roomId = await createRoom(3) // Default 3 players
      navigate(`/room/${roomId}`)
    } catch (error: any) {
      toast.error(error.message || '创建失败')
    }
  }

  const handleJoinRoom = async () => {
    if (!roomIdInput) return
    try {
      await joinRoom(roomIdInput)
      navigate(`/room/${roomIdInput}`)
    } catch (error: any) {
      toast.error(error.message || '加入失败')
    }
  }

  const handleQuickMatch = async () => {
    try {
      const roomId = await quickMatch()
      navigate(`/room/${roomId}`)
    } catch (error: any) {
      toast.error(error.message || '匹配失败')
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-xl font-bold">
            {user.nickname[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user.nickname}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="px-2 py-0.5 bg-slate-800 rounded text-yellow-500">Lv.{user.level}</span>
              <span>🪙 {user.coins}</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => { logout(); navigate('/'); }}
          className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Start Banner */}
          <div 
            onClick={handleQuickMatch}
            className="relative overflow-hidden group cursor-pointer rounded-2xl bg-gradient-to-r from-primary-600 to-orange-600 p-8 shadow-2xl shadow-primary-900/20 transition-all hover:scale-[1.01]"
          >
            <div className="relative z-10">
              <h3 className="text-3xl font-bold text-white mb-2">快速匹配</h3>
              <p className="text-primary-100 mb-6">立即开始一场刺激的对局</p>
              <button className="px-6 py-2 bg-white text-primary-600 font-bold rounded-full shadow-lg group-hover:shadow-xl transition-all">
                开始游戏
              </button>
            </div>
            <Play className="absolute right-8 bottom-8 text-white/20 w-32 h-32 rotate-12 group-hover:scale-110 transition-transform duration-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Room */}
            <div 
              onClick={handleCreateRoom}
              className="group cursor-pointer p-6 bg-slate-800 rounded-2xl border border-slate-700 hover:border-primary-500/50 transition-all hover:bg-slate-800/80"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-1">创建房间</h4>
              <p className="text-slate-400 text-sm">自定义规则，邀请好友</p>
            </div>

            {/* Join Room */}
            <div className="p-6 bg-slate-800 rounded-2xl border border-slate-700">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <Users size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-4">加入房间</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="输入房间号"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none"
                />
                <button 
                  onClick={handleJoinRoom}
                  disabled={!roomIdInput}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  加入
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Stats/History (Placeholder) */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          <h3 className="text-lg font-bold text-white mb-4">最近战绩</h3>
          <div className="space-y-4">
            <div className="text-center py-8 text-slate-500">
              暂无战绩记录
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
