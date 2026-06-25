alter table public.profiles
  add column if not exists timezone text not null default 'UTC',
  add column if not exists equipped_badge_key text;

alter table public.courses
  add column if not exists languages jsonb not null default '[]'::jsonb,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists syllabus jsonb not null default '[]'::jsonb;

update public.courses
set
  languages = case
    when lower(subject) like '%python%' then '["Python"]'::jsonb
    when lower(subject) like '%computer%' then '["JavaScript","Python"]'::jsonb
    else '["JavaScript","HTML","CSS"]'::jsonb
  end,
  tags = case
    when lower(subject) like '%computer%' then '["Problem solving","Data structures","Complexity"]'::jsonb
    else '["Fundamentals","Projects","Debugging"]'::jsonb
  end,
  syllabus = jsonb_build_array(
    jsonb_build_object('id', 'read-code', 'title', 'Read the current code', 'summary', 'Trace inputs, outputs, and state before making changes.', 'lessonIndex', 0, 'hasChallenge', false),
    jsonb_build_object('id', 'explain-edge-cases', 'title', 'Reason about edge cases', 'summary', 'Explain behavior clearly before implementing a fix.', 'lessonIndex', 1, 'hasChallenge', true, 'challengeKey', 'course-empty-array'),
    jsonb_build_object('id', 'choose-an-operation', 'title', 'Choose the right operation', 'summary', 'Compare alternatives and identify their side effects.', 'lessonIndex', 2, 'hasChallenge', true, 'challengeKey', 'course-array-mutation'),
    jsonb_build_object('id', 'build-and-run', 'title', 'Build and run a solution', 'summary', 'Implement a focused feature and verify it in the terminal.', 'lessonIndex', 3, 'hasChallenge', true, 'challengeKey', 'course-queue-terminal'),
    jsonb_build_object('id', 'visual-review', 'title', 'Review the system visually', 'summary', 'Connect the implementation to a reusable mental model.', 'lessonIndex', 4, 'hasChallenge', false)
  )
where languages = '[]'::jsonb or tags = '[]'::jsonb or syllabus = '[]'::jsonb;

create table if not exists public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  challenge_key text not null,
  scope_key text not null,
  section_id text,
  source text not null check (source in ('course', 'independent')),
  language text not null,
  topic text not null,
  difficulty text not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  attempts integer not null default 0 check (attempts >= 0),
  hint_used boolean not null default false,
  completed_at timestamptz,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scope_key)
);

create table if not exists public.daily_exercise_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null,
  independent_completions integer not null default 0 check (independent_completions >= 0),
  independent_skips integer not null default 0 check (independent_skips >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table if not exists public.course_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

alter table public.challenge_progress enable row level security;
alter table public.daily_exercise_usage enable row level security;
alter table public.course_completions enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists "challenge progress own rows" on public.challenge_progress;
create policy "challenge progress own rows" on public.challenge_progress
  for select using (auth.uid() = user_id);

drop policy if exists "daily exercise usage own rows" on public.daily_exercise_usage;
create policy "daily exercise usage own rows" on public.daily_exercise_usage
  for select using (auth.uid() = user_id);

drop policy if exists "course completions own rows" on public.course_completions;
create policy "course completions own rows" on public.course_completions
  for select using (auth.uid() = user_id);

drop policy if exists "user badges own rows" on public.user_badges;
create policy "user badges own rows" on public.user_badges
  for select using (auth.uid() = user_id);

create or replace function public.record_challenge_attempt(
  p_user_id uuid,
  p_course_id uuid,
  p_challenge_key text,
  p_scope_key text,
  p_section_id text,
  p_source text,
  p_language text,
  p_topic text,
  p_difficulty text,
  p_xp integer,
  p_accepted boolean,
  p_plan text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.challenge_progress%rowtype;
  activity_day date;
  daily_limit integer;
  completion_count integer;
  awarded integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_scope_key, 0));
  activity_day := (now() at time zone coalesce((select timezone from public.profiles where id = p_user_id), 'UTC'))::date;

  select * into existing
  from public.challenge_progress
  where user_id = p_user_id and scope_key = p_scope_key
  for update;

  if p_accepted and existing.completed_at is null and p_source = 'independent' then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || activity_day::text, 0));
    daily_limit := case p_plan when 'pro' then 30 when 'basic' then 10 else 2 end;

    insert into public.daily_exercise_usage (user_id, activity_date)
    values (p_user_id, activity_day)
    on conflict (user_id, activity_date) do nothing;

    select independent_completions into completion_count
    from public.daily_exercise_usage
    where user_id = p_user_id and activity_date = activity_day
    for update;

    if completion_count >= daily_limit then
      raise exception 'Daily completion limit reached.';
    end if;

    update public.daily_exercise_usage
    set independent_completions = independent_completions + 1, updated_at = now()
    where user_id = p_user_id and activity_date = activity_day;
  end if;

  if p_accepted and existing.completed_at is null then
    awarded := greatest(coalesce(p_xp, 0), 0);
  end if;

  insert into public.challenge_progress (
    user_id, course_id, challenge_key, scope_key, section_id, source,
    language, topic, difficulty, attempts, completed_at, xp_awarded, last_attempt_at, updated_at
  ) values (
    p_user_id, p_course_id, p_challenge_key, p_scope_key, p_section_id, p_source,
    p_language, p_topic, p_difficulty, 1,
    case when p_accepted then now() else null end,
    awarded, now(), now()
  )
  on conflict (user_id, scope_key) do update set
    attempts = public.challenge_progress.attempts + 1,
    completed_at = coalesce(public.challenge_progress.completed_at, excluded.completed_at),
    xp_awarded = public.challenge_progress.xp_awarded + awarded,
    last_attempt_at = now(),
    updated_at = now()
  returning * into existing;

  return jsonb_build_object(
    'accepted', p_accepted,
    'completed', existing.completed_at is not null,
    'xpAwarded', awarded,
    'attempts', existing.attempts,
    'activityDate', activity_day
  );
end;
$$;

create or replace function public.record_challenge_hint(
  p_user_id uuid,
  p_course_id uuid,
  p_challenge_key text,
  p_scope_key text,
  p_section_id text,
  p_source text,
  p_language text,
  p_topic text,
  p_difficulty text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.challenge_progress%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_scope_key, 0));

  select * into existing
  from public.challenge_progress
  where user_id = p_user_id and scope_key = p_scope_key
  for update;

  if existing.hint_used then
    raise exception 'Hint already used for this challenge.';
  end if;

  insert into public.challenge_progress (
    user_id, course_id, challenge_key, scope_key, section_id, source,
    language, topic, difficulty, hint_used, updated_at
  ) values (
    p_user_id, p_course_id, p_challenge_key, p_scope_key, p_section_id, p_source,
    p_language, p_topic, p_difficulty, true, now()
  )
  on conflict (user_id, scope_key) do update set hint_used = true, updated_at = now()
  returning * into existing;

  return jsonb_build_object('hintUsed', existing.hint_used);
end;
$$;

create or replace function public.record_challenge_skip(
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_day date;
  skip_count integer;
begin
  activity_day := (now() at time zone coalesce((select timezone from public.profiles where id = p_user_id), 'UTC'))::date;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || activity_day::text, 0));

  insert into public.daily_exercise_usage (user_id, activity_date)
  values (p_user_id, activity_day)
  on conflict (user_id, activity_date) do nothing;

  select independent_skips into skip_count
  from public.daily_exercise_usage
  where user_id = p_user_id and activity_date = activity_day
  for update;

  if skip_count >= 1 then
    raise exception 'Daily skip already used.';
  end if;

  update public.daily_exercise_usage
  set independent_skips = independent_skips + 1, updated_at = now()
  where user_id = p_user_id and activity_date = activity_day;

  return jsonb_build_object('skipUsed', true, 'activityDate', activity_day);
end;
$$;

revoke all on function public.record_challenge_attempt(uuid, uuid, text, text, text, text, text, text, text, integer, boolean, text) from public, anon, authenticated;
revoke all on function public.record_challenge_hint(uuid, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_challenge_skip(uuid) from public, anon, authenticated;
grant execute on function public.record_challenge_attempt(uuid, uuid, text, text, text, text, text, text, text, integer, boolean, text) to service_role;
grant execute on function public.record_challenge_hint(uuid, uuid, text, text, text, text, text, text, text) to service_role;
grant execute on function public.record_challenge_skip(uuid) to service_role;
