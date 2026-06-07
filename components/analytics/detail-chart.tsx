'use client'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { DailyLogAnalytics } from '@/lib/queries/analytics'
import type { MetricSlug } from './metric-config'

interface Props {
  slug: MetricSlug
  data: DailyLogAnalytics[]
  target?: number | null
}

const TOOLTIP_STYLE = { background: '#141414', border: '1px solid #1f1f1f', borderRadius: 8, fontSize: 11 }
const xFmt = (d: string) => format(parseISO(d), 'MMM d')

export function DetailChart({ slug, data, target }: Props) {
  if (slug === 'weight') {
    const chartData = data.map(r => ({ date: r.date, weight: r.weight_kg }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="weight" stroke="#34d399" dot={{ r: 2 }} strokeWidth={1.5} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (slug === 'protein') {
    const chartData = data.map(r => ({
      date: r.date,
      value: r.protein_g,
      hit: target != null && r.protein_g != null && r.protein_g >= target,
    }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis tick={{ fontSize: 10, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {target != null && <ReferenceLine y={target} stroke="#525252" strokeDasharray="4 4" />}
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.hit ? '#34d399' : '#2a2a2a'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (slug === 'macros') {
    const chartData = data.map(r => {
      const total = r.calories ?? 0
      if (total === 0) return { date: r.date, protein: null, fat: null, carbs: null }
      return {
        date: r.date,
        protein: Math.round(((r.protein_g ?? 0) * 4 / total) * 100),
        fat:     Math.round(((r.fat_g ?? 0) * 9 / total) * 100),
        carbs:   Math.round(((r.carbs_g ?? 0) * 4 / total) * 100),
      }
    })
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis tick={{ fontSize: 10, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="protein" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.45} />
          <Area type="monotone" dataKey="fat"     stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.45} />
          <Area type="monotone" dataKey="carbs"   stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.45} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (slug === 'sessions') {
    const SESSION_COLORS: Record<string, string> = {
      push: '#34d399', pull: '#60a5fa', legs: '#a78bfa',
      upper: '#f59e0b', cardio: '#f97316', rest: '#2a2a2a',
    }
    const allTypes = [...new Set(data.map(r => r.session_type).filter(Boolean))] as string[]
    const chartData = data.map(r => {
      const row: Record<string, string | number | null> = { date: r.date }
      for (const t of allTypes) row[t] = r.session_type === t ? 1 : 0
      return row
    })
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis hide />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {allTypes.map(t => (
            <Bar key={t} dataKey={t} stackId="a" fill={SESSION_COLORS[t] ?? '#525252'} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (slug === 'mood') {
    const moodColor = (v: number) => v <= 2 ? '#ef4444' : v === 3 ? '#f59e0b' : '#34d399'
    const chartData = data.map(r => ({ date: r.date, value: r.mood }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.value != null ? moodColor(entry.value) : '#2a2a2a'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Default bar chart: calories, steps, sleep, water
  const FIELD_MAP: Partial<Record<MetricSlug, keyof DailyLogAnalytics>> = {
    calories: 'calories',
    steps:    'steps',
    sleep:    'sleep_hours',
    water:    'water_l',
  }
  const CHART_COLOR: Partial<Record<MetricSlug, string>> = {
    calories: '#f59e0b', steps: '#60a5fa', sleep: '#a78bfa', water: '#60a5fa',
  }
  const field = FIELD_MAP[slug] ?? 'calories'
  const barColor = CHART_COLOR[slug] ?? '#34d399'
  const chartData = data.map(r => ({ date: r.date, value: r[field] as number | null }))
  const nonNull = chartData.filter(r => r.value != null).map(r => r.value!)
  const avg = nonNull.length > 0 ? Math.round(nonNull.reduce((a, b) => a + b, 0) / nonNull.length * 10) / 10 : null

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
        <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
        <YAxis tick={{ fontSize: 10, fill: '#525252' }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {target != null && (
          <ReferenceLine y={target} stroke="#525252" strokeDasharray="4 4" label={{ value: 'target', position: 'insideTopRight', fontSize: 9, fill: '#525252' }} />
        )}
        {slug === 'sleep' && avg != null && (
          <ReferenceLine y={avg} stroke="#a78bfa" strokeDasharray="4 4" strokeOpacity={0.6} />
        )}
        <Bar dataKey="value" fill={barColor} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
