create table if not exists public.schedule_events (
  id uuid primary key,
  title text not null,
  description text default '',
  answer_mode text not null default 'tri' check (answer_mode in ('tri', 'yesno')),
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_slots (
  id uuid primary key,
  event_id uuid not null references public.schedule_events(id) on delete cascade,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.schedule_events(id) on delete cascade,
  name text not null,
  note text default '',
  submitted_at timestamptz not null default now(),
  unique (event_id, name)
);

alter table public.schedule_responses
  add column if not exists note text default '';

create table if not exists public.schedule_answers (
  response_id uuid not null references public.schedule_responses(id) on delete cascade,
  slot_id uuid not null references public.schedule_slots(id) on delete cascade,
  answer text not null check (answer in ('yes', 'maybe', 'no')),
  primary key (response_id, slot_id)
);

alter table public.schedule_events enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.schedule_responses enable row level security;
alter table public.schedule_answers enable row level security;

drop policy if exists "Public schedule events are readable" on public.schedule_events;
drop policy if exists "Public schedule events are writable" on public.schedule_events;
drop policy if exists "Public schedule slots are readable" on public.schedule_slots;
drop policy if exists "Public schedule slots are writable" on public.schedule_slots;
drop policy if exists "Public schedule responses are readable" on public.schedule_responses;
drop policy if exists "Public schedule responses are writable" on public.schedule_responses;
drop policy if exists "Public schedule answers are readable" on public.schedule_answers;
drop policy if exists "Public schedule answers are writable" on public.schedule_answers;

create policy "Public schedule events are readable"
  on public.schedule_events for select
  using (true);

create policy "Public schedule events are writable"
  on public.schedule_events for all
  using (true)
  with check (true);

create policy "Public schedule slots are readable"
  on public.schedule_slots for select
  using (true);

create policy "Public schedule slots are writable"
  on public.schedule_slots for all
  using (true)
  with check (true);

create policy "Public schedule responses are readable"
  on public.schedule_responses for select
  using (true);

create policy "Public schedule responses are writable"
  on public.schedule_responses for all
  using (true)
  with check (true);

create policy "Public schedule answers are readable"
  on public.schedule_answers for select
  using (true);

create policy "Public schedule answers are writable"
  on public.schedule_answers for all
  using (true)
  with check (true);
