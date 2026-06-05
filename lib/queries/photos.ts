import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { v4 as uuid } from 'uuid'

type Photo = Database['public']['Tables']['progress_photos']['Row']

export function useProgressPhotos() {
  return useQuery<Photo[]>({
    queryKey: ['progress-photos'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      return (data ?? []) as Photo[]
    },
  })
}

export function usePhotoUrl(imagePath: string | null) {
  return useQuery<string | null>({
    queryKey: ['photo-url', imagePath],
    enabled: !!imagePath,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      if (!imagePath) return null
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('progress-photos')
        .createSignedUrl(imagePath, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export function useAddPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, date, note }: { file: File; date: string; note?: string }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const ext = file.type.split('/')[1] ?? 'jpg'
      const imagePath = `${user.id}/${uuid()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(imagePath, file)
      if (uploadError) throw uploadError

      const { data, error } = await (supabase.from('progress_photos') as any)
        .insert({ user_id: user.id, date, image_path: imagePath, note: note ?? null })
        .select()
        .single()
      if (error) {
        await supabase.storage.from('progress-photos').remove([imagePath])
        throw error
      }
      return data as Photo
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['progress-photos'] }),
  })
}
