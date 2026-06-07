'use client'

export type Period = 7 | 30 | 90

interface Props {
  value: Period
  onChange: (p: Period) => void
}

const OPTIONS: Period[] = [7, 30, 90]

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map(opt => {
        const active = value === opt
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface)',
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border)'}`,
            }}
          >
            {opt}d
          </button>
        )
      })}
    </div>
  )
}
