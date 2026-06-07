'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { PeriodSelector, type Period } from './period-selector'
import { DetailChart } from './detail-chart'
import { CorrelationPanel } from './correlation-panel'
import {
  useAnalyticsForPeriod, useMealLogsForPeriod, periodBounds, previousPeriodBounds, avgOf, hitRate, mergeNutrition,
} from '@/lib/queries/analytics'
import { useTargets } from '@/lib/queries/targets'
import { METRIC_CONFIG, type MetricSlug } from './metric-config'

export function MetricDetailClient({ slug }: { slug: MetricSlug }) {
  const [period, setPeriod] = useState<Period>(30)
  const today = format(new Date(), 'yyyy-MM-dd')
  const { startDate, endDate }   = periodBounds(period, today)
  const prev                     = previousPeriodBounds(period, today)

  const { data: logs = [], isLoading }    = useAnalyticsForPeriod(startDate, endDate)
  const { data: prevLogs = [] }           = useAnalyticsForPeriod(prev.startDate, prev.endDate)
  const { data: mealLogs = [] }           = useMealLogsForPeriod(startDate, endDate)
  const { data: prevMealLogs = [] }       = useMealLogsForPeriod(prev.startDate, prev.endDate)
  const { data: targets }                 = useTargets()

  const enrichedLogs     = mergeNutrition(logs, mealLogs)
  const enrichedPrevLogs = mergeNutrition(prevLogs, prevMealLogs)

  const config = METRIC_CONFIG[slug]
  const target = slug === 'calories' ? targets?.calories
    : slug === 'protein' ? targets?.protein_g
    : slug === 'steps'   ? targets?.steps
    : null

  const currentValues = enrichedLogs.map(l => config.getValue(l))
  const prevValues    = enrichedPrevLogs.map(l => config.getValue(l))
  const currentAvg    = avgOf(currentValues)
  const prevAvg       = avgOf(prevValues)

  const delta = currentAvg != null && prevAvg != null
    ? Math.round((currentAvg - prevAvg) * 10) / 10
    : null
  const deltaStr = delta != null
    ? `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} ${config.unit} vs previous ${period}d`
    : null

  const nonNull    = currentValues.filter((v): v is number => v != null)
  const best       = nonNull.length > 0 ? Math.max(...nonNull) : null
  const worst      = nonNull.length > 0 ? Math.min(...nonNull) : null
  const daysLogged = nonNull.length

  const chips = [
    { label: 'Avg',   value: currentAvg != null ? config.formatStat(currentAvg) : '—' },
    { label: 'Best',  value: best  != null ? config.formatStat(best)  : '—' },
    { label: 'Worst', value: worst != null ? config.formatStat(worst) : '—' },
    target != null
      ? { label: 'Hit Rate', value: `${hitRate(currentValues, target)}%` }
      : { label: 'Logged',   value: `${daysLogged}d` },
  ]

  return (
    <div className="pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <Link href="/insights" className="text-lg font-bold" style={{ color: 'var(--accent)' }}>←</Link>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{config.label}</h1>
      </div>

      <div className="px-4 flex flex-col gap-4">
        <PeriodSelector value={period} onChange={setPeriod} />

        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {isLoading ? (
            <div className="h-8 w-32 rounded animate-pulse" style={{ background: 'var(--border)' }} />
          ) : (
            <>
              <div className="text-3xl font-extrabold tracking-tight mb-0.5" style={{ color: config.color }}>
                {currentAvg != null
                  ? config.formatStat(currentAvg)
                  : <span style={{ color: 'var(--text-muted)' }}>—</span>
                }
              </div>
              {deltaStr && (
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{deltaStr}</div>
              )}
            </>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-2xl h-56 animate-pulse" style={{ background: 'var(--surface)' }} />
        ) : enrichedLogs.length > 0 ? (
          <div className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <DetailChart slug={slug} data={enrichedLogs} target={target} />
          </div>
        ) : (
          <div className="rounded-2xl p-6 text-center text-sm" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
            No data logged for this period
          </div>
        )}

        {daysLogged > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {chips.map(chip => (
              <div key={chip.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{chip.label}</div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{chip.value}</div>
              </div>
            ))}
          </div>
        )}

        {enrichedLogs.length > 0 && <CorrelationPanel slug={slug} data={enrichedLogs} />}
      </div>
    </div>
  )
}
