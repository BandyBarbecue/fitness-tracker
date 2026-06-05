'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Bot } from 'lucide-react'

function usePastCheckins() {
  return useQuery({
    queryKey: ['ai-checkins'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('ai_checkins').select('*')
        .order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      return data ?? []
    },
  })
}

export function CheckinUI() {
  const [streaming, setStreaming] = useState(false)
  const [liveText, setLiveText] = useState('')
  const { data: past = [], refetch } = usePastCheckins()

  async function runCheckin() {
    if (streaming) return
    setStreaming(true)
    setLiveText('')
    try {
      const periodEnd = format(new Date(), 'yyyy-MM-dd')
      const periodStart = format(subDays(new Date(), 13), 'yyyy-MM-dd')

      const response = await fetch('/api/ai/weekly-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart, periodEnd }),
      })

      if (!response.ok || !response.body) {
        setLiveText(await response.text())
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setLiveText(t => t + decoder.decode(value, { stream: true }))
      }

      refetch()
    } catch {
      setLiveText('Something went wrong. Please try again.')
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-4">
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Coach</h1>

      <button
        onClick={runCheckin}
        disabled={streaming}
        className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-opacity disabled:opacity-50"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}
      >
        <Bot size={18} />
        {streaming ? 'Analysing your data…' : 'Run weekly check-in (last 14 days)'}
      </button>

      {liveText && (
        <div className="rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {liveText}
          {streaming && <span className="inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse" style={{ background: 'var(--accent)' }} />}
        </div>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Past check-ins</p>
          {past.map((c: { id: string; created_at: string; period_start: string; period_end: string; summary_text: string }) => (
            <div key={c.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                {format(new Date(c.created_at), 'dd MMM yyyy')} · {c.period_start} → {c.period_end}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {c.summary_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
