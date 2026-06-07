'use client'
import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useNutritionForDate } from '@/lib/queries/meal-logs'
import { useDailyLog } from '@/lib/queries/daily-logs'
import { useTargets } from '@/lib/queries/targets'
import { format } from 'date-fns'

const MACRO_COLORS = { protein: '#34d399', fat: '#f59e0b', carbs: '#60a5fa' }

interface CellProps {
  label: string
  value: string | null
  sub?: string
  href: string
  progress?: number
  progressColor?: string
  children?: React.ReactNode
}

function GlanceCell({ label, value, sub, href, progress, progressColor = 'var(--accent)', children }: CellProps) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 p-3 rounded-xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span className="text-xl font-bold tracking-tight" style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {value ?? '—'}
      </span>
      {sub && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{sub}</span>}
      {progress != null && (
        <div className="h-1 rounded-full overflow-hidden mt-1" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%`, background: progressColor }}
          />
        </div>
      )}
      {children}
    </Link>
  )
}

export function TodayGlanceCard() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: nutrition } = useNutritionForDate(today)
  const { data: log } = useDailyLog(today)
  const { data: targets } = useTargets()

  const cal = nutrition?.calories ?? null
  const calTarget = targets?.calories ?? 2400
  const steps = log?.steps ?? null
  const stepsTarget = targets?.steps ?? 10000
  const sleep = log?.sleep_hours ?? null
  const mood = log?.mood ?? null
  const protein_g = nutrition?.protein_g ?? null
  const fat_g = nutrition?.fat_g ?? null
  const carbs_g = nutrition?.carbs_g ?? null

  const hasMacros = (protein_g ?? 0) + (fat_g ?? 0) + (carbs_g ?? 0) > 0
  const pieData = [
    { name: 'Protein', value: protein_g ?? 0, color: MACRO_COLORS.protein },
    { name: 'Fat',     value: fat_g ?? 0,     color: MACRO_COLORS.fat     },
    { name: 'Carbs',   value: carbs_g ?? 0,   color: MACRO_COLORS.carbs   },
  ]

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        Today at a Glance
      </div>

      <div className="grid grid-cols-2 gap-2">
        <GlanceCell
          label="Calories"
          value={cal != null ? cal.toLocaleString() : null}
          sub={`/ ${calTarget.toLocaleString()} kcal`}
          href="/insights/calories"
          progress={cal != null ? (cal / calTarget) * 100 : undefined}
          progressColor="var(--amber)"
        />
        <GlanceCell
          label="Steps"
          value={steps != null ? steps.toLocaleString() : null}
          sub={`/ ${stepsTarget.toLocaleString()}`}
          href="/insights/steps"
          progress={steps != null ? (steps / stepsTarget) * 100 : undefined}
          progressColor="var(--sky)"
        />
        <GlanceCell
          label="Sleep"
          value={sleep != null ? `${sleep} hr` : null}
          href="/insights/sleep"
        />
        <Link
          href="/insights/mood"
          className="flex flex-col gap-1 p-3 rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Mood</span>
          <span className="text-xl font-bold tracking-tight" style={{ color: mood != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {mood != null ? `${mood}` : '—'}
            {mood != null && <span className="text-[11px] font-normal" style={{ color: 'var(--text-muted)' }}>/5</span>}
          </span>
          {mood != null && (
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: i < mood ? 'var(--accent)' : 'var(--border)' }}
                />
              ))}
            </div>
          )}
        </Link>
      </div>

      <Link
        href="/insights/macros"
        className="rounded-xl p-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', display: 'block' }}
      >
        <div className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Macros</div>
        {hasMacros ? (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={26} strokeWidth={0}>
                    {pieData.map(d => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-0.5 text-[11px]">
              {protein_g != null && <span style={{ color: MACRO_COLORS.protein }}>P {protein_g}g</span>}
              {fat_g != null && <span style={{ color: MACRO_COLORS.fat }}>F {fat_g}g</span>}
              {carbs_g != null && <span style={{ color: MACRO_COLORS.carbs }}>C {carbs_g}g</span>}
            </div>
          </div>
        ) : (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Log nutrition to see macro split</p>
        )}
      </Link>
    </div>
  )
}
