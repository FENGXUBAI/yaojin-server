import { useUserStore } from '@/store/userStore'
import { useNavigate } from 'react-router-dom'

export default function Profile() {
  const { user, logout } = useUserStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user) {
    navigate('/')
    return null
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-md mx-auto bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
        <h1 className="text-2xl font-bold mb-6 text-primary-400">个人资料</h1>
        
        <div className="space-y-4 mb-8">
          <div>
            <label className="text-sm text-slate-400">用户ID</label>
            <div className="font-mono bg-slate-900 p-2 rounded border border-slate-700 mt-1">
              {user.id}
            </div>
          </div>
          
          <div>
            <label className="text-sm text-slate-400">昵称</label>
            <div className="text-lg font-bold mt-1">{user.nickname}</div>
          </div>

          <div>
            <label className="text-sm text-slate-400">金币</label>
            <div className="text-lg font-bold text-yellow-400 mt-1">
              {user.coins.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/lobby')}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold transition-colors"
          >
            返回大厅
          </button>
          <button 
            onClick={handleLogout}
            className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-colors"
          >
            退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
