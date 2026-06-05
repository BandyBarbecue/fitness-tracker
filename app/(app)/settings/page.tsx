'use client'
import { useState, useEffect } from 'react'
import { useTargets, useUpsertTargets } from '@/lib/queries/targets'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const { data: targets } = useTargets()
  const upsert = useUpsertTargets()
  const [toast, setToast] = useState<string | null>(null)

  const [fields, setFields] = useState({
    calories: '2400', protein_g: '185', fat_g: '70', carbs_g: '255',
    steps: '10000', goal_rate_kg_per_week: '0.5',
    bodyweight_kg: '86', height_cm: '188',
    training_split: 'Push/Pull/Legs/Upper — 4 lifting days + daily steps + Zone 2 cardio',
  })

  useEffect(() => {
    if (targets) {
      setFields({
        calories: String(targets.calories),
        protein_g: String(targets.protein_g),
        fat_g: String(targets.fat_g),
        carbs_g: String(targets.carbs_g),
        steps: String(targets.steps),
        goal_rate_kg_per_week: String(targets.goal_rate_kg_per_week),
        bodyweight_kg: String(targets.bodyweight_kg),
        height_cm: String(targets.height_cm),
        training_split: targets.training_split,
      })
    }
  }, [targets])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      await upsert.mutateAsync({
        user_id: user.id,
        calories: parseInt(fields.calories),
        protein_g: parseFloat(fields.protein_g),
        fat_g: parseFloat(fields.fat_g),
        carbs_g: parseFloat(fields.carbs_g),
        steps: parseInt(fields.steps),
        goal_rate_kg_per_week: parseFloat(fields.goal_rate_kg_per_week),
        bodyweight_kg: parseFloat(fields.bodyweight_kg),
        height_cm: parseInt(fields.height_cm),
        training_split: fields.training_split,
      })
      setToast('Saved')
      setTimeout(() => setToast(null), 2000)
    } catch {
      setToast('Save failed')
      setTimeout(() => setToast(null), 3000)
    }
  }

  function field(label: string, key: keyof typeof fields, unit?: string, type = 'number') {
    return (
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {label}{unit ? ` (${unit})` : ''}
        </label>
        <input
          type={type}
          value={fields[key]}
          onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-4">
      <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Settings</h1>

      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>Daily Targets</p>
      {field('Calories', 'calories', 'kcal')}
      {field('Protein', 'protein_g', 'g')}
      {field('Fat', 'fat_g', 'g')}
      {field('Carbs', 'carbs_g', 'g')}
      {field('Steps', 'steps')}
      {field('Goal rate', 'goal_rate_kg_per_week', 'kg/week')}

      <p className="text-xs uppercase tracking-widest font-semibold mt-2" style={{ color: 'var(--text-muted)' }}>Body Stats</p>
      {field('Current weight', 'bodyweight_kg', 'kg')}
      {field('Height', 'height_cm', 'cm')}
      {field('Training split', 'training_split', undefined, 'text')}

      <button type="submit" disabled={upsert.isPending}
        className="py-4 rounded-xl font-bold text-sm mt-2 transition-opacity disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#0a0a0a' }}>
        {upsert.isPending ? 'Saving…' : 'Save Settings'}
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
