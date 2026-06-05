const SESSIONS = ['push', 'pull', 'legs', 'upper', 'rest', 'cardio'] as const
export type SessionType = typeof SESSIONS[number]

interface Props {
  value: SessionType | null
  onChange: (v: SessionType) => void
}

export function SessionPicker({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        Session
      </label>
      <div className="flex flex-wrap gap-2">
        {SESSIONS.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold capitalize transition-colors"
            style={{
              background: value === s ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--surface)',
              border: `1px solid ${value === s ? 'color-mix(in srgb, var(--accent) 38%, transparent)' : 'var(--border)'}`,
              color: value === s ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
