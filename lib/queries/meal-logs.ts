import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useDailyLog } from './daily-logs'
import type { Database } from '@/types/database'

export type MealLog = Database['public']['Tables']['meal_logs']['Row']
type MealLogInsert = Database['public']['Tables']['meal_logs']['Insert']

interface MacroFields {
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}

export function sumMealMacros(meals: MacroFields[]) {
  return {
    calories: meals.reduce((sum, m) => sum + (m.calories ?? 0), 0),
    protein_g: meals.reduce((sum, m) => sum + (m.protein_g ?? 0), 0),
    fat_g: meals.reduce((sum, m) => sum + (m.fat_g ?? 0), 0),
    carbs_g: meals.reduce((sum, m) => sum + (m.carbs_g ?? 0), 0),
  }
}

export function useMealLogsForDate(date: string) {
  return useQuery<MealLog[]>({
    queryKey: ['meal-logs', date],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('date', date)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MealLog[]
    },
  })
}

export function useUpsertMealLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (meal: MealLogInsert) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .from('meal_logs')
        .upsert(meal as any, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      return data as MealLog
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs', data.date] })
      queryClient.invalidateQueries({ queryKey: ['daily-log', data.date] })
    },
  })
}

export function useDeleteMealLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; date: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from('meal_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs', variables.date] })
      queryClient.invalidateQueries({ queryKey: ['daily-log', variables.date] })
    },
  })
}

export interface NutritionForDate {
  source: 'meals' | 'daily'
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  meals: MealLog[]
}

export function useNutritionForDate(date: string) {
  const { data: dailyLog, isLoading: dailyLoading } = useDailyLog(date)
  const { data: meals = [], isLoading: mealsLoading } = useMealLogsForDate(date)

  const isLoading = dailyLoading || mealsLoading

  let data: NutritionForDate | undefined
  if (!isLoading) {
    data = meals.length > 0
      ? { source: 'meals', ...sumMealMacros(meals), meals }
      : {
          source: 'daily',
          calories: dailyLog?.calories ?? null,
          protein_g: dailyLog?.protein_g ?? null,
          fat_g: dailyLog?.fat_g ?? null,
          carbs_g: dailyLog?.carbs_g ?? null,
          meals: [],
        }
  }

  return { data, isLoading }
}
