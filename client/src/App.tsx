import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import Room from './pages/Room'
import Profile from './pages/Profile'
import { Toaster } from 'react-hot-toast'
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'

function App() {
  const connectRef = useRef(false)

  useEffect(() => {
    // Only connect once on app mount
    if (!connectRef.current) {
      connectRef.current = true
      useGameStore.getState().connect()
    }
    
    // Don't disconnect on unmount - keep connection alive
    // Socket will auto-reconnect if needed
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen w-full bg-slate-900 text-slate-100 font-sans selection:bg-primary-500 selection:text-white">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-center" />
      </div>
    </BrowserRouter>
  )
}

export default App
