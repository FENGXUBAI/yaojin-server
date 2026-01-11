export function formatCoins(amount: number): string {
  const n = Number(amount) || 0
  const abs = Math.abs(n)

  // >= 1千万 => kw
  if (abs >= 10_000_000) {
    const v = n / 10_000_000
    const s = Number.isInteger(v) ? String(v) : v.toFixed(1)
    return `${s}kw`
  }

  // >= 1万 => w
  if (abs >= 10_000) {
    const v = n / 10_000
    const s = Number.isInteger(v) ? String(v) : v.toFixed(1)
    return `${s}w`
  }

  return String(n)
}
