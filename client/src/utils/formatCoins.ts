export function formatCoins(amount: number): string {
  const n = Number(amount) || 0
  const abs = Math.abs(n)

  const fmt = (value: number, digits: number) => {
    if (Number.isInteger(value)) return String(value)
    const s = value.toFixed(digits)
    return s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
  }

  // >= 1亿 => 亿
  if (abs >= 100_000_000) {
    const v = n / 100_000_000
    return `${fmt(v, 2)}亿`
  }

  // >= 1千万 => kw
  if (abs >= 10_000_000) {
    const v = n / 10_000_000
    return `${fmt(v, 1)}kw`
  }

  // >= 1万 => w
  if (abs >= 10_000) {
    const v = n / 10_000
    return `${fmt(v, 1)}w`
  }

  return String(n)
}
