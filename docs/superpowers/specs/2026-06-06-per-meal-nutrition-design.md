# Per-Meal Nutrition Logging — Design Spec
**Date:** 2026-06-06
**Status:** Approved
**Sub-project:** 2 of 3 (follows Date Navigation & Calendar, merged to master)

---

## 1. Overview

Today, `/log/[date]` captures a single set of daily macro totals (`calories`, `protein_g`, `fat_g`, `carbs_g`) on `daily_logs`, optionally pre-filled by uploading one nutrition-app screenshot per day and letting Claude vision extract the values.

This sub-project adds the option to log nutrition **per meal** (breakfast / lunch / dinner / snack) — each with its own screenshot-upload-and-AI-extract or manual-entry flow — while keeping the existing "just log one daily total" flow available for days that don't need that level of detail. It also adds simple daily water tracking.

**Goal:** richer nutrition data on the days the user wants it, zero added friction on the days they don't.

---

## 2. Data Model

### New table: `meal_logs`

One row per logged meal. Deliberately **not** FK'd to `daily_logs` — a meal can be logged for a date before any `daily_logs` row exists for that date, avoiding the "ensure a parent row exists first" dance that `ScreenshotUploader` currently has to do for the daily flow.

```sql
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
```

Notes:
- **No uniqueness constraint** on `(user_id, date, meal_type)` — multiple entries per meal type per day are allowed (e.g. two snacks), matching how people actually eat.
- Reuses the existing `update_updated_at()` trigger function.
- No explicit secondary index on `(user_id, date)` — matches the existing tables (e.g. `daily_logs` relies on its PK and unique constraint alone), and is unnecessary at single-user scale. Can be added later if query plans show it's warranted.

### `food_screenshots`: generalize the FK target

Currently `daily_log_id` is required. To let the same upload → AI-extraction pipeline serve per-meal screenshots:

```sql
alter table food_screenshots
  alter column daily_log_id drop not null,
  add column meal_log_id uuid references meal_logs(id) on delete cascade,
  add constraint food_screenshot_exactly_one_target check (
    (daily_log_id is not null)::int + (meal_log_id is not null)::int = 1
  );
```

The existing `extracted_json`, `confirmed`, storage bucket (`screenshots`), and storage RLS policies are untouched and serve both flows identically.

### `daily_logs`: add `water_l`

```sql
alter table daily_logs add column water_l numeric(3,1);
```

A simple optional field (liters, one decimal — e.g. `2.5`), tracked the same way as `steps` or `sleep_hours`. Not part of the meal model; no AI extraction; no relation to `meal_logs`.

---

## 3. UI / Component Architecture

### Mode-aware nutrition section on `/log/[date]`

The "Nutrition" block in `LogForm` becomes mode-aware based on whether any `meal_logs` rows exist for the date:

- **No meals logged** → today's existing UI is unchanged: the daily `ScreenshotUploader` + the 4 editable macro inputs (calories/protein/fat/carbs). A new `+ Log by meal instead` button/link opens the add-meal sheet to start the per-meal flow.
- **One or more meals logged** → the 4 editable inputs and the daily screenshot uploader are replaced by:
  - A **read-only "Today's totals" summary** — sum across all of the day's meals, computed by `useNutritionForDate` (see §4)
  - A **meal list**, grouped by `meal_type` (Breakfast / Lunch / Dinner / Snacks), each entry showing its macros, with a per-group subtotal
  - A `+ Add meal` button

Tapping an existing meal entry reopens the sheet pre-filled for editing, with a delete option. The same sheet serves add and edit.

### New component: `MealEntrySheet`

A bottom sheet, following the existing `day-calendar-sheet.tsx` pattern (overlay, slide-up, escape-to-dismiss, accessible labeling, z-index above bottom nav):

1. **Meal-type picker** — breakfast / lunch / dinner / snack (styled like `SessionPicker`)
2. **Entry method** — upload screenshot (AI-extracted) *or* enter macros manually
3. **Optional note** field
4. **Save** / **Cancel** / **Delete** (delete shown only when editing an existing entry)

### Generalizing `ScreenshotUploader`

The component currently hardcodes "attach to a `daily_log_id`, lazily creating the `daily_logs` row if one doesn't exist yet." It will take a discriminated `target` prop instead:

```ts
type UploadTarget =
  | { type: 'daily'; dailyLogId: string | null; date: string }
  | { type: 'meal'; mealLogId: string }
```

- For `type: 'daily'`, behavior is unchanged from today (lazily upserts a `daily_logs` row, inserts `food_screenshots` with `daily_log_id`).
- For `type: 'meal'`, the sheet first creates the draft `meal_logs` row (meal type + date, macros left `null`) when the user picks "upload screenshot," then passes its id; the uploader inserts `food_screenshots` with `meal_log_id`.

`MacroConfirm` is reused unchanged — it already just returns `{ calories, protein_g, fat_g, carbs_g }` regardless of where those values end up.

### Water input

A plain number input (liters, one decimal) added to the existing "Sleep & mood (optional)" expandable section in `LogForm`, written straight to `daily_logs.water_l` via the existing `useUpsertLog`. No sheet, no AI, no relation to meals.

---

## 4. Data Fetching

### New `lib/queries/meal-logs.ts`

- **`useMealLogsForDate(date)`** — `useQuery` over `meal_logs` filtered by `date`, query key `['meal-logs', date]`
- **`useUpsertMealLog()`** — insert or update a `meal_logs` row; on success invalidates `['meal-logs', date]` and `['daily-log', date]` (the latter because computed totals derive from both sources)
- **`useDeleteMealLog()`** — delete a `meal_logs` row; same invalidation as above

### New shared helper: `useNutritionForDate(date)`

Lives alongside the meal-log hooks (or in a small `lib/nutrition.ts`). Combines `useDailyLog(date)` and `useMealLogsForDate(date)`:

- If `meal_logs` rows exist for the date → returns `{ source: 'meals', calories, protein_g, fat_g, carbs_g, meals }`, with the four macro values being the **sum across all meals**
- Otherwise → returns `{ source: 'daily', calories, protein_g, fat_g, carbs_g, meals: [] }`, taken straight from the `daily_logs` row

This hook is the single source of truth for "what are this day's nutrition totals," consumed by:
- `LogForm` — to decide which UI mode to render and to populate the read-only summary
- `DashboardMetrics` — so the "Calories" card on `/dashboard` reflects meal-summed totals on days that have them, and the existing `daily_logs` value on days that don't

### Mutation flow recap

- **Manual meal entry**: `MealEntrySheet` calls `useUpsertMealLog()` directly with the typed-in macros.
- **Screenshot meal entry**: sheet creates a draft `meal_logs` row → `ScreenshotUploader` (target `meal`) uploads + calls `/api/ai/extract-macros` (unchanged route — it already works generically off `screenshotId`/`imagePath`) → `MacroConfirm` → `useUpsertMealLog()` writes the confirmed values onto the draft row, and `food_screenshots.confirmed` is set to `true`.

---

## 5. Out of Scope

- No changes to the AI weekly check-in (`/api/ai/weekly-checkin`) — it can be extended to reference per-meal data in a future sub-project if useful, but that's not part of this one.
- No global setting or per-day toggle for "simple vs. per-meal" mode — the mode is purely a function of whether meals exist for the date (per design decision above).
- Water is a simple tracked number; no targets, charts, or reminders for it in this sub-project.

---

## 6. Testing

- Unit-level: pure helpers (e.g. the meal-summing logic inside `useNutritionForDate`) get plain function tests where practical.
- Manual verification on `/log/[date]`:
  - Logging a day with no meals behaves exactly as today (regression check)
  - Adding a meal switches the section into per-meal mode; totals update correctly as meals are added/edited/deleted
  - Screenshot upload + AI extraction works for a meal entry (mirrors the existing daily flow)
  - Dashboard "Calories" card reflects meal-summed totals on days with meals, and `daily_logs.calories` on days without
  - Water field saves and round-trips via `useUpsertLog`
