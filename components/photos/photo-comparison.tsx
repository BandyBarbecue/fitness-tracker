'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { useProgressPhotos, usePhotoUrl } from '@/lib/queries/photos'
import type { Database } from '@/types/database'

type Photo = Database['public']['Tables']['progress_photos']['Row']

function CompareSlot({ photos, selectedId, onSelect }: {
  photos: Photo[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const selected = photos.find(p => p.id === selectedId) ?? null
  const { data: url } = usePhotoUrl(selected?.image_path ?? null)

  return (
    <div className="flex-1 flex flex-col gap-2">
      <select
        value={selectedId ?? ''}
        onChange={e => onSelect(e.target.value)}
        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      >
        <option value="">Select date…</option>
        {photos.map(p => (
          <option key={p.id} value={p.id}>{format(new Date(p.date), 'dd MMM yyyy')}</option>
        ))}
      </select>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', aspectRatio: '3/4' }}>
        {url
          ? <img src={url} alt={selected?.date ?? ''} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
            </div>
        }
      </div>

      {selected && (
        <p className="text-[10px] text-center font-semibold" style={{ color: 'var(--text-muted)' }}>
          {format(new Date(selected.date), 'dd MMM yyyy')}
        </p>
      )}
    </div>
  )
}

export function PhotoComparison() {
  const { data: photos = [] } = useProgressPhotos()
  const [leftId, setLeftId] = useState<string | null>(null)
  const [rightId, setRightId] = useState<string | null>(null)

  if (photos.length < 2) {
    return (
      <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
        You need at least 2 photos to compare
      </p>
    )
  }

  return (
    <div className="flex gap-3">
      <CompareSlot photos={photos} selectedId={leftId} onSelect={setLeftId} />
      <CompareSlot photos={photos} selectedId={rightId} onSelect={setRightId} />
    </div>
  )
}
