# Per-Meal Nutrition Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user log nutrition per meal (breakfast/lunch/dinner/snack) — by screenshot-and-AI-extraction or manual entry — while keeping the existing single daily-totals flow available, plus simple daily water tracking and meal-aware AI weekly check-ins.

**Architecture:** A new `meal_logs` table (independent of `daily_logs`, no FK between them) becomes the source of truth for nutrition on dates that have meal entries; `daily_logs` remains the source of truth otherwise. `useNutritionForDate` is the single hook that resolves "this date's nutrition totals" from whichever source applies — consumed by both `/log/[date]` and `/dashboard`. The existing screenshot-upload-and-AI-extract pipeline is generalized via a discriminated `UploadTarget` prop so meal screenshots reuse it without duplicating ~30 lines of upload logic. `LogForm`'s nutrition section automatically switches mode based on whether any meals are logged for the date — no manual toggle, per the approved design spec.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, TanStack Query v5, Supabase (Postgres + Auth + Storage + RLS), Anthropic SDK (Claude vision), date-fns, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-06-per-meal-nutrition-design.md`

---

## File Map

```
supabase/migrations/0002_meal_logs.sql       — new meal_logs table + food_screenshots/daily_logs alterations (applied manually via Supabase dashboard SQL editor)
types/database.ts                             — hand-maintained types: meal_logs Row/Insert/Update, generalized food_screenshots, daily_logs.water_l
lib/queries/meal-logs.ts                      — meal_logs CRUD hooks (useMealLogsForDate/useUpsertMealLog/useDeleteMealLog), sumMealMacros, useNutritionForDate
lib/queries/meal-logs.test.ts                 — unit tests for the pure sumMealMacros helper
components/log/screenshot-uploader.tsx        — generalized to a discriminated UploadTarget prop (daily | meal)
components/log/meal-entry-sheet.tsx           — new bottom sheet: meal-type picker, screenshot/manual entry, note, save/delete
components/log/meal-list.tsx                  — new read-only totals summary + grouped meal list + add-meal trigger
components/log/log-form.tsx                   — mode-aware nutrition section, water input, MealEntrySheet wiring
app/(app)/dashboard/dashboard-metrics.tsx     — Calories card sources from useNutritionForDate instead of useDailyLog directly
lib/anthropic/weekly-checkin.ts               — buildCheckinPrompt gains optional mealLogs param + "Meal distribution" prompt section
lib/anthropic/weekly-checkin.test.ts          — new test cases for the meal-distribution section
app/api/ai/weekly-checkin/route.ts            — fetches meal_logs for the check-in period and passes them through
```

---

## Task 1: Database Migration — `meal_logs`, generalized `food_screenshots`, `daily_logs.water_l`

**Goal:** Add the `meal_logs` table, generalize `food_screenshots` to support attaching to either a daily log or a meal log, and add `daily_logs.water_l` — applied to the live Supabase project and reflected in the hand-maintained TypeScript types.

**Files:**
- Create: `supabase/migrations/0002_meal_logs.sql`
- Modify: `types/database.ts`

**Acceptance Criteria:**
- [ ] `meal_logs` table exists with RLS enabled, policy `own_meal_logs`, and an `updated_at` trigger reusing the existing `update_updated_at()` function
- [ ] `food_screenshots.daily_log_id` is nullable, `meal_log_id` exists (nullable, FK to `meal_logs.id` with `on delete cascade`), and a check constraint `food_screenshot_exactly_one_target` enforces exactly one of the two is set
- [ ] `daily_logs.water_l` exists as `numeric(3,1)`
- [ ] `types/database.ts` Row/Insert/Update shapes for `meal_logs`, `food_screenshots`, and `daily_logs` match the new schema exactly

**Verify:** `npm run build` → compiles with no TypeScript errors

**Steps:**

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0002_meal_logs.sql`:

```sql
-- meal_logs: one row per logged meal, independent of daily_logs
create table meal_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        date not null,
  meal_type   text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  calories    integer,
  protein_g   numeric(5,1),
  fat_g       numeric(5,1),
  carbs_g     numeric(5,1),
  note        text,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

alter table meal_logs enable row level security;
create policy "own_meal_logs" on meal_logs for all using (auth.uid() = user_id);

create trigger meal_logs_updated_at
  before update on meal_logs
  for each row execute function update_updated_at();

-- food_screenshots: support attaching to a single meal instead of a whole day
alter table food_screenshots
  alter column daily_log_id drop not null,
  add column meal_log_id uuid references meal_logs(id) on delete cascade,
  add constraint food_screenshot_exactly_one_target check (
    (daily_log_id is not null)::int + (meal_log_id is not null)::int = 1
  );

-- daily_logs: simple optional daily water tracking (liters, one decimal)
alter table daily_logs add column water_l numeric(3,1);
```

- [ ] **Step 2: Apply the migration to the live project**

This project has no linked Supabase CLI project — migrations are applied manually (same as `0001_schema.sql` was). Open the Supabase Dashboard → SQL Editor, paste the full contents of `supabase/migrations/0002_meal_logs.sql`, and run it. Confirm it completes with no errors. If `food_screenshots` already has rows with `daily_log_id` set, the `alter column ... drop not null` and the new check constraint apply cleanly against them (existing rows satisfy `daily_log_id is not null` = 1, `meal_log_id is not null` = 0, sum = 1).

- [ ] **Step 3: Update `types/database.ts`**

Add `water_l: number | null` to the `daily_logs` `Row` type (insert it after the `mood: number | null` line):

```typescript
          mood: number | null
          water_l: number | null
          note: string | null
```

Add `water_l?: number | null` to `daily_logs` `Insert` and `Update` (insert after `mood?: number | null` in each):

```typescript
          mood?: number | null
          water_l?: number | null
          note?: string | null
```

Replace the entire `food_screenshots` block (currently lines 66-94) with:

```typescript
      food_screenshots: {
        Row: {
          id: string
          user_id: string
          daily_log_id: string | null
          meal_log_id: string | null
          image_path: string
          extracted_json: Json | null
          confirmed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          daily_log_id?: string | null
          meal_log_id?: string | null
          image_path: string
          extracted_json?: Json | null
          confirmed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          daily_log_id?: string | null
          meal_log_id?: string | null
          image_path?: string
          extracted_json?: Json | null
          confirmed?: boolean
          created_at?: string
        }
      }
```

Add a new `meal_logs` table block immediately after the `food_screenshots` block (and before `progress_photos`):

```typescript
      meal_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          calories: number | null
          protein_g: number | null
          fat_g: number | null
          carbs_g: number | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          calories?: number | null
          protein_g?: number | null
          fat_g?: number | null
          carbs_g?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          calories?: number | null
          protein_g?: number | null
          fat_g?: number | null
          carbs_g?: number | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_meal_logs.sql types/database.ts
git commit -m "feat: add meal_logs table and generalize food_screenshots for per-meal uploads"
```

---

## Task 2: `meal-logs` Query Module — CRUD Hooks, Macro Summing, Shared Nutrition Helper

**Goal:** Add the data-fetching layer for per-meal nutrition: CRUD hooks over `meal_logs`, a pure `sumMealMacros` helper (TDD'd), and the `useNutritionForDate` hook that's the single source of truth for "this date's nutrition totals" — to be consumed by `LogForm`, `MealList`, and `DashboardMetrics` in later tasks.

**Files:**
- Create: `lib/queries/meal-logs.ts`
- Test: `lib/queries/meal-logs.test.ts`

**Acceptance Criteria:**
- [ ] `sumMealMacros(meals)` sums `calories`/`protein_g`/`fat_g`/`carbs_g` across an array of macro-bearing objects, treating `null` as `0`, always returning numbers
- [ ] `useMealLogsForDate(date)` queries `meal_logs` filtered by `date`, ordered by `created_at` ascending, query key `['meal-logs', date]`
- [ ] `useUpsertMealLog()` inserts or updates a `meal_logs` row (`upsert` on `id`), and on success invalidates `['meal-logs', date]` and `['daily-log', date]`
- [ ] `useDeleteMealLog()` deletes a `meal_logs` row by id, and on success invalidates the same query keys
- [ ] `useNutritionForDate(date)` returns `{ source: 'meals', calories, protein_g, fat_g, carbs_g, meals }` (summed) when meal rows exist for the date, else `{ source: 'daily', calories, protein_g, fat_g, carbs_g, meals: [] }` taken from `daily_logs`

**Verify:** `npx vitest run lib/queries/meal-logs.test.ts` → all tests pass; `npm run build` → compiles

**Steps:**

- [ ] **Step 1: Write the failing test for `sumMealMacros`**

Create `lib/queries/meal-logs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { sumMealMacros } from './meal-logs'

describe('sumMealMacros', () => {
  it('sums macros across multiple meals', () => {
    const meals = [
      { calories: 400, protein_g: 30, fat_g: 12, carbs_g: 40 },
      { calories: 800, protein_g: 60, fat_g: 30, carbs_g: 70 },
    ]
    expect(sumMealMacros(meals)).toEqual({ calories: 1200, protein_g: 90, fat_g: 42, carbs_g: 110 })
  })

  it('treats null macro fields as zero', () => {
    const meals = [
      { calories: 400, protein_g: null, fat_g: 12, carbs_g: null },
      { calories: null, protein_g: 60, fat_g: null, carbs_g: 70 },
    ]
    expect(sumMealMacros(meals)).toEqual({ calories: 400, protein_g: 60, fat_g: 12, carbs_g: 70 })
  })

  it('returns all zeros for an empty list', () => {
    expect(sumMealMacros([])).toEqual({ calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run lib/queries/meal-logs.test.ts`
Expected: FAIL — `lib/queries/meal-logs.ts` does not exist / `sumMealMacros` is not exported

- [ ] **Step 3: Implement the module**

Create `lib/queries/meal-logs.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useDailyLog } from './daily-logs'
import type { Database } from '@/types/database'

export type MealLog = Database['public']['Tables']['meal_logs']['Row']
type MealLogInsert = Database['public']['Tables']['meal_logs']['Insert']

interface MacroFields {
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}

export function sumMealMacros(meals: MacroFields[]) {
  return {
    calories: meals.reduce((sum, m) => sum + (m.calories ?? 0), 0),
    protein_g: meals.reduce((sum, m) => sum + (m.protein_g ?? 0), 0),
    fat_g: meals.reduce((sum, m) => sum + (m.fat_g ?? 0), 0),
    carbs_g: meals.reduce((sum, m) => sum + (m.carbs_g ?? 0), 0),
  }
}

export function useMealLogsForDate(date: string) {
  return useQuery<MealLog[]>({
    queryKey: ['meal-logs', date],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('meal_logs')
        .select('*')
        .eq('date', date)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MealLog[]
    },
  })
}

export function useUpsertMealLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (meal: MealLogInsert) => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .from('meal_logs')
        .upsert(meal as any, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      return data as MealLog
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs', data.date] })
      queryClient.invalidateQueries({ queryKey: ['daily-log', data.date] })
    },
  })
}

export function useDeleteMealLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; date: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from('meal_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meal-logs', variables.date] })
      queryClient.invalidateQueries({ queryKey: ['daily-log', variables.date] })
    },
  })
}

export interface NutritionForDate {
  source: 'meals' | 'daily'
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  meals: MealLog[]
}

export function useNutritionForDate(date: string) {
  const { data: dailyLog, isLoading: dailyLoading } = useDailyLog(date)
  const { data: meals = [], isLoading: mealsLoading } = useMealLogsForDate(date)

  const isLoading = dailyLoading || mealsLoading

  let data: NutritionForDate | undefined
  if (!isLoading) {
    data = meals.length > 0
      ? { source: 'meals', ...sumMealMacros(meals), meals }
      : {
          source: 'daily',
          calories: dailyLog?.calories ?? null,
          protein_g: dailyLog?.protein_g ?? null,
          fat_g: dailyLog?.fat_g ?? null,
          carbs_g: dailyLog?.carbs_g ?? null,
          meals: [],
        }
  }

  return { data, isLoading }
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npx vitest run lib/queries/meal-logs.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add lib/queries/meal-logs.ts lib/queries/meal-logs.test.ts
git commit -m "feat: add meal_logs query hooks and useNutritionForDate helper"
```

---

## Task 3: Generalize `ScreenshotUploader` via `UploadTarget`

**Goal:** Replace `ScreenshotUploader`'s hardcoded `dailyLogId`/`date` props with a discriminated `UploadTarget` union so the same upload-and-AI-extract pipeline serves both daily and per-meal screenshots without duplicating the upload logic.

**Files:**
- Modify: `components/log/screenshot-uploader.tsx`
- Modify: `components/log/log-form.tsx:137-153` (update the call site)

**Acceptance Criteria:**
- [ ] `ScreenshotUploader` exports `UploadTarget = { type: 'daily'; dailyLogId: string | null; date: string } | { type: 'meal'; mealLogId: string }` and accepts `target: UploadTarget`
- [ ] For `target.type === 'daily'`, behavior is unchanged from today: lazily upserts a `daily_logs` row when `dailyLogId` is null, then inserts `food_screenshots` with `daily_log_id`
- [ ] For `target.type === 'meal'`, it inserts `food_screenshots` with `meal_log_id` directly (no `daily_logs` lazy-create)
- [ ] `LogForm`'s existing daily screenshot upload still works exactly as before (regression)

**Verify:** `npm run build` → compiles; manual smoke test on `/log/[date]` — upload a nutrition screenshot and confirm the existing extraction → confirm → fill-form flow is unchanged

**Steps:**

- [ ] **Step 1: Rewrite `screenshot-uploader.tsx` with the discriminated `UploadTarget`**

Replace the full contents of `components/log/screenshot-uploader.tsx` with:

```tsx
'use client'
import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { v4 as uuid } from 'uuid'

interface UploadResult {
  screenshotId: string
  imagePath: string
}

export type UploadTarget =
  | { type: 'daily'; dailyLogId: string | null; date: string }
  | { type: 'meal'; mealLogId: string }

interface Props {
  target: UploadTarget
  onUploaded: (result: UploadResult) => void
}

export function ScreenshotUploader({ target, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setUploading(false); return }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const imagePath = `${user.id}/${uuid()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(imagePath, file, { upsert: false })

    if (uploadError) {
      setError('Upload failed — check your connection')
      setUploading(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let screenshotInsert: any = { user_id: user.id, image_path: imagePath, confirmed: false }

    if (target.type === 'daily') {
      let logId = target.dailyLogId
      if (!logId) {
        const { data: log, error: logError } = await supabase
          .from('daily_logs')
          .upsert({ user_id: user.id, date: target.date } as any, { onConflict: 'user_id,date' })
          .select('id')
          .single() as any
        if (logError || !log) {
          setError('Could not create log entry')
          setUploading(false)
          return
        }
        logId = (log as { id: string }).id
      }
      screenshotInsert = { ...screenshotInsert, daily_log_id: logId }
    } else {
      screenshotInsert = { ...screenshotInsert, meal_log_id: target.mealLogId }
    }

    const { data: screenshot, error: screenshotError } = await supabase
      .from('food_screenshots')
      .insert(screenshotInsert)
      .select('id')
      .single() as any

    if (screenshotError || !screenshot) {
      setError('Screenshot record failed')
      setUploading(false)
      return
    }

    setUploading(false)
    onUploaded({ screenshotId: (screenshot as { id: string }).id, imagePath })
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-opacity disabled:opacity-50"
        style={{ background: '#0f1f17', border: '1px dashed #34d39960' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#34d39920' }}>
          <Upload size={15} color="#34d399" />
        </div>
        <div className="text-left">
          <div className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
            {uploading ? 'Uploading…' : 'Extract from screenshot'}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Tap to upload · AI fills macros</div>
        </div>
      </button>
      {error && <p className="text-xs mt-1.5" style={{ color: 'var(--red)' }}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Update the `LogForm` call site**

In `components/log/log-form.tsx`, replace the `<ScreenshotUploader dailyLogId={existing?.id ?? null} date={date} ... />` opening props (lines 137-139) with:

```tsx
      <ScreenshotUploader
        target={{ type: 'daily', dailyLogId: existing?.id ?? null, date }}
```

(Leave the `onUploaded={...}` callback below it exactly as-is.)

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`, visit `/log/[date]`, tap "Extract from screenshot," upload a nutrition-app screenshot, and confirm the existing flow (extracting → confirm macros → fields populated) behaves exactly as it did before this change.

- [ ] **Step 5: Commit**

```bash
git add components/log/screenshot-uploader.tsx components/log/log-form.tsx
git commit -m "refactor: generalize ScreenshotUploader to support daily and meal upload targets"
```

---

## Task 4: `MealEntrySheet` Component

**Goal:** Add the bottom-sheet component that handles both adding and editing a meal entry — meal-type selection, screenshot-upload-and-AI-extract or manual macro entry, an optional note, and save/delete — following the existing `day-calendar-sheet.tsx` overlay/slide-up pattern.

**Files:**
- Create: `components/log/meal-entry-sheet.tsx`

**Acceptance Criteria:**
- [ ] When `meal` is `null`, the sheet opens on a meal-type picker (breakfast/lunch/dinner/snack); selecting a type advances to the entry form
- [ ] When `meal` is provided, the sheet opens directly on the entry form pre-filled with the existing meal's type, macros, and note, and shows a Delete button
- [ ] The entry form shows an "Extract from screenshot" trigger that creates a draft `meal_logs` row on first tap, then renders `ScreenshotUploader` with `target: { type: 'meal', mealLogId }`; a successful extraction shows `MacroConfirm` and populates the macro fields on confirm
- [ ] Manual macro fields (calories/protein/fat/carbs) and a note field are always editable directly in the form
- [ ] Save calls `useUpsertMealLog()` with the chosen type, macros, and note (creating or updating as appropriate) and closes the sheet; Delete calls `useDeleteMealLog()` and closes the sheet
- [ ] Escape key and backdrop click dismiss the sheet via `onClose`

**Verify:** Manual smoke test — `npm run dev`, open `/log/[date]`, add a meal manually, add a meal via screenshot, edit an existing meal, delete an existing meal; confirm each flow saves/updates/removes the row and the sheet closes

**Steps:**

- [ ] **Step 1: Create the component**

Create `components/log/meal-entry-sheet.tsx`:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUpsertMealLog, useDeleteMealLog, type MealLog } from '@/lib/queries/meal-logs'
import { ScreenshotUploader } from './screenshot-uploader'
import { MacroConfirm } from './macro-confirm'
import type { ExtractedMacros } from '@/lib/anthropic/extract-macros'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
      <div className="fixed inset-0 z-[60]" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
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
            <button type="button" onClick={onClose} className="text-sm py-3 rounded-xl"
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
              <button type="button" onClick={onClose} className="py-3 rounded-xl text-sm"
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
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: compiles with no TypeScript errors (the component isn't wired into any page yet, so this only checks it type-checks in isolation — full interaction testing happens in Task 5 once it's mounted from `LogForm`)

- [ ] **Step 3: Commit**

```bash
git add components/log/meal-entry-sheet.tsx
git commit -m "feat: add MealEntrySheet for adding and editing per-meal nutrition entries"
```

---

## Task 5: Mode-Aware Nutrition Section in `LogForm` + `MealList` + Water Input

**Goal:** Wire everything together on `/log/[date]`: the nutrition section automatically switches between "single daily total" mode and "per-meal" mode based on whether any meals are logged for the date, add the `MealList` summary/list component, mount `MealEntrySheet`, and add the daily water field.

**Files:**
- Create: `components/log/meal-list.tsx`
- Modify: `components/log/log-form.tsx`

**Acceptance Criteria:**
- [ ] On a date with **no** meal entries, `/log/[date]` shows the existing daily `ScreenshotUploader` and 4 editable macro inputs exactly as before, plus a new "+ Log by meal instead" link that opens `MealEntrySheet`
- [ ] On a date with **one or more** meal entries, the daily uploader and 4 macro inputs are replaced by a read-only "Today's totals" summary (computed via `useNutritionForDate`/`sumMealMacros`) and a meal list grouped by type, each group showing a subtotal and each entry showing its macros
- [ ] Tapping an existing meal entry reopens `MealEntrySheet` pre-filled for editing (with delete available); tapping "+ Add meal" opens it for a new entry
- [ ] A "Water" number input (liters, one decimal) appears in the existing "Sleep & mood (optional)" section and round-trips through `useUpsertLog` via `daily_logs.water_l`
- [ ] Logging a day with no meals continues to behave exactly as today (regression)

**Verify:** Manual smoke test — `npm run dev`, visit `/log/[date]`:
1. On a fresh date, confirm the daily uploader + 4 macro fields render and save as before
2. Tap "+ Log by meal instead", add a manual meal entry, confirm the section switches to per-meal mode showing the totals summary and the new entry
3. Add a second meal via screenshot upload, confirm AI extraction populates it and the totals update
4. Tap an existing entry, edit its macros, save, confirm the list and totals update
5. Delete an entry, confirm it's removed and totals recompute (and the section reverts to daily mode if it was the last meal)
6. Expand "Sleep & mood (optional)", enter a water value, save, reload the page, confirm it persists

**Steps:**

- [ ] **Step 1: Create `MealList`**

Create `components/log/meal-list.tsx`:

```tsx
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
```

- [ ] **Step 2: Update `LogForm` imports and state**

In `components/log/log-form.tsx`, update the import block (lines 1-9) to add the new imports:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { SessionPicker, type SessionType } from './session-picker'
import { useDailyLog, useUpsertLog } from '@/lib/queries/daily-logs'
import { useMealLogsForDate } from '@/lib/queries/meal-logs'
import { createClient } from '@/lib/supabase/client'
import { ScreenshotUploader } from './screenshot-uploader'
import { MacroConfirm } from './macro-confirm'
import { MealList } from './meal-list'
import { MealEntrySheet } from './meal-entry-sheet'
import type { ExtractedMacros } from '@/lib/anthropic/extract-macros'
import { DateNav } from './date-nav'
```

Inside the `LogForm` function, add two new pieces of state right after the existing `const [extracted, ...]` line (line 20):

```tsx
  const { data: meals = [] } = useMealLogsForDate(date)
  const [showMealEntry, setShowMealEntry] = useState(false)
```

Add `water_l: ''` to the `fields` initial state (line 25), changing:

```tsx
    sleep_hours: '', mood: '', note: '',
```

to:

```tsx
    sleep_hours: '', mood: '', water_l: '', note: '',
```

Add `water_l` population to the `useEffect` that loads `existing` (inside the `setFields` call, after the `mood` line):

```tsx
        mood:         String(existing.mood ?? ''),
        water_l:      String(existing.water_l ?? ''),
        note:         existing.note ?? '',
```

Add `water_l` to the `handleSubmit` payload (after the `mood` line):

```tsx
        mood:         fields.mood         ? parseInt(fields.mood)            : null,
        water_l:      fields.water_l      ? parseFloat(fields.water_l)       : null,
        note:         fields.note || null,
```

- [ ] **Step 3: Replace the `ScreenshotUploader` + Nutrition block with the mode-aware section**

Replace the block from `<ScreenshotUploader` through the closing `</div>` of the Nutrition section (originally lines 137-186) with:

```tsx
      {numInput('Morning Weight', 'weight_kg', 'kg')}

      {meals.length === 0 ? (
        <>
          <ScreenshotUploader
            target={{ type: 'daily', dailyLogId: existing?.id ?? null, date }}
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
            <button type="button" onClick={() => setShowMealEntry(true)}
              className="mt-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
              + Log by meal instead
            </button>
          </div>
        </>
      ) : (
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Nutrition
          </label>
          <MealList date={date} />
        </div>
      )}

      {showMealEntry && <MealEntrySheet date={date} meal={null} onClose={() => setShowMealEntry(false)} />}
```

Note this also removes the standalone `{numInput('Morning Weight', 'weight_kg', 'kg')}` line that originally sat between the uploader and the Nutrition label — it's now hoisted above the mode-aware block so weight always renders regardless of nutrition mode.

- [ ] **Step 4: Add the water input to the optional section**

Replace the `{showOptional && (...)}` block (originally lines 217-239) with:

```tsx
      {showOptional && (
        <div className="grid grid-cols-2 gap-3">
          {numInput('Sleep', 'sleep_hours', 'hrs')}
          {numInput('Water', 'water_l', 'L')}
          <div className="col-span-2">
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
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 6: Manual smoke test**

Run `npm run dev` and walk through all 6 checks listed in the task's **Verify** section above.

- [ ] **Step 7: Commit**

```bash
git add components/log/meal-list.tsx components/log/log-form.tsx
git commit -m "feat: switch LogForm nutrition section between daily and per-meal modes, add water tracking"
```

---

## Task 6: Wire `useNutritionForDate` into `DashboardMetrics`

**Goal:** Make the Dashboard's "Calories" card reflect meal-summed totals on dates that have per-meal logs, and the existing `daily_logs.calories` value on dates that don't — via the shared `useNutritionForDate` hook, so the dashboard and `/log/[date]` always agree on "today's calories."

**Files:**
- Modify: `app/(app)/dashboard/dashboard-metrics.tsx`

**Acceptance Criteria:**
- [ ] On a date with per-meal logs, the Calories card shows the sum across that date's meals
- [ ] On a date without per-meal logs, the Calories card shows `daily_logs.calories` exactly as it did before this change
- [ ] The Steps card is unaffected

**Verify:** Manual smoke test — `npm run dev`:
1. On a day with no meals logged, confirm the Calories card matches `daily_logs.calories` for that day (as before)
2. Log two or more meals for today via `/log/[date]`, return to `/dashboard`, confirm the Calories card now shows the sum of those meals' calories

**Steps:**

- [ ] **Step 1: Update the component**

Replace the full contents of `app/(app)/dashboard/dashboard-metrics.tsx` with:

```tsx
'use client'
import { MetricCard } from '@/components/dashboard/metric-card'
import { useDailyLog } from '@/lib/queries/daily-logs'
import { useNutritionForDate } from '@/lib/queries/meal-logs'
import { useTargets } from '@/lib/queries/targets'
import { format } from 'date-fns'

export function DashboardMetrics() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: log } = useDailyLog(today)
  const { data: nutrition } = useNutritionForDate(today)
  const { data: targets } = useTargets()

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard
        label="Calories"
        value={nutrition?.calories}
        target={targets?.calories ?? 2400}
        unit="kcal"
        color="var(--amber)"
      />
      <MetricCard
        label="Steps"
        value={log?.steps}
        target={targets?.steps ?? 10000}
        unit="steps"
        color="var(--sky)"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 3: Manual smoke test**

Run `npm run dev` and walk through both checks listed in the task's **Verify** section above.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/dashboard/dashboard-metrics.tsx
git commit -m "feat: source dashboard Calories card from useNutritionForDate"
```

---

## Task 7: Weekly Check-In — Meal Distribution

**Goal:** Make the AI weekly check-in prompt aware of how macros are distributed across meal types, additively — periods with no per-meal logs produce an unchanged prompt, periods with per-meal logs gain a "Meal distribution" section and an extra coaching-instruction clause.

**Files:**
- Modify: `lib/anthropic/weekly-checkin.ts`
- Modify: `lib/anthropic/weekly-checkin.test.ts`
- Modify: `app/api/ai/weekly-checkin/route.ts`

**Acceptance Criteria:**
- [ ] `buildCheckinPrompt(targets, logs, mealLogs?)` accepts an optional third parameter (default `[]`) and remains a pure function
- [ ] When `mealLogs` is non-empty, the prompt includes a "Meal distribution" section listing, per meal type that has entries, the average calories (rounded), percentage share of average daily calories (rounded), and average protein (rounded), computed across the distinct dates that have per-meal logs
- [ ] When `mealLogs` is empty or omitted, the prompt contains no "Meal distribution" text and no extra coverage clause — i.e. it is unchanged from today's output shape
- [ ] `app/api/ai/weekly-checkin/route.ts` fetches `meal_logs` rows (`date, meal_type, calories, protein_g, fat_g, carbs_g`) for the same `[periodStart, periodEnd]` range and passes them to `buildCheckinPrompt`

**Verify:** `npx vitest run lib/anthropic/weekly-checkin.test.ts` → all tests pass (existing + new)

**Steps:**

- [ ] **Step 1: Write the failing tests**

Append to `lib/anthropic/weekly-checkin.test.ts` (after the existing `describe('buildCheckinPrompt', ...)` block, before its closing — i.e. add a new top-level `describe` block at the end of the file):

```typescript
describe('buildCheckinPrompt — meal distribution', () => {
  const mealLogs: Array<{
    date: string
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    calories: number | null
    protein_g: number | null
    fat_g: number | null
    carbs_g: number | null
  }> = [
    { date: '2026-05-29', meal_type: 'breakfast', calories: 400, protein_g: 30, fat_g: 12, carbs_g: 40 },
    { date: '2026-05-29', meal_type: 'dinner', calories: 800, protein_g: 60, fat_g: 30, carbs_g: 70 },
    { date: '2026-05-30', meal_type: 'breakfast', calories: 440, protein_g: 26, fat_g: 14, carbs_g: 44 },
    { date: '2026-05-30', meal_type: 'dinner', calories: 760, protein_g: 56, fat_g: 28, carbs_g: 66 },
  ]

  it('includes a meal distribution section when meal logs are present', () => {
    const prompt = buildCheckinPrompt(targets, logs, mealLogs)
    expect(prompt).toContain('Meal distribution')
  })

  it('omits the meal distribution section when no meal logs are passed', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).not.toContain('Meal distribution')
  })

  it('computes average calories, percentage share, and average protein per meal type', () => {
    // Breakfast avg: (400+440)/2 = 420 kcal, (30+26)/2 = 28g protein
    // Dinner avg: (800+760)/2 = 780 kcal, (60+56)/2 = 58g protein
    // Total avg calories = 1200 → Breakfast 35%, Dinner 65%
    const prompt = buildCheckinPrompt(targets, logs, mealLogs)
    expect(prompt).toContain('Breakfast: 420 kcal (35%), 28g protein')
    expect(prompt).toContain('Dinner: 780 kcal (65%), 58g protein')
  })

  it('mentions meal distribution in the coaching instructions when present', () => {
    const prompt = buildCheckinPrompt(targets, logs, mealLogs)
    expect(prompt).toContain('how protein and calories are distributed across meals')
  })

  it('does not mention meal distribution in the coaching instructions when absent', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).not.toContain('how protein and calories are distributed across meals')
  })
})
```

- [ ] **Step 2: Run the tests and verify the new ones fail**

Run: `npx vitest run lib/anthropic/weekly-checkin.test.ts`
Expected: the 5 new tests FAIL (existing tests still pass) — `buildCheckinPrompt` doesn't yet accept `mealLogs` or emit the distribution section

- [ ] **Step 3: Extend `buildCheckinPrompt`**

Replace the full contents of `lib/anthropic/weekly-checkin.ts` with:

```typescript
interface Targets {
  calories: number; protein_g: number; fat_g: number; carbs_g: number
  steps: number; goal_rate_kg_per_week: number
  bodyweight_kg: number; height_cm: number; training_split: string | null
}

interface LogRow {
  date: string; weight_kg: number | null
  calories: number | null; protein_g: number | null
  fat_g: number | null; carbs_g: number | null
  steps: number | null; session_type: string | null
}

export interface MealLogRow {
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const MEAL_LABELS: Record<typeof MEAL_TYPES[number], string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks',
}

function buildMealDistributionSection(mealLogs: MealLogRow[]): string | null {
  if (mealLogs.length === 0) return null

  const daysWithMeals = new Set(mealLogs.map(m => m.date)).size

  const rows = MEAL_TYPES
    .map(type => {
      const entries = mealLogs.filter(m => m.meal_type === type)
      if (entries.length === 0) return null
      return {
        type,
        avgCalories: Math.round(entries.reduce((sum, m) => sum + (m.calories ?? 0), 0) / daysWithMeals),
        avgProtein: Math.round(entries.reduce((sum, m) => sum + (m.protein_g ?? 0), 0) / daysWithMeals),
      }
    })
    .filter((r): r is { type: typeof MEAL_TYPES[number]; avgCalories: number; avgProtein: number } => r != null)

  if (rows.length === 0) return null

  const totalAvgCalories = rows.reduce((sum, r) => sum + r.avgCalories, 0)

  const lines = rows.map(r => {
    const pct = totalAvgCalories > 0 ? Math.round((r.avgCalories / totalAvgCalories) * 100) : 0
    return `- ${MEAL_LABELS[r.type]}: ${r.avgCalories} kcal (${pct}%), ${r.avgProtein}g protein`
  })

  return [`Meal distribution (avg across ${daysWithMeals} days with per-meal logs):`, ...lines].join('\n')
}

export function buildCheckinPrompt(targets: Targets, logs: LogRow[], mealLogs: MealLogRow[] = []): string {
  const proteinLogged = logs.filter(l => l.protein_g != null)
  const proteinHits = proteinLogged.filter(l => l.protein_g! >= targets.protein_g).length
  const proteinHitRate = proteinLogged.length > 0
    ? Math.round((proteinHits / proteinLogged.length) * 100)
    : 0

  const weightLogs = logs.filter(l => l.weight_kg != null).map(l => l.weight_kg!)
  const sortedWeights = [...weightLogs].reverse() // newest first
  const recentSlice = sortedWeights.slice(0, Math.min(7, sortedWeights.length))
  const olderSlice = sortedWeights.slice(7)
  const recentAvg = recentSlice.length > 0
    ? recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length
    : targets.bodyweight_kg
  const olderAvg = olderSlice.length > 0
    ? olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length
    : recentSlice.length > 1
      ? recentSlice[recentSlice.length - 1] // oldest in window (index is highest = oldest because newest-first)
      : recentAvg
  const weeklyDelta = Math.round((recentAvg - olderAvg) * 100) / 100
  const trendDir = weeklyDelta < 0 ? 'down' : weeklyDelta > 0 ? 'up' : 'flat'

  const table = [
    'date       | weight | kcal | prot | fat | carbs | steps | session',
    '-----------|--------|------|------|-----|-------|-------|--------',
    ...logs.map(l =>
      `${l.date} | ${l.weight_kg ?? '—'} | ${l.calories ?? '—'} | ${l.protein_g ?? '—'} | ${l.fat_g ?? '—'} | ${l.carbs_g ?? '—'} | ${l.steps ?? '—'} | ${l.session_type ?? '—'}`
    ),
  ].join('\n')

  const mealDistribution = buildMealDistributionSection(mealLogs)
  const mealDistributionBlock = mealDistribution ? `\n\n${mealDistribution}` : ''
  const coverageNote = mealDistribution
    ? ', how protein and calories are distributed across meals and whether that supports training and recovery'
    : ''

  return `You are a personal fitness coach. Your client's current profile:
- Height: ${targets.height_cm}cm, Weight goal base: ${targets.bodyweight_kg}kg
- Programme: ${targets.training_split ?? 'Not set'}
- Daily targets: ${targets.calories} kcal, ${targets.protein_g}g protein, ${targets.fat_g}g fat, ${targets.carbs_g}g carbs, ${targets.steps} steps
- Fat-loss goal: ${targets.goal_rate_kg_per_week} kg/week

Data for the last ${logs.length} logged days:
${table}

Computed stats:
- Recent avg weight: ${Math.round(recentAvg * 10) / 10} kg (7-day trend: ${trendDir}, ${weeklyDelta > 0 ? '+' : ''}${weeklyDelta} kg)
- Protein target hit rate: ${proteinHitRate}% of logged days
- Days logged: ${logs.length}${mealDistributionBlock}

Write a concise coaching summary in 3–5 short paragraphs. Cover: weight trend vs goal rate, protein adherence${coverageNote}, what's going well, one specific actionable focus for this week. Be direct. No bullet points. No sign-off.`
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npx vitest run lib/anthropic/weekly-checkin.test.ts`
Expected: PASS — all tests (existing + 5 new) green

- [ ] **Step 5: Update the route to fetch and pass through `meal_logs`**

In `app/api/ai/weekly-checkin/route.ts`, replace the `Promise.all` block and the `buildCheckinPrompt` call (lines 15-25) with:

```typescript
  const [{ data: logs }, { data: targets }, { data: mealLogs }] = await Promise.all([
    supabase.from('daily_logs').select('*')
      .eq('user_id', user.id)
      .gte('date', periodStart).lte('date', periodEnd)
      .order('date', { ascending: false }),
    supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('meal_logs').select('date, meal_type, calories, protein_g, fat_g, carbs_g')
      .eq('user_id', user.id)
      .gte('date', periodStart).lte('date', periodEnd),
  ])

  if (!targets) return new Response('No targets configured — set up your targets in Settings first', { status: 422 })

  const prompt = buildCheckinPrompt(targets, logs ?? [], mealLogs ?? [])
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: compiles with no TypeScript errors

- [ ] **Step 7: Manual smoke test**

Run `npm run dev`, visit `/check-in`:
1. Run a check-in over a period that includes per-meal logs (logged in earlier tasks' smoke tests) — confirm the streamed summary references how meals/macros are distributed across the day
2. Run a check-in over a period with no per-meal logs — confirm the output reads exactly as it did before this change

- [ ] **Step 8: Commit**

```bash
git add lib/anthropic/weekly-checkin.ts lib/anthropic/weekly-checkin.test.ts app/api/ai/weekly-checkin/route.ts
git commit -m "feat: make weekly check-in prompt aware of per-meal macro distribution"
```

---

## Self-Review Notes

- **Spec coverage:** §2 (Data Model) → Task 1; §3 (UI/Component Architecture: mode-aware section, `MealEntrySheet`, generalized `ScreenshotUploader`, water input) → Tasks 3, 4, 5; §4 (Data Fetching: `meal-logs` hooks, `useNutritionForDate`) → Task 2; §5 (Weekly Check-In meal distribution) → Task 7; §6 (Out of Scope) → respected (no global mode toggle is built; water has no targets/charts); §7 (Testing) → pure-helper unit tests in Tasks 2 and 7, manual verification checklists embedded in Tasks 3, 5, 6, 7.
- **Type consistency:** `MealLog`/`NutritionForDate`/`sumMealMacros`/`useNutritionForDate`/`UploadTarget`/`MealLogRow` are defined once (Tasks 2, 3, 7) and referenced with identical names and shapes everywhere they're consumed (Tasks 4, 5, 6, 7).
- **No placeholders:** every step contains complete, copy-pasteable code or an exact command with expected output.
