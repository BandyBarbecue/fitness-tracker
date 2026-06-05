'use client'
import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { useProgressPhotos, usePhotoUrl, useAddPhoto } from '@/lib/queries/photos'
import { PhotoComparison } from './photo-comparison'
import type { Database } from '@/types/database'

type Photo = Database['public']['Tables']['progress_photos']['Row']

function PhotoCard({ photo }: { photo: Photo }) {
  const { data: url } = usePhotoUrl(photo.image_path)
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {url
        ? <img src={url} alt={photo.date} className="w-full object-cover" style={{ aspectRatio: '3/4' }} />
        : <div className="w-full animate-pulse" style={{ background: 'var(--surface)', aspectRatio: '3/4' }} />
      }
      <div className="px-2 py-1.5" style={{ background: 'var(--surface)' }}>
        <div className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
          {format(new Date(photo.date + 'T00:00:00'), 'dd MMM yyyy')}
        </div>
        {photo.note && (
          <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{photo.note}</div>
        )}
      </div>
    </div>
  )
}

export function PhotoGallery() {
  const { data: photos = [] } = useProgressPhotos()
  const addPhoto = useAddPhoto()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [comparing, setComparing] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    try {
      await addPhoto.mutateAsync({ file, date: format(new Date(), 'yyyy-MM-dd') })
    } catch {
      setError('Upload failed — check your connection')
    }
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4 gap-2">
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Progress Photos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setComparing(c => !c)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{
              background: comparing ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--surface)',
              border: `1px solid ${comparing ? 'color-mix(in srgb, var(--accent) 38%, transparent)' : 'var(--border)'}`,
              color: comparing ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            Compare
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={addPhoto.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {error && <p className="text-xs mb-3" style={{ color: 'var(--red)' }}>{error}</p>}

      {comparing ? (
        <PhotoComparison />
      ) : photos.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No photos yet — tap Add to upload your first progress photo</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map(p => <PhotoCard key={p.id} photo={p} />)}
        </div>
      )}
    </div>
  )
}
