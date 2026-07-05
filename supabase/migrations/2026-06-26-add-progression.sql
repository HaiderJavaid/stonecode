alter table public.profiles
  add column if not exists timezone text not null default 'UTC',
  add column if not exists equipped_badge_id text;

alter table public.courses
  add column if not exists required_section_count integer not null default 5 check (required_section_count > 0);

create table if not exists public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  source text not null check (source in ('independent', 'course-mcq', 'course-chat')),
  exercise_key text not null,
  language text not null,
  difficulty text not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  attempts integer not null default 0 check (attempts >= 0),
  hint_used boolean not null default false,
  hint_used_on date,
  status text not null default 'started' check (status in ('started', 'failed', 'completed', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, exercise_key)
);

create table if not exists public.exercise_daily_state (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  completed_count integer not null default 0 check (completed_count >= 0),
  skip_used boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table if not exists public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  source text not null check (source in ('independent', 'course-mcq', 'course-chat')),
  source_key text not null,
  language text not null,
  difficulty text not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  xp integer not null check (xp > 0),
  earned_on date not null,
  created_at timestamptz not null default now(),
  unique (user_id, source, source_key)
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null,
  title text not null,
  description text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

create table if not exists public.course_section_completions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  section_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, course_id, section_id)
);

create index if not exists exercise_attempts_user_updated_idx
  on public.exercise_attempts (user_id, updated_at desc);
create index if not exists xp_ledger_user_date_idx
  on public.xp_ledger (user_id, earned_on desc);
create index if not exists xp_ledger_user_language_date_idx
  on public.xp_ledger (user_id, language, earned_on desc);
create index if not exists course_section_completions_course_idx
  on public.course_section_completions (course_id);

alter table public.exercise_attempts enable row level security;
alter table public.exercise_daily_state enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.user_badges enable row level security;
alter table public.course_section_completions enable row level security;

create policy "exercise attempts own rows" on public.exercise_attempts
  for select using ((select auth.uid()) = user_id);
create policy "exercise daily state own rows" on public.exercise_daily_state
  for select using ((select auth.uid()) = user_id);
create policy "xp ledger own rows" on public.xp_ledger
  for select using ((select auth.uid()) = user_id);
create policy "badges own rows" on public.user_badges
  for select using ((select auth.uid()) = user_id);
create policy "section completions own rows" on public.course_section_completions
  for select using ((select auth.uid()) = user_id);

create or replace function public.award_exercise_completion(
  p_user_id uuid,
  p_course_id uuid,
  p_source text,
  p_source_key text,
  p_language text,
  p_difficulty text,
  p_xp integer,
  p_earned_on date,
  p_daily_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed_count integer;
  v_award_id uuid;
begin
  if exists (
    select 1 from public.xp_ledger
    where user_id = p_user_id and source = p_source and source_key = p_source_key
  ) then
    return jsonb_build_object('awarded', false, 'reason', 'already_completed');
  end if;

  insert into public.exercise_daily_state (user_id, activity_date)
  values (p_user_id, p_earned_on)
  on conflict (user_id, activity_date) do nothing;

  select completed_count into v_completed_count
  from public.exercise_daily_state
  where user_id = p_user_id and activity_date = p_earned_on
  for update;

  if v_completed_count >= p_daily_limit then
    raise exception 'Daily completion limit reached.';
  end if;

  insert into public.exercise_attempts (
    user_id, course_id, source, exercise_key, language, difficulty,
    attempts, status, completed_at, updated_at
  ) values (
    p_user_id, p_course_id, p_source, p_source_key, p_language, p_difficulty,
    1, 'completed', now(), now()
  )
  on conflict (user_id, source, exercise_key) do update set
    attempts = public.exercise_attempts.attempts + 1,
    status = 'completed',
    completed_at = coalesce(public.exercise_attempts.completed_at, now()),
    updated_at = now();

  insert into public.xp_ledger (
    user_id, course_id, source, source_key, language, difficulty, xp, earned_on
  ) values (
    p_user_id, p_course_id, p_source, p_source_key, p_language, p_difficulty, p_xp, p_earned_on
  ) returning id into v_award_id;

  update public.exercise_daily_state
  set completed_count = completed_count + 1, updated_at = now()
  where user_id = p_user_id and activity_date = p_earned_on;

  insert into public.user_badges (user_id, badge_key)
  values (p_user_id, 'first-steps')
  on conflict (user_id, badge_key) do nothing;

  update public.profiles
  set equipped_badge_id = coalesce(equipped_badge_id, 'first-steps'), updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('awarded', true, 'award_id', v_award_id, 'xp', p_xp);
end;
$$;

revoke all on function public.award_exercise_completion(uuid, uuid, text, text, text, text, integer, date, integer) from public, anon, authenticated;
grant execute on function public.award_exercise_completion(uuid, uuid, text, text, text, text, integer, date, integer) to service_role;
