# Date Navigation & Calendar — Design Spec
**Date:** 2026-06-06
**Status:** Approved
**Sub-project:** 1 of 3 (Date Navigation → Per-Meal Logging → Analytics)

---

## 1. Overview

Currently `/log/[date]` accepts an arbitrary date in its URL and `LogForm` correctly loads/saves data for that date — but there's no UI to move between days. Users can only ever reach "today" (via the `/log` redirect). This sub-project adds:

1. A header on `/log/[date]` with prev/next day arrows and a tappable date label
2. A calendar popup (opened by tapping the date label) showing a month grid with dots marking days that have a saved log entry
3. A "Today" shortcut that appears whenever viewing a non-today date

This is purely a navigation layer over existing data — no schema changes.

---

## 2. Components

### `DateNav` (new — `components/log/date-nav.tsx`)
Replaces the current plain `<h1>{date}</h1>` in `LogForm`. A header row containing:
- **Back arrow** — navigates to the previous day (`router.push('/log/[prevDate]')`), always enabled
- **Date label** — formatted e.g. "Thu, 5 Jun" (or "Today" / "Yesterday" for those two special cases), tappable to open `DayCalendarSheet`
- **Forward arrow** — navigates to the next day, **disabled when the viewed date is today** (no browsing into the future, per design decision)
- **"Today" pill** — rendered only when the viewed date is not today; one tap navigates straight to today's date

### `DayCalendarSheet` (new — `components/log/day-calendar-sheet.tsx`)
A custom-built month-grid calendar (no new dependency — uses `date-fns`, styled with the app's existing `--surface` / `--border` / `--accent` design tokens):
- Renders as a bottom-sheet overlay on mobile (`fixed inset-x-0 bottom-0`, slide-up animation consistent with the app's `animate-fade-in-up` utilities) and a centered modal on desktop (`md:` breakpoint)
- Backdrop click or a close button dismisses it
- Month header with prev/next month arrows (independent of the viewed date — browsing the calendar doesn't navigate until a date is tapped)
- 7-column day grid (date-fns `startOfMonth`/`endOfMonth`/`eachDayOfInterval`)
- Each day cell:
  - Shows a small accent-colored dot beneath the date number if `useLoggedDatesInMonth` confirms that date has a saved entry
  - Today is highlighted with an accent ring
  - The currently-viewed date is highlighted with a filled accent background
  - Future dates are visually dimmed and non-interactive (`disabled`, `pointer-events-none`)
- Tapping a valid (past or today) date: `router.push('/log/[date]')`, sheet closes

---

## 3. Data Flow

**No schema changes.** This is purely a navigation feature over the existing `daily_logs` table.

### New query: `useLoggedDatesInMonth`
Added to `lib/queries/daily-logs.ts`:
```ts
export function useLoggedDatesInMonth(monthStart: string) // 'yyyy-MM-01'
```
- Fetches `select date from daily_logs where date >= monthStart and date <= monthEnd` (range computed via `date-fns` `endOfMonth`)
- Returns a `Set<string>` of `'yyyy-MM-dd'` strings for O(1) dot-rendering lookups
- TanStack Query key: `['daily-logs', 'logged-dates', monthStart]` — each month is cached independently; flipping between months in the calendar re-uses cached results instantly on return visits

### Navigation model
The URL `[date]` segment remains the single source of truth — consistent with how `LogForm` already works (it derives all state from the `date` prop, which comes from the route param). Neither `DateNav` nor `DayCalendarSheet` holds the "current date" in client state; they only compute adjacent/relative dates for display and call `router.push`.

### Edge cases
- **Invalid date in URL** (e.g. `/log/not-a-date` or a malformed string): `LogDatePage` validates the param with `date-fns` `isValid(parseISO(date))`. On failure, redirect to `/log` (which redirects to today). This prevents `LogForm`/`DateNav` from crashing on bad input.
- **Calendar opens to the viewed month**, not always the current month — so if you're looking at May 12th and tap the date label, the sheet opens on May, not June.
- **Forward arrow at today**: rendered visually disabled (dimmed, `pointer-events-none`), not hidden — keeps layout stable.

---

## 4. UI Placement

Per design decision, day-switching lives **only on `/log`** (not the dashboard, not globally). The dashboard continues to show "today + trends," keeping its purpose focused. `DateNav` sits at the top of `LogForm`'s rendered output, replacing the existing `<h1>{date}</h1>`.

---

## 5. Out of Scope

- Browsing into future dates (forward arrow stops at today)
- Date scoping on `/dashboard`, `/photos`, or any other route
- Any change to `daily_logs` schema or the save/upsert flow — `LogForm` continues to work exactly as it does today, just now reachable for any past date via the new nav
