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

-- Storage buckets
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
