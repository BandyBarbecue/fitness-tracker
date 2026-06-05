import { WeightChart } from '@/components/dashboard/weight-chart'
import { ProteinCard } from '@/components/dashboard/protein-card'
import { StreakRow } from '@/components/dashboard/streak-row'
import { DashboardMetrics } from './dashboard-metrics'

export default function DashboardPage() {
  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-3">
      <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
      <WeightChart />
      <ProteinCard />
      <DashboardMetrics />
      <StreakRow />
    </div>
  )
}
