import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type DailyLog = Database['public']['Tables']['daily_logs']['Row']
type DailyLogInsert = Database['public']['Tables']['daily_logs']['Insert']

export function useDailyLog(date: string) {
  return useQuery<DailyLog | null>({
    queryKey: ['daily-log', date],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('date', date)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useRecentLogs(limit = 14) {
  return useQuery({
    queryKey: ['daily-logs', 'recent', limit],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useUpsertLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (log: DailyLogInsert) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .from('daily_logs')
        .upsert(log as any, { onConflict: 'user_id,date' })
        .select()
        .single()
      if (error) throw error
      return data as DailyLog
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['daily-log', data.date] })
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] })
    },
  })
}
