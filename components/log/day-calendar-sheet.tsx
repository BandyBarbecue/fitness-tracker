// components/log/day-calendar-sheet.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, isSameMonth, isSameDay,
  isToday as isTodayFn, isAfter,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useLoggedDatesInMonth } from '@/lib/queries/daily-logs'

interface Props {
  date: string
  onClose: () => void
}

export function DayCalendarSheet({ date, onClose }: Props) {
  const router = useRouter()
  const [viewedMonth, setViewedMonth] = useState(() => startOfMonth(parseISO(date)))
  const monthStartStr = format(viewedMonth, 'yyyy-MM-dd')
  const { data: loggedDates = new Set<string>() } = useLoggedDatesInMonth(monthStartStr)

  const gridStart = startOfWeek(startOfMonth(viewedMonth))
  const gridEnd = endOfWeek(endOfMonth(viewedMonth))
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const today = new Date()

  function selectDate(d: Date) {
    if (isAfter(d, today) && !isSameDay(d, today)) return
    router.push(`/log/${format(d, 'yyyy-MM-dd')}`)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 z-50 rounded-t-2xl md:rounded-2xl p-4 max-w-sm w-full md:mx-auto animate-fade-in-up"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <button type="button" aria-label="Previous month" onClick={() => setViewedMonth(m => subMonths(m, 1))}
            className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {format(viewedMonth, 'MMMM yyyy')}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Next month" onClick={() => setViewedMonth(m => addMonths(m, 1))}
              className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <ChevronRight size={18} />
            </button>
            <button type="button" aria-label="Close calendar" onClick={onClose}
              className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map(d => {
            const dStr = format(d, 'yyyy-MM-dd')
            const inMonth = isSameMonth(d, viewedMonth)
            const isViewed = dStr === date
            const isTodayCell = isTodayFn(d)
            const future = isAfter(d, today) && !isSameDay(d, today)
            const hasLog = loggedDates.has(dStr)

            return (
              <button
                key={dStr}
                type="button"
                disabled={future}
                onClick={() => selectDate(d)}
                className="aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-colors disabled:pointer-events-none"
                style={{
                  background: isViewed ? 'var(--accent)' : 'transparent',
                  color: isViewed ? '#0a0a0a' : future ? 'var(--text-muted)' : 'var(--text-primary)',
                  opacity: future ? 0.3 : inMonth ? 1 : 0.4,
                  border: isTodayCell && !isViewed ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                {format(d, 'd')}
                <span
                  className="block w-1 h-1 rounded-full mt-0.5"
                  style={{ background: hasLog ? (isViewed ? '#0a0a0a' : 'var(--accent)') : 'transparent' }}
                />
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
