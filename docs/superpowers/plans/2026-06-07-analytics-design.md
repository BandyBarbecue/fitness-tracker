# Analytics & Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full analytics layer — enhanced AI coach stats, a new Insights tab with a metrics grid, tappable metric detail pages with charts and correlation panels, and a redesigned "Today at a Glance" dashboard card with macro pie chart.

**Architecture:** Pure-function stat utilities in `lib/queries/analytics.ts` (tested); a single `useAnalyticsForPeriod` hook feeds all analytics pages from one DB call. Navigation restructures the Photos tab into an Insights tab (Analytics + Photos sub-tabs). Dashboard, grid, and detail pages all link to the same `/insights/[metric]` routes.

**Tech Stack:** Next.js 16 App Router (await params), TanStack Query v5, Recharts (BarChart / LineChart / AreaChart / PieChart / ComposedChart), date-fns, Tailwind + CSS custom properties.

> **AGENTS.md requirement:** Read `node_modules/next/dist/docs/` before writing any Next.js-specific page or layout file.

---

### Task 1: Enhanced Coach Prompt Stats

**Goal:** Add avg sleep, avg mood, avg water, steps hit rate %, and session breakdown to `buildCheckinPrompt`, then extend the coaching instruction to cover these metrics, backed by new tests.

**Files:**
- Modify: `lib/anthropic/weekly-checkin.ts`
- Modify: `lib/anthropic/weekly-checkin.test.ts`

**Acceptance Criteria:**
- [ ] Prompt includes `Avg sleep: X hr` (or `not logged`) in Computed stats
- [ ] Prompt includes `Avg mood: X/5` (or `not logged`) in Computed stats
- [ ] Prompt includes `Avg water: X L` (or `not logged`) in Computed stats
- [ ] Prompt includes `Steps target hit rate: X%` (% of logged days meeting target)
- [ ] Prompt includes `Sessions:` breakdown (e.g. `Push ×2, Pull ×1, Rest ×1`)
- [ ] Coaching instruction lists sleep quality, mood patterns, hydration, training frequency
- [ ] All new fields are null-safe — no NaN or undefined in output
- [ ] All existing 17 tests still pass

**Verify:** `npx vitest run lib/anthropic/weekly-checkin.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Write failing tests** — append this describe block to `lib/anthropic/weekly-checkin.test.ts`:

```typescript
describe('buildCheckinPrompt — extended stats', () => {
  const extTargets = {
    calories: 2400, protein_g: 185, fat_g: 70, carbs_g: 255,
    steps: 10000, goal_rate_kg_per_week: 0.5,
    bodyweight_kg: 86, height_cm: 188,
    training_split: 'Push/Pull/Legs/Upper',
  }
  const extLogs = [
    { date: '2026-05-29', weight_kg: 86.2, calories: 2380, protein_g: 182, fat_g: 68, carbs_g: 252,
      steps: 9800, session_type: 'push', sleep_hours: 7.5, mood: 4, water_l: 2.5, note: null },
    { date: '2026-05-30', weight_kg: 86.0, calories: 2420, protein_g: 190, fat_g: 71, carbs_g: 258,
      steps: 11200, session_type: 'pull', sleep_hours: 6.0, mood: 3, water_l: 1.8, note: null },
    { date: '2026-05-31', weight_kg: 85.8, calories: 2300, protein_g: 175, fat_g: 65, carbs_g: 248,
      steps: 8900, session_type: 'rest', sleep_hours: 8.0, mood: 5, water_l: 3.0, note: null },
  ]

  it('includes avg sleep in computed stats', () => {
    // (7.5 + 6.0 + 8.0) / 3 = 7.2
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Avg sleep: 7.2 hr')
  })

  it('includes avg mood in computed stats', () => {
    // (4 + 3 + 5) / 3 = 4
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Avg mood: 4/5')
  })

  it('includes avg water in computed stats', () => {
    // (2.5 + 1.8 + 3.0) / 3 = 2.4
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Avg water: 2.4 L')
  })

  it('includes steps hit rate in computed stats', () => {
    // 9800 < 10000 (miss), 11200 >= 10000 (hit), 8900 < 10000 (miss) → 1/3 = 33%
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Steps target hit rate: 33%')
  })

  it('includes session breakdown in computed stats', () => {
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('Sessions:')
    expect(prompt).toContain('Push ×1')
    expect(prompt).toContain('Pull ×1')
    expect(prompt).toContain('Rest ×1')
  })

  it('extends coaching instruction to include sleep/mood/hydration/training frequency', () => {
    const prompt = buildCheckinPrompt(extTargets, extLogs)
    expect(prompt).toContain('sleep quality and trends')
    expect(prompt).toContain('mood patterns')
    expect(prompt).toContain('hydration')
    expect(prompt).toContain('training frequency')
  })

  it('handles null sleep/mood/water gracefully', () => {
    const nullLogs = extLogs.map(l => ({ ...l, sleep_hours: null, mood: null, water_l: null }))
    const prompt = buildCheckinPrompt(extTargets, nullLogs)
    expect(prompt).toContain('Avg sleep: not logged')
    expect(prompt).toContain('Avg mood: not logged')
    expect(prompt).toContain('Avg water: not logged')
    expect(prompt).not.toMatch(/NaN|undefined/)
  })
})
```

- [ ] **Step 2: Run tests to verify failures**

Run: `npx vitest run lib/anthropic/weekly-checkin.test.ts`
Expected: 7 new tests FAIL, existing 17 PASS (24 total, 7 fail)

- [ ] **Step 3: Add computed variables to `buildCheckinPrompt`** in `lib/anthropic/weekly-checkin.ts` — insert after the existing `weeklyDelta`/`trendDir` block (around line 80) and before the `table` definition:

```typescript
  const sleepLogged = logs.filter(l => l.sleep_hours != null)
  const avgSleep = sleepLogged.length > 0
    ? Math.round(sleepLogged.reduce((s, l) => s + l.sleep_hours!, 0) / sleepLogged.length * 10) / 10
    : null

  const moodLogged = logs.filter(l => l.mood != null)
  const avgMood = moodLogged.length > 0
    ? Math.round(moodLogged.reduce((s, l) => s + l.mood!, 0) / moodLogged.length * 10) / 10
    : null

  const waterLogged = logs.filter(l => l.water_l != null)
  const avgWater = waterLogged.length > 0
    ? Math.round(waterLogged.reduce((s, l) => s + l.water_l!, 0) / waterLogged.length * 10) / 10
    : null

  const stepsLoggedRows = logs.filter(l => l.steps != null)
  const stepsHits = stepsLoggedRows.filter(l => l.steps! >= targets.steps).length
  const stepsHitRate = stepsLoggedRows.length > 0
    ? Math.round(stepsHits / stepsLoggedRows.length * 100)
    : 0

  const SESSION_LABELS_SHORT: Record<string, string> = {
    push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', rest: 'Rest', cardio: 'Cardio',
  }
  const sessionCounts: Record<string, number> = {}
  for (const l of logs) {
    if (l.session_type) sessionCounts[l.session_type] = (sessionCounts[l.session_type] ?? 0) + 1
  }
  const sessionBreakdown = Object.entries(sessionCounts)
    .map(([t, n]) => `${SESSION_LABELS_SHORT[t] ?? t} ×${n}`)
    .join(', ') || 'none logged'
```

- [ ] **Step 4: Update the Computed stats block in the prompt template** — replace:

```typescript
Computed stats:
- Recent avg weight: ${Math.round(recentAvg * 10) / 10} kg (7-day trend: ${trendDir}, ${weeklyDelta > 0 ? '+' : ''}${weeklyDelta} kg)
- Protein target hit rate: ${proteinHitRate}% of logged days
- Days logged: ${logs.length}${mealDistributionBlock}
```

with:

```typescript
Computed stats:
- Recent avg weight: ${Math.round(recentAvg * 10) / 10} kg (7-day trend: ${trendDir}, ${weeklyDelta > 0 ? '+' : ''}${weeklyDelta} kg)
- Protein target hit rate: ${proteinHitRate}% of logged days
- Steps target hit rate: ${stepsHitRate}% of logged days
- Avg sleep: ${avgSleep != null ? `${avgSleep} hr` : 'not logged'}
- Avg mood: ${avgMood != null ? `${avgMood}/5` : 'not logged'}
- Avg water: ${avgWater != null ? `${avgWater} L` : 'not logged'}
- Sessions: ${sessionBreakdown}
- Days logged: ${logs.length}${mealDistributionBlock}
```

- [ ] **Step 5: Extend the coaching instruction** — replace the closing sentence:

```typescript
Write a concise coaching summary in 3–5 short paragraphs. Cover: weight trend vs goal rate, protein adherence${coverageNote}, what's going well, one specific actionable focus for this week. Be direct. No bullet points. No sign-off.`
```

with:

```typescript
Write a concise coaching summary in 3–5 short paragraphs. Cover: weight trend vs goal rate, protein adherence${coverageNote}, sleep quality and trends, mood patterns, hydration, and training frequency — and whether any of these correlate with weight or energy patterns in the data, what's going well, one specific actionable focus for this week. Be direct. No bullet points. No sign-off.`
```

- [ ] **Step 6: Run tests to verify all pass**

Run: `npx vitest run lib/anthropic/weekly-checkin.test.ts`
Expected: 24 tests PASS, 0 fail

- [ ] **Step 7: Commit**

```bash
git add lib/anthropic/weekly-checkin.ts lib/anthropic/weekly-checkin.test.ts
git commit -m "feat: add sleep/mood/water/steps/sessions computed stats to coach prompt"
```

---

### Task 2: Analytics Query Hooks & Stat Utilities

**Goal:** Create the shared data layer for all analytics pages — a Supabase query hook, a meal-logs period hook, and pure stat utilities (average, hit rate, trend arrow, sparkline, period bounds), all TDD'd.

**Files:**
- Create: `lib/queries/analytics.ts`
- Create: `lib/queries/analytics.test.ts`

**Acceptance Criteria:**
- [ ] `periodBounds(7, '2026-06-07')` → `{ startDate: '2026-06-01', endDate: '2026-06-07' }`
- [ ] `previousPeriodBounds(7, '2026-06-07')` → `{ startDate: '2026-05-25', endDate: '2026-05-31' }`
- [ ] `avgOf([1, null, 3])` → `2`, `avgOf([])` → `null`
- [ ] `hitRate([8, null, 12], 10)` → `50` (one of two non-null values meets target)
- [ ] `trendArrow([1, 1, 1, 1])` → `'→'`, `[1, 1, 2, 2]` → `'↑'`, `[2, 2, 1, 1]` → `'↓'`
- [ ] `sparklineValues([1,2,3,4,5,6,7,8,9], 7)` → `[3,4,5,6,7,8,9]` (last 7)
- [ ] `useAnalyticsForPeriod` uses query key `['daily-logs', 'analytics', startDate, endDate]`
- [ ] `useMealLogsForPeriod` uses query key `['meal-logs', 'analytics', startDate, endDate]`
- [ ] All tests pass; `npm run build` compiles cleanly

**Verify:** `npx vitest run lib/queries/analytics.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Write the test file** — create `lib/queries/analytics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  periodBounds, previousPeriodBounds,
  avgOf, hitRate, trendArrow, sparklineValues,
} from './analytics'

describe('periodBounds', () => {
  it('returns correct 7-day window', () => {
    expect(periodBounds(7, '2026-06-07')).toEqual({ startDate: '2026-06-01', endDate: '2026-06-07' })
  })
  it('returns correct 30-day window', () => {
    expect(periodBounds(30, '2026-06-07')).toEqual({ startDate: '2026-05-09', endDate: '2026-06-07' })
  })
  it('returns correct 90-day window', () => {
    expect(periodBounds(90, '2026-06-07')).toEqual({ startDate: '2026-03-09', endDate: '2026-06-07' })
  })
})

describe('previousPeriodBounds', () => {
  it('returns the 7-day window immediately before the current one', () => {
    // current: Jun 1–7 → previous: May 25–31
    expect(previousPeriodBounds(7, '2026-06-07')).toEqual({ startDate: '2026-05-25', endDate: '2026-05-31' })
  })
  it('returns the 30-day window immediately before the current one', () => {
    // current: May 9–Jun 7 → previous: Apr 9–May 8
    expect(previousPeriodBounds(30, '2026-06-07')).toEqual({ startDate: '2026-04-09', endDate: '2026-05-08' })
  })
})

describe('avgOf', () => {
  it('averages non-null values', () => {
    expect(avgOf([1, 2, 3])).toBe(2)
  })
  it('ignores null values', () => {
    expect(avgOf([1, null, 3])).toBe(2)
  })
  it('returns null for empty array', () => {
    expect(avgOf([])).toBeNull()
  })
  it('returns null when all values are null', () => {
    expect(avgOf([null, null])).toBeNull()
  })
  it('rounds to one decimal place', () => {
    // (1 + 2) / 3 = 1.0 (not 0.666) — actually (1+2)/2 = 1.5
    expect(avgOf([1, 2])).toBe(1.5)
    // (7.5 + 6.0 + 8.0) / 3 = 7.166... → 7.2
    expect(avgOf([7.5, 6.0, 8.0])).toBe(7.2)
  })
})

describe('hitRate', () => {
  it('returns correct percentage of logged values meeting target', () => {
    // 8 < 10 (miss), 12 >= 10 (hit) → 1/2 = 50%
    expect(hitRate([8, null, 12], 10)).toBe(50)
  })
  it('returns 0 when no logged values', () => {
    expect(hitRate([null, null], 10)).toBe(0)
  })
  it('returns 100 when all values meet target', () => {
    expect(hitRate([10, 11, 12], 10)).toBe(100)
  })
  it('returns 0 when no values meet target', () => {
    expect(hitRate([1, 2, 3], 10)).toBe(0)
  })
})

describe('trendArrow', () => {
  it('returns → for flat data', () => {
    expect(trendArrow([2, 2, 2, 2])).toBe('→')
  })
  it('returns ↑ when second half average exceeds first half', () => {
    expect(trendArrow([1, 1, 2, 2])).toBe('↑')
  })
  it('returns ↓ when second half average is below first half', () => {
    expect(trendArrow([2, 2, 1, 1])).toBe('↓')
  })
  it('returns → for single value', () => {
    expect(trendArrow([5])).toBe('→')
  })
  it('ignores null values', () => {
    expect(trendArrow([1, null, 2, 2])).toBe('↑')
  })
})

describe('sparklineValues', () => {
  it('returns last N values', () => {
    expect(sparklineValues([1, 2, 3, 4, 5, 6, 7, 8, 9], 7)).toEqual([3, 4, 5, 6, 7, 8, 9])
  })
  it('returns all values when fewer than N', () => {
    expect(sparklineValues([1, 2, 3], 7)).toEqual([1, 2, 3])
  })
  it('maps null to null', () => {
    expect(sparklineValues([1, null, 3], 7)).toEqual([1, null, 3])
  })
})
```

- [ ] **Step 2: Run tests to verify failures**

Run: `npx vitest run lib/queries/analytics.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `lib/queries/analytics.ts`**:

```typescript
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { subDays, format, parseISO } from 'date-fns'
import type { Database } from '@/types/database'

export type DailyLogAnalytics = Database['public']['Tables']['daily_logs']['Row']
export type MealLogAnalytics = Database['public']['Tables']['meal_logs']['Row']

export function periodBounds(days: 7 | 30 | 90, today: string): { startDate: string; endDate: string } {
  return {
    startDate: format(subDays(parseISO(today), days - 1), 'yyyy-MM-dd'),
    endDate: today,
  }
}

export function previousPeriodBounds(days: 7 | 30 | 90, today: string): { startDate: string; endDate: string } {
  const prevEnd = format(subDays(parseISO(today), days), 'yyyy-MM-dd')
  return {
    startDate: format(subDays(parseISO(prevEnd), days - 1), 'yyyy-MM-dd'),
    endDate: prevEnd,
  }
}

export function avgOf(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null)
  if (valid.length === 0) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length * 10) / 10
}

export function hitRate(values: (number | null | undefined)[], target: number): number {
  const logged = values.filter((v): v is number => v != null)
  if (logged.length === 0) return 0
  return Math.round(logged.filter(v => v >= target).length / logged.length * 100)
}

export function trendArrow(data: (number | null | undefined)[]): '↑' | '↓' | '→' {
  const valid = data.filter((v): v is number => v != null)
  if (valid.length < 2) return '→'
  const mid = Math.floor(valid.length / 2)
  const firstAvg = valid.slice(0, mid).reduce((a, b) => a + b, 0) / mid
  const secondAvg = valid.slice(mid).reduce((a, b) => a + b, 0) / (valid.length - mid)
  const delta = secondAvg - firstAvg
  if (Math.abs(delta) < 0.01 * Math.abs(firstAvg || 1)) return '→'
  return delta > 0 ? '↑' : '↓'
}

export function sparklineValues(data: (number | null | undefined)[], count = 7): (number | null)[] {
  return data.slice(-count).map(v => v ?? null)
}

export function useAnalyticsForPeriod(startDate: string, endDate: string) {
  return useQuery<DailyLogAnalytics[]>({
    queryKey: ['daily-logs', 'analytics', startDate, endDate],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as DailyLogAnalytics[]
    },
  })
}

export function useMealLogsForPeriod(startDate: string, endDate: string) {
  return useQuery<MealLogAnalytics[]>({
    queryKey: ['meal-logs', 'analytics', startDate, endDate],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as MealLogAnalytics[]
    },
  })
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run lib/queries/analytics.test.ts`
Expected: all 20 tests PASS

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add lib/queries/analytics.ts lib/queries/analytics.test.ts
git commit -m "feat: add analytics query hooks and stat utilities"
```

---

### Task 3: Navigation Restructure & Photos Move

**Goal:** Rename the Photos nav tab to Insights (href `/insights`), redirect `/photos` → `/insights/photos`, move the photos page, and create the `InsightsSubTabs` sub-tab strip component.

**Files:**
- Modify: `components/nav/tabs.ts`
- Modify: `app/(app)/photos/page.tsx` (becomes redirect)
- Create: `app/(app)/insights/photos/page.tsx`
- Create: `components/analytics/insights-sub-tabs.tsx`

**Acceptance Criteria:**
- [ ] Nav tab 3 shows "Insights" with `TrendingUp` icon, href `/insights`
- [ ] `GET /photos` returns a redirect to `/insights/photos`
- [ ] `GET /insights/photos` renders the photo gallery
- [ ] `InsightsSubTabs` shows "Analytics" and "Photos" pills; active style applied to the current sub-tab
- [ ] All existing tests still pass; `npm run build` compiles

**Verify:** `npm run build` → compiles; manual check: nav shows Insights tab, `/photos` redirects, gallery visible at `/insights/photos`

**Steps:**

> **Before writing any Next.js page file:** Read `node_modules/next/dist/docs/` — specifically the routing and redirect sections — to confirm the `redirect()` API for this version.

- [ ] **Step 1: Update the nav** — replace `components/nav/tabs.ts` in full:

```typescript
import { BarChart2, PenLine, TrendingUp, Bot, Settings, type LucideIcon } from 'lucide-react'

export type Tab = { href: string; label: string; Icon: LucideIcon }

export const tabs: Tab[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: BarChart2 },
  { href: '/log',       label: 'Log',       Icon: PenLine    },
  { href: '/insights',  label: 'Insights',  Icon: TrendingUp },
  { href: '/check-in',  label: 'Coach',     Icon: Bot        },
  { href: '/settings',  label: 'Settings',  Icon: Settings   },
]

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}
```

- [ ] **Step 2: Replace `app/(app)/photos/page.tsx` with a redirect** — write the file in full:

```tsx
import { redirect } from 'next/navigation'

export default function PhotosPage() {
  redirect('/insights/photos')
}
```

- [ ] **Step 3: Create `app/(app)/insights/photos/page.tsx`**:

```tsx
import { InsightsSubTabs } from '@/components/analytics/insights-sub-tabs'
import { PhotoGallery } from '@/components/photos/photo-gallery'

export default function InsightsPhotosPage() {
  return (
    <div>
      <InsightsSubTabs />
      <PhotoGallery />
    </div>
  )
}
```

- [ ] **Step 4: Create `components/analytics/insights-sub-tabs.tsx`**:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function SubTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="flex-1 text-center py-2.5 text-xs font-semibold transition-colors"
      style={{
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
      }}
    >
      {label}
    </Link>
  )
}

export function InsightsSubTabs() {
  const pathname = usePathname()
  return (
    <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
      <SubTab href="/insights" label="Analytics" active={pathname === '/insights'} />
      <SubTab href="/insights/photos" label="Photos" active={pathname.startsWith('/insights/photos')} />
    </div>
  )
}
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: compiles cleanly

- [ ] **Step 6: Commit**

```bash
git add components/nav/tabs.ts app/\(app\)/photos/page.tsx \
        app/\(app\)/insights/photos/page.tsx \
        components/analytics/insights-sub-tabs.tsx
git commit -m "feat: restructure nav — Photos tab becomes Insights with sub-tabs"
```

---

### Task 4: TodayGlanceCard Dashboard

**Goal:** Replace `DashboardMetrics` (2-cell Calories/Steps card) with `TodayGlanceCard` — a 4-cell grid (Calories, Steps, Sleep, Mood) where each cell links to its analytics detail page, plus a macro pie chart row linking to `/insights/macros`.

**Files:**
- Create: `components/dashboard/today-glance-card.tsx`
- Modify: `app/(app)/dashboard/page.tsx`
- Delete: `app/(app)/dashboard/dashboard-metrics.tsx` (no longer imported anywhere)

**Acceptance Criteria:**
- [ ] Dashboard shows Calories, Steps, Sleep, Mood cells in a 2×2 grid
- [ ] Calories and Steps cells have a progress bar vs their targets
- [ ] Mood cell shows a 5-dot indicator
- [ ] Bottom macro row renders a `PieChart` with protein/fat/carbs when any macro is logged; shows fallback text when none logged
- [ ] Each cell and the macro row are `Link` components navigating to the correct `/insights/[metric]` route
- [ ] Unlogged metrics show `—` rather than 0 or NaN
- [ ] Build compiles; no TypeScript errors

**Verify:** `npm run build` → compiles; `npm run dev` → dashboard shows the new card

**Steps:**

> **Before writing any Next.js page file:** Read `node_modules/next/dist/docs/` to confirm Link and client component patterns for this version.

- [ ] **Step 1: Create `components/dashboard/today-glance-card.tsx`**:

```tsx
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
```

- [ ] **Step 2: Update `app/(app)/dashboard/page.tsx`** — replace the `DashboardMetrics` import and usage:

```tsx
import { WeightChart } from '@/components/dashboard/weight-chart'
import { ProteinCard } from '@/components/dashboard/protein-card'
import { StreakRow } from '@/components/dashboard/streak-row'
import { TodayGlanceCard } from '@/components/dashboard/today-glance-card'

export default function DashboardPage() {
  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-3">
      <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
      <div className="animate-fade-in-up animate-stagger-1"><WeightChart /></div>
      <div className="animate-fade-in-up animate-stagger-2"><ProteinCard /></div>
      <div className="animate-fade-in-up animate-stagger-3"><TodayGlanceCard /></div>
      <div className="animate-fade-in-up animate-stagger-4"><StreakRow /></div>
    </div>
  )
}
```

- [ ] **Step 3: Delete `app/(app)/dashboard/dashboard-metrics.tsx`** — it is no longer imported anywhere. Confirm with `grep -r "dashboard-metrics" .` before deleting (expected: 0 results after Step 2).

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/today-glance-card.tsx \
        app/\(app\)/dashboard/page.tsx
git rm app/\(app\)/dashboard/dashboard-metrics.tsx
git commit -m "feat: replace DashboardMetrics with TodayGlanceCard incl macro pie chart"
```

---

### Task 5: Analytics Grid Page & Components

**Goal:** Build the `/insights` page: a period selector (7d/30d/90d), 9 `MetricSquare` components organized by section, each with sparkline and trend arrow, linking to their detail pages. Data comes from one `useAnalyticsForPeriod` call.

**Files:**
- Create: `components/analytics/period-selector.tsx`
- Create: `components/analytics/metric-square.tsx`
- Create: `app/(app)/insights/page.tsx`

**Acceptance Criteria:**
- [ ] Period selector shows 7d / 30d / 90d pills; active pill has accent style; switching period re-fetches data
- [ ] 9 metric squares render in 4 sections (Body, Nutrition, Activity, Wellbeing)
- [ ] Each square shows label, emoji icon, primary stat, 7-bar sparkline, trend arrow
- [ ] Squares show a shimmer skeleton while `isLoading`
- [ ] Tapping a square navigates to `/insights/[slug]`
- [ ] InsightsSubTabs sub-tab strip appears at the top with Analytics active
- [ ] Build compiles

**Verify:** `npm run build` → compiles; `npm run dev` → navigate to Insights tab, all squares render

**Steps:**

> **Before writing the page file:** Read `node_modules/next/dist/docs/` — confirm `'use client'` page pattern for this version of Next.js.

- [ ] **Step 1: Create `components/analytics/period-selector.tsx`**:

```tsx
'use client'

export type Period = 7 | 30 | 90

interface Props {
  value: Period
  onChange: (p: Period) => void
}

const OPTIONS: Period[] = [7, 30, 90]

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map(opt => {
        const active = value === opt
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
            style={{
              background: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface)',
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--border)'}`,
            }}
          >
            {opt}d
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/analytics/metric-square.tsx`**:

```tsx
'use client'
import Link from 'next/link'

export type MetricSlug =
  | 'weight' | 'calories' | 'protein' | 'macros'
  | 'steps' | 'sessions' | 'sleep' | 'mood' | 'water'

interface Props {
  slug: MetricSlug
  label: string
  icon: string
  stat: string | null
  sparkValues: (number | null)[]
  trend: '↑' | '↓' | '→'
  color: string
}

function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const nonNull = values.filter((v): v is number => v != null)
  const max = nonNull.length > 0 ? Math.max(...nonNull) : 1
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: v != null ? `${Math.max((v / max) * 100, 6)}%` : '6%',
            background: v != null ? color : 'var(--border)',
            opacity: v != null ? 0.65 : 0.25,
          }}
        />
      ))}
    </div>
  )
}

export function MetricSquare({ slug, label, icon, stat, sparkValues, trend, color }: Props) {
  const trendColor = trend === '↑' ? 'var(--accent)' : trend === '↓' ? 'var(--destructive)' : 'var(--text-muted)'

  return (
    <Link
      href={`/insights/${slug}`}
      className="rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {icon} {label}
        </span>
        <span className="text-sm font-bold" style={{ color: trendColor }}>{trend}</span>
      </div>
      <div className="text-xl font-bold tracking-tight" style={{ color: stat ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {stat ?? '—'}
      </div>
      <Sparkline values={sparkValues} color={color} />
    </Link>
  )
}
```

- [ ] **Step 3: Create `app/(app)/insights/page.tsx`**:

```tsx
'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { InsightsSubTabs } from '@/components/analytics/insights-sub-tabs'
import { PeriodSelector, type Period } from '@/components/analytics/period-selector'
import { MetricSquare, type MetricSlug } from '@/components/analytics/metric-square'
import {
  useAnalyticsForPeriod, useMealLogsForPeriod,
  periodBounds, avgOf, hitRate, trendArrow, sparklineValues,
} from '@/lib/queries/analytics'
import { useTargets } from '@/lib/queries/targets'

const SECTIONS = [
  { key: 'body',      label: 'Body'      },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'activity',  label: 'Activity'  },
  { key: 'wellbeing', label: 'Wellbeing' },
] as const

type SectionKey = typeof SECTIONS[number]['key']

interface SquareDef {
  slug: MetricSlug
  label: string
  icon: string
  section: SectionKey
  color: string
}

const SQUARE_DEFS: SquareDef[] = [
  { slug: 'weight',   label: 'Weight',  icon: '⚖️',  section: 'body',      color: '#34d399' },
  { slug: 'calories', label: 'Calories',icon: '🔥',  section: 'nutrition', color: '#f59e0b' },
  { slug: 'protein',  label: 'Protein', icon: '🥩',  section: 'nutrition', color: '#34d399' },
  { slug: 'macros',   label: 'Macros',  icon: '🥧',  section: 'nutrition', color: '#a78bfa' },
  { slug: 'steps',    label: 'Steps',   icon: '👟',  section: 'activity',  color: '#60a5fa' },
  { slug: 'sessions', label: 'Sessions',icon: '🏋️', section: 'activity',  color: '#c084fc' },
  { slug: 'sleep',    label: 'Sleep',   icon: '😴',  section: 'wellbeing', color: '#a78bfa' },
  { slug: 'mood',     label: 'Mood',    icon: '😊',  section: 'wellbeing', color: '#f59e0b' },
  { slug: 'water',    label: 'Water',   icon: '💧',  section: 'wellbeing', color: '#60a5fa' },
]

export default function InsightsPage() {
  const [period, setPeriod] = useState<Period>(30)
  const today = format(new Date(), 'yyyy-MM-dd')
  const { startDate, endDate } = periodBounds(period, today)

  const { data: logs = [], isLoading } = useAnalyticsForPeriod(startDate, endDate)
  const { data: mealLogs = [] } = useMealLogsForPeriod(startDate, endDate)
  const { data: targets } = useTargets()

  const weights   = logs.map(l => l.weight_kg)
  const calories  = logs.map(l => l.calories)
  const proteins  = logs.map(l => l.protein_g)
  const steps     = logs.map(l => l.steps)
  const sleeps    = logs.map(l => l.sleep_hours)
  const moods     = logs.map(l => l.mood)
  const waters    = logs.map(l => l.water_l)
  const sessionBinary = logs.map(l =>
    l.session_type ? (l.session_type !== 'rest' ? 1 : 0) : null
  )

  // Macro protein % — prefer meal logs when available
  const macroSource = mealLogs.length > 0
    ? mealLogs.map(m => ({ calories: m.calories, protein_g: m.protein_g }))
    : logs.map(l => ({ calories: l.calories, protein_g: l.protein_g }))
  const totalKcal   = macroSource.reduce((s, m) => s + (m.calories ?? 0), 0)
  const proteinKcal = macroSource.reduce((s, m) => s + ((m.protein_g ?? 0) * 4), 0)
  const avgProteinPct = totalKcal > 0 ? Math.round(proteinKcal / totalKcal * 100) : null

  // Session type breakdown string
  const sessionCounts = logs.reduce<Record<string, number>>((acc, l) => {
    if (l.session_type) acc[l.session_type] = (acc[l.session_type] ?? 0) + 1
    return acc
  }, {})
  const SESSION_SHORT: Record<string, string> = { push: 'Pu', pull: 'Pl', legs: 'L', upper: 'U', rest: 'R', cardio: 'C' }
  const sessionStat = Object.entries(sessionCounts)
    .filter(([t]) => t !== 'rest')
    .map(([t, n]) => `${n}${SESSION_SHORT[t] ?? t}`)
    .join(' ') || null

  const avgWeight   = avgOf(weights)
  const avgCalories = avgOf(calories)
  const avgSteps    = avgOf(steps)
  const avgSleep    = avgOf(sleeps)
  const avgMood     = avgOf(moods)
  const avgWater    = avgOf(waters)

  function getStat(slug: MetricSlug): string | null {
    switch (slug) {
      case 'weight':   return avgWeight != null ? `${avgWeight} kg` : null
      case 'calories': return avgCalories != null ? `${Math.round(avgCalories)} kcal` : null
      case 'protein':  return targets ? `${hitRate(proteins, targets.protein_g)}% hit` : null
      case 'macros':   return avgProteinPct != null ? `${avgProteinPct}% P` : null
      case 'steps':    return avgSteps != null ? Math.round(avgSteps).toLocaleString() : null
      case 'sessions': return sessionStat
      case 'sleep':    return avgSleep != null ? `${avgSleep} hr` : null
      case 'mood':     return avgMood != null ? `${avgMood}/5` : null
      case 'water':    return avgWater != null ? `${avgWater} L` : null
    }
  }

  function getSparkValues(slug: MetricSlug): (number | null)[] {
    switch (slug) {
      case 'weight':   return sparklineValues(weights)
      case 'calories': return sparklineValues(calories)
      case 'protein':  return sparklineValues(proteins)
      case 'macros':   return sparklineValues(macroSource.map(m => {
        const total = m.calories ?? 0
        const prot = m.protein_g ?? 0
        return total > 0 ? Math.round((prot * 4) / total * 100) : null
      }))
      case 'steps':    return sparklineValues(steps)
      case 'sessions': return sparklineValues(sessionBinary)
      case 'sleep':    return sparklineValues(sleeps)
      case 'mood':     return sparklineValues(moods)
      case 'water':    return sparklineValues(waters)
    }
  }

  function getTrend(slug: MetricSlug): '↑' | '↓' | '→' {
    switch (slug) {
      case 'weight':   return trendArrow(weights)
      case 'calories': return trendArrow(calories)
      case 'protein':  return trendArrow(proteins)
      case 'macros':   return '→'
      case 'steps':    return trendArrow(steps)
      case 'sessions': return trendArrow(sessionBinary)
      case 'sleep':    return trendArrow(sleeps)
      case 'mood':     return trendArrow(moods)
      case 'water':    return trendArrow(waters)
    }
  }

  return (
    <div className="pb-8 max-w-lg mx-auto">
      <InsightsSubTabs />
      <div className="px-4 pt-4 flex flex-col gap-4">
        <PeriodSelector value={period} onChange={setPeriod} />

        {SECTIONS.map(section => {
          const sectionDefs = SQUARE_DEFS.filter(d => d.section === section.key)
          return (
            <div key={section.key}>
              <div
                className="text-[9px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                {section.label}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {sectionDefs.map(def =>
                  isLoading ? (
                    <div
                      key={def.slug}
                      className="rounded-2xl h-28 animate-pulse"
                      style={{ background: 'var(--surface)' }}
                    />
                  ) : (
                    <MetricSquare
                      key={def.slug}
                      slug={def.slug}
                      label={def.label}
                      icon={def.icon}
                      color={def.color}
                      stat={getStat(def.slug)}
                      sparkValues={getSparkValues(def.slug)}
                      trend={getTrend(def.slug)}
                    />
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add components/analytics/period-selector.tsx \
        components/analytics/metric-square.tsx \
        app/\(app\)/insights/page.tsx
git commit -m "feat: analytics grid page with MetricSquare, sparklines, and period selector"
```

---

### Task 6: Metric Detail Pages

**Goal:** Build `/insights/[metric]` — a server shell that validates the slug, delegating to a client component that shows period selector, hero stat + delta vs previous period, full Recharts chart per metric type, stats chips, and a CorrelationPanel.

**Files:**
- Create: `components/analytics/metric-config.ts`
- Create: `components/analytics/detail-chart.tsx`
- Create: `components/analytics/correlation-panel.tsx`
- Create: `components/analytics/metric-detail-client.tsx`
- Create: `app/(app)/insights/[metric]/page.tsx`

**Acceptance Criteria:**
- [ ] Unknown slugs redirect server-side to `/insights`
- [ ] Period selector defaults to 30d, switches chart + stats on change
- [ ] Hero stat shows avg for period + delta string vs previous period (e.g. `↑ 0.4 hr vs previous 30d`)
- [ ] Primary chart renders correct Recharts chart type per metric (see spec §4)
- [ ] Stats chips show: avg, best, worst, and either hit-rate % (when target exists) or days logged
- [ ] CorrelationPanel renders a dual-axis `ComposedChart` (Bar primary + Line secondary) with a link to the correlated metric
- [ ] "No data logged for this period" empty state when no rows returned
- [ ] All 9 slugs render without TypeScript error; build compiles

**Verify:** `npm run build` → compiles; `npm run dev` → tap each MetricSquare on the grid, all 9 detail pages render with chart and correlation panel

**Steps:**

> **Before writing any Next.js page file:** Read `node_modules/next/dist/docs/` — confirm `params: Promise<{ metric: string }>` and `await params` pattern for dynamic segments in this version.

- [ ] **Step 1: Create `components/analytics/metric-config.ts`**:

```typescript
import type { DailyLogAnalytics } from '@/lib/queries/analytics'

export const VALID_SLUGS = [
  'weight', 'calories', 'protein', 'macros',
  'steps', 'sessions', 'sleep', 'mood', 'water',
] as const
export type MetricSlug = typeof VALID_SLUGS[number]

export interface MetricConfig {
  label: string
  unit: string
  color: string
  section: 'body' | 'nutrition' | 'activity' | 'wellbeing'
  getValue: (row: DailyLogAnalytics) => number | null
  formatStat: (v: number) => string
  correlatesWith: MetricSlug
}

export const METRIC_CONFIG: Record<MetricSlug, MetricConfig> = {
  weight: {
    label: 'Weight', unit: 'kg', color: '#34d399', section: 'body',
    getValue: r => r.weight_kg,
    formatStat: v => `${Math.round(v * 10) / 10} kg`,
    correlatesWith: 'calories',
  },
  calories: {
    label: 'Calories', unit: 'kcal', color: '#f59e0b', section: 'nutrition',
    getValue: r => r.calories,
    formatStat: v => `${Math.round(v)} kcal`,
    correlatesWith: 'weight',
  },
  protein: {
    label: 'Protein', unit: 'g', color: '#34d399', section: 'nutrition',
    getValue: r => r.protein_g,
    formatStat: v => `${Math.round(v)}g`,
    correlatesWith: 'weight',
  },
  macros: {
    label: 'Macro Split', unit: '%P', color: '#a78bfa', section: 'nutrition',
    getValue: r => {
      const total = r.calories
      const prot = r.protein_g
      if (!total || !prot) return null
      return Math.round((prot * 4) / total * 100)
    },
    formatStat: v => `${v}% protein`,
    correlatesWith: 'protein',
  },
  steps: {
    label: 'Steps', unit: 'steps', color: '#60a5fa', section: 'activity',
    getValue: r => r.steps,
    formatStat: v => Math.round(v).toLocaleString(),
    correlatesWith: 'weight',
  },
  sessions: {
    label: 'Sessions', unit: '', color: '#c084fc', section: 'activity',
    getValue: r => r.session_type ? (r.session_type !== 'rest' ? 1 : 0) : null,
    formatStat: v => `${v} training day${v !== 1 ? 's' : ''}`,
    correlatesWith: 'mood',
  },
  sleep: {
    label: 'Sleep', unit: 'hr', color: '#a78bfa', section: 'wellbeing',
    getValue: r => r.sleep_hours,
    formatStat: v => `${Math.round(v * 10) / 10} hr`,
    correlatesWith: 'mood',
  },
  mood: {
    label: 'Mood', unit: '/5', color: '#f59e0b', section: 'wellbeing',
    getValue: r => r.mood,
    formatStat: v => `${Math.round(v * 10) / 10}/5`,
    correlatesWith: 'sleep',
  },
  water: {
    label: 'Water', unit: 'L', color: '#60a5fa', section: 'wellbeing',
    getValue: r => r.water_l,
    formatStat: v => `${Math.round(v * 10) / 10}L`,
    correlatesWith: 'mood',
  },
}
```

- [ ] **Step 2: Create `components/analytics/detail-chart.tsx`**:

```tsx
'use client'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import type { DailyLogAnalytics } from '@/lib/queries/analytics'
import type { MetricSlug } from './metric-config'

interface Props {
  slug: MetricSlug
  data: DailyLogAnalytics[]
  target?: number | null
}

const TOOLTIP_STYLE = { background: '#141414', border: '1px solid #1f1f1f', borderRadius: 8, fontSize: 11 }
const xFmt = (d: string) => format(parseISO(d), 'MMM d')

export function DetailChart({ slug, data, target }: Props) {
  if (slug === 'weight') {
    const chartData = data.map(r => ({ date: r.date, weight: r.weight_kg }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="weight" stroke="#34d399" dot={{ r: 2 }} strokeWidth={1.5} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (slug === 'protein') {
    const chartData = data.map(r => ({
      date: r.date,
      value: r.protein_g,
      hit: target != null && r.protein_g != null && r.protein_g >= target,
    }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis tick={{ fontSize: 10, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {target != null && <ReferenceLine y={target} stroke="#525252" strokeDasharray="4 4" />}
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.hit ? '#34d399' : '#2a2a2a'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (slug === 'macros') {
    const chartData = data.map(r => {
      const total = r.calories ?? 0
      if (total === 0) return { date: r.date, protein: null, fat: null, carbs: null }
      return {
        date: r.date,
        protein: Math.round(((r.protein_g ?? 0) * 4 / total) * 100),
        fat:     Math.round(((r.fat_g ?? 0) * 9 / total) * 100),
        carbs:   Math.round(((r.carbs_g ?? 0) * 4 / total) * 100),
      }
    })
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis tick={{ fontSize: 10, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="protein" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.45} />
          <Area type="monotone" dataKey="fat"     stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.45} />
          <Area type="monotone" dataKey="carbs"   stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.45} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  if (slug === 'sessions') {
    const SESSION_COLORS: Record<string, string> = {
      push: '#34d399', pull: '#60a5fa', legs: '#a78bfa',
      upper: '#f59e0b', cardio: '#f97316', rest: '#2a2a2a',
    }
    const allTypes = [...new Set(data.map(r => r.session_type).filter(Boolean))] as string[]
    const chartData = data.map(r => {
      const row: Record<string, string | number | null> = { date: r.date }
      for (const t of allTypes) row[t] = r.session_type === t ? 1 : 0
      return row
    })
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis hide />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {allTypes.map(t => (
            <Bar key={t} dataKey={t} stackId="a" fill={SESSION_COLORS[t] ?? '#525252'} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  if (slug === 'mood') {
    const moodColor = (v: number) => v <= 2 ? '#ef4444' : v === 3 ? '#f59e0b' : '#34d399'
    const chartData = data.map(r => ({ date: r.date, value: r.mood }))
    return (
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
          <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.value != null ? moodColor(entry.value) : '#2a2a2a'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // Default bar chart: calories, steps, sleep, water
  const FIELD_MAP: Partial<Record<MetricSlug, keyof DailyLogAnalytics>> = {
    calories: 'calories',
    steps:    'steps',
    sleep:    'sleep_hours',
    water:    'water_l',
  }
  const CHART_COLOR: Partial<Record<MetricSlug, string>> = {
    calories: '#f59e0b', steps: '#60a5fa', sleep: '#a78bfa', water: '#60a5fa',
  }
  const field = FIELD_MAP[slug] ?? 'calories'
  const barColor = CHART_COLOR[slug] ?? '#34d399'
  const chartData = data.map(r => ({ date: r.date, value: r[field] as number | null }))
  const nonNull = chartData.filter(r => r.value != null).map(r => r.value!)
  const avg = nonNull.length > 0 ? Math.round(nonNull.reduce((a, b) => a + b, 0) / nonNull.length * 10) / 10 : null

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
        <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 10, fill: '#525252' }} />
        <YAxis tick={{ fontSize: 10, fill: '#525252' }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        {target != null && (
          <ReferenceLine y={target} stroke="#525252" strokeDasharray="4 4" label={{ value: 'target', position: 'insideTopRight', fontSize: 9, fill: '#525252' }} />
        )}
        {slug === 'sleep' && avg != null && (
          <ReferenceLine y={avg} stroke="#a78bfa" strokeDasharray="4 4" strokeOpacity={0.6} />
        )}
        <Bar dataKey="value" fill={barColor} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Create `components/analytics/correlation-panel.tsx`**:

```tsx
'use client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import type { DailyLogAnalytics } from '@/lib/queries/analytics'
import { METRIC_CONFIG, type MetricSlug } from './metric-config'

interface Props {
  slug: MetricSlug
  data: DailyLogAnalytics[]
}

interface CorrDef {
  primaryField: (r: DailyLogAnalytics) => number | null
  secondaryField: (r: DailyLogAnalytics) => number | null
  primaryColor: string
  secondaryColor: string
}

const CORR_DEFS: Record<MetricSlug, CorrDef> = {
  weight:   { primaryField: r => r.weight_kg, secondaryField: r => r.calories, primaryColor: '#34d399', secondaryColor: '#f59e0b' },
  calories: { primaryField: r => r.calories,  secondaryField: r => r.weight_kg, primaryColor: '#f59e0b', secondaryColor: '#34d399' },
  protein:  { primaryField: r => r.protein_g, secondaryField: r => r.weight_kg, primaryColor: '#34d399', secondaryColor: '#34d399' },
  macros:   { primaryField: r => r.protein_g, secondaryField: r => r.weight_kg, primaryColor: '#a78bfa', secondaryColor: '#34d399' },
  steps:    { primaryField: r => r.steps,     secondaryField: r => r.weight_kg, primaryColor: '#60a5fa', secondaryColor: '#34d399' },
  sessions: { primaryField: r => r.session_type ? (r.session_type !== 'rest' ? 1 : 0) : null, secondaryField: r => r.mood, primaryColor: '#c084fc', secondaryColor: '#f59e0b' },
  sleep:    { primaryField: r => r.sleep_hours, secondaryField: r => r.mood, primaryColor: '#a78bfa', secondaryColor: '#f59e0b' },
  mood:     { primaryField: r => r.mood,       secondaryField: r => r.sleep_hours, primaryColor: '#f59e0b', secondaryColor: '#a78bfa' },
  water:    { primaryField: r => r.water_l,    secondaryField: r => r.mood, primaryColor: '#60a5fa', secondaryColor: '#f59e0b' },
}

const TOOLTIP_STYLE = { background: '#141414', border: '1px solid #1f1f1f', borderRadius: 8, fontSize: 11 }

export function CorrelationPanel({ slug, data }: Props) {
  const config = METRIC_CONFIG[slug]
  const corrSlug = config.correlatesWith
  const corrConfig = METRIC_CONFIG[corrSlug]
  const def = CORR_DEFS[slug]
  const xFmt = (d: string) => format(parseISO(d), 'MMM d')

  const chartData = data.map(r => ({
    date: r.date,
    primary: def.primaryField(r),
    secondary: def.secondaryField(r),
  }))

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          How this relates to {corrConfig.label}
        </div>
        <Link href={`/insights/${corrSlug}`} className="text-[10px] font-semibold" style={{ color: 'var(--accent)' }}>
          → {corrConfig.label}
        </Link>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
          <XAxis dataKey="date" tickFormatter={xFmt} tick={{ fontSize: 9, fill: '#525252' }} />
          <YAxis yAxisId="left"  tick={{ fontSize: 9, fill: '#525252' }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#525252' }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar   yAxisId="left"  dataKey="primary"   fill={def.primaryColor}   fillOpacity={0.7} radius={[2, 2, 0, 0]} name={config.label} />
          <Line  yAxisId="right" dataKey="secondary" stroke={def.secondaryColor} dot={false} strokeWidth={1.5} connectNulls name={corrConfig.label} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Create `components/analytics/metric-detail-client.tsx`**:

```tsx
'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { PeriodSelector, type Period } from './period-selector'
import { DetailChart } from './detail-chart'
import { CorrelationPanel } from './correlation-panel'
import {
  useAnalyticsForPeriod, periodBounds, previousPeriodBounds, avgOf, hitRate,
} from '@/lib/queries/analytics'
import { useTargets } from '@/lib/queries/targets'
import { METRIC_CONFIG, type MetricSlug } from './metric-config'

export function MetricDetailClient({ slug }: { slug: MetricSlug }) {
  const [period, setPeriod] = useState<Period>(30)
  const today = format(new Date(), 'yyyy-MM-dd')
  const { startDate, endDate }   = periodBounds(period, today)
  const prev                     = previousPeriodBounds(period, today)

  const { data: logs = [], isLoading }    = useAnalyticsForPeriod(startDate, endDate)
  const { data: prevLogs = [] }           = useAnalyticsForPeriod(prev.startDate, prev.endDate)
  const { data: targets }                 = useTargets()

  const config = METRIC_CONFIG[slug]
  const target = slug === 'calories' ? targets?.calories
    : slug === 'protein' ? targets?.protein_g
    : slug === 'steps'   ? targets?.steps
    : null

  const currentValues = logs.map(l => config.getValue(l))
  const prevValues    = prevLogs.map(l => config.getValue(l))
  const currentAvg    = avgOf(currentValues)
  const prevAvg       = avgOf(prevValues)

  const delta = currentAvg != null && prevAvg != null
    ? Math.round((currentAvg - prevAvg) * 10) / 10
    : null
  const deltaStr = delta != null
    ? `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} ${config.unit} vs previous ${period}d`
    : null

  const nonNull    = currentValues.filter((v): v is number => v != null)
  const best       = nonNull.length > 0 ? Math.max(...nonNull) : null
  const worst      = nonNull.length > 0 ? Math.min(...nonNull) : null
  const daysLogged = nonNull.length

  const chips = [
    { label: 'Avg',   value: currentAvg != null ? config.formatStat(currentAvg) : '—' },
    { label: 'Best',  value: best  != null ? config.formatStat(best)  : '—' },
    { label: 'Worst', value: worst != null ? config.formatStat(worst) : '—' },
    target != null
      ? { label: 'Hit Rate', value: `${hitRate(currentValues, target)}%` }
      : { label: 'Logged',   value: `${daysLogged}d` },
  ]

  return (
    <div className="pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 px-4 pt-6 pb-4">
        <Link href="/insights" className="text-lg font-bold" style={{ color: 'var(--accent)' }}>←</Link>
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{config.label}</h1>
      </div>

      <div className="px-4 flex flex-col gap-4">
        <PeriodSelector value={period} onChange={setPeriod} />

        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {isLoading ? (
            <div className="h-8 w-32 rounded animate-pulse" style={{ background: 'var(--border)' }} />
          ) : (
            <>
              <div className="text-3xl font-extrabold tracking-tight mb-0.5" style={{ color: config.color }}>
                {currentAvg != null
                  ? config.formatStat(currentAvg)
                  : <span style={{ color: 'var(--text-muted)' }}>—</span>
                }
              </div>
              {deltaStr && (
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{deltaStr}</div>
              )}
            </>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-2xl h-56 animate-pulse" style={{ background: 'var(--surface)' }} />
        ) : logs.length > 0 ? (
          <div className="rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <DetailChart slug={slug} data={logs} target={target} />
          </div>
        ) : (
          <div className="rounded-2xl p-6 text-center text-sm" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
            No data logged for this period
          </div>
        )}

        {daysLogged > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {chips.map(chip => (
              <div key={chip.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{chip.label}</div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{chip.value}</div>
              </div>
            ))}
          </div>
        )}

        {logs.length > 0 && <CorrelationPanel slug={slug} data={logs} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `app/(app)/insights/[metric]/page.tsx`**:

> **Check AGENTS.md first:** Read `node_modules/next/dist/docs/` to confirm the exact `params: Promise<{ metric: string }>` pattern and `await params` for dynamic segments in this version of Next.js.

```tsx
import { redirect } from 'next/navigation'
import { MetricDetailClient } from '@/components/analytics/metric-detail-client'
import { VALID_SLUGS, type MetricSlug } from '@/components/analytics/metric-config'

export default async function MetricDetailPage({
  params,
}: {
  params: Promise<{ metric: string }>
}) {
  const { metric } = await params
  if (!(VALID_SLUGS as readonly string[]).includes(metric)) {
    redirect('/insights')
  }
  return <MetricDetailClient slug={metric as MetricSlug} />
}
```

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add components/analytics/metric-config.ts \
        components/analytics/detail-chart.tsx \
        components/analytics/correlation-panel.tsx \
        components/analytics/metric-detail-client.tsx \
        app/\(app\)/insights/\[metric\]/page.tsx
git commit -m "feat: metric detail pages with charts, stats chips, and correlation panels"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Dashboard "Today at a Glance" — 4 metric cells + macro pie | Task 4 |
| Dashboard cells link to analytics detail pages | Task 4 (`GlanceCell` href props) |
| Photos tab → Insights tab in nav | Task 3 |
| `/photos` redirect → `/insights/photos` | Task 3 |
| Analytics sub-tab strip (Analytics / Photos) | Task 3 `InsightsSubTabs` |
| Analytics grid with period selector | Task 5 |
| 9 MetricSquares in 4 sections with sparklines + trend arrow | Task 5 |
| Detail pages with primary chart per metric type | Task 6 `DetailChart` |
| Hero stat + delta vs previous period | Task 6 `MetricDetailClient` |
| Stats chips (avg, best, worst, hit-rate/days) | Task 6 `MetricDetailClient` |
| CorrelationPanel with predefined pairs + link | Task 6 `CorrelationPanel` |
| Unknown slug redirect → /insights | Task 6 `MetricDetailPage` |
| Enhanced coach prompt — sleep/mood/water/steps/sessions | Task 1 |
| No extra DB queries for correlation data | Task 6 (same `useAnalyticsForPeriod` call) |
| No `insights/layout.tsx` — sub-tabs only on grid + photos pages | Tasks 3, 5 (sub-tabs included directly in pages, not in a layout) |

**Placeholder scan:** None found. All code blocks are complete.

**Type consistency check:**
- `MetricSlug` is defined in `components/analytics/metric-config.ts` and re-exported via `metric-square.tsx` for the grid page — both use identical string literal types
- `Period` is exported from `period-selector.tsx` and imported by `insights/page.tsx` and `metric-detail-client.tsx`
- `DailyLogAnalytics` from `lib/queries/analytics.ts` used consistently in `detail-chart.tsx`, `correlation-panel.tsx`, `metric-config.ts`
- `avgOf`, `hitRate`, `trendArrow`, `sparklineValues`, `periodBounds`, `previousPeriodBounds` all live in `lib/queries/analytics.ts` and are imported by consumers
- `VALID_SLUGS` is a `readonly string[]` — cast to `readonly string[]` before `.includes()` in the page to avoid TypeScript's strict array narrowing issue
