'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { InsightsSubTabs } from '@/components/analytics/insights-sub-tabs'
import { PeriodSelector, type Period } from '@/components/analytics/period-selector'
import { MetricSquare, type MetricSlug } from '@/components/analytics/metric-square'
import {
  useAnalyticsForPeriod, useMealLogsForPeriod,
  periodBounds, avgOf, hitRate, trendArrow, sparklineValues,
} from '@/lib/queries/analytics'
import { useTargets } from '@/lib/queries/targets'

const SECTIONS = [
  { key: 'body',      label: 'Body'      },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'activity',  label: 'Activity'  },
  { key: 'wellbeing', label: 'Wellbeing' },
] as const

type SectionKey = typeof SECTIONS[number]['key']

interface SquareDef {
  slug: MetricSlug
  label: string
  icon: string
  section: SectionKey
  color: string
}

const SQUARE_DEFS: SquareDef[] = [
  { slug: 'weight',   label: 'Weight',  icon: '⚖️',  section: 'body',      color: '#34d399' },
  { slug: 'calories', label: 'Calories',icon: '🔥',  section: 'nutrition', color: '#f59e0b' },
  { slug: 'protein',  label: 'Protein', icon: '🥩',  section: 'nutrition', color: '#34d399' },
  { slug: 'macros',   label: 'Macros',  icon: '🥧',  section: 'nutrition', color: '#a78bfa' },
  { slug: 'steps',    label: 'Steps',   icon: '👟',  section: 'activity',  color: '#60a5fa' },
  { slug: 'sessions', label: 'Sessions',icon: '🏋️', section: 'activity',  color: '#c084fc' },
  { slug: 'sleep',    label: 'Sleep',   icon: '😴',  section: 'wellbeing', color: '#a78bfa' },
  { slug: 'mood',     label: 'Mood',    icon: '😊',  section: 'wellbeing', color: '#f59e0b' },
  { slug: 'water',    label: 'Water',   icon: '💧',  section: 'wellbeing', color: '#60a5fa' },
]

export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>(30)
  const today = format(new Date(), 'yyyy-MM-dd')
  const { startDate, endDate } = periodBounds(period, today)

  const { data: logs = [], isLoading } = useAnalyticsForPeriod(startDate, endDate)
  const { data: mealLogs = [] } = useMealLogsForPeriod(startDate, endDate)
  const { data: targets } = useTargets()

  const weights   = logs.map(l => l.weight_kg)
  const calories  = logs.map(l => l.calories)
  const proteins  = logs.map(l => l.protein_g)
  const steps     = logs.map(l => l.steps)
  const sleeps    = logs.map(l => l.sleep_hours)
  const moods     = logs.map(l => l.mood)
  const waters    = logs.map(l => l.water_l)
  const sessionBinary = logs.map(l =>
    l.session_type ? (l.session_type !== 'rest' ? 1 : 0) : null
  )

  // Macro protein % — prefer meal logs when available
  const macroSource = mealLogs.length > 0
    ? mealLogs.map(m => ({ calories: m.calories, protein_g: m.protein_g }))
    : logs.map(l => ({ calories: l.calories, protein_g: l.protein_g }))
  const totalKcal   = macroSource.reduce((s, m) => s + (m.calories ?? 0), 0)
  const proteinKcal = macroSource.reduce((s, m) => s + ((m.protein_g ?? 0) * 4), 0)
  const avgProteinPct = totalKcal > 0 ? Math.round(proteinKcal / totalKcal * 100) : null

  // Session type breakdown string
  const sessionCounts = logs.reduce<Record<string, number>>((acc, l) => {
    if (l.session_type) acc[l.session_type] = (acc[l.session_type] ?? 0) + 1
    return acc
  }, {})
  const SESSION_SHORT: Record<string, string> = { push: 'Pu', pull: 'Pl', legs: 'L', upper: 'U', rest: 'R', cardio: 'C' }
  const sessionStat = Object.entries(sessionCounts)
    .filter(([t]) => t !== 'rest')
    .map(([t, n]) => `${n}${SESSION_SHORT[t] ?? t}`)
    .join(' ') || null

  const avgWeight   = avgOf(weights)
  const avgCalories = avgOf(calories)
  const avgSteps    = avgOf(steps)
  const avgSleep    = avgOf(sleeps)
  const avgMood     = avgOf(moods)
  const avgWater    = avgOf(waters)

  function getStat(slug: MetricSlug): string | null {
    switch (slug) {
      case 'weight':   return avgWeight != null ? `${avgWeight} kg` : null
      case 'calories': return avgCalories != null ? `${Math.round(avgCalories)} kcal` : null
      case 'protein':  return targets ? `${hitRate(proteins, targets.protein_g)}% hit` : null
      case 'macros':   return avgProteinPct != null ? `${avgProteinPct}% P` : null
      case 'steps':    return avgSteps != null ? Math.round(avgSteps).toLocaleString() : null
      case 'sessions': return sessionStat
      case 'sleep':    return avgSleep != null ? `${avgSleep} hr` : null
      case 'mood':     return avgMood != null ? `${avgMood}/5` : null
      case 'water':    return avgWater != null ? `${avgWater} L` : null
    }
  }

  function getSparkValues(slug: MetricSlug): (number | null)[] {
    switch (slug) {
      case 'weight':   return sparklineValues(weights)
      case 'calories': return sparklineValues(calories)
      case 'protein':  return sparklineValues(proteins)
      case 'macros':   return sparklineValues(macroSource.map(m => {
        const total = m.calories ?? 0
        const prot = m.protein_g ?? 0
        return total > 0 ? Math.round((prot * 4) / total * 100) : null
      }))
      case 'steps':    return sparklineValues(steps)
      case 'sessions': return sparklineValues(sessionBinary)
      case 'sleep':    return sparklineValues(sleeps)
      case 'mood':     return sparklineValues(moods)
      case 'water':    return sparklineValues(waters)
    }
  }

  function getTrend(slug: MetricSlug): '↑' | '↓' | '→' {
    switch (slug) {
      case 'weight':   return trendArrow(weights)
      case 'calories': return trendArrow(calories)
      case 'protein':  return trendArrow(proteins)
      case 'macros':   return '→'
      case 'steps':    return trendArrow(steps)
      case 'sessions': return trendArrow(sessionBinary)
      case 'sleep':    return trendArrow(sleeps)
      case 'mood':     return trendArrow(moods)
      case 'water':    return trendArrow(waters)
    }
  }

  return (
    <div className="pb-8 max-w-lg mx-auto">
      <InsightsSubTabs />
      <div className="px-4 pt-4 flex flex-col gap-4">
        <PeriodSelector value={period} onChange={setPeriod} />

        {SECTIONS.map(section => {
          const sectionDefs = SQUARE_DEFS.filter(d => d.section === section.key)
          return (
            <div key={section.key}>
              <div
                className="text-[9px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {section.label}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {sectionDefs.map(def =>
                  isLoading ? (
                    <div
                      key={def.slug}
                      className="rounded-2xl h-28 animate-pulse"
                      style={{ background: 'var(--surface)' }}
                    />
                  ) : (
                    <MetricSquare
                      key={def.slug}
                      slug={def.slug}
                      label={def.label}
                      icon={def.icon}
                      color={def.color}
                      stat={getStat(def.slug)}
                      sparkValues={getSparkValues(def.slug)}
                      trend={getTrend(def.slug)}
                    />
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
