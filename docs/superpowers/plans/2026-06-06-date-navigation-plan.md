# Date Navigation & Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user switch `/log` between any past date (prev/next arrows, "Today" shortcut, and a calendar popup with entry-marker dots), so the daily log is no longer locked to today.

**Architecture:** Pure date-string helpers drive all navigation logic (validation, adjacency, labels) and are unit-tested in isolation. A new `useLoggedDatesInMonth` TanStack Query hook feeds the calendar's dot markers. Two new client components — `DateNav` (header bar) and `DayCalendarSheet` (month-grid popup) — replace the static `<h1>{date}</h1>` in `LogForm`. The URL `[date]` route param remains the single source of truth; no client-side "current date" state.

**Tech Stack:** Next.js 15 (App Router), TypeScript, date-fns, TanStack Query v5, Recharts (unaffected), Tailwind CSS, Lucide React, Vitest

---

## File Map

```
lib/
  utils/log-date.ts                   # NEW — pure date-string helpers (validate, adjacent, label, future-check)
  utils/log-date.test.ts              # NEW — Vitest unit tests for the above
  queries/daily-logs.ts               # MODIFY — add useLoggedDatesInMonth hook

components/log/
  date-nav.tsx                        # NEW — header bar: prev/next arrows, date label, Today pill, opens calendar
  day-calendar-sheet.tsx              # NEW — month-grid calendar popup with entry-dot markers
  log-form.tsx                        # MODIFY — replace <h1>{date}</h1> with <DateNav date={date} />

app/(app)/log/[date]/page.tsx         # MODIFY — validate date param, redirect invalid/future dates to /log
```

---

## Task 1: Pure Date-String Helpers

**Goal:** Add small, independently-tested pure functions for date validation, adjacency, future-checking, and relative labeling — the logic both `DateNav` and the page-level guard depend on.

**Files:**
- Create: `lib/utils/log-date.ts`
- Test: `lib/utils/log-date.test.ts`

**Acceptance Criteria:**
- [ ] `isValidLogDate` returns `true` only for well-formed, real `yyyy-MM-dd` calendar dates
- [ ] `isFutureLogDate` correctly compares two `yyyy-MM-dd` strings
- [ ] `adjacentLogDate` correctly steps a date forward/back across month and year boundaries
- [ ] `logDateLabel` returns `'Today'`, `'Yesterday'`, or a formatted label (`'EEE, d MMM'`) for any other date

**Verify:** `npx vitest run lib/utils/log-date.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/utils/log-date.test.ts
import { describe, it, expect } from 'vitest'
import { isValidLogDate, isFutureLogDate, adjacentLogDate, logDateLabel } from './log-date'

describe('isValidLogDate', () => {
  it('accepts a well-formed date string', () => {
    expect(isValidLogDate('2026-06-05')).toBe(true)
  })

  it('rejects a non-date string', () => {
    expect(isValidLogDate('not-a-date')).toBe(false)
  })

  it('rejects an impossible calendar date', () => {
    expect(isValidLogDate('2026-02-30')).toBe(false)
  })

  it('rejects a string in the wrong format', () => {
    expect(isValidLogDate('2026-6-5')).toBe(false)
  })
})

describe('isFutureLogDate', () => {
  it('returns true for a date after today', () => {
    expect(isFutureLogDate('2026-06-07', '2026-06-06')).toBe(true)
  })

  it('returns false for today', () => {
    expect(isFutureLogDate('2026-06-06', '2026-06-06')).toBe(false)
  })

  it('returns false for a date before today', () => {
    expect(isFutureLogDate('2026-06-05', '2026-06-06')).toBe(false)
  })
})

describe('adjacentLogDate', () => {
  it('returns the next day', () => {
    expect(adjacentLogDate('2026-06-05', 1)).toBe('2026-06-06')
  })

  it('returns the previous day', () => {
    expect(adjacentLogDate('2026-06-05', -1)).toBe('2026-06-04')
  })

  it('rolls over to the next month', () => {
    expect(adjacentLogDate('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('rolls over to the previous year', () => {
    expect(adjacentLogDate('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('logDateLabel', () => {
  it('labels today as "Today"', () => {
    expect(logDateLabel('2026-06-06', '2026-06-06')).toBe('Today')
  })

  it('labels yesterday as "Yesterday"', () => {
    expect(logDateLabel('2026-06-05', '2026-06-06')).toBe('Yesterday')
  })

  it('formats other dates as "EEE, d MMM"', () => {
    expect(logDateLabel('2026-06-01', '2026-06-06')).toBe('Mon, 1 Jun')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/utils/log-date.test.ts`
Expected: FAIL — `Cannot find module './log-date'` (file doesn't exist yet)

- [ ] **Step 3: Write the implementation**

```typescript
// lib/utils/log-date.ts
import { addDays, format, isValid, parseISO } from 'date-fns'

/** Validates a 'yyyy-MM-dd' string is both correctly formatted and a real calendar date. */
export function isValidLogDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = parseISO(date)
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === date
}

/** ISO 'yyyy-MM-dd' strings sort lexicographically in chronological order. */
export function isFutureLogDate(date: string, today: string): boolean {
  return date > today
}

export function adjacentLogDate(date: string, direction: -1 | 1): string {
  return format(addDays(parseISO(date), direction), 'yyyy-MM-dd')
}

export function logDateLabel(date: string, today: string): string {
  if (date === today) return 'Today'
  if (date === adjacentLogDate(today, -1)) return 'Yesterday'
  return format(parseISO(date), 'EEE, d MMM')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/utils/log-date.test.ts`
Expected: PASS — 13 tests passing

- [ ] **Step 5: Commit**

```bash
git add lib/utils/log-date.ts lib/utils/log-date.test.ts
git commit -m "feat: add pure date-string helpers for log navigation"
```

---

## Task 2: `useLoggedDatesInMonth` Query Hook

**Goal:** Add a TanStack Query hook that fetches which dates within a given month have a saved `daily_logs` entry, returned as a `Set<string>` for fast dot-marker lookups in the calendar.

**Files:**
- Modify: `lib/queries/daily-logs.ts`

**Acceptance Criteria:**
- [ ] `useLoggedDatesInMonth(monthStart)` queries `daily_logs` for dates within `[monthStart, monthEnd]` inclusive
- [ ] Returns a `Set<string>` of `'yyyy-MM-dd'` date strings
- [ ] Caches per-month via a `['daily-logs', 'logged-dates', monthStart]` query key, matching the existing convention used by `useWeightHistory`

**Verify:** `npm run build` → compiles with no TypeScript errors (no dedicated unit test — this is a thin Supabase query wrapper, consistent with `useWeightHistory` and `useRecentLogs` which also have no unit tests; only pure functions are unit-tested in this codebase)

**Steps:**

- [ ] **Step 1: Add the date-fns imports**

In `lib/queries/daily-logs.ts`, add to the top of the file (alongside the existing imports):

```typescript
import { format, parseISO, endOfMonth } from 'date-fns'
```

- [ ] **Step 2: Add the hook**

Append to `lib/queries/daily-logs.ts`:

```typescript
export function useLoggedDatesInMonth(monthStart: string) {
  return useQuery<Set<string>>({
    queryKey: ['daily-logs', 'logged-dates', monthStart],
    queryFn: async () => {
      const supabase = createClient()
      const monthEnd = format(endOfMonth(parseISO(monthStart)), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('daily_logs')
        .select('date')
        .gte('date', monthStart)
        .lte('date', monthEnd)
      if (error) throw error
      return new Set((data ?? []).map(row => row.date as string))
    },
  })
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: `✓ Compiled successfully` with no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add lib/queries/daily-logs.ts
git commit -m "feat: add useLoggedDatesInMonth query hook"
```

---

## Task 3: `DateNav` Header Bar + Page-Level Date Guard

**Goal:** Replace the static `<h1>{date}</h1>` in `LogForm` with a `DateNav` header providing prev/next-day navigation, a relative date label, and a "Today" shortcut — and add server-side validation so malformed or future date URLs redirect to `/log` instead of crashing the page.

**Files:**
- Create: `components/log/date-nav.tsx`
- Modify: `app/(app)/log/[date]/page.tsx`
- Modify: `components/log/log-form.tsx:134`

**Acceptance Criteria:**
- [ ] Tapping the back arrow navigates to the previous day's `/log/[date]`
- [ ] Tapping the forward arrow navigates to the next day, and is disabled (dimmed, non-interactive) when the next day would be in the future
- [ ] The date label shows "Today", "Yesterday", or `'EEE, d MMM'` for other dates
- [ ] A "Today" pill appears only when viewing a non-today date, and navigates to today when tapped
- [ ] Visiting `/log/not-a-date` or `/log/2099-01-01` redirects to `/log` (which redirects to today)

**Verify:** Manual smoke test — `npm run dev`, visit `/log`, use the arrows and Today pill to move between several days, then visit `/log/bogus-date` and `/log/2099-01-01` directly and confirm both redirect to today's log

**Steps:**

- [ ] **Step 1: Create the `DateNav` component**

```typescript
// components/log/date-nav.tsx
'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { adjacentLogDate, isFutureLogDate, logDateLabel } from '@/lib/utils/log-date'

interface Props {
  date: string
}

export function DateNav({ date }: Props) {
  const router = useRouter()
  const today = format(new Date(), 'yyyy-MM-dd')
  const isToday = date === today
  const next = adjacentLogDate(date, 1)
  const nextDisabled = isFutureLogDate(next, today)

  return (
    <div className="flex items-center justify-between mb-1">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => router.push(`/log/${adjacentLogDate(date, -1)}`)}
        className="p-2 -ml-2 rounded-lg"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {logDateLabel(date, today)}
        </span>
        {!isToday && (
          <button
            type="button"
            onClick={() => router.push(`/log/${today}`)}
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full transition-colors"
            style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}
          >
            Today
          </button>
        )}
      </div>

      <button
        type="button"
        aria-label="Next day"
        disabled={nextDisabled}
        onClick={() => router.push(`/log/${next}`)}
        className="p-2 -mr-2 rounded-lg disabled:opacity-30 disabled:pointer-events-none"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire `DateNav` into `LogForm`**

In `components/log/log-form.tsx`, add the import alongside the existing ones:

```typescript
import { DateNav } from './date-nav'
```

Replace line 134:

```typescript
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{date}</h1>
```

with:

```typescript
      <DateNav date={date} />
```

- [ ] **Step 3: Add the date guard to the page**

Replace the full contents of `app/(app)/log/[date]/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { LogForm } from '@/components/log/log-form'
import { isValidLogDate, isFutureLogDate } from '@/lib/utils/log-date'

export default async function LogDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const today = format(new Date(), 'yyyy-MM-dd')

  if (!isValidLogDate(date) || isFutureLogDate(date, today)) {
    redirect('/log')
  }

  return <LogForm date={date} />
}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, then in the browser:
1. Visit `/log` — confirm it redirects to today and shows "Today" with no "Today" pill and a disabled forward arrow
2. Tap the back arrow several times — confirm the URL and label update (e.g. "Yesterday", then "Wed, 3 Jun") and the "Today" pill appears
3. Tap "Today" — confirm it returns to today's date
4. Visit `/log/bogus-date` directly — confirm it redirects to today's log
5. Visit `/log/2099-01-01` directly — confirm it redirects to today's log

Expected: all five behaviors match

- [ ] **Step 5: Commit**

```bash
git add components/log/date-nav.tsx components/log/log-form.tsx "app/(app)/log/[date]/page.tsx"
git commit -m "feat: add DateNav header with prev/next/today navigation and date guard"
```

---

## Task 4: `DayCalendarSheet` Calendar Popup

**Goal:** Make the date label in `DateNav` open a month-grid calendar popup (custom-built, styled to match the app's dark/emerald theme) that marks days with saved entries and lets the user jump straight to any past date.

**Files:**
- Create: `components/log/day-calendar-sheet.tsx`
- Modify: `components/log/date-nav.tsx`

**Acceptance Criteria:**
- [ ] Tapping the date label opens a calendar sheet showing the month of the currently-viewed date
- [ ] Days with a saved `daily_logs` entry show a small accent-colored dot
- [ ] Today is ringed, the currently-viewed date has a filled accent background
- [ ] Future dates are dimmed and not selectable
- [ ] Tapping a valid date navigates to `/log/[that-date]` and closes the sheet
- [ ] Prev/next month arrows browse the calendar without navigating the page
- [ ] Backdrop click or the close button dismisses the sheet without navigating

**Verify:** Manual smoke test — `npm run dev`, open the calendar from `/log`, browse months, confirm dot markers appear only on days you've actually logged (cross-check against a couple of known dates), select a past date and confirm it navigates there, and confirm future dates can't be selected

**Steps:**

- [ ] **Step 1: Create the `DayCalendarSheet` component**

```typescript
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
```

- [ ] **Step 2: Wire it into `DateNav`**

In `components/log/date-nav.tsx`:

Add to the imports:

```typescript
import { useState } from 'react'
import { DayCalendarSheet } from './day-calendar-sheet'
```

Add state inside the `DateNav` function body (right after `const router = useRouter()`):

```typescript
  const [calendarOpen, setCalendarOpen] = useState(false)
```

Replace the date-label `<span>`:

```typescript
        <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          {logDateLabel(date, today)}
        </span>
```

with a tappable button:

```typescript
        <button
          type="button"
          onClick={() => setCalendarOpen(true)}
          className="text-lg font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          {logDateLabel(date, today)}
        </button>
```

And render the sheet at the end of the returned JSX, just before the closing `</div>` of the root element:

```typescript
      {calendarOpen && <DayCalendarSheet date={date} onClose={() => setCalendarOpen(false)} />}
```

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, then in the browser:
1. On `/log`, tap the date label — confirm the sheet opens on the current month
2. Confirm days you've previously logged show a small dot, and days you haven't don't
3. Browse to a previous month using the arrows — confirm dots update for that month and the page URL doesn't change
4. Tap a past date with a dot — confirm it navigates to `/log/[that-date]` and the sheet closes
5. Reopen the calendar from that new date — confirm it opens on that date's month, with that date highlighted
6. Confirm tomorrow and later dates are dimmed and unclickable
7. Open the calendar and tap the backdrop — confirm it closes without navigating

Expected: all seven behaviors match

- [ ] **Step 4: Commit**

```bash
git add components/log/day-calendar-sheet.tsx components/log/date-nav.tsx
git commit -m "feat: add calendar popup with entry-marker dots for date navigation"
```
