export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—'
  return n.toLocaleString('en-GB', { maximumFractionDigits: decimals })
}

export function pct(value: number | null | undefined, target: number): number {
  if (!value || !target) return 0
  return Math.round((value / target) * 100)
}
