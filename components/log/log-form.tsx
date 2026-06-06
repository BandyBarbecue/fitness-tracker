'use client'
import { useState, useEffect } from 'react'
import { SessionPicker, type SessionType } from './session-picker'
import { useDailyLog, useUpsertLog } from '@/lib/queries/daily-logs'
import { createClient } from '@/lib/supabase/client'
import { ScreenshotUploader } from './screenshot-uploader'
import { MacroConfirm } from './macro-confirm'
import type { ExtractedMacros } from '@/lib/anthropic/extract-macros'
import { DateNav } from './date-nav'

interface Props { date: string }

export function LogForm({ date }: Props) {
  const { data: existing } = useDailyLog(date)
  const upsert = useUpsertLog()
  const [showOptional, setShowOptional] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingScreenshot, setPendingScreenshot] = useState<{ screenshotId: string; imagePath: string } | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedMacros | null>(null)

  const [fields, setFields] = useState({
    weight_kg: '', calories: '', protein_g: '', fat_g: '', carbs_g: '',
    steps: '', session_type: null as SessionType | null,
    sleep_hours: '', mood: '', note: '',
  })

  useEffect(() => {
    if (existing != null) {
      setFields({
        weight_kg:    String(existing.weight_kg ?? ''),
        calories:     String(existing.calories ?? ''),
        protein_g:    String(existing.protein_g ?? ''),
        fat_g:        String(existing.fat_g ?? ''),
        carbs_g:      String(existing.carbs_g ?? ''),
        steps:        String(existing.steps ?? ''),
        session_type: (existing.session_type as SessionType) ?? null,
        sleep_hours:  String(existing.sleep_hours ?? ''),
        mood:         String(existing.mood ?? ''),
        note:         existing.note ?? '',
      })
    }
  }, [existing])

  function set(key: keyof typeof fields, value: string) {
    setFields(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await upsert.mutateAsync({
        user_id:      user.id,
        date,
        weight_kg:    fields.weight_kg    ? parseFloat(fields.weight_kg)    : null,
        calories:     fields.calories     ? parseInt(fields.calories)        : null,
        protein_g:    fields.protein_g    ? parseFloat(fields.protein_g)    : null,
        fat_g:        fields.fat_g        ? parseFloat(fields.fat_g)        : null,
        carbs_g:      fields.carbs_g      ? parseFloat(fields.carbs_g)      : null,
        steps:        fields.steps        ? parseInt(fields.steps)           : null,
        session_type: fields.session_type ?? null,
        sleep_hours:  fields.sleep_hours  ? parseFloat(fields.sleep_hours)  : null,
        mood:         fields.mood         ? parseInt(fields.mood)            : null,
        note:         fields.note || null,
      })
      if (pendingScreenshot) {
        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('food_screenshots') as any).update({ confirmed: true }).eq('id', pendingScreenshot.screenshotId)
        setPendingScreenshot(null)
      }
      setToast('Saved')
      setTimeout(() => setToast(null), 2000)
    } catch {
      setToast('Save failed — try again')
      setTimeout(() => setToast(null), 3000)
    }
  }

  function numInput(label: string, key: keyof typeof fields, unit: string, accent = false) {
    return (
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </label>
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${accent ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'var(--border)'}`,
          }}
        >
          <input
            type="number"
            inputMode="decimal"
            value={fields[key] as string}
            onChange={e => set(key, e.target.value)}
            placeholder="—"
            className="bg-transparent outline-none text-xl font-bold w-full"
            style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)' }}
          />
          <span className="text-xs ml-2 shrink-0" style={{ color: 'var(--text-muted)' }}>{unit}</span>
        </div>
      </div>
    )
  }

  if (extracting) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Reading screenshot…</p>
      </div>
    )
  }

  if (extracted) {
    return (
      <MacroConfirm
        extracted={extracted}
        onConfirm={(values) => {
          setFields(f => ({ ...f, ...values }))
          setExtracted(null)
        }}
        onSkip={() => setExtracted(null)}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-8 pt-6 max-w-lg mx-auto">
      <DateNav date={date} />

      <ScreenshotUploader
        dailyLogId={existing?.id ?? null}
        date={date}
        onUploaded={async ({ screenshotId, imagePath }) => {
          setExtracting(true)
          setPendingScreenshot({ screenshotId, imagePath })
          const res = await fetch('/api/ai/extract-macros', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ screenshotId, imagePath }),
          })
          const data = await res.json()
          setExtracting(false)
          if (res.ok) setExtracted(data)
          else setToast('Could not read screenshot — enter manually')
        }}
      />

      {numInput('Morning Weight', 'weight_kg', 'kg')}

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Nutrition
        </label>
        <div className="grid grid-cols-4 gap-2">
          {(['calories','protein_g','fat_g','carbs_g'] as const).map((key, i) => (
            <div
              key={key}
              className="rounded-xl px-2 py-3 text-center"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${i === 1 ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'var(--border)'}`,
              }}
            >
              <input
                type="number"
                inputMode="decimal"
                value={fields[key] as string}
                onChange={e => set(key, e.target.value)}
                placeholder="—"
                className="bg-transparent outline-none text-sm font-bold w-full text-center"
                style={{ color: i === 1 ? 'var(--accent)' : 'var(--text-primary)' }}
              />
              <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {['kcal','prot','fat','carbs'][i]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {numInput('Steps', 'steps', 'steps')}

      <SessionPicker
        value={fields.session_type}
        onChange={s => setFields(f => ({ ...f, session_type: s }))}
      />

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Note
        </label>
        <textarea
          value={fields.note}
          onChange={e => set('note', e.target.value)}
          rows={2}
          placeholder="How did today go?"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {!showOptional && (
        <button type="button" onClick={() => setShowOptional(true)}
          className="text-sm py-3 rounded-xl"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          + Sleep &amp; mood (optional)
        </button>
      )}

      {showOptional && (
        <div className="grid grid-cols-2 gap-3">
          {numInput('Sleep', 'sleep_hours', 'hrs')}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Mood
            </label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => set('mood', String(n))}
                  className="flex-1 py-3 rounded-lg text-sm font-bold transition-colors"
                  style={{
                    background: fields.mood === String(n) ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--surface)',
                    border: `1px solid ${fields.mood === String(n) ? 'color-mix(in srgb, var(--accent) 38%, transparent)' : 'var(--border)'}`,
                    color: fields.mood === String(n) ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={upsert.isPending}
        className="py-4 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#0a0a0a' }}
      >
        {upsert.isPending ? 'Saving…' : 'Save Entry'}
      </button>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-semibold z-50"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}
    </form>
  )
}
