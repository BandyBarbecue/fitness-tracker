import { WeightChart } from '@/components/dashboard/weight-chart'
import { ProteinCard } from '@/components/dashboard/protein-card'
import { StreakRow } from '@/components/dashboard/streak-row'
import { TodayGlanceCard } from '@/components/dashboard/today-glance-card'

export default function DashboardPage() {
  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-3">
      <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
      <div className="animate-fade-in-up animate-stagger-1"><WeightChart /></div>
      <div className="animate-fade-in-up animate-stagger-2"><ProteinCard /></div>
      <div className="animate-fade-in-up animate-stagger-3"><TodayGlanceCard /></div>
      <div className="animate-fade-in-up animate-stagger-4"><StreakRow /></div>
    </div>
  )
}
