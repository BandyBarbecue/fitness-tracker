'use client'
import { useRecentLogs } from '@/lib/queries/daily-logs'
import { fmtNum } from '@/lib/utils/format'
import { subDays, format, parseISO, startOfWeek } from 'date-fns'

export function StreakRow() {
  const { data: logs = [] } = useRecentLogs(30)

  const streak = (() => {
    let s = 0
    let d = new Date()
    const loggedDates = new Set(logs.map(l => l.date))
    if (!loggedDates.has(format(d, 'yyyy-MM-dd'))) d = subDays(d, 1)
    while (loggedDates.has(format(d, 'yyyy-MM-dd'))) {
      s++; d = subDays(d, 1)
    }
    return s
  })()

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const logsThisWeek = logs.filter(l => parseISO(l.date) >= weekStart).length

  const weightLogs = logs.filter(l => l.weight_kg != null).slice(0, 14)
  const weeklyDelta = (() => {
    if (weightLogs.length < 2) return null
    const recent = weightLogs.slice(0, 7).map(l => l.weight_kg!)
    const older = weightLogs.slice(7).map(l => l.weight_kg!)
    if (!older.length) return null
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
    return Math.round((recentAvg - olderAvg) * 10) / 10
  })()

  const cells = [
    { value: String(streak), label: 'day streak' },
    { value: `${logsThisWeek}/7`, label: 'logged this week' },
    {
      value: weeklyDelta != null ? `${weeklyDelta > 0 ? '+' : ''}${weeklyDelta}` : '—',
      label: 'kg / week',
      color: weeklyDelta != null && weeklyDelta < 0 ? 'var(--accent)' : undefined,
    },
  ]

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="grid grid-cols-3">
        {cells.map(({ value, label, color }, i) => (
          <div
            key={label}
            className="text-center px-2"
            style={i > 0 ? { borderLeft: '1px solid var(--border)' } : undefined}
          >
            <div className="text-xl font-bold" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
            <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
