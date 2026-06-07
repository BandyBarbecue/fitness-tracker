# Analytics & Insights — Design Spec
**Date:** 2026-06-07
**Status:** Approved
**Sub-project:** 3 of 3 (follows Date Navigation & Calendar, Per-Meal Nutrition Logging)

---

## 1. Overview

Sub-project 3 adds a full analytics layer across three areas:

1. **Dashboard "Today at a Glance" card** — compact card showing calories, steps, sleep, mood, and macro pie chart. Each metric is tappable and navigates to its analytics detail page.
2. **Insights tab** — the Photos tab becomes an Insights tab containing two sub-tabs: Analytics (new) and Photos (existing, moved). Nav stays at 5 tabs.
3. **Analytics grid** (`/insights`) — 9 metric squares in a 2-column grid with a global period selector (7d / 30d / 90d). Each square shows the summary stat for the period + mini sparkline.
4. **Metric detail pages** (`/insights/[metric]`) — full chart, key stats, period comparison delta, and one predefined correlated-metric panel per metric.
5. **Enhanced coach prompt** — `buildCheckinPrompt` gains computed stats for sleep, mood, water, steps, and session frequency — mirroring what the analytics grid surfaces.

---

## 2. Navigation Restructure

The Photos tab becomes the **Insights** tab. Nav label: "Insights", icon: bar chart, href: `/insights`. All other tabs (Dashboard, Log, Coach, Settings) are unchanged.

| Old route | New route | Notes |
|---|---|---|
| `/photos` | `/insights/photos` | Page moved inside Insights |
| *(new)* | `/insights` | Analytics grid — default sub-tab |
| *(new)* | `/insights/[metric]` | Detail page per metric |

`/photos` stays as a server-side redirect to `/insights/photos` so existing bookmarks don't break.

Inside Insights, a sub-tab strip at the top switches between **Analytics** (`/insights`) and **Photos** (`/insights/photos`).

---

## 3. Dashboard: "Today at a Glance" Card

### What changes
`DashboardMetrics` (the current Calories + Steps two-column card) is replaced by a new `TodayGlanceCard`. `ProteinCard` stays above it, unchanged.

### `TodayGlanceCard` (`components/dashboard/today-glance-card.tsx`)

**Data sources:**
- `useNutritionForDate(today)` → calories, protein_g, fat_g, carbs_g
- `useDailyLog(today)` → steps, sleep_hours, mood, water_l

**Layout:**

*Top row — 4 metric cells in a 2×2 mini-grid:*

| Cell | Value shown | Progress indicator | Links to |
|---|---|---|---|
| Calories | kcal value | Bar vs target | `/insights/calories` |
| Steps | step count | Bar vs target | `/insights/steps` |
| Sleep | hours | Plain value | `/insights/sleep` |
| Mood | n/5 | Dot scale (5 dots) | `/insights/mood` |

Each cell is a `Link` (`next/link`). Tapping navigates to the corresponding analytics detail page.

*Bottom row — Macro pie chart:*
- Recharts `PieChart` showing protein / fat / carbs proportions for today
- Legend with gram amounts beside the pie
- Entire bottom row is a `Link` to `/insights/macros`
- Falls back to a muted "Log nutrition to see macro split" message if no macros are logged for today

**Empty states:** Any unlogged metric shows "—" in muted text. No broken layout.

**Styling:** Same card shell as existing cards — `rounded-2xl p-4`, `var(--surface)` background, `var(--border)` border, consistent with the design system.

---

## 4. Insights Tab & Analytics Grid

### Layout (`app/(app)/insights/page.tsx`)

- Period selector at the top: **7d**, **30d**, **90d** pill buttons — local React state, resets on navigation
- Small uppercase section dividers between metric groups: **Body**, **Nutrition**, **Activity**, **Wellbeing**
- 2-column grid of 9 `MetricSquare` components
- Skeleton shimmer on all squares while data loads

### `MetricSquare` (`components/analytics/metric-square.tsx`)

Each square shows:
- Metric name + icon
- Primary stat (see table below)
- 7-bar mini sparkline from the period
- Trend arrow (↑ ↓ →) comparing first half vs second half of the period

Tapping navigates to `/insights/[metric]`.

### Primary stat per metric

| Metric | Slug | Stat shown | Section |
|---|---|---|---|
| Weight | `weight` | Avg kg for period | Body |
| Calories | `calories` | Avg kcal/day | Nutrition |
| Protein | `protein` | % of days hitting target | Nutrition |
| Macro Split | `macros` | Avg protein % of total kcal | Nutrition |
| Steps | `steps` | Avg steps/day | Activity |
| Sessions | `sessions` | Total sessions; type breakdown e.g. "4P 3Pu 3L" | Activity |
| Sleep | `sleep` | Avg hours/night | Wellbeing |
| Mood | `mood` | Avg score /5 | Wellbeing |
| Water | `water` | Avg litres/day | Wellbeing |

### Data fetching

**`useAnalyticsForPeriod(startDate, endDate)`** (`lib/queries/analytics.ts`):
- Single `daily_logs` query for the range — all metric squares derive their stats from this shared result. One DB call, 9 derived values.
- Period boundaries computed via `date-fns` `subDays` / `format` from today.

**`useMealLogsForPeriod(startDate, endDate)`** (`lib/queries/analytics.ts`):
- Only called by the Macro Split square and its detail page.
- Falls back to `daily_logs` macro totals if no meal rows exist for the period.

---

## 5. Metric Detail Pages

**Route:** `app/(app)/insights/[metric]/page.tsx`

Unknown slugs redirect to `/insights` via `redirect()`.

### Page structure

1. **Back arrow + metric title** (standard page header pattern)
2. **Period selector** — 7d / 30d / 90d (local state, independent of grid's selector)
3. **Hero stat** — large avg value + delta vs previous equivalent period (e.g. "↑ 0.4 hr vs previous 30d")
4. **Primary chart** — full-width Recharts chart (type per metric, see below)
5. **Stats row** — 3–4 compact chips: avg, best, worst, days logged; "vs target" where a target exists in `targets`
6. **Correlation panel** (`components/analytics/correlation-panel.tsx`) — labelled "How this relates to [correlated metric]"; mini dual-axis or overlaid chart. Bottom of panel: "→ View [correlated metric]" link.

### Primary chart per metric

| Metric | Chart type |
|---|---|
| Weight | Line (daily dots + 7-day rolling avg line — matches dashboard) |
| Calories | Bar + target reference line |
| Protein | Hit/miss bar (accent = hit, muted = miss) + target line |
| Macro Split | Stacked area (protein / fat / carbs % over time) |
| Steps | Bar + target reference line |
| Sessions | Stacked bar by session type (colour-coded by type) |
| Sleep | Bar + avg reference line |
| Mood | Bar (colour-coded: 1–2 red, 3 amber, 4–5 accent) |
| Water | Bar |

### Predefined correlation pairs

| Metric | Correlated with | Correlation chart |
|---|---|---|
| Weight | Calories | Weight line + calories bar (dual axis) |
| Calories | Weight | Same chart, weight perspective |
| Protein | Weight | Protein hit/miss bars + weight line |
| Sleep | Mood | Sleep bars + mood line overlay |
| Mood | Sleep | Same chart, mood perspective |
| Steps | Weight | Steps bars + weight line |
| Water | Mood | Water bars + mood line |
| Sessions | Mood | Session-type stacked bars + mood line |
| Macro Split | Protein | Stacked macro % area + protein g line |

All correlation data comes from the same `useAnalyticsForPeriod` call — no additional DB queries.

---

## 6. Enhanced Coach Prompt

`buildCheckinPrompt` in `lib/anthropic/weekly-checkin.ts` gains additional computed stats, mirroring the analytics grid's summary stats. These are pure derivations from the `LogRow[]` data already passed in — no new DB queries or API route changes needed.

### New computed stats added to the prompt

- **Avg sleep hours** for the period (excluding null days)
- **Avg mood score** (1–5) for the period (excluding null days)
- **Avg water intake** (litres) for the period (excluding null days)
- **Steps hit rate %** — days hitting `targets.steps` (parallel to existing protein hit rate)
- **Session breakdown** — count by type for the period (e.g. "Push ×4, Pull ×3, Legs ×3, Rest ×2, Cardio ×1")

### Coaching instruction extension

The closing instruction gains one additional item:

> "…sleep quality and trends, mood patterns, hydration, and training frequency — and whether any of these correlate with weight or energy patterns in the data."

### Tests

New test cases in `weekly-checkin.test.ts` covering:
- Avg sleep / mood / water computed correctly (excluding nulls)
- Steps hit rate computed correctly
- Session breakdown string formatted correctly
- Empty / all-null cases handled gracefully (no NaN, no crash)

---

## 7. Component Architecture

```
app/(app)/
  insights/
    layout.tsx              ← sub-tab strip (Analytics / Photos)
    page.tsx                ← analytics grid
    [metric]/
      page.tsx              ← detail page
    photos/
      page.tsx              ← existing photos page (moved from app/(app)/photos/)
  photos/
    page.tsx                ← redirect → /insights/photos
  dashboard/
    page.tsx                ← unchanged shell
    dashboard-metrics.tsx   ← REMOVED (replaced by TodayGlanceCard)

components/
  analytics/
    metric-square.tsx       ← grid tile + sparkline + trend arrow
    period-selector.tsx     ← 7d/30d/90d pills (shared between grid + detail)
    correlation-panel.tsx   ← dual-metric mini-chart with link to full detail
    detail-chart.tsx        ← full-width chart, switches rendering by metric slug
  dashboard/
    today-glance-card.tsx   ← NEW — replaces DashboardMetrics
    protein-card.tsx        ← unchanged

lib/queries/
  analytics.ts              ← useAnalyticsForPeriod, useMealLogsForPeriod

lib/anthropic/
  weekly-checkin.ts         ← extended LogRow type + new computed stats
  weekly-checkin.test.ts    ← new test cases for new stats
```

---

## 8. Error Handling

- **No data for period** — metric squares and detail pages render a clear empty state ("No data logged for this period") rather than broken charts
- **Partial data** — charts render with available rows; gaps show as missing bars (`connectNulls={false}` in Recharts)
- **Unknown metric slug** — `[metric]/page.tsx` calls `redirect('/insights')` server-side
- **Query errors** — TanStack Query `isError` state shows retry button, consistent with existing error handling

---

## 9. Testing

**Unit tests** (`lib/queries/analytics.test.ts`):
- Period boundary computation (7d, 30d, 90d from today)
- Stat derivation: avg, hit rate %, trend direction arrow logic
- Rolling average reused from existing `lib/utils/rolling-average.ts`

**Unit tests** (`lib/anthropic/weekly-checkin.test.ts`):
- New computed stats (sleep avg, mood avg, water avg, steps hit rate, session breakdown)
- Null-safe handling for all new stats

**Manual smoke checks:**
- Grid loads with correct period stats; period selector updates all squares
- Each metric square navigates to correct detail page
- Detail pages render charts and correlation panels
- Dashboard "Today at a Glance" metrics link through to analytics correctly
- Photos sub-tab still works after route move
- `/photos` redirect works

---

## 10. Out of Scope

- AI-generated insights on the analytics page (Coach tab serves this)
- Export / CSV download
- Custom date range picker (7d / 30d / 90d covers the need)
- Chart annotations from the analytics view
- Water target (no target field in `targets` table — water chart shows raw intake only)
- Correlation between more than two metrics at a time
