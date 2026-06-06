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
