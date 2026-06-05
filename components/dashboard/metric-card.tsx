'use client'
import { fmtNum, pct } from '@/lib/utils/format'

interface Props {
  label: string
  value: number | null | undefined
  target: number
  unit: string
  color: string
}

export function MetricCard({ label, value, target, unit, color }: Props) {
  const p = pct(value, target)
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight mb-0.5" style={{ color: 'var(--text-primary)' }}>
        {fmtNum(value)}
      </div>
      <div className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>/ {fmtNum(target)} {unit}</div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(p, 100)}%`, background: color }} />
      </div>
    </div>
  )
}
