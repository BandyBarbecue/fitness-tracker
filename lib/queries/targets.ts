import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Targets = Database['public']['Tables']['targets']['Row']
type TargetsInsert = Database['public']['Tables']['targets']['Insert']

export function useTargets() {
  return useQuery<Targets | null>({
    queryKey: ['targets'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('targets')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data as Targets | null
    },
  })
}

export function useUpsertTargets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (targets: TargetsInsert) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .from('targets')
        .upsert(targets as any, { onConflict: 'user_id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['targets'] }),
  })
}
