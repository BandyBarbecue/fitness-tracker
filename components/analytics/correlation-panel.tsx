'use client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { DailyLogAnalytics } from '@/lib/queries/analytics'
import { METRIC_CONFIG, type MetricSlug } from './metric-config'

interface Props {
  slug: MetricSlug
  data: DailyLogAnalytics[]
}

interface CorrDef {
  primaryField: (r: DailyLogAnalytics) => number | null
  secondaryField: (r: DailyLogAnalytics) => number | null
  primaryColor: string
  secondaryColor: string
}

const CORR_DEFS: Record<MetricSlug, CorrDef> = {
  weight:   { primaryField: r => r.weight_kg, secondaryField: r => r.calories, primaryColor: '#34d399', secondaryColor: '#f59e0b' },
  calories: { primaryField: r => r.calories,  secondaryField: r => r.weight_kg, primaryColor: '#f59e0b', secondaryColor: '#34d399' },
  protein:  { primaryField: r => r.protein_g, secondaryField: r => r.weight_kg, primaryColor: '#34d399', secondaryColor: '#34d399' },
  macros:   { primaryField: r => r.protein_g, secondaryField: r => r.weight_kg, primaryColor: '#a78bfa', secondaryColor: '#34d399' },
  steps:    { primaryField: r => r.steps,     secondaryField: r => r.weight_kg, primaryColor: '#60a5fa', secondaryColor: '#34d399' },
  sessions: { primaryField: r => r.session_type ? (r.session_type !== 'rest' ? 1 : 0) : null, secondaryField: r => r.mood, primaryColor: '#c084fc', secondaryColor: '#f59e0b' },
  sleep:    { primaryField: r => r.sleep_hours, secondaryField: r => r.mood, primaryColor: '#a78bfa', secondaryColor: '#f59e0b' },
  mood:     { primaryField: r => r.mood,       secondaryField: r => r.sleep_hours, primaryColor: '#f59e0b', secondaryColor: '#a78bfa' },
  water:    { primaryField: r => r.water_l,    secondaryField: r => r.mood, primaryColor: '#60a5fa', secondaryColor: '#f59e0b' },
}

const TOOLTIP_STYLE = { background: '#141414', border: '1px solid #1f1f1f', borderRadius: 8, fontSize: 11 }

export function CorrelationPanel({ slug, data }: Props) {
  const config = METRIC_CONFIG[slug]
  const corrSlug = config.correlatesWith
  const corrConfig = METRIC_CONFIG[corrSlug]
  const def = CORR_DEFS[slug]
  const xFmt = (d: string) => format(parseISO(d), 'MMM d')

  const chartData = data.map(r => ({
    date: r.date,
    primary: def.primaryField(r),
    secondary: def.secondaryField(r),
  }))

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          How this relates to {corrConfig.label}
        </div>
        <Link href={`/insights/${corrSlug}`} className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
          → {corrConfig.label}
        </Link>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 9, fill: '#525252' }} />
          <YAxis yAxisId="left"  tick={{ fontSize: 9, fill: '#525252' }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar   yAxisId="left"  dataKey="primary"   fill={def.primaryColor}   fillOpacity={0.7} radius={[2, 2, 0, 0]} name={config.label} />
          <Line  yAxisId="right" dataKey="secondary" stroke={def.secondaryColor} dot={false} strokeWidth={1.5} connectNulls name={corrConfig.label} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
