import { useState, useEffect } from 'react'
import { Volume2, VolumeX, Music } from 'lucide-react'
import { bgmPlayer } from '@/services/bgm'
import { motion, AnimatePresence } from 'framer-motion'

interface BGMControllerProps {
  scene?: 'lobby' | 'game' | 'win' | 'lose' | 'none'
  className?: string
}

export default function BGMController({ scene = 'lobby', className = '' }: BGMControllerProps) {
  const [enabled, setEnabled] = useState(bgmPlayer.isEnabled())
  const [volume, setVolume] = useState(bgmPlayer.getVolume())
  const [showSlider, setShowSlider] = useState(false)

  // 场景变化时切换 BGM
  useEffect(() => {
    if (enabled && scene !== 'none') {
      bgmPlayer.play(scene)
    }
  }, [scene, enabled])

  // 页面可见性变化时暂停/恢复
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        bgmPlayer.pause()
      } else if (enabled) {
        bgmPlayer.resume()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled])

  const toggleSlider = () => {
    setShowSlider(s => !s)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value)
    setVolume(vol)
    bgmPlayer.setVolume(vol)
  }

  return (
    <div 
      className={`relative ${className}`}
    >
      <button
        onClick={toggleSlider}
        className="w-10 h-10 rounded-full bg-slate-700/80 hover:bg-slate-600 flex items-center justify-center text-white shadow-lg transition-all"
        title={'调节背景音乐音量'}
      >
        {volume > 0 ? (
          <Music size={20} className="text-yellow-400" />
        ) : (
          <VolumeX size={20} className="text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {showSlider && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-slate-800/95 backdrop-blur rounded-lg p-3 shadow-xl border border-slate-600 min-w-[140px]"
          >
            <div className="flex items-center gap-2 mb-2">
              <VolumeX size={14} className="text-slate-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
              <Volume2 size={14} className="text-slate-400" />
            </div>
            <div className="text-xs text-center text-slate-400">
              音量: {Math.round(volume * 100)}%
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
