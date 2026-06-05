'use client'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'
import { useWeightHistory } from '@/lib/queries/daily-logs'
import { rollingAverage } from '@/lib/utils/rolling-average'
import { format, parseISO } from 'date-fns'

export function WeightChart() {
  const { data: raw = [], isLoading } = useWeightHistory(30)

  if (isLoading) return (
    <div className="h-40 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
  )

  if (raw.length === 0) return (
    <div className="h-40 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No weight data yet — add your first log entry</p>
    </div>
  )

  const avgData = rollingAverage(raw)
  const chartData = raw.map((point, i) => ({
    date: point.date,
    daily: point.weight_kg,
    avg: avgData[i].average,
  }))

  const weights = raw.map(p => p.weight_kg)
  const yMin = Math.floor(Math.min(...weights) - 0.5)
  const yMax = Math.ceil(Math.max(...weights) + 0.5)

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Weight Trend
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>30 days</span>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#1f1f1f" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={d => format(parseISO(d), 'dd')}
            tick={{ fill: '#525252', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: '#525252', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#141414', border: '1px solid #1f1f1f', borderRadius: 8, fontSize: 11 }}
            labelFormatter={d => format(parseISO(d as string), 'dd MMM')}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: unknown, name: unknown) => [
              `${value as number} kg`,
              name === 'avg' ? '7-day avg' : 'Daily',
            ]) as any}
          />
          <Line dataKey="daily" stroke="#2a2a2a" strokeWidth={1} dot={false} />
          <Line dataKey="avg" stroke="#34d399" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: 'var(--accent)' }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>7-day avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: '#2a2a2a' }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Daily</span>
        </div>
      </div>
    </div>
  )
}
