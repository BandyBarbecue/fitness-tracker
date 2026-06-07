'use client'
import { useNutritionForDate } from '@/lib/queries/meal-logs'
import { useTargets } from '@/lib/queries/targets'
import { pct, fmtNum } from '@/lib/utils/format'
import { format } from 'date-fns'

export function ProteinCard() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: nutrition } = useNutritionForDate(today)
  const { data: targets } = useTargets()

  const protein = nutrition?.protein_g ?? null
  const target = targets?.protein_g ?? 185
  const p = pct(protein, target)
  const label = p >= 95 ? 'great' : p >= 80 ? 'on track' : p > 0 ? 'keep going' : 'not logged'
  const labelColor = p >= 95 ? 'var(--accent)' : p >= 80 ? 'var(--amber)' : 'var(--text-muted)'

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Protein — Today
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>target {fmtNum(target)} g</span>
      </div>
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {fmtNum(protein)}<span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>g</span>
        </span>
        {p > 0 && <span className="text-xs font-semibold" style={{ color: labelColor }}>{p}% — {label}</span>}
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(p, 100)}%`, background: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}
