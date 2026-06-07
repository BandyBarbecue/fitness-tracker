import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { subDays, format, parseISO } from 'date-fns'
import type { Database } from '@/types/database'

export type DailyLogAnalytics = Database['public']['Tables']['daily_logs']['Row']
export type MealLogAnalytics = Database['public']['Tables']['meal_logs']['Row']

export function periodBounds(days: 7 | 30 | 90, today: string): { startDate: string; endDate: string } {
  return {
    startDate: format(subDays(parseISO(today), days - 1), 'yyyy-MM-dd'),
    endDate: today,
  }
}

export function previousPeriodBounds(days: 7 | 30 | 90, today: string): { startDate: string; endDate: string } {
  const prevEnd = format(subDays(parseISO(today), days), 'yyyy-MM-dd')
  return {
    startDate: format(subDays(parseISO(prevEnd), days - 1), 'yyyy-MM-dd'),
    endDate: prevEnd,
  }
}

export function avgOf(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length === 0) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10
}

export function hitRate(values: (number | null | undefined)[], target: number): number {
  const logged = values.filter((v): v is number => v != null)
  if (logged.length === 0) return 0
  return Math.round(logged.filter(v => v >= target).length / logged.length * 100)
}

export function trendArrow(data: (number | null | undefined)[]): '↑' | '↓' | '→' {
  const valid = data.filter((v): v is number => v != null)
  if (valid.length < 2) return '→'
  const mid = Math.floor(valid.length / 2)
  const firstAvg = valid.slice(0, mid).reduce((a, b) => a + b, 0) / mid
  const secondAvg = valid.slice(mid).reduce((a, b) => a + b, 0) / (valid.length - mid)
  const delta = secondAvg - firstAvg
  if (Math.abs(delta) < 0.01 * Math.abs(firstAvg || 1)) return '→'
  return delta > 0 ? '↑' : '↓'
}

export function sparklineValues(data: (number | null | undefined)[], count = 7): (number | null)[] {
  return data.slice(-count).map(v => v ?? null)
}

export function mergeNutrition(
  logs: DailyLogAnalytics[],
  mealLogs: MealLogAnalytics[]
): DailyLogAnalytics[] {
  if (mealLogs.length === 0) return logs
  const byDate = new Map<string, { calories: number; protein_g: number; fat_g: number; carbs_g: number }>()
  for (const m of mealLogs) {
    const cur = byDate.get(m.date) ?? { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
    byDate.set(m.date, {
      calories: cur.calories + (m.calories ?? 0),
      protein_g: cur.protein_g + (m.protein_g ?? 0),
      fat_g: cur.fat_g + (m.fat_g ?? 0),
      carbs_g: cur.carbs_g + (m.carbs_g ?? 0),
    })
  }
  return logs.map(row => {
    const meal = byDate.get(row.date)
    if (!meal) return row
    return { ...row, ...meal }
  })
}

export function useAnalyticsForPeriod(startDate: string, endDate: string) {
  return useQuery<DailyLogAnalytics[]>({
    queryKey: ['daily-logs', 'analytics', startDate, endDate],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as DailyLogAnalytics[]
    },
  })
}

export function useMealLogsForPeriod(startDate: string, endDate: string) {
  return useQuery<MealLogAnalytics[]>({
    queryKey: ['meal-logs', 'analytics', startDate, endDate],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as MealLogAnalytics[]
    },
  })
}
