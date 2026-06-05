import { WeightChart } from '@/components/dashboard/weight-chart'

export default function DashboardPage() {
  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-4">
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
      <WeightChart />
    </div>
  )
}
