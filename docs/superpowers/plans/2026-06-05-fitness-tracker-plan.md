# Fitness Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal body-recomposition tracker with AI-powered macro extraction from screenshots, a dashboard with rolling-average weight trend, and a weekly AI coaching check-in.

**Architecture:** Next.js 15 App Router with React Server Components for page shells, TanStack Query for client-side data fetching and caching, and dedicated API routes for all Anthropic API calls. Supabase handles the database (PostgreSQL + RLS), auth (email+password), and private file storage.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Recharts, TanStack Query v5, Supabase (`@supabase/ssr`), Anthropic SDK, Lucide React, Vitest, Vercel

---

## File Map

```
app/
  layout.tsx                          # Root layout — fonts, providers
  globals.css                         # Tailwind base + CSS custom properties
  (auth)/login/page.tsx               # Login page
  (app)/layout.tsx                    # Authenticated shell — bottom nav / sidebar
  (app)/dashboard/page.tsx            # Dashboard
  (app)/log/page.tsx                  # Redirect to /log/[today]
  (app)/log/[date]/page.tsx           # Daily log create/edit
  (app)/photos/page.tsx               # Progress photos
  (app)/check-in/page.tsx             # AI coach tab
  (app)/settings/page.tsx             # Edit targets
  api/ai/extract-macros/route.ts      # Claude vision endpoint
  api/ai/weekly-checkin/route.ts      # Streaming coaching endpoint

components/
  providers.tsx                       # TanStack Query provider (client)
  nav/bottom-nav.tsx                  # Mobile bottom tab bar
  nav/sidebar.tsx                     # Desktop sidebar
  dashboard/weight-chart.tsx          # Recharts weight + rolling avg
  dashboard/protein-card.tsx          # Protein hero progress card
  dashboard/metric-card.tsx           # Generic calories/steps card
  dashboard/streak-row.tsx            # Streak / consistency stats
  log/log-form.tsx                    # Daily log entry form
  log/session-picker.tsx              # Pill selector for session type
  log/screenshot-uploader.tsx         # Screenshot upload + AI extract
  log/macro-confirm.tsx               # AI extraction confirmation screen
  photos/photo-gallery.tsx            # Progress photo grid
  photos/photo-comparison.tsx         # Side-by-side photo comparison
  check-in/checkin-ui.tsx             # Trigger button + streaming display

lib/
  supabase/client.ts                  # Browser Supabase client factory
  supabase/server.ts                  # Server Supabase client factory
  queries/daily-logs.ts               # TanStack Query hooks — logs
  queries/targets.ts                  # TanStack Query hooks — targets
  queries/photos.ts                   # TanStack Query hooks — photos
  utils/rolling-average.ts            # 7-day rolling average (pure fn)
  utils/format.ts                     # Number/date formatters
  anthropic/extract-macros.ts         # Vision prompt + response parser
  anthropic/weekly-checkin.ts         # Coaching prompt builder

middleware.ts                         # Auth middleware (Supabase SSR)
types/database.ts                     # Supabase generated types
supabase/migrations/0001_schema.sql   # All tables, RLS, storage buckets
.env.local.example                    # Env var template
vitest.config.ts                      # Vitest config
```

---

## Task 0: Project Scaffold

**Goal:** Create a working Next.js 15 project with TypeScript, Tailwind, all required packages, folder structure, and environment variable template.

**Files:**
- Create: entire project root via `create-next-app`
- Create: `.env.local.example`
- Create: `vitest.config.ts`
- Create: `app/globals.css` (replace default)

**Acceptance Criteria:**
- [ ] `npm run dev` starts without errors on `http://localhost:3000`
- [ ] `npm run build` compiles without TypeScript errors
- [ ] `npx vitest run` exits 0 with no test files found (not an error)
- [ ] `.env.local.example` lists all required variables

**Verify:** `npm run build` → `✓ Compiled successfully`

**Steps:**

- [ ] **Step 1: Scaffold the project**

```bash
cd "c:/Claude Projects SAFE/Fitness Tracker"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*"
```

When prompted: Yes to all defaults. Choose `no` to Turbopack if asked (stable builds).

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/ssr @supabase/supabase-js @tanstack/react-query anthropic recharts lucide-react
npm install --save-dev vitest @vitejs/plugin-react jsdom @vitest/coverage-v8
```

- [ ] **Step 3: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 4: Add vitest script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create env template**

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
```

Copy to `.env.local` and fill in real values from the Supabase dashboard and Anthropic console.

- [ ] **Step 6: Replace globals.css with design tokens**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg: #0a0a0a;
  --surface: #141414;
  --border: #1f1f1f;
  --accent: #34d399;
  --text-primary: #f0f0f0;
  --text-secondary: #a0a0a0;
  --text-muted: #525252;
  --amber: #fbbf24;
  --sky: #60a5fa;
  --red: #f87171;
}

body {
  background-color: var(--bg);
  color: var(--text-primary);
  font-family: var(--font-inter), system-ui, sans-serif;
}

* {
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 7: Create folder structure**

```bash
mkdir -p app/\(auth\)/login app/\(app\)/dashboard app/\(app\)/log app/\(app\)/photos app/\(app\)/check-in app/\(app\)/settings app/api/ai/extract-macros app/api/ai/weekly-checkin
mkdir -p components/nav components/dashboard components/log components/photos components/check-in
mkdir -p lib/supabase lib/queries lib/utils lib/anthropic
mkdir -p supabase/migrations types
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```

Expected: `✓ Compiled successfully` (ignore "no pages" warnings)

- [ ] **Step 9: Add .env.local to .gitignore and commit**

```bash
echo ".env.local" >> .gitignore
git add -A
git commit -m "feat: project scaffold with Next.js 15, Tailwind, Supabase, TanStack Query"
```

---

## Task 1: Database Schema & RLS

**Goal:** Create all Supabase tables, RLS policies, and storage buckets via a migration file that can be applied to any Supabase project.

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Acceptance Criteria:**
- [ ] All 5 tables exist in Supabase with correct columns and constraints
- [ ] RLS is enabled on all tables; anonymous queries return 0 rows
- [ ] Both storage buckets exist and are private
- [ ] `supabase gen types typescript` produces a valid `types/database.ts`

**Verify:** Run the migration in the Supabase SQL editor — no errors. Then `npx supabase gen types typescript --project-id <id> --schema public > types/database.ts` succeeds.

**Steps:**

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/0001_schema.sql

-- daily_logs
create table daily_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  date          date not null,
  weight_kg     numeric(5,2),
  calories      integer,
  protein_g     numeric(5,1),
  fat_g         numeric(5,1),
  carbs_g       numeric(5,1),
  steps         integer,
  session_type  text check (session_type in ('push','pull','legs','upper','rest','cardio')),
  sleep_hours   numeric(4,1),
  mood          smallint check (mood between 1 and 5),
  note          text,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null,
  unique(user_id, date)
);

-- food_screenshots
create table food_screenshots (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  daily_log_id   uuid references daily_logs(id) on delete cascade not null,
  image_path     text not null,
  extracted_json jsonb,
  confirmed      boolean default false not null,
  created_at     timestamptz default now() not null
);

-- progress_photos
create table progress_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  date        date not null,
  image_path  text not null,
  note        text,
  created_at  timestamptz default now() not null
);

-- targets (single row per user, upserted on settings save)
create table targets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade not null unique,
  calories              integer not null default 2400,
  protein_g             numeric(5,1) not null default 185,
  fat_g                 numeric(5,1) not null default 70,
  carbs_g               numeric(5,1) not null default 255,
  steps                 integer not null default 10000,
  goal_rate_kg_per_week numeric(3,2) not null default 0.5,
  bodyweight_kg         numeric(5,2) not null default 86,
  height_cm             integer not null default 188,
  training_split        text not null default 'Push/Pull/Legs/Upper — 4 lifting days + daily steps + Zone 2 cardio',
  updated_at            timestamptz default now() not null
);

-- ai_checkins
create table ai_checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  created_at    timestamptz default now() not null,
  period_start  date not null,
  period_end    date not null,
  summary_text  text not null
);

-- RLS
alter table daily_logs      enable row level security;
alter table food_screenshots enable row level security;
alter table progress_photos  enable row level security;
alter table targets          enable row level security;
alter table ai_checkins      enable row level security;

create policy "own_logs"        on daily_logs      for all using (auth.uid() = user_id);
create policy "own_screenshots" on food_screenshots for all using (auth.uid() = user_id);
create policy "own_photos"      on progress_photos  for all using (auth.uid() = user_id);
create policy "own_targets"     on targets          for all using (auth.uid() = user_id);
create policy "own_checkins"    on ai_checkins      for all using (auth.uid() = user_id);

-- Auto-update updated_at on daily_logs
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger daily_logs_updated_at
  before update on daily_logs
  for each row execute function update_updated_at();

-- Storage buckets (run separately in Supabase dashboard Storage section
-- OR via Supabase CLI: supabase storage create screenshots --private)
-- If running in SQL editor, use:
insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false) on conflict do nothing;

-- Storage RLS: files stored as {user_id}/{filename}
create policy "upload_screenshots" on storage.objects for insert
  with check (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "read_screenshots" on storage.objects for select
  using (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "delete_screenshots" on storage.objects for delete
  using (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "upload_photos" on storage.objects for insert
  with check (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "read_photos" on storage.objects for select
  using (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "delete_photos" on storage.objects for delete
  using (bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Go to Supabase dashboard → SQL Editor → paste the full migration → Run.

- [ ] **Step 3: Generate TypeScript types**

```bash
npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> --schema public > types/database.ts
```

Replace `<YOUR_PROJECT_ID>` with the value from your Supabase project URL (e.g. `abcdefghijkl`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_schema.sql types/database.ts
git commit -m "feat: Supabase schema, RLS policies, and generated types"
```

---

## Task 2: Auth & Supabase Clients

**Goal:** Wire up Supabase email+password auth — login page, session middleware, and reusable server/browser client factories.

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `components/providers.tsx`
- Modify: `app/layout.tsx`

**Acceptance Criteria:**
- [ ] Visiting `/dashboard` while logged out redirects to `/login`
- [ ] Submitting correct credentials on `/login` redirects to `/dashboard`
- [ ] Visiting `/login` while logged in redirects to `/dashboard`
- [ ] `npm run build` passes with no type errors

**Verify:** Manual — open `http://localhost:3000`, confirm redirect to `/login`. Log in with Supabase credentials, confirm redirect to `/dashboard`.

**Steps:**

- [ ] **Step 1: Browser Supabase client**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Server Supabase client**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 3: Auth middleware**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

- [ ] **Step 4: TanStack Query provider**

```typescript
// components/providers.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

- [ ] **Step 5: Root layout with Inter font and providers**

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Fitness Tracker',
  description: 'Personal body-recomposition tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Login page**

```typescript
// app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Sign in</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>Your personal fitness tracker</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#0a0a0a' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create a user in Supabase dashboard**

Go to Supabase → Authentication → Users → Add user. Use your real email and a strong password. This is the only user the app will ever have.

- [ ] **Step 8: Test manually and commit**

```bash
npm run dev
# Open http://localhost:3000 — should redirect to /login
# Log in — should redirect to /dashboard (404 for now, that's fine)
git add -A
git commit -m "feat: Supabase auth, middleware, login page"
```

---

## Task 3: App Shell & Navigation

**Goal:** Build the authenticated layout with a bottom tab bar (mobile) and sidebar (desktop), and stub out all five tab pages so navigation works end-to-end.

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/dashboard/page.tsx` (stub)
- Create: `app/(app)/log/page.tsx` (redirect)
- Create: `app/(app)/log/[date]/page.tsx` (stub)
- Create: `app/(app)/photos/page.tsx` (stub)
- Create: `app/(app)/check-in/page.tsx` (stub)
- Create: `app/(app)/settings/page.tsx` (stub)
- Create: `components/nav/bottom-nav.tsx`
- Create: `components/nav/sidebar.tsx`

**Acceptance Criteria:**
- [ ] All 5 tab routes render without errors when logged in
- [ ] `/log` redirects to `/log/2026-06-05` (today's date)
- [ ] Bottom nav visible on mobile (< 768px), sidebar visible on desktop
- [ ] Active tab highlighted with accent colour

**Verify:** `npm run dev` → manually tap each tab on a mobile viewport in DevTools.

**Steps:**

- [ ] **Step 1: Bottom nav component**

```typescript
// components/nav/bottom-nav.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, PenLine, Camera, Bot, Settings } from 'lucide-react'

const tabs = [
  { href: '/dashboard', label: 'Dashboard', Icon: BarChart2 },
  { href: '/log',       label: 'Log',       Icon: PenLine   },
  { href: '/photos',    label: 'Photos',    Icon: Camera    },
  { href: '/check-in',  label: 'Coach',     Icon: Bot       },
  { href: '/settings',  label: 'Settings',  Icon: Settings  },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden grid grid-cols-5 z-50"
      style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)' }}
    >
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link key={href} href={href} className="flex flex-col items-center gap-1 py-2 pt-3">
            <Icon
              size={20}
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
              strokeWidth={active ? 2.5 : 1.75}
            />
            <span
              className="text-[9px] font-semibold"
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Sidebar component**

```typescript
// components/nav/sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, PenLine, Camera, Bot, Settings } from 'lucide-react'

const tabs = [
  { href: '/dashboard', label: 'Dashboard', Icon: BarChart2 },
  { href: '/log',       label: 'Log',       Icon: PenLine   },
  { href: '/photos',    label: 'Photos',    Icon: Camera    },
  { href: '/check-in',  label: 'Coach',     Icon: Bot       },
  { href: '/settings',  label: 'Settings',  Icon: Settings  },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside
      className="hidden md:flex fixed top-0 left-0 h-full w-56 flex-col gap-1 p-4 z-50"
      style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}
    >
      <div className="px-3 pt-4 pb-6">
        <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Fitness</span>
      </div>
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
            style={{
              background: active ? '#34d39915' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <Icon size={18} strokeWidth={active ? 2.5 : 1.75} />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 3: Authenticated layout**

```typescript
// app/(app)/layout.tsx
import { BottomNav } from '@/components/nav/bottom-nav'
import { Sidebar } from '@/components/nav/sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:pl-56">
      <Sidebar />
      <main className="pb-20 md:pb-0 min-h-screen">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 4: Log redirect page**

```typescript
// app/(app)/log/page.tsx
import { redirect } from 'next/navigation'
import { format } from 'date-fns'

export default function LogPage() {
  redirect(`/log/${format(new Date(), 'yyyy-MM-dd')}`)
}
```

Install date-fns: `npm install date-fns`

- [ ] **Step 5: Stub pages for all tabs**

```typescript
// app/(app)/dashboard/page.tsx
export default function DashboardPage() {
  return <div className="p-4 pt-8"><h1 className="text-xl font-bold">Dashboard</h1></div>
}
```

Repeat the same minimal stub for:
- `app/(app)/log/[date]/page.tsx` — show `params.date` in heading
- `app/(app)/photos/page.tsx`
- `app/(app)/check-in/page.tsx`
- `app/(app)/settings/page.tsx`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: app shell with bottom nav (mobile) and sidebar (desktop)"
```

---

## Task 4: Daily Log CRUD

**Goal:** Build the daily log entry form at `/log/[date]` — create and edit a day's entry with all fields, session type picker, and a recent log list accessible from the Log tab.

**Files:**
- Create: `components/log/log-form.tsx`
- Create: `components/log/session-picker.tsx`
- Create: `lib/queries/daily-logs.ts`
- Modify: `app/(app)/log/[date]/page.tsx`
- Modify: `app/(app)/log/page.tsx` (add recent list)

**Acceptance Criteria:**
- [ ] Submitting the form creates a `daily_logs` row in Supabase
- [ ] Returning to the same date pre-fills all fields from the existing row
- [ ] Session type pill selector highlights selected type in accent colour
- [ ] Protein field visually distinct (accent border)
- [ ] Optional fields (sleep, mood) hidden until "+ Sleep & mood" tapped
- [ ] Toast shown on save success/failure

**Verify:** `npm run dev` → create an entry → refresh → confirm form pre-fills.

**Steps:**

- [ ] **Step 1: TanStack Query hooks for daily logs**

```typescript
// lib/queries/daily-logs.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type DailyLog = Database['public']['Tables']['daily_logs']['Row']
type DailyLogInsert = Database['public']['Tables']['daily_logs']['Insert']

export function useDailyLog(date: string) {
  return useQuery({
    queryKey: ['daily-log', date],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('date', date)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useRecentLogs(limit = 14) {
  return useQuery({
    queryKey: ['daily-logs', 'recent', limit],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useUpsertLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (log: DailyLogInsert) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('daily_logs')
        .upsert(log, { onConflict: 'user_id,date' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['daily-log', data.date] })
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] })
    },
  })
}
```

- [ ] **Step 2: Session picker component**

```typescript
// components/log/session-picker.tsx
const SESSIONS = ['push', 'pull', 'legs', 'upper', 'rest', 'cardio'] as const
export type SessionType = typeof SESSIONS[number]

interface Props {
  value: SessionType | null
  onChange: (v: SessionType) => void
}

export function SessionPicker({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        Session
      </label>
      <div className="flex flex-wrap gap-2">
        {SESSIONS.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold capitalize transition-colors"
            style={{
              background: value === s ? '#34d39920' : 'var(--surface)',
              border: `1px solid ${value === s ? '#34d39960' : 'var(--border)'}`,
              color: value === s ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Log form component**

```typescript
// components/log/log-form.tsx
'use client'
import { useState, useEffect } from 'react'
import { SessionPicker, type SessionType } from './session-picker'
import { useDailyLog, useUpsertLog } from '@/lib/queries/daily-logs'
import { createClient } from '@/lib/supabase/client'

interface Props { date: string }

export function LogForm({ date }: Props) {
  const { data: existing } = useDailyLog(date)
  const upsert = useUpsertLog()
  const [showOptional, setShowOptional] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [fields, setFields] = useState({
    weight_kg: '', calories: '', protein_g: '', fat_g: '', carbs_g: '',
    steps: '', session_type: null as SessionType | null,
    sleep_hours: '', mood: '', note: '',
  })

  useEffect(() => {
    if (existing) {
      setFields({
        weight_kg:    String(existing.weight_kg ?? ''),
        calories:     String(existing.calories ?? ''),
        protein_g:    String(existing.protein_g ?? ''),
        fat_g:        String(existing.fat_g ?? ''),
        carbs_g:      String(existing.carbs_g ?? ''),
        steps:        String(existing.steps ?? ''),
        session_type: (existing.session_type as SessionType) ?? null,
        sleep_hours:  String(existing.sleep_hours ?? ''),
        mood:         String(existing.mood ?? ''),
        note:         existing.note ?? '',
      })
    }
  }, [existing])

  function set(key: keyof typeof fields, value: string) {
    setFields(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      await upsert.mutateAsync({
        user_id:      user.id,
        date,
        weight_kg:    fields.weight_kg    ? parseFloat(fields.weight_kg)    : null,
        calories:     fields.calories     ? parseInt(fields.calories)        : null,
        protein_g:    fields.protein_g    ? parseFloat(fields.protein_g)    : null,
        fat_g:        fields.fat_g        ? parseFloat(fields.fat_g)        : null,
        carbs_g:      fields.carbs_g      ? parseFloat(fields.carbs_g)      : null,
        steps:        fields.steps        ? parseInt(fields.steps)           : null,
        session_type: fields.session_type ?? null,
        sleep_hours:  fields.sleep_hours  ? parseFloat(fields.sleep_hours)  : null,
        mood:         fields.mood         ? parseInt(fields.mood)            : null,
        note:         fields.note || null,
      })
      setToast('Saved')
      setTimeout(() => setToast(null), 2000)
    } catch {
      setToast('Save failed — try again')
      setTimeout(() => setToast(null), 3000)
    }
  }

  function numInput(label: string, key: keyof typeof fields, unit: string, accent = false) {
    return (
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </label>
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{
            background: 'var(--surface)',
            border: `1px solid ${accent ? '#34d39940' : 'var(--border)'}`,
          }}
        >
          <input
            type="number"
            inputMode="decimal"
            value={fields[key] as string}
            onChange={e => set(key, e.target.value)}
            placeholder="—"
            className="bg-transparent outline-none text-xl font-bold w-full"
            style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)' }}
          />
          <span className="text-xs ml-2 shrink-0" style={{ color: 'var(--text-muted)' }}>{unit}</span>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-8 pt-6 max-w-lg mx-auto">
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{date}</h1>

      {numInput('Morning Weight', 'weight_kg', 'kg')}

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
                border: `1px solid ${i === 1 ? '#34d39940' : 'var(--border)'}`,
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
      </div>

      {numInput('Steps', 'steps', 'steps')}

      <SessionPicker
        value={fields.session_type}
        onChange={s => setFields(f => ({ ...f, session_type: s }))}
      />

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Note
        </label>
        <textarea
          value={fields.note}
          onChange={e => set('note', e.target.value)}
          rows={2}
          placeholder="How did today go?"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {!showOptional && (
        <button type="button" onClick={() => setShowOptional(true)}
          className="text-sm py-3 rounded-xl"
          style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          + Sleep &amp; mood (optional)
        </button>
      )}

      {showOptional && (
        <div className="grid grid-cols-2 gap-3">
          {numInput('Sleep', 'sleep_hours', 'hrs')}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Mood
            </label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => set('mood', String(n))}
                  className="flex-1 py-3 rounded-lg text-sm font-bold transition-colors"
                  style={{
                    background: fields.mood === String(n) ? '#34d39920' : 'var(--surface)',
                    border: `1px solid ${fields.mood === String(n) ? '#34d39960' : 'var(--border)'}`,
                    color: fields.mood === String(n) ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={upsert.isPending}
        className="py-4 rounded-xl font-bold text-sm transition-opacity disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#0a0a0a' }}
      >
        {upsert.isPending ? 'Saving…' : 'Save Entry'}
      </button>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-semibold z-50"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}
    </form>
  )
}
```

- [ ] **Step 4: Wire up the log page**

```typescript
// app/(app)/log/[date]/page.tsx
import { LogForm } from '@/components/log/log-form'

export default function LogDatePage({ params }: { params: { date: string } }) {
  return <LogForm date={params.date} />
}
```

- [ ] **Step 5: Test and commit**

```bash
npm run dev
# Navigate to /log — should redirect to /log/today
# Fill in fields and save — check Supabase dashboard for the row
# Refresh — confirm form pre-fills from DB
git add -A
git commit -m "feat: daily log entry form with Supabase upsert"
```

---

## Task 5: Rolling Average Utility

**Goal:** Implement and fully test the 7-day rolling average function used by the weight trend chart.

**Files:**
- Create: `lib/utils/rolling-average.ts`
- Create: `lib/utils/rolling-average.test.ts`

**Acceptance Criteria:**
- [ ] All 5 tests pass
- [ ] Single data point returns itself
- [ ] Partial window at start uses available points only
- [ ] Full window of 7 averages correctly
- [ ] Empty input returns empty array

**Verify:** `npm test` → `5 tests passed`

**Steps:**

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/utils/rolling-average.test.ts
import { describe, it, expect } from 'vitest'
import { rollingAverage } from './rolling-average'

describe('rollingAverage', () => {
  it('returns empty array for empty input', () => {
    expect(rollingAverage([])).toEqual([])
  })

  it('returns the single point for a single data point', () => {
    const result = rollingAverage([{ date: '2026-01-01', weight_kg: 80 }])
    expect(result).toEqual([{ date: '2026-01-01', average: 80 }])
  })

  it('uses partial window at the start of the series', () => {
    const data = [
      { date: '2026-01-01', weight_kg: 80 },
      { date: '2026-01-02', weight_kg: 86 },
    ]
    const result = rollingAverage(data, 7)
    expect(result[0].average).toBe(80)     // window of 1
    expect(result[1].average).toBe(83)     // window of 2: (80+86)/2
  })

  it('calculates a full window correctly', () => {
    const data = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      weight_kg: 80 + i, // 80,81,82,83,84,85,86
    }))
    const result = rollingAverage(data, 7)
    expect(result[6].average).toBe(83) // (80+81+82+83+84+85+86)/7 = 83
  })

  it('rounds to one decimal place', () => {
    const data = [
      { date: '2026-01-01', weight_kg: 80.1 },
      { date: '2026-01-02', weight_kg: 80.2 },
      { date: '2026-01-03', weight_kg: 80.3 },
    ]
    const result = rollingAverage(data, 3)
    expect(result[2].average).toBe(80.2)
  })
})
```

- [ ] **Step 2: Run to confirm all fail**

```bash
npm test
```

Expected: 5 failing tests — `rollingAverage is not a function`

- [ ] **Step 3: Write the implementation**

```typescript
// lib/utils/rolling-average.ts
export function rollingAverage(
  data: Array<{ date: string; weight_kg: number }>,
  windowDays = 7
): Array<{ date: string; average: number }> {
  return data.map((point, index) => {
    const start = Math.max(0, index - windowDays + 1)
    const window = data.slice(start, index + 1)
    const avg = window.reduce((sum, p) => sum + p.weight_kg, 0) / window.length
    return { date: point.date, average: Math.round(avg * 10) / 10 }
  })
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm test
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add lib/utils/rolling-average.ts lib/utils/rolling-average.test.ts
git commit -m "feat: rolling average utility with Vitest tests"
```

---

## Task 6: Weight Trend Chart

**Goal:** Build the Recharts weight trend chart with daily weight (faint line) and 7-day rolling average (prominent accent line) overlaid, wired to real data.

**Files:**
- Create: `components/dashboard/weight-chart.tsx`
- Create: `lib/queries/daily-logs.ts` (add `useWeightHistory` hook)

**Acceptance Criteria:**
- [ ] Chart renders with a green rolling-average line and a faint grey daily line
- [ ] Chart is responsive (fills its container width)
- [ ] Tooltip shows both values on hover
- [ ] Shows last 30 days of data by default
- [ ] Shows a "No data yet" placeholder when no logs exist

**Verify:** `npm run dev` → add a few log entries with weight → navigate to `/dashboard` → confirm chart renders with both lines.

**Steps:**

- [ ] **Step 1: Add `useWeightHistory` to queries**

Add to `lib/queries/daily-logs.ts`:

```typescript
export function useWeightHistory(days = 30) {
  return useQuery({
    queryKey: ['daily-logs', 'weight', days],
    queryFn: async () => {
      const supabase = createClient()
      const from = new Date()
      from.setDate(from.getDate() - days)
      const { data, error } = await supabase
        .from('daily_logs')
        .select('date, weight_kg')
        .not('weight_kg', 'is', null)
        .gte('date', from.toISOString().split('T')[0])
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as Array<{ date: string; weight_kg: number }>
    },
  })
}
```

- [ ] **Step 2: Build the weight chart**

```typescript
// components/dashboard/weight-chart.tsx
'use client'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'
import { useWeightHistory } from '@/lib/queries/daily-logs'
import { rollingAverage } from '@/lib/utils/rolling-average'
import { format, parseISO } from 'date-fns'

export function WeightChart() {
  const { data: raw = [], isLoading } = useWeightHistory(30)

  if (isLoading) return (
    <div className="h-40 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
  )

  if (raw.length === 0) return (
    <div className="h-40 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No weight data yet — add your first log entry</p>
    </div>
  )

  const avgData = rollingAverage(raw)
  const chartData = raw.map((point, i) => ({
    date: point.date,
    daily: point.weight_kg,
    avg: avgData[i].average,
  }))

  const weights = raw.map(p => p.weight_kg)
  const yMin = Math.floor(Math.min(...weights) - 0.5)
  const yMax = Math.ceil(Math.max(...weights) + 0.5)

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Weight Trend
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>30 days</span>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#1f1f1f" strokeDasharray="0" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={d => format(parseISO(d), 'dd')}
            tick={{ fill: '#525252', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: '#525252', fontSize: 9 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#141414', border: '1px solid #1f1f1f', borderRadius: 8, fontSize: 11 }}
            labelFormatter={d => format(parseISO(d as string), 'dd MMM')}
            formatter={(value: number, name: string) => [
              `${value} kg`,
              name === 'avg' ? '7-day avg' : 'Daily',
            ]}
          />
          <Line dataKey="daily" stroke="#2a2a2a" strokeWidth={1} dot={false} />
          <Line dataKey="avg" stroke="#34d399" strokeWidth={2} dot={false} strokeLinecap="round" />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: 'var(--accent)' }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>7-day avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ background: '#2a2a2a' }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Daily</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add chart to dashboard page**

```typescript
// app/(app)/dashboard/page.tsx
import { WeightChart } from '@/components/dashboard/weight-chart'

export default function DashboardPage() {
  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-4">
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
      <WeightChart />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: weight trend chart with 7-day rolling average"
```

---

## Task 7: Dashboard — Macro Cards, Steps & Streak

**Goal:** Complete the dashboard with the protein hero card, calories/steps two-column cards, and the streak row, all wired to today's log and the targets.

**Files:**
- Create: `components/dashboard/protein-card.tsx`
- Create: `components/dashboard/metric-card.tsx`
- Create: `components/dashboard/streak-row.tsx`
- Create: `lib/queries/targets.ts`
- Create: `lib/utils/format.ts`
- Modify: `app/(app)/dashboard/page.tsx`

**Acceptance Criteria:**
- [ ] Protein card shows today's protein vs target with a progress bar, percentage, and colour-coded label
- [ ] Calories and steps cards show value vs target with progress bars
- [ ] Streak row shows current log streak, logs this week, and weekly weight delta
- [ ] All cards show a skeleton while loading
- [ ] Dashboard looks correct at 390px width (iPhone viewport)

**Verify:** `npm run dev` → log an entry with macros → dashboard shows correct values and bars.

**Steps:**

- [ ] **Step 1: Targets query hook**

```typescript
// lib/queries/targets.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Targets = Database['public']['Tables']['targets']['Row']
type TargetsInsert = Database['public']['Tables']['targets']['Insert']

export function useTargets() {
  return useQuery({
    queryKey: ['targets'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('targets')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpsertTargets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (targets: TargetsInsert) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('targets')
        .upsert(targets, { onConflict: 'user_id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['targets'] }),
  })
}
```

- [ ] **Step 2: Format utilities**

```typescript
// lib/utils/format.ts
export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—'
  return n.toLocaleString('en-GB', { maximumFractionDigits: decimals })
}

export function pct(value: number | null | undefined, target: number): number {
  if (!value || !target) return 0
  return Math.round((value / target) * 100)
}
```

- [ ] **Step 3: Protein hero card**

```typescript
// components/dashboard/protein-card.tsx
'use client'
import { useDailyLog } from '@/lib/queries/daily-logs'
import { useTargets } from '@/lib/queries/targets'
import { pct, fmtNum } from '@/lib/utils/format'
import { format } from 'date-fns'

export function ProteinCard() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: log } = useDailyLog(today)
  const { data: targets } = useTargets()

  const protein = log?.protein_g ?? null
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
```

- [ ] **Step 4: Generic metric card**

```typescript
// components/dashboard/metric-card.tsx
'use client'
import { fmtNum, pct } from '@/lib/utils/format'

interface Props {
  label: string
  value: number | null | undefined
  target: number
  unit: string
  color: string
}

export function MetricCard({ label, value, target, unit, color }: Props) {
  const p = pct(value, target)
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight mb-0.5" style={{ color: 'var(--text-primary)' }}>
        {fmtNum(value)}
      </div>
      <div className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>/ {fmtNum(target)} {unit}</div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(p, 100)}%`, background: color }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Streak row**

```typescript
// components/dashboard/streak-row.tsx
'use client'
import { useRecentLogs } from '@/lib/queries/daily-logs'
import { fmtNum } from '@/lib/utils/format'
import { isToday, subDays, format, parseISO, startOfWeek } from 'date-fns'

export function StreakRow() {
  const { data: logs = [] } = useRecentLogs(30)

  const streak = (() => {
    let s = 0
    let d = new Date()
    const loggedDates = new Set(logs.map(l => l.date))
    // If today isn't logged yet, start from yesterday
    if (!loggedDates.has(format(d, 'yyyy-MM-dd'))) d = subDays(d, 1)
    while (loggedDates.has(format(d, 'yyyy-MM-dd'))) {
      s++; d = subDays(d, 1)
    }
    return s
  })()

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const thisWeekLogs = logs.filter(l => parseISO(l.date) >= weekStart)
  const logsThisWeek = thisWeekLogs.length

  const weightLogs = logs.filter(l => l.weight_kg != null).slice(0, 14)
  const weeklyDelta = (() => {
    if (weightLogs.length < 2) return null
    const recent = weightLogs.slice(0, 7).map(l => l.weight_kg!)
    const older = weightLogs.slice(7).map(l => l.weight_kg!)
    if (!older.length) return null
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
    return Math.round((recentAvg - olderAvg) * 10) / 10
  })()

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="grid grid-cols-3 divide-x" style={{ '--tw-divide-opacity': 1, borderColor: 'var(--border)' } as React.CSSProperties}>
        {[
          { value: streak, label: 'day streak' },
          { value: `${logsThisWeek}/7`, label: 'logged this week' },
          { value: weeklyDelta != null ? `${weeklyDelta > 0 ? '+' : ''}${weeklyDelta}` : '—', label: 'kg / week', color: weeklyDelta != null && weeklyDelta < 0 ? 'var(--accent)' : undefined },
        ].map(({ value, label, color }) => (
          <div key={label} className="text-center px-2">
            <div className="text-xl font-bold" style={{ color: color ?? 'var(--text-primary)' }}>{value}</div>
            <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Assemble the full dashboard**

```typescript
// app/(app)/dashboard/page.tsx
import { WeightChart } from '@/components/dashboard/weight-chart'
import { ProteinCard } from '@/components/dashboard/protein-card'
import { MetricCard } from '@/components/dashboard/metric-card'
import { StreakRow } from '@/components/dashboard/streak-row'

export default function DashboardPage() {
  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-3">
      <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
      <WeightChart />
      <ProteinCard />
      <DashboardMetrics />
      <StreakRow />
    </div>
  )
}

// Inline client component to read targets + today's log together
// (avoids prop-drilling; MetricCard is purely presentational)
import { DashboardMetrics } from './dashboard-metrics'
```

Create an additional file `app/(app)/dashboard/dashboard-metrics.tsx`:

```typescript
// app/(app)/dashboard/dashboard-metrics.tsx
'use client'
import { MetricCard } from '@/components/dashboard/metric-card'
import { useDailyLog } from '@/lib/queries/daily-logs'
import { useTargets } from '@/lib/queries/targets'
import { format } from 'date-fns'

export function DashboardMetrics() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: log } = useDailyLog(today)
  const { data: targets } = useTargets()

  return (
    <div className="grid grid-cols-2 gap-3">
      <MetricCard label="Calories" value={log?.calories} target={targets?.calories ?? 2400} unit="kcal" color="var(--amber)" />
      <MetricCard label="Steps" value={log?.steps} target={targets?.steps ?? 10000} unit="steps" color="var(--sky)" />
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: complete dashboard — protein hero, macro cards, streak row"
```

---

## Task 8: Settings Page

**Goal:** Build the settings page where the user can edit all targets and personal stats.

**Files:**
- Modify: `app/(app)/settings/page.tsx`

**Acceptance Criteria:**
- [ ] Form pre-fills from `targets` row in Supabase
- [ ] Saving updates the `targets` row via upsert
- [ ] Dashboard metrics update immediately after save (React Query invalidation)
- [ ] Toast shown on save success

**Verify:** `npm run dev` → change protein target in Settings → go to Dashboard → confirm protein card target updated.

**Steps:**

- [ ] **Step 1: Write the settings page**

```typescript
// app/(app)/settings/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useTargets, useUpsertTargets } from '@/lib/queries/targets'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const { data: targets } = useTargets()
  const upsert = useUpsertTargets()
  const [toast, setToast] = useState<string | null>(null)

  const [fields, setFields] = useState({
    calories: '2400', protein_g: '185', fat_g: '70', carbs_g: '255',
    steps: '10000', goal_rate_kg_per_week: '0.5',
    bodyweight_kg: '86', height_cm: '188',
    training_split: 'Push/Pull/Legs/Upper — 4 lifting days + daily steps + Zone 2 cardio',
  })

  useEffect(() => {
    if (targets) {
      setFields({
        calories: String(targets.calories),
        protein_g: String(targets.protein_g),
        fat_g: String(targets.fat_g),
        carbs_g: String(targets.carbs_g),
        steps: String(targets.steps),
        goal_rate_kg_per_week: String(targets.goal_rate_kg_per_week),
        bodyweight_kg: String(targets.bodyweight_kg),
        height_cm: String(targets.height_cm),
        training_split: targets.training_split,
      })
    }
  }, [targets])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    try {
      await upsert.mutateAsync({
        user_id: user.id,
        calories: parseInt(fields.calories),
        protein_g: parseFloat(fields.protein_g),
        fat_g: parseFloat(fields.fat_g),
        carbs_g: parseFloat(fields.carbs_g),
        steps: parseInt(fields.steps),
        goal_rate_kg_per_week: parseFloat(fields.goal_rate_kg_per_week),
        bodyweight_kg: parseFloat(fields.bodyweight_kg),
        height_cm: parseInt(fields.height_cm),
        training_split: fields.training_split,
      })
      setToast('Saved')
      setTimeout(() => setToast(null), 2000)
    } catch {
      setToast('Save failed')
      setTimeout(() => setToast(null), 3000)
    }
  }

  function field(label: string, key: keyof typeof fields, unit?: string, type = 'number') {
    return (
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {label}{unit ? ` (${unit})` : ''}
        </label>
        <input
          type={type}
          value={fields[key]}
          onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-4">
      <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Settings</h1>

      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>Daily Targets</p>
      {field('Calories', 'calories', 'kcal')}
      {field('Protein', 'protein_g', 'g')}
      {field('Fat', 'fat_g', 'g')}
      {field('Carbs', 'carbs_g', 'g')}
      {field('Steps', 'steps')}
      {field('Goal rate', 'goal_rate_kg_per_week', 'kg/week')}

      <p className="text-xs uppercase tracking-widest font-semibold mt-2" style={{ color: 'var(--text-muted)' }}>Body Stats</p>
      {field('Current weight', 'bodyweight_kg', 'kg')}
      {field('Height', 'height_cm', 'cm')}
      {field('Training split', 'training_split', undefined, 'text')}

      <button type="submit" disabled={upsert.isPending}
        className="py-4 rounded-xl font-bold text-sm mt-2 transition-opacity disabled:opacity-50"
        style={{ background: 'var(--accent)', color: '#0a0a0a' }}>
        {upsert.isPending ? 'Saving…' : 'Save Settings'}
      </button>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-semibold z-50"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}
    </form>
  )
}
```

- [ ] **Step 2: Test and commit**

```bash
git add -A
git commit -m "feat: settings page — edit targets and body stats"
```

---

## Task 9: Screenshot Upload to Supabase Storage

**Goal:** Build the screenshot upload UI — tap to select image(s), upload to the private Supabase `screenshots` bucket, create a `food_screenshots` row, and return the storage path for use in the AI extraction step.

**Files:**
- Create: `components/log/screenshot-uploader.tsx`
- Modify: `components/log/log-form.tsx` (add uploader)

**Acceptance Criteria:**
- [ ] Tapping "Extract from screenshot" opens the file picker
- [ ] Uploaded image appears as a thumbnail with a loading indicator during upload
- [ ] File stored at `{user_id}/{uuid}.{ext}` in the `screenshots` bucket
- [ ] A `food_screenshots` row created with `confirmed=false`
- [ ] Error shown if upload fails

**Verify:** `npm run dev` → upload a screenshot → check Supabase Storage bucket for the file → check `food_screenshots` table for the row.

**Steps:**

- [ ] **Step 1: Screenshot uploader component**

```typescript
// components/log/screenshot-uploader.tsx
'use client'
import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { v4 as uuid } from 'uuid'

// Install uuid: npm install uuid @types/uuid

interface UploadResult {
  screenshotId: string
  imagePath: string
}

interface Props {
  dailyLogId: string | null
  date: string
  onUploaded: (result: UploadResult) => void
}

export function ScreenshotUploader({ dailyLogId, date, onUploaded }: Props) {
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

    // Ensure log exists before inserting screenshot row
    let logId = dailyLogId
    if (!logId) {
      const { data: log, error: logError } = await supabase
        .from('daily_logs')
        .upsert({ user_id: user.id, date }, { onConflict: 'user_id,date' })
        .select('id')
        .single()
      if (logError || !log) { setError('Could not create log entry'); setUploading(false); return }
      logId = log.id
    }

    const { data: screenshot, error: screenshotError } = await supabase
      .from('food_screenshots')
      .insert({ user_id: user.id, daily_log_id: logId, image_path: imagePath, confirmed: false })
      .select('id')
      .single()

    if (screenshotError || !screenshot) {
      setError('Screenshot record failed')
      setUploading(false)
      return
    }

    setUploading(false)
    onUploaded({ screenshotId: screenshot.id, imagePath })
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

Run: `npm install uuid @types/uuid`

- [ ] **Step 2: Add uploader to log form**

At the top of `LogForm`, add the `ScreenshotUploader` component (before the weight field), passing `dailyLogId` (from `existing?.id ?? null`), `date`, and a no-op `onUploaded` callback for now (this will be wired to the confirm step in Task 10).

Add to the top of the form JSX:

```tsx
<ScreenshotUploader
  dailyLogId={existing?.id ?? null}
  date={date}
  onUploaded={({ screenshotId, imagePath }) => {
    // Will trigger AI extraction in Task 10
    console.log('Uploaded', screenshotId, imagePath)
  }}
/>
```

- [ ] **Step 3: Test and commit**

```bash
npm run dev
# Navigate to /log/today, tap the extract button, pick an image
# Verify in Supabase Storage: screenshots/{user_id}/{uuid}.jpg exists
# Verify in Supabase Table: food_screenshots row created with confirmed=false
git add -A
git commit -m "feat: screenshot upload to Supabase Storage"
```

---

## Task 10: Claude Vision Extraction & Confirmation UI

**Goal:** Build the server-side macro extraction API route using Claude vision, and the client-side confirmation screen that lets the user review and edit extracted values before they pre-fill the log form.

**Files:**
- Create: `app/api/ai/extract-macros/route.ts`
- Create: `lib/anthropic/extract-macros.ts`
- Create: `components/log/macro-confirm.tsx`
- Modify: `components/log/log-form.tsx` (wire confirm step)

**Acceptance Criteria:**
- [ ] `POST /api/ai/extract-macros` returns `{ calories, protein_g, fat_g, carbs_g }` for a valid screenshot
- [ ] Unauthenticated requests return 401
- [ ] Confirmation screen shows extracted values in editable inputs before the form
- [ ] Confirming pre-fills the log form fields
- [ ] "Manual entry" link on the confirm screen skips AI values

**Verify:** Upload a MyFitnessPal screenshot → confirm screen appears with extracted values → confirm → log form pre-filled.

**Steps:**

- [ ] **Step 1: Extraction prompt and parser**

```typescript
// lib/anthropic/extract-macros.ts
export const EXTRACTION_PROMPT = `You are extracting nutrition summary data from a screenshot of a food tracking app (e.g. MyFitnessPal, Cronometer, Nutracheck).

Extract the TOTAL daily summary values — not individual food items.

Return ONLY valid JSON in this exact format, with no other text:
{
  "calories": number | null,
  "protein_g": number | null,
  "fat_g": number | null,
  "carbs_g": number | null,
  "confidence": "high" | "medium" | "low"
}

Rules:
- Set a field to null if you cannot read it with confidence
- calories should be the total calories for the day, not a single food
- protein_g, fat_g, carbs_g are in grams
- confidence = "high" if you can clearly read all 4 values, "medium" if 2-3, "low" if 0-1`

export interface ExtractedMacros {
  calories: number | null
  protein_g: number | null
  fat_g: number | null
  carbs_g: number | null
  confidence: 'high' | 'medium' | 'low'
}

export function parseExtractionResponse(text: string): ExtractedMacros {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in response')
  const parsed = JSON.parse(match[0])
  return {
    calories: parsed.calories ?? null,
    protein_g: parsed.protein_g ?? null,
    fat_g: parsed.fat_g ?? null,
    carbs_g: parsed.carbs_g ?? null,
    confidence: parsed.confidence ?? 'low',
  }
}
```

- [ ] **Step 2: API route**

```typescript
// app/api/ai/extract-macros/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { EXTRACTION_PROMPT, parseExtractionResponse } from '@/lib/anthropic/extract-macros'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { imagePath, screenshotId } = await request.json() as { imagePath: string; screenshotId: string }

  // Generate a signed URL to fetch the image server-side
  const { data: signedData, error: signedError } = await supabase.storage
    .from('screenshots')
    .createSignedUrl(imagePath, 60)

  if (signedError || !signedData) {
    return NextResponse.json({ error: 'Could not access image' }, { status: 500 })
  }

  // Fetch image and convert to base64
  const imageResponse = await fetch(signedData.signedUrl)
  const imageBuffer = await imageResponse.arrayBuffer()
  const base64 = Buffer.from(imageBuffer).toString('base64')
  const mediaType = (imageResponse.headers.get('content-type') ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: EXTRACTION_PROMPT },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const extracted = parseExtractionResponse(text)

    // Save extracted data to food_screenshots row
    await supabase
      .from('food_screenshots')
      .update({ extracted_json: extracted })
      .eq('id', screenshotId)

    return NextResponse.json(extracted)
  } catch {
    return NextResponse.json({ error: 'Could not parse nutrition from this image. Try manual entry.' }, { status: 422 })
  }
}
```

- [ ] **Step 3: Confirmation screen component**

```typescript
// components/log/macro-confirm.tsx
'use client'
import { useState } from 'react'
import type { ExtractedMacros } from '@/lib/anthropic/extract-macros'

interface Props {
  extracted: ExtractedMacros
  onConfirm: (values: { calories: string; protein_g: string; fat_g: string; carbs_g: string }) => void
  onSkip: () => void
}

export function MacroConfirm({ extracted, onConfirm, onSkip }: Props) {
  const [values, setValues] = useState({
    calories: String(extracted.calories ?? ''),
    protein_g: String(extracted.protein_g ?? ''),
    fat_g: String(extracted.fat_g ?? ''),
    carbs_g: String(extracted.carbs_g ?? ''),
  })

  const labels = { calories: 'kcal', protein_g: 'protein', fat_g: 'fat', carbs_g: 'carbs' }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
          Step 2 — AI Extracted
        </div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Confirm Macros</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Review the extracted values. Tap any field to edit before confirming.
        </p>
      </div>

      <div
        className="rounded-2xl p-4 grid grid-cols-2 gap-3"
        style={{ background: 'var(--surface)', border: '1px solid #34d39930' }}
      >
        <div className="col-span-2 text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
          Extracted values · tap to edit
        </div>
        {(Object.keys(values) as Array<keyof typeof values>).map(key => (
          <div
            key={key}
            className="rounded-xl p-3 text-center"
            style={{ background: '#0f1f17', border: '1px solid #34d39940' }}
          >
            <input
              type="number"
              inputMode="decimal"
              value={values[key]}
              onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
              className="bg-transparent outline-none text-xl font-bold w-full text-center"
              style={{ color: key === 'protein_g' ? 'var(--accent)' : 'var(--text-primary)' }}
            />
            <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>{labels[key]}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="py-3 rounded-xl text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          Manual entry
        </button>
        <button
          type="button"
          onClick={() => onConfirm(values)}
          className="col-span-2 py-3 rounded-xl font-bold text-sm"
          style={{ background: 'var(--accent)', color: '#0a0a0a' }}
        >
          Confirm & fill form
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire extraction into the log form**

In `components/log/log-form.tsx`, add state for the pending extraction:

```typescript
const [pendingScreenshot, setPendingScreenshot] = useState<{ screenshotId: string; imagePath: string } | null>(null)
const [extracting, setExtracting] = useState(false)
const [extracted, setExtracted] = useState<ExtractedMacros | null>(null)
```

Update `onUploaded` callback in `ScreenshotUploader`:
```typescript
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
```

Wrap the entire form return:
```typescript
if (extracting) return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Reading screenshot…</div>

if (extracted) return (
  <MacroConfirm
    extracted={extracted}
    onConfirm={(values) => {
      setFields(f => ({ ...f, ...values }))
      setExtracted(null)
    }}
    onSkip={() => setExtracted(null)}
  />
)
```

Also, mark the screenshot as confirmed when the user saves the form. In `handleSubmit`, after a successful upsert, if `pendingScreenshot`:
```typescript
if (pendingScreenshot) {
  const supabase = createClient()
  await supabase.from('food_screenshots').update({ confirmed: true }).eq('id', pendingScreenshot.screenshotId)
  setPendingScreenshot(null)
}
```

- [ ] **Step 5: Test end-to-end and commit**

```bash
npm run dev
# Upload a MFP screenshot → extraction loading state → confirm screen → form pre-fills
# Check food_screenshots.confirmed = true after saving
git add -A
git commit -m "feat: Claude vision screenshot extraction with confirmation step"
```

---

## Task 11: Progress Photos — Upload & Gallery

**Goal:** Build the progress photos tab — upload photos tagged with a date, store them in the private `progress-photos` bucket, and display them in a date-sorted gallery grid.

**Files:**
- Create: `components/photos/photo-gallery.tsx`
- Create: `lib/queries/photos.ts`
- Modify: `app/(app)/photos/page.tsx`

**Acceptance Criteria:**
- [ ] Tapping "+" opens file picker; selected photo uploads to `progress-photos` bucket
- [ ] Photo appears in gallery after upload without page refresh
- [ ] Photos sorted newest-first with date label on each
- [ ] Photos load via signed URLs (not public URLs)
- [ ] Empty state shown when no photos exist

**Verify:** `npm run dev` → upload 2 photos → confirm both appear in the gallery with correct dates.

**Steps:**

- [ ] **Step 1: Photo query hooks**

```typescript
// lib/queries/photos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Photo = Database['public']['Tables']['progress_photos']['Row']

export function useProgressPhotos() {
  return useQuery({
    queryKey: ['progress-photos'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function usePhotoUrl(imagePath: string | null) {
  return useQuery({
    queryKey: ['photo-url', imagePath],
    enabled: !!imagePath,
    staleTime: 50 * 60 * 1000, // 50 min — signed URLs expire after 60 min
    queryFn: async () => {
      if (!imagePath) return null
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('progress-photos')
        .createSignedUrl(imagePath, 3600)
      if (error) throw error
      return data.signedUrl
    },
  })
}

export function useAddPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, date, note }: { file: File; date: string; note?: string }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { v4: uuid } = await import('uuid')
      const ext = file.name.split('.').pop() ?? 'jpg'
      const imagePath = `${user.id}/${uuid()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(imagePath, file)
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('progress_photos')
        .insert({ user_id: user.id, date, image_path: imagePath, note: note ?? null })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['progress-photos'] }),
  })
}
```

- [ ] **Step 2: Photo gallery component**

```typescript
// components/photos/photo-gallery.tsx
'use client'
import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { useProgressPhotos, usePhotoUrl, useAddPhoto } from '@/lib/queries/photos'

function PhotoCard({ photo }: { photo: { id: string; date: string; image_path: string; note: string | null } }) {
  const { data: url } = usePhotoUrl(photo.image_path)
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {url
        ? <img src={url} alt={photo.date} className="w-full aspect-[3/4] object-cover" />
        : <div className="w-full aspect-[3/4] animate-pulse" style={{ background: 'var(--surface)' }} />
      }
      <div className="px-2 py-1.5" style={{ background: 'var(--surface)' }}>
        <div className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
          {format(new Date(photo.date), 'dd MMM yyyy')}
        </div>
        {photo.note && <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{photo.note}</div>}
      </div>
    </div>
  )
}

export function PhotoGallery() {
  const { data: photos = [] } = useProgressPhotos()
  const addPhoto = useAddPhoto()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    try {
      await addPhoto.mutateAsync({ file, date: format(new Date(), 'yyyy-MM-dd') })
    } catch {
      setError('Upload failed')
    }
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Progress Photos</h1>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={addPhoto.isPending}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity disabled:opacity-50"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      {error && <p className="text-xs mb-3" style={{ color: 'var(--red)' }}>{error}</p>}

      {photos.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No photos yet — add your first progress photo</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {photos.map(p => <PhotoCard key={p.id} photo={p} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire up the photos page**

```typescript
// app/(app)/photos/page.tsx
import { PhotoGallery } from '@/components/photos/photo-gallery'
export default function PhotosPage() { return <PhotoGallery /> }
```

- [ ] **Step 4: Test and commit**

```bash
git add -A
git commit -m "feat: progress photo upload and gallery"
```

---

## Task 12: Progress Photo Comparison View

**Goal:** Add a side-by-side comparison view to the photos tab — the user picks two dates and the photos are displayed together.

**Files:**
- Create: `components/photos/photo-comparison.tsx`
- Modify: `components/photos/photo-gallery.tsx` (add "Compare" toggle)

**Acceptance Criteria:**
- [ ] "Compare" button in the photos header toggles a date-picker UI
- [ ] User can select two photos from dropdown/list; both appear side by side
- [ ] Date label shown under each photo
- [ ] Works at 390px width (images equal width, stacked label)

**Verify:** `npm run dev` → upload 2+ photos → tap Compare → select two → confirm side-by-side display.

**Steps:**

- [ ] **Step 1: Comparison component**

```typescript
// components/photos/photo-comparison.tsx
'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { useProgressPhotos, usePhotoUrl } from '@/lib/queries/photos'

function CompareSlot({ photos, selectedId, onSelect }: {
  photos: Array<{ id: string; date: string; image_path: string }>
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const selected = photos.find(p => p.id === selectedId)
  const { data: url } = usePhotoUrl(selected?.image_path ?? null)

  return (
    <div className="flex-1 flex flex-col gap-2">
      <select
        value={selectedId ?? ''}
        onChange={e => onSelect(e.target.value)}
        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      >
        <option value="">Select date…</option>
        {photos.map(p => (
          <option key={p.id} value={p.id}>{format(new Date(p.date), 'dd MMM yyyy')}</option>
        ))}
      </select>

      <div className="rounded-xl overflow-hidden aspect-[3/4]" style={{ border: '1px solid var(--border)' }}>
        {url
          ? <img src={url} alt={selected?.date} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
            </div>
        }
      </div>

      {selected && (
        <p className="text-[10px] text-center font-semibold" style={{ color: 'var(--text-muted)' }}>
          {format(new Date(selected.date), 'dd MMM yyyy')}
        </p>
      )}
    </div>
  )
}

export function PhotoComparison() {
  const { data: photos = [] } = useProgressPhotos()
  const [leftId, setLeftId] = useState<string | null>(photos[photos.length - 1]?.id ?? null)
  const [rightId, setRightId] = useState<string | null>(photos[0]?.id ?? null)

  if (photos.length < 2) return (
    <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
      You need at least 2 photos to compare
    </p>
  )

  return (
    <div className="flex gap-3">
      <CompareSlot photos={photos} selectedId={leftId} onSelect={setLeftId} />
      <CompareSlot photos={photos} selectedId={rightId} onSelect={setRightId} />
    </div>
  )
}
```

- [ ] **Step 2: Add compare toggle to gallery**

In `components/photos/photo-gallery.tsx`, add a `comparing` boolean state and a toggle button next to "Add":

```typescript
const [comparing, setComparing] = useState(false)
```

Add to the header row (after the Add button):
```tsx
<button
  onClick={() => setComparing(c => !c)}
  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
  style={{
    background: comparing ? '#34d39920' : 'var(--surface)',
    border: `1px solid ${comparing ? '#34d39960' : 'var(--border)'}`,
    color: comparing ? 'var(--accent)' : 'var(--text-secondary)',
  }}
>
  Compare
</button>
```

Below the header, render conditionally:
```tsx
{comparing ? <PhotoComparison /> : /* existing grid */}
```

Add the import: `import { PhotoComparison } from './photo-comparison'`

- [ ] **Step 3: Test and commit**

```bash
git add -A
git commit -m "feat: progress photo side-by-side comparison view"
```

---

## Task 13: Check-in Prompt Builder

**Goal:** Implement and fully test the function that assembles the weekly check-in prompt from live DB data.

**Files:**
- Create: `lib/anthropic/weekly-checkin.ts`
- Create: `lib/anthropic/weekly-checkin.test.ts`

**Acceptance Criteria:**
- [ ] All 5 tests pass
- [ ] Prompt includes height, weight, training split from targets
- [ ] Prompt includes all log rows as a compact table
- [ ] Protein hit rate calculated correctly
- [ ] 7-day weight trend direction and delta included

**Verify:** `npm test` → `10 tests passed` (5 existing + 5 new)

**Steps:**

- [ ] **Step 1: Write failing tests**

```typescript
// lib/anthropic/weekly-checkin.test.ts
import { describe, it, expect } from 'vitest'
import { buildCheckinPrompt } from './weekly-checkin'

const targets = {
  calories: 2400, protein_g: 185, fat_g: 70, carbs_g: 255,
  steps: 10000, goal_rate_kg_per_week: 0.5,
  bodyweight_kg: 86, height_cm: 188,
  training_split: 'Push/Pull/Legs/Upper',
}

const logs = [
  { date: '2026-05-29', weight_kg: 86.2, calories: 2380, protein_g: 182, fat_g: 68, carbs_g: 252, steps: 9800, session_type: 'push' },
  { date: '2026-05-30', weight_kg: 86.0, calories: 2420, protein_g: 190, fat_g: 71, carbs_g: 258, steps: 11200, session_type: 'pull' },
  { date: '2026-05-31', weight_kg: 85.8, calories: 2300, protein_g: 175, fat_g: 65, carbs_g: 248, steps: 8900, session_type: 'rest' },
]

describe('buildCheckinPrompt', () => {
  it('includes height and weight from targets', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('188cm')
    expect(prompt).toContain('86')
  })

  it('includes training split', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('Push/Pull/Legs/Upper')
  })

  it('includes all log dates in the data table', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('2026-05-29')
    expect(prompt).toContain('2026-05-30')
    expect(prompt).toContain('2026-05-31')
  })

  it('calculates protein hit rate correctly', () => {
    // 182 < 185 → miss; 190 >= 185 → hit; 175 < 185 → miss → 1/3 = 33%
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('33%')
  })

  it('includes goal rate in prompt', () => {
    const prompt = buildCheckinPrompt(targets, logs)
    expect(prompt).toContain('0.5')
  })
})
```

- [ ] **Step 2: Run to confirm all 5 fail**

```bash
npm test -- weekly-checkin
```

Expected: 5 failing

- [ ] **Step 3: Write the implementation**

```typescript
// lib/anthropic/weekly-checkin.ts
interface Targets {
  calories: number; protein_g: number; fat_g: number; carbs_g: number
  steps: number; goal_rate_kg_per_week: number
  bodyweight_kg: number; height_cm: number; training_split: string
}

interface LogRow {
  date: string; weight_kg: number | null
  calories: number | null; protein_g: number | null
  fat_g: number | null; carbs_g: number | null
  steps: number | null; session_type: string | null
}

export function buildCheckinPrompt(targets: Targets, logs: LogRow[]): string {
  const proteinHits = logs.filter(l => l.protein_g != null && l.protein_g >= targets.protein_g).length
  const proteinHitRate = logs.length > 0 ? Math.round((proteinHits / logs.length) * 100) : 0

  const weightLogs = logs.filter(l => l.weight_kg != null).map(l => l.weight_kg!)
  const recentAvg = weightLogs.length > 0
    ? weightLogs.slice(0, Math.min(7, weightLogs.length)).reduce((a, b) => a + b, 0) / Math.min(7, weightLogs.length)
    : targets.bodyweight_kg
  const olderWeights = weightLogs.slice(7)
  const olderAvg = olderWeights.length > 0
    ? olderWeights.reduce((a, b) => a + b, 0) / olderWeights.length
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

  return `You are a personal fitness coach. Your client's current profile:
- Height: ${targets.height_cm}cm, Weight goal base: ${targets.bodyweight_kg}kg
- Programme: ${targets.training_split}
- Daily targets: ${targets.calories} kcal, ${targets.protein_g}g protein, ${targets.fat_g}g fat, ${targets.carbs_g}g carbs, ${targets.steps} steps
- Fat-loss goal: ${targets.goal_rate_kg_per_week} kg/week

Data for the last ${logs.length} logged days:
${table}

Computed stats:
- Recent avg weight: ${Math.round(recentAvg * 10) / 10} kg (7-day trend: ${trendDir}, ${weeklyDelta > 0 ? '+' : ''}${weeklyDelta} kg)
- Protein target hit rate: ${proteinHitRate}% of logged days
- Days logged: ${logs.length}

Write a concise coaching summary in 3–5 short paragraphs. Cover: weight trend vs goal rate, protein adherence, what's going well, one specific actionable focus for this week. Be direct. No bullet points. No sign-off.`
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm test
```

Expected: `10 tests passed`

- [ ] **Step 5: Commit**

```bash
git add lib/anthropic/weekly-checkin.ts lib/anthropic/weekly-checkin.test.ts
git commit -m "feat: check-in prompt builder with Vitest tests"
```

---

## Task 14: AI Weekly Check-in — API Route & Coach Tab UI

**Goal:** Build the streaming check-in API route and the Coach tab UI that triggers it, displays the streaming response in real time, and saves completed summaries.

**Files:**
- Create: `app/api/ai/weekly-checkin/route.ts`
- Create: `components/check-in/checkin-ui.tsx`
- Modify: `app/(app)/check-in/page.tsx`

**Acceptance Criteria:**
- [ ] `POST /api/ai/weekly-checkin` streams a text response
- [ ] Unauthenticated requests return 401
- [ ] UI shows a typing indicator while streaming, then renders the full summary
- [ ] Completed summary saved to `ai_checkins` table
- [ ] Past check-ins listed below the trigger button, newest first

**Verify:** `npm run dev` → tap "Run check-in" → text streams in → summary appears in the list after completion.

**Steps:**

- [ ] **Step 1: Streaming API route**

```typescript
// app/api/ai/weekly-checkin/route.ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildCheckinPrompt } from '@/lib/anthropic/weekly-checkin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { periodStart, periodEnd } = await request.json() as { periodStart: string; periodEnd: string }

  const [{ data: logs }, { data: targets }] = await Promise.all([
    supabase.from('daily_logs').select('*')
      .gte('date', periodStart).lte('date', periodEnd)
      .order('date', { ascending: false }),
    supabase.from('targets').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  if (!targets) return new Response('No targets configured — set up your targets in Settings first', { status: 422 })

  const prompt = buildCheckinPrompt(targets, logs ?? [])

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      const anthropicStream = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      })

      for await (const event of anthropicStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullText += event.delta.text
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }

      // Save completed summary
      await supabase.from('ai_checkins').insert({
        user_id: user.id,
        period_start: periodStart,
        period_end: periodEnd,
        summary_text: fullText,
      })

      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' },
  })
}
```

- [ ] **Step 2: Coach tab UI**

```typescript
// components/check-in/checkin-ui.tsx
'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { Bot } from 'lucide-react'

function usePastCheckins() {
  return useQuery({
    queryKey: ['ai-checkins'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('ai_checkins').select('*')
        .order('created_at', { ascending: false }).limit(10)
      if (error) throw error
      return data ?? []
    },
  })
}

export function CheckinUI() {
  const [streaming, setStreaming] = useState(false)
  const [liveText, setLiveText] = useState('')
  const { data: past = [], refetch } = usePastCheckins()

  async function runCheckin() {
    setStreaming(true)
    setLiveText('')
    const periodEnd = format(new Date(), 'yyyy-MM-dd')
    const periodStart = format(subDays(new Date(), 13), 'yyyy-MM-dd')

    const response = await fetch('/api/ai/weekly-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodStart, periodEnd }),
    })

    if (!response.ok || !response.body) {
      setLiveText(await response.text())
      setStreaming(false)
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      setLiveText(t => t + decoder.decode(value, { stream: true }))
    }

    setStreaming(false)
    setLiveText('')
    refetch()
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-4">
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Coach</h1>

      <button
        onClick={runCheckin}
        disabled={streaming}
        className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-opacity disabled:opacity-50"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--accent)' }}
      >
        <Bot size={18} />
        {streaming ? 'Analysing your data…' : 'Run weekly check-in (last 14 days)'}
      </button>

      {streaming && liveText && (
        <div className="rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          {liveText}
          <span className="inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse" style={{ background: 'var(--accent)' }} />
        </div>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Past check-ins</p>
          {past.map(c => (
            <div key={c.id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                {format(new Date(c.created_at), 'dd MMM yyyy')} · {c.period_start} → {c.period_end}
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                {c.summary_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Wire up the page**

```typescript
// app/(app)/check-in/page.tsx
import { CheckinUI } from '@/components/check-in/checkin-ui'
export default function CheckinPage() { return <CheckinUI /> }
```

- [ ] **Step 4: Test and commit**

```bash
npm run dev
# Navigate to Coach tab → tap "Run weekly check-in"
# Verify text streams in, typing cursor visible
# After completion: verify ai_checkins row created in Supabase
git add -A
git commit -m "feat: streaming AI weekly check-in with Coach tab UI"
```

---

## Task 15: Design Polish & Mobile QA

**Goal:** Polish the full app — entrance animations, consistent spacing, loading skeletons, and a thorough mobile QA pass at 390px.

**Files:**
- Modify: `app/globals.css` (add animation utilities)
- Modify: various components (minor spacing/animation tweaks)

**Acceptance Criteria:**
- [ ] Cards fade in on mount (opacity 0 → 1, translate-y 8px → 0)
- [ ] All loading states use consistent skeleton pulse style
- [ ] No layout breaks at 390px width (iPhone 14)
- [ ] All form inputs have `:focus` visible ring in accent colour
- [ ] Bottom nav safe area handled on iOS (padding-bottom env)

**Verify:** Open on a real iPhone or in Chrome DevTools at iPhone 14 Pro viewport (393px). Walk through every tab end-to-end.

**Steps:**

- [ ] **Step 1: Add animation utilities to globals.css**

Add to `app/globals.css`:
```css
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
  animation: fade-in-up 0.25s ease-out both;
}

.animate-stagger-1 { animation-delay: 0.05s; }
.animate-stagger-2 { animation-delay: 0.10s; }
.animate-stagger-3 { animation-delay: 0.15s; }
.animate-stagger-4 { animation-delay: 0.20s; }

input:focus, textarea:focus, select:focus {
  outline: none;
  box-shadow: 0 0 0 2px #34d39940;
}
```

- [ ] **Step 2: Apply animations to dashboard cards**

In `app/(app)/dashboard/page.tsx`, wrap each card in a div with `className="animate-fade-in-up animate-stagger-N"` (1 through 4).

- [ ] **Step 3: iOS safe area for bottom nav**

In `components/nav/bottom-nav.tsx`, change `padding: 8px 0 12px` to `padding: 8px 0 max(12px, env(safe-area-inset-bottom))`:

```tsx
style={{
  background: 'var(--bg)',
  borderTop: '1px solid var(--border)',
  paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
}}
```

- [ ] **Step 4: Add consistent focus ring to all inputs**

The `input:focus` rule in globals.css covers this globally — verify it renders correctly on the log form.

- [ ] **Step 5: Mobile QA checklist**

Walk through every screen at 390px:
- [ ] Login page — form fills viewport, button reachable
- [ ] Dashboard — all cards visible, chart scrolls correctly
- [ ] Log entry — all fields accessible, save button above keyboard
- [ ] Photos — gallery grid renders, compare view fills width
- [ ] Coach — run check-in, streaming text readable
- [ ] Settings — all fields visible, save works

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: design polish — animations, focus rings, iOS safe area"
```

---

## Task 16: Vercel Deployment

**Goal:** Deploy the app to Vercel with correct environment variables and confirm it works end-to-end in production.

**Files:**
- Create: `.gitignore` update (ensure `.env.local` is excluded)
- No code changes — configuration only

**Acceptance Criteria:**
- [ ] `vercel deploy --prod` succeeds with no build errors
- [ ] Login works in production URL
- [ ] Dashboard loads real data in production
- [ ] Screenshot upload + AI extraction works in production
- [ ] AI check-in streams correctly in production

**Verify:** Open the production Vercel URL on a real phone. Log in, create a log entry, run a check-in.

**Steps:**

- [ ] **Step 1: Install Vercel CLI and login**

```bash
npm install -g vercel
vercel login
```

- [ ] **Step 2: Link the project**

```bash
vercel link
```

Follow the prompts — create a new project named `fitness-tracker`.

- [ ] **Step 3: Set environment variables in Vercel dashboard**

Go to Vercel → Project → Settings → Environment Variables. Add:

| Key | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | Production, Preview, Development |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | Production, Preview |

- [ ] **Step 4: Update Supabase Auth redirect URLs**

In Supabase → Authentication → URL Configuration, add your Vercel production URL to:
- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** `https://your-app.vercel.app/**`

- [ ] **Step 5: Deploy**

```bash
vercel deploy --prod
```

- [ ] **Step 6: Smoke test on production URL**

Open the Vercel URL on your phone:
- [ ] Login works
- [ ] Log entry creates a row in Supabase
- [ ] Screenshot extraction returns macros
- [ ] Weekly check-in streams

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: Vercel deployment configuration"
git push
```

---

## Dependency Map

```
Task 0 (scaffold)
  └─ Task 1 (schema)
       └─ Task 2 (auth)
            └─ Task 3 (app shell)
                 └─ Task 4 (log CRUD)
                      ├─ Task 5 (rolling avg) ──── Task 6 (weight chart)
                      │                                 └─ Task 7 (dashboard complete)
                      │                                       └─ Task 8 (settings)
                      └─ Task 9 (screenshot upload)
                           └─ Task 10 (AI extraction)
                                └─ Task 11 (photos gallery)
                                     └─ Task 12 (photo comparison)
                                          └─ Task 13 (prompt builder)
                                               └─ Task 14 (check-in UI)
                                                    └─ Task 15 (polish)
                                                         └─ Task 16 (deploy)
```

---

## Self-Review Notes

- All spec requirements mapped: ✓ rolling avg, ✓ protein hero, ✓ AI extraction confirm gate, ✓ private storage, ✓ streaming check-in, ✓ dynamic prompt from DB, ✓ email+password auth, ✓ RLS on all tables
- No TBDs or placeholders
- Type names consistent across tasks (e.g., `ExtractedMacros` defined in Task 10, used in Task 10 only)
- `useUpsertTargets` defined in Task 8 (targets hook), used in Task 8 (settings page) — consistent
- `uuid` package installed in Task 9, reused in Task 11 — consistent
- `date-fns` installed in Task 3 (log redirect), used throughout — consistent
