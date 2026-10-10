# Fitness Tracker

A full-stack personal body-recomposition tracker with two AI features: **Claude vision reads a screenshot from a nutrition app and fills in your macros**, and an **AI coach streams a weekly check-in** based on everything you've logged.

**Live:** https://fitness-tracker-steel-tau.vercel.app (single-user app, so it needs a login)

## Features

- **Daily log:** weight, calories and macros, steps, water, sleep, mood, training session and notes, for any date. A calendar view marks which days have entries.
- **Screenshot → macros:** upload a screenshot from your nutrition app. Claude vision extracts calories, protein, fat and carbs, and you review them on a confirmation screen before anything is saved.
- **Per-meal logging:** switch between daily totals and per-meal entries (breakfast, lunch, dinner, snacks). Every view reads nutrition from one shared source, so the dashboard, analytics and coach always agree.
- **Dashboard:** weight trend with a 7-day rolling average, protein progress against target, macro split, and streaks.
- **Insights:** a grid of metric tiles with sparklines and a period selector. Each metric has a drill-down page with charts, summary stats and correlation panels (e.g. sleep vs. weight change).
- **Weekly AI check-in:** the server builds a prompt from the week's data (weight trend, adherence, meal distribution, sleep, mood, steps, sessions) and streams Claude's coaching feedback into the Coach tab.
- **Progress photos:** private uploads, a gallery, and side-by-side comparison.
- **Settings:** all targets and body stats are editable. Nothing is hardcoded in the AI prompts.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Data | Supabase Postgres, with **row-level security** on every table (rows scoped to `auth.uid()`) |
| Auth | Supabase Auth via `@supabase/ssr`. A request proxy gates every route except `/login` |
| Storage | Private Supabase buckets. Images are served via short-lived signed URLs |
| Client data | TanStack Query v5 (caching and optimistic updates) |
| Charts | Recharts |
| AI | Anthropic SDK (Claude Sonnet), called **only from server API routes**, so the key never reaches the browser |
| Tests | Vitest (68 unit tests: rolling averages, date helpers, analytics stats, check-in prompt builder, meal logs) |
| Hosting | Vercel |

## Architecture notes

- React Server Components render page shells. TanStack Query handles client-side fetching and cache invalidation.
- AI endpoints: `POST /api/ai/extract-macros` (vision extraction) and `POST /api/ai/weekly-checkin` (streamed response). Both are auth-gated.
- The database schema lives in `supabase/migrations/` (`0001_schema.sql`, `0002_meal_logs.sql`).
- Pure logic, such as the rolling average, date maths, stats and prompt building, is kept out of components so it can be unit tested.

## Running locally

```bash
npm install
cp .env.local.example .env.local   # add your Supabase URL/anon key and Anthropic API key
npm run dev                        # http://localhost:3000
npm test                           # Vitest
```

Apply the SQL migrations in `supabase/migrations/` to your Supabase project first.

## How it was built

I built this with **Claude Code** in June 2026, using a spec-driven workflow from the Superpowers plugin:

1. Brainstorming, with browser mockups of the design options.
2. A written design spec I approved.
3. A task-by-task implementation plan.
4. Test-first implementation, with a code review after each task.

The MVP (17 tasks) was built in one afternoon. Three follow-up features were each specced, planned and built the same way over the next two days: date navigation, per-meal nutrition, and analytics. The specs and plans are in [`docs/superpowers/`](docs/superpowers/).

I was the product owner and user: I set the goals and requirements, made the design decisions, set up Supabase and Vercel, and tested the app day to day. Claude Code wrote most of the implementation.
