'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUpsertMealLog, useDeleteMealLog, type MealLog } from '@/lib/queries/meal-logs'
import { ScreenshotUploader } from './screenshot-uploader'
import { MacroConfirm } from './macro-confirm'
import type { ExtractedMacros } from '@/lib/anthropic/extract-macros'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
}

interface Props {
  date: string
  meal: MealLog | null
  onClose: () => void
}

type Stage = 'type' | 'form' | 'extracting' | 'confirm'

export function MealEntrySheet({ date, meal, onClose }: Props) {
  const upsert = useUpsertMealLog()
  const del = useDeleteMealLog()

  const [stage, setStage] = useState<Stage>(meal ? 'form' : 'type')
  const [mealType, setMealType] = useState<MealType | null>((meal?.meal_type as MealType) ?? null)
  const [draftId, setDraftId] = useState<string | null>(meal?.id ?? null)
  const [extracted, setExtracted] = useState<ExtractedMacros | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [fields, setFields] = useState({
    calories: String(meal?.calories ?? ''),
    protein_g: String(meal?.protein_g ?? ''),
    fat_g: String(meal?.fat_g ?? ''),
    carbs_g: String(meal?.carbs_g ?? ''),
    note: meal?.note ?? '',
  })

  const handleClose = useCallback(async () => {
    if (!meal && draftId) {
      try {
        await del.mutateAsync({ id: draftId, date })
      } catch {
        // best-effort cleanup — still close even if the delete fails
      }
    }
    onClose()
  }, [meal, draftId, date, del, onClose])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  function set(key: keyof typeof fields, value: string) {
    setFields(f => ({ ...f, [key]: value }))
  }

  async function ensureDraft(type: MealType): Promise<string | null> {
    if (draftId) return draftId
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    try {
      const row = await upsert.mutateAsync({ user_id: user.id, date, meal_type: type })
      setDraftId(row.id)
      return row.id
    } catch {
      setError('Could not start this entry — try again')
      return null
    }
  }

  async function handleSave() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !mealType) return
    try {
      await upsert.mutateAsync({
        id: draftId ?? undefined,
        user_id: user.id,
        date,
        meal_type: mealType,
        calories: fields.calories ? parseInt(fields.calories) : null,
        protein_g: fields.protein_g ? parseFloat(fields.protein_g) : null,
        fat_g: fields.fat_g ? parseFloat(fields.fat_g) : null,
        carbs_g: fields.carbs_g ? parseFloat(fields.carbs_g) : null,
        note: fields.note || null,
      })
      onClose()
    } catch {
      setError('Save failed — try again')
    }
  }

  async function handleDelete() {
    if (!draftId) return
    try {
      await del.mutateAsync({ id: draftId, date })
      onClose()
    } catch {
      setError('Delete failed — try again')
    }
  }

  function macroInput(key: 'calories' | 'protein_g' | 'fat_g' | 'carbs_g', unit: string, accent = false) {
    return (
      <div
        className="rounded-xl px-2 py-3 text-center"
        style={{
          background: 'var(--bg)',
          border: `1px solid ${accent ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'var(--border)'}`,
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          value={fields[key]}
          onChange={e => set(key, e.target.value)}
          placeholder="—"
          className="bg-transparent outline-none text-sm font-bold w-full text-center"
          style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)' }}
        />
        <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{unit}</div>
      </div>
    )
  }

  if (stage === 'extracting') {
    return (
      <>
        <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.6)' }} />
        <div
          className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 z-[70] rounded-t-2xl md:rounded-2xl p-8 max-w-sm w-full md:mx-auto animate-fade-in-up flex items-center justify-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Reading screenshot…</p>
        </div>
      </>
    )
  }

  if (stage === 'confirm' && extracted) {
    return (
      <>
        <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.6)' }} />
        <div
          className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 z-[70] rounded-t-2xl md:rounded-2xl max-w-sm w-full md:mx-auto animate-fade-in-up overflow-y-auto max-h-[85vh]"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <MacroConfirm
            extracted={extracted}
            onConfirm={(values) => {
              setFields(f => ({ ...f, ...values }))
              setExtracted(null)
              setStage('form')
            }}
            onSkip={() => { setExtracted(null); setStage('form') }}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={meal ? 'Edit meal' : 'Add meal'}
        className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 z-[70] rounded-t-2xl md:rounded-2xl p-4 max-w-sm w-full md:mx-auto animate-fade-in-up overflow-y-auto max-h-[85vh] flex flex-col gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {stage === 'type' && (
          <>
            <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>What did you eat?</div>
            <div className="flex flex-wrap gap-2">
              {MEAL_TYPES.map(t => (
                <button key={t} type="button" onClick={() => { setMealType(t); setStage('form') }}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                  style={{
                    background: mealType === t ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--bg)',
                    border: `1px solid ${mealType === t ? 'color-mix(in srgb, var(--accent) 38%, transparent)' : 'var(--border)'}`,
                    color: mealType === t ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                  {MEAL_LABELS[t]}
                </button>
              ))}
            </div>
            <button type="button" onClick={handleClose} className="text-sm py-3 rounded-xl"
              style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </>
        )}

        {stage === 'form' && mealType && (
          <>
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {meal ? `Edit ${MEAL_LABELS[mealType]}` : `Add ${MEAL_LABELS[mealType]}`}
              </div>
              {!meal && (
                <button type="button" onClick={() => setStage('type')} className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Change type
                </button>
              )}
            </div>

            {draftId ? (
              <ScreenshotUploader
                target={{ type: 'meal', mealLogId: draftId }}
                onUploaded={async ({ screenshotId, imagePath }) => {
                  setStage('extracting')
                  const res = await fetch('/api/ai/extract-macros', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ screenshotId, imagePath }),
                  })
                  const data = await res.json()
                  if (res.ok) {
                    setExtracted(data)
                    setStage('confirm')
                  } else {
                    setError('Could not read screenshot — enter manually')
                    setStage('form')
                  }
                }}
              />
            ) : (
              <button type="button" onClick={() => ensureDraft(mealType)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: '#0f1f17', border: '1px dashed #34d39960' }}>
                <div className="text-left">
                  <div className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>Extract from screenshot</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tap to upload · AI fills macros</div>
                </div>
              </button>
            )}

            <div className="grid grid-cols-4 gap-2">
              {macroInput('calories', 'kcal')}
              {macroInput('protein_g', 'protein', true)}
              {macroInput('fat_g', 'fat')}
              {macroInput('carbs_g', 'carbs')}
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Note (optional)
              </label>
              <textarea
                value={fields.note}
                onChange={e => set('note', e.target.value)}
                rows={2}
                placeholder="e.g. chicken & rice"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            {error && <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>}

            <div className="grid gap-2" style={{ gridTemplateColumns: meal ? '1fr 1fr 1fr' : '1fr 2fr' }}>
              <button type="button" onClick={handleClose} className="py-3 rounded-xl text-sm"
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              {meal && (
                <button type="button" onClick={handleDelete} disabled={del.isPending}
                  className="py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ border: '1px solid var(--red)', color: 'var(--red)' }}>
                  {del.isPending ? 'Deleting…' : 'Delete'}
                </button>
              )}
              <button type="button" onClick={handleSave} disabled={upsert.isPending}
                className="py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#0a0a0a' }}>
                {upsert.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
