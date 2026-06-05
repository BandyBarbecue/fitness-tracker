'use client'
import { useState } from 'react'
import type { ExtractedMacros } from '@/lib/anthropic/extract-macros'

interface Props {
  extracted: ExtractedMacros
  onConfirm: (values: { calories: string; protein_g: string; fat_g: string; carbs_g: string }) => void
  onSkip: () => void
}

export function MacroConfirm({ extracted, onConfirm, onSkip }: Props) {
  const [values, setValues] = useState({
    calories: String(extracted.calories ?? ''),
    protein_g: String(extracted.protein_g ?? ''),
    fat_g: String(extracted.fat_g ?? ''),
    carbs_g: String(extracted.carbs_g ?? ''),
  })

  const labels: Record<keyof typeof values, string> = {
    calories: 'kcal',
    protein_g: 'protein',
    fat_g: 'fat',
    carbs_g: 'carbs',
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
          Step 2 — AI Extracted
        </div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Confirm Macros</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Review the extracted values. Tap any field to edit before confirming.
        </p>
      </div>

      <div
        className="rounded-2xl p-4 grid grid-cols-2 gap-3"
        style={{ background: 'var(--surface)', border: '1px solid #34d39930' }}
      >
        <div className="col-span-2 text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
          Extracted values · tap to edit
        </div>
        {(Object.keys(values) as Array<keyof typeof values>).map(key => (
          <div
            key={key}
            className="rounded-xl p-3 text-center"
            style={{ background: '#0f1f17', border: '1px solid #34d39940' }}
          >
            <input
              type="number"
              inputMode="decimal"
              value={values[key]}
              onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
              className="bg-transparent outline-none text-xl font-bold w-full text-center"
              style={{ color: key === 'protein_g' ? 'var(--accent)' : 'var(--text-primary)' }}
            />
            <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{labels[key]}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="py-3 rounded-xl text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          Manual entry
        </button>
        <button
          type="button"
          onClick={() => onConfirm(values)}
          className="col-span-2 py-3 rounded-xl font-bold text-sm"
          style={{ background: 'var(--accent)', color: '#0a0a0a' }}
        >
          Confirm &amp; fill form
        </button>
      </div>
    </div>
  )
}
