'use client'
import { useState } from 'react'
import { useMealLogsForDate, sumMealMacros, type MealLog } from '@/lib/queries/meal-logs'
import { MealEntrySheet } from './meal-entry-sheet'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
}

interface Props { date: string }

export function MealList({ date }: Props) {
  const { data: meals = [] } = useMealLogsForDate(date)
  const [editing, setEditing] = useState<MealLog | null>(null)
  const [adding, setAdding] = useState(false)

  const totals = sumMealMacros(meals)
  const groups = MEAL_TYPES
    .map(type => ({ type, entries: meals.filter(m => m.meal_type === type) }))
    .filter(g => g.entries.length > 0)

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--accent)' }}>
          Today&apos;s totals
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(['calories', 'protein_g', 'fat_g', 'carbs_g'] as const).map((key, i) => (
            <div key={key} className="rounded-xl px-2 py-3 text-center"
              style={{ background: 'var(--surface)', border: `1px solid ${i === 1 ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'var(--border)'}` }}>
              <div className="text-sm font-bold" style={{ color: i === 1 ? 'var(--accent)' : 'var(--text-primary)' }}>
                {totals[key]}
              </div>
              <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {['kcal', 'prot', 'fat', 'carbs'][i]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {groups.map(({ type, entries }) => {
        const subtotal = sumMealMacros(entries)
        return (
          <div key={type}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {MEAL_LABELS[type]}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {subtotal.calories} kcal · {subtotal.protein_g}g protein
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {entries.map(entry => (
                <button key={entry.id} type="button" onClick={() => setEditing(entry)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {entry.note || MEAL_LABELS[type]}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    {entry.calories ?? '—'} kcal
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}

      <button type="button" onClick={() => setAdding(true)}
        className="text-sm py-3 rounded-xl"
        style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
        + Add meal
      </button>

      {adding && <MealEntrySheet date={date} meal={null} onClose={() => setAdding(false)} />}
      {editing && <MealEntrySheet date={date} meal={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
