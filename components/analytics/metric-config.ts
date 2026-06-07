import type { DailyLogAnalytics } from '@/lib/queries/analytics'

export const VALID_SLUGS = [
  'weight', 'calories', 'protein', 'macros',
  'steps', 'sessions', 'sleep', 'mood', 'water',
] as const
export type MetricSlug = typeof VALID_SLUGS[number]

export interface MetricConfig {
  label: string
  unit: string
  color: string
  section: 'body' | 'nutrition' | 'activity' | 'wellbeing'
  getValue: (row: DailyLogAnalytics) => number | null
  formatStat: (v: number) => string
  correlatesWith: MetricSlug
}

export const METRIC_CONFIG: Record<MetricSlug, MetricConfig> = {
  weight: {
    label: 'Weight', unit: 'kg', color: '#34d399', section: 'body',
    getValue: r => r.weight_kg,
    formatStat: v => `${Math.round(v * 10) / 10} kg`,
    correlatesWith: 'calories',
  },
  calories: {
    label: 'Calories', unit: 'kcal', color: '#f59e0b', section: 'nutrition',
    getValue: r => r.calories,
    formatStat: v => `${Math.round(v)} kcal`,
    correlatesWith: 'weight',
  },
  protein: {
    label: 'Protein', unit: 'g', color: '#34d399', section: 'nutrition',
    getValue: r => r.protein_g,
    formatStat: v => `${Math.round(v)}g`,
    correlatesWith: 'weight',
  },
  macros: {
    label: 'Macro Split', unit: '%P', color: '#a78bfa', section: 'nutrition',
    getValue: r => {
      const total = r.calories
      const prot = r.protein_g
      if (!total || !prot) return null
      return Math.round((prot * 4) / total * 100)
    },
    formatStat: v => `${v}% protein`,
    correlatesWith: 'protein',
  },
  steps: {
    label: 'Steps', unit: 'steps', color: '#60a5fa', section: 'activity',
    getValue: r => r.steps,
    formatStat: v => Math.round(v).toLocaleString(),
    correlatesWith: 'weight',
  },
  sessions: {
    label: 'Sessions', unit: '', color: '#c084fc', section: 'activity',
    getValue: r => r.session_type ? (r.session_type !== 'rest' ? 1 : 0) : null,
    formatStat: v => `${v} training day${v !== 1 ? 's' : ''}`,
    correlatesWith: 'mood',
  },
  sleep: {
    label: 'Sleep', unit: 'hr', color: '#a78bfa', section: 'wellbeing',
    getValue: r => r.sleep_hours,
    formatStat: v => `${Math.round(v * 10) / 10} hr`,
    correlatesWith: 'mood',
  },
  mood: {
    label: 'Mood', unit: '/5', color: '#f59e0b', section: 'wellbeing',
    getValue: r => r.mood,
    formatStat: v => `${Math.round(v * 10) / 10}/5`,
    correlatesWith: 'sleep',
  },
  water: {
    label: 'Water', unit: 'L', color: '#60a5fa', section: 'wellbeing',
    getValue: r => r.water_l,
    formatStat: v => `${Math.round(v * 10) / 10}L`,
    correlatesWith: 'mood',
  },
}
