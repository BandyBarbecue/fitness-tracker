# Fitness Tracker — Design Spec
**Date:** 2026-06-05
**Status:** Approved

---

## 1. Overview

A personal web app to track a body-recomposition / fat-loss journey. Single user, not a product. The killer feature is Claude vision screenshot parsing: upload a nutrition app screenshot and have macros extracted and pre-filled into the daily log. An AI coaching layer reads historical data and provides weekly feedback.

**Goal:** lose fat while preserving muscle, targeting ~0.4–0.6 kg/week fat loss from ~12–16% to ~10–12% body fat.

---

## 2. Personal Context (stored in `targets` table, editable in Settings)

| Field | Value |
|---|---|
| Height | 188 cm (6'2") |
| Starting weight | 86 kg |
| Training split | Push / Pull / Legs / Upper — 4 lifting days + daily steps + Zone 2 cardio |
| Calorie target | 2,400 kcal/day |
| Protein target | 185 g/day |
| Fat target | 70 g/day |
| Carbs target | 255 g/day |
| Steps target | 10,000/day |
| Goal rate | 0.4–0.6 kg fat loss/week |

All values are editable in Settings and read dynamically by the AI check-in prompt — nothing is hardcoded.

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Data fetching | TanStack Query v5 (React Query) |
| Database + Auth + Storage | Supabase |
| AI | Anthropic SDK (server-side only) |
| Icons | Lucide React |
| Deployment | Vercel |
| Secrets | Vercel env vars + local `.env.local` |

---

## 4. Architecture — Approach B (Hybrid)

- **React Server Components** render page shells and initial data server-side.
- **TanStack Query** manages all client-side data fetching, caching, and optimistic updates. Dashboard feels snappy with stale-while-revalidate.
- **Dedicated API routes** handle all Anthropic API calls (`/api/ai/extract-macros`, `/api/ai/weekly-checkin`). The Anthropic key never reaches the browser.
- **Supabase SSR helpers** (`@supabase/ssr`) manage session cookies. Auth middleware gates every route except `/login`.
- **Row-Level Security** on every table — all rows are scoped to `auth.uid()`.
- **Private Supabase Storage buckets** (`screenshots`, `progress-photos`). Signed URLs generated server-side on demand; no permanent public links.

---

## 5. Routes

| Route | Description |
|---|---|
| `/` | Redirect → `/dashboard` (or `/login` if unauthenticated) |
| `/login` | Email + password via Supabase Auth |
| `/dashboard` | Weight trend, macros, steps, streak |
| `/log` | Redirect → `/log/[today's date]` |
| `/log/[date]` | Create or edit a specific day's log entry |
| `/photos` | Progress photo gallery + side-by-side comparison |
| `/check-in` | Trigger AI weekly summary; view past summaries |
| `/settings` | Edit targets, body stats, training split |

**API routes (auth-gated, server-only):**

| Route | Purpose |
|---|---|
| `POST /api/ai/extract-macros` | Receive image path, call Claude vision, return extracted macros |
| `POST /api/ai/weekly-checkin` | Receive date range, call Claude with log data, stream coaching summary |

---

## 6. Data Model

### `daily_logs`
```sql
id            uuid        PK
user_id       uuid        FK → auth.users (RLS)
date          date        UNIQUE per user
weight_kg     numeric(5,2)
calories      integer
protein_g     numeric(5,1)
fat_g         numeric(5,1)
carbs_g       numeric(5,1)
steps         integer
session_type  text        -- 'push'|'pull'|'legs'|'upper'|'rest'|'cardio'
sleep_hours   numeric(4,1)   nullable
mood          smallint       nullable  -- 1–5
note          text           nullable
created_at    timestamptz
updated_at    timestamptz
```

### `food_screenshots`
```sql
id             uuid        PK
user_id        uuid        FK (RLS)
daily_log_id   uuid        FK → daily_logs
image_path     text        -- Supabase Storage object path (not a URL)
extracted_json jsonb       -- raw Claude response
confirmed      boolean     DEFAULT false
created_at     timestamptz
```

### `progress_photos`
```sql
id          uuid        PK
user_id     uuid        FK (RLS)
date        date
image_path  text        -- Supabase Storage object path
note        text        nullable
created_at  timestamptz
```

### `targets`
```sql
id                    uuid        PK
user_id               uuid        FK (RLS) UNIQUE
calories              integer
protein_g             numeric(5,1)
fat_g                 numeric(5,1)
carbs_g               numeric(5,1)
steps                 integer
goal_rate_kg_per_week numeric(3,2)
bodyweight_kg         numeric(5,2)
height_cm             integer
training_split        text        -- e.g. 'Push/Pull/Legs/Upper — 4 lifting days'
updated_at            timestamptz
```

### `ai_checkins`
```sql
id            uuid        PK
user_id       uuid        FK (RLS)
created_at    timestamptz
period_start  date
period_end    date
summary_text  text
```

---

## 7. Core Features

### 7.1 Daily Log Entry
Form at `/log/[date]` with fields: morning weight, calories, protein/fat/carbs, steps, session type (pill selector), note, and optional sleep/mood. Optional fields collapsed under "+ Sleep & mood" row by default. The form uses optimistic updates — saves instantly, rolls back on failure.

### 7.2 Screenshot → Macros (AI)

**Flow:**
1. User taps "Extract from screenshot" button at top of log form.
2. Image uploaded to Supabase Storage (`screenshots` bucket, private). A `food_screenshots` row is created with `confirmed=false`.
3. `POST /api/ai/extract-macros` — server fetches the image via a signed URL, sends to Claude vision with a structured extraction prompt, returns `{ calories, protein_g, fat_g, carbs_g, confidence, raw_text }`.
4. Confirmation screen shows extracted values in editable fields. User reviews and adjusts if needed, then taps "Confirm & continue."
5. `daily_logs` row updated with confirmed values. `food_screenshots.confirmed` set to `true`.

**Invariant:** AI-extracted values are never written to `daily_logs` without user confirmation. If extraction fails, the form stays open for manual entry.

### 7.3 Progress Photos
Upload photos tagged with a date. Gallery view shows all photos sorted by date. Comparison view lets the user pick two dates and displays them side by side. All images stored in the private `progress-photos` bucket; access via signed URLs only.

### 7.4 Dashboard

Cards in order (mobile, single column):
1. **Weight trend chart** — 30-day view with daily weight (faint line) and 7-day rolling average (prominent green line) overlaid. The rolling average is the hero — it smooths daily water-weight noise. Tapping a point shows that day's entry.
2. **Protein bar** — today's protein vs target. Highlighted green. The most important daily metric.
3. **Calories + Steps** — two-column card with progress bars.
4. **Streak row** — current streak, logs this week (e.g. 6/7), and weekly weight change vs goal rate.

### 7.5 AI Weekly Check-in

**Flow:**
1. User taps "Run check-in" on the Coach tab.
2. Client fetches last 14 days of `daily_logs` + current `targets` row.
3. `POST /api/ai/weekly-checkin` — server assembles a prompt dynamically from DB values (targets, body stats, training split) plus a compact data table of the last 14 days. Computed stats (7-day trend, protein hit-rate %) are included.
4. Claude streams a coaching summary. Response is displayed in real time.
5. On completion, summary is saved to `ai_checkins`.

All values in the prompt come from the DB at request time. Nothing is hardcoded. Changing targets in Settings takes effect on the next check-in.

### 7.6 Settings
Editable fields: calorie/macro targets, steps target, goal rate, current bodyweight, height, training split description. Single `targets` row per user, upserted on save.

---

## 8. Navigation & App Shell

**Mobile (< 768px):** Fixed bottom tab bar with 5 tabs — Dashboard, Log, Photos, Coach, Settings. Icons from Lucide React (no emoji). Active tab highlighted with emerald accent.

**Desktop (≥ 768px):** Fixed left sidebar with same 5 items, stacked vertically with icons and labels.

**Header:** Minimal — page title on the left, contextual action (e.g. date picker on `/log/[date]`) on the right.

---

## 9. Design Direction

### Colour Palette — Emerald (Option B)

| Token | Value | Use |
|---|---|---|
| Background | `#0a0a0a` | Page background |
| Surface | `#141414` | Cards |
| Border | `#1f1f1f` | Card borders, dividers |
| Accent | `#34d399` | Progress bars, rolling avg line, active states, CTA buttons |
| Text primary | `#f0f0f0` | Headlines, numbers |
| Text secondary | `#a0a0a0` | Labels, secondary values |
| Text muted | `#525252` | Timestamps, hints |
| Calories | `#fbbf24` (amber) | Calorie progress bar |
| Steps | `#60a5fa` (sky) | Steps progress bar |
| Destructive | `#f87171` (red) | Errors, delete actions |

Accent used sparingly: progress bars, the rolling-average line, success states, active tab, and primary action buttons. Everything else is near-black surfaces and white/grey text.

### Typography
- **Font:** Inter (via `next/font`)
- **Hero numbers:** 36px / 800 weight / tight tracking (`−0.03em`) — today's weight, key metrics
- **Card headlines:** 22px / 700 / `−0.02em` — chart values, totals
- **Body:** 15px / 400 — notes, descriptions
- **Labels:** 10px / 600 / all-caps / wide tracking (`0.06em`) — card section headers
- Tabular figures (`font-variant-numeric: tabular-nums`) on all numbers so charts align cleanly

### General
- Card-based layout, `border-radius: 14px` on cards
- Subtle entrance animations (`fade + translate-y`) via Tailwind's `animate-` utilities
- Mobile-first, fully responsive
- No public-facing pages — entire app is behind auth

---

## 10. Auth

- Supabase Auth, email + password
- `@supabase/ssr` for server-side session management
- Next.js middleware redirects unauthenticated requests to `/login`
- Single user — no registration UI needed; account created directly in Supabase dashboard

---

## 11. AI Pipeline Details

### Macro Extraction Prompt (structure)
```
You are extracting nutrition data from a screenshot of a food tracking app.
Return ONLY valid JSON in this exact format:
{ "calories": number, "protein_g": number, "fat_g": number, "carbs_g": number, "confidence": "high"|"medium"|"low", "raw_text": string }
If you cannot extract a value with confidence, set it to null.
Do not include any text outside the JSON object.
```

### Weekly Check-in Prompt (dynamically assembled at request time)
```
You are a personal fitness coach. Your client's profile (from their settings):
- Height: {height_cm}cm, Current weight: {bodyweight_kg}kg
- Programme: {training_split}
- Daily targets: {calories} kcal, {protein_g}g protein, {fat_g}g fat, {carbs_g}g carbs, {steps} steps
- Goal: lose {goal_rate_kg_per_week} kg/week of fat while preserving muscle

Here are their last 14 days of data:
[date | weight | kcal | protein | fat | carbs | steps | session]
...

Computed stats:
- 7-day rolling average weight: {avg}kg (trend: {direction} {delta}kg/week)
- Protein target hit rate: {pct}% of logged days
- Days logged: {n}/14

Give a concise coaching summary (3–5 short paragraphs). Cover: weight trend vs goal rate, protein adherence, what's going well, one specific thing to focus on this week. Be direct and personal. Do not use bullet points.
```

---

## 12. Error Handling

- **AI extraction failure** — structured error returned, form stays open for manual entry, screenshot kept in storage for retry
- **Failed log save** — optimistic update rolls back, toast shows error, form data preserved
- **Auth expiry** — middleware catches refresh failure, redirects to `/login`
- **Check-in streaming timeout** — Vercel 60s limit; partial response shown with "incomplete" flag, not saved to `ai_checkins`
- **Network offline** — React Query shows retry button, in-progress form data preserved in local state

---

## 13. Testing Approach

- **Vitest unit tests** on the 7-day rolling average calculation and the weekly check-in prompt builder (pure functions, high value to test)
- **TypeScript + Supabase generated types** as the primary correctness layer
- **Manual mobile smoke tests** after each milestone
- No E2E tests — disproportionate for a personal tool

---

## 14. Out of Scope

- Food database / barcode scanner (screenshot parsing + manual entry covers it)
- Multiple users / sharing
- PWA / offline support
- Native health app integration (steps entered manually; iOS Shortcut webhook is a potential post-launch bolt-on)
- Push notifications
- Barcode scanning
- Meal planning

---

## 15. Milestones

| # | Scope |
|---|---|
| 1 | Project scaffold, Supabase connected, daily log create/read/list |
| 2 | Dashboard: weight trend (+ rolling average), macro/step charts |
| 3 | Screenshot upload + Claude vision extraction with confirm step |
| 4 | Progress photos + comparison view |
| 5 | AI weekly check-in (streaming) |
| 6 | Design polish, mobile QA, deploy to Vercel |

---

## 16. Cost & Security Notes

- **Anthropic API cost** — screenshot extraction and weekly check-ins are the only paid calls. Screenshot parsing is ~1–2k tokens/call. Weekly check-in is ~3–5k tokens. Low volume for personal use.
- **Supabase Storage** — progress photos are the main storage cost. Standard Supabase free tier covers early use.
- **Secrets** — `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars only. Never committed. Never sent to the client.
- **RLS** — all tables enforce `user_id = auth.uid()`. Storage bucket policies restrict access to authenticated owner only.
