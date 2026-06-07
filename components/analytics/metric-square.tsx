'use client'
import Link from 'next/link'

export type MetricSlug =
  | 'weight' | 'calories' | 'protein' | 'macros'
  | 'steps' | 'sessions' | 'sleep' | 'mood' | 'water'

interface Props {
  slug: MetricSlug
  label: string
  icon: string
  stat: string | null
  sparkValues: (number | null)[]
  trend: '↑' | '↓' | '→'
  color: string
}

function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const nonNull = values.filter((v): v is number => v != null)
  const max = nonNull.length > 0 ? Math.max(...nonNull) : 1
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: v != null ? `${Math.max((v / max) * 100, 6)}%` : '6%',
            background: v != null ? color : 'var(--border)',
            opacity: v != null ? 0.65 : 0.25,
          }}
        />
      ))}
    </div>
  )
}

export function MetricSquare({ slug, label, icon, stat, sparkValues, trend, color }: Props) {
  const trendColor = trend === '↑' ? 'var(--accent)' : trend === '↓' ? 'var(--destructive)' : 'var(--text-muted)'

  return (
    <Link
      href={`/insights/${slug}`}
      className="rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {icon} {label}
        </span>
        <span className="text-sm font-bold" style={{ color: trendColor }}>{trend}</span>
      </div>
      <div className="text-xl font-bold tracking-tight" style={{ color: stat ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {stat ?? '—'}
      </div>
      <Sparkline values={sparkValues} color={color} />
    </Link>
  )
}
