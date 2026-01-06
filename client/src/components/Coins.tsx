export default function Coins({ className = '', size = 16 }: { className?: string, size?: number }) {
  return (
    <div className={`flex items-center justify-center bg-yellow-400 rounded-full border-2 border-yellow-600 shadow-sm ${className}`} style={{ width: size, height: size }}>
      <span className="text-yellow-700 font-bold" style={{ fontSize: size * 0.6 }}>$</span>
    </div>
  )
}
