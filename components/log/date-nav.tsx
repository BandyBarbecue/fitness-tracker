// components/log/date-nav.tsx
'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { adjacentLogDate, isFutureLogDate, logDateLabel } from '@/lib/utils/log-date'

interface Props {
  date: string
}

export function DateNav({ date }: Props) {
  const router = useRouter()
  const today = format(new Date(), 'yyyy-MM-dd')
  const isToday = date === today
  const next = adjacentLogDate(date, 1)
  const nextDisabled = isFutureLogDate(next, today)

  return (
    <div className="flex items-center justify-between mb-1">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => router.push(`/log/${adjacentLogDate(date, -1)}`)}
        className="p-2 -ml-2 rounded-lg"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {logDateLabel(date, today)}
        </span>
        {!isToday && (
          <button
            type="button"
            onClick={() => router.push(`/log/${today}`)}
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors"
            style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}
          >
            Today
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label="Next day"
        disabled={nextDisabled}
        onClick={() => router.push(`/log/${next}`)}
        className="p-2 -mr-2 rounded-lg disabled:opacity-30 disabled:pointer-events-none"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
