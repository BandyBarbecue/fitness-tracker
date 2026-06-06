'use client'
import { MetricCard } from '@/components/dashboard/metric-card'
import { useDailyLog } from '@/lib/queries/daily-logs'
import { useNutritionForDate } from '@/lib/queries/meal-logs'
import { useTargets } from '@/lib/queries/targets'
import { format } from 'date-fns'

export function DashboardMetrics() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: log } = useDailyLog(today)
  const { data: nutrition } = useNutritionForDate(today)
  const { data: targets } = useTargets()

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard
        label="Calories"
        value={nutrition?.calories}
        target={targets?.calories ?? 2400}
        unit="kcal"
        color="var(--amber)"
      />
      <MetricCard
        label="Steps"
        value={log?.steps}
        target={targets?.steps ?? 10000}
        unit="steps"
        color="var(--sky)"
      />
    </div>
  )
}
