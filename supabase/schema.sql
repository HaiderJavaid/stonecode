create extension if not exists vector;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  timezone text not null default 'UTC',
  equipped_badge_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text not null,
  experience_type text not null default 'course' check (experience_type in ('course', 'short_course', 'exercise', 'guided_project')),
  client_request_id text,
  skill_ids text[] not null default '{}',
  domain_ids text[] not null default '{}',
  mode text not null check (mode in ('fundamentals', 'project', 'leetcode', 'mixed')),
  checkpoint text not null,
  description text,
  progress integer not null default 0 check (progress between 0 and 100),
  required_section_count integer not null default 5 check (required_section_count > 0),
  languages text[] not null default '{}',
  tags text[] not null default '{}',
  course_content jsonb,
  content_generation_state text not null default 'roadmap' check (content_generation_state in ('roadmap', 'first_chapter', 'full_course')),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists courses_user_client_request_id_idx
  on public.courses (user_id, client_request_id)
  where client_request_id is not null;

create table if not exists public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  path text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, path)
);

create table if not exists public.workspace_folders (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, path)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  lesson_index integer,
  message_kind text not null default 'chat' check (message_kind in ('chat', 'lesson-intro', 'exercise-hint')),
  generated_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists chat_messages_generated_key_idx
  on public.chat_messages (course_id, generated_key)
  where generated_key is not null;

create table if not exists public.course_progress (
  course_id uuid primary key references public.courses(id) on delete cascade,
  lesson_index integer not null default 0,
  lesson_view text check (lesson_view in ('resume', 'details', 'progress')),
  selected_file_path text,
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'basic', 'pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'free' check (status in ('free', 'trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  event_type text not null check (event_type in ('tutor_message', 'tool_call', 'code_run')),
  model text,
  input_tokens integer,
  output_tokens integer,
  status text not null check (status in ('success', 'failed', 'blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_ai_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'openai' check (provider in ('openai')),
  encrypted_secret text not null,
  secret_iv text not null,
  secret_tag text not null,
  last_four text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learner_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  known_subjects text[] not null default '{}',
  weak_concepts text[] not null default '{}',
  strong_concepts text[] not null default '{}',
  assessment_history jsonb not null default '[]'::jsonb,
  teaching_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  subject text not null,
  raw_answers jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_type text not null check (source_type in ('stonecode-curriculum', 'official-docs')),
  title text not null,
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rag_documents(id) on delete cascade,
  chunk_key text not null unique,
  subject_tags text[] not null default '{}',
  task_tags text[] not null default '{}',
  kind text not null,
  block_kind text,
  title text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  source text not null check (source in ('independent', 'course-mcq', 'course-chat')),
  exercise_key text not null,
  language text not null,
  primary_skill text,
  parent_language text,
  topic_ids text[] not null default '{}',
  domain_ids text[] not null default '{}',
  exercise_kind text not null default 'code' check (exercise_kind in ('mcq', 'code', 'chat')),
  difficulty text not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  attempts integer not null default 0 check (attempts >= 0),
  hint_used boolean not null default false,
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
  primary_skill text,
  parent_language text,
  topic_ids text[] not null default '{}',
  domain_ids text[] not null default '{}',
  exercise_kind text not null default 'code' check (exercise_kind in ('mcq', 'code', 'chat')),
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

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.workspace_files enable row level security;
alter table public.workspace_folders enable row level security;
alter table public.chat_messages enable row level security;
alter table public.course_progress enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.user_ai_credentials enable row level security;
alter table public.learner_profiles enable row level security;
alter table public.course_assessments enable row level security;
alter table public.rag_documents enable row level security;
alter table public.rag_chunks enable row level security;
alter table public.exercise_attempts enable row level security;
alter table public.exercise_daily_state enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.user_badges enable row level security;
alter table public.course_section_completions enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "courses own rows" on public.courses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "files own course" on public.workspace_files for all using (
  exists (select 1 from public.courses where courses.id = workspace_files.course_id and courses.user_id = auth.uid())
) with check (
  exists (select 1 from public.courses where courses.id = workspace_files.course_id and courses.user_id = auth.uid())
);
create policy "folders own course" on public.workspace_folders for all using (
  exists (select 1 from public.courses where courses.id = workspace_folders.course_id and courses.user_id = auth.uid())
) with check (
  exists (select 1 from public.courses where courses.id = workspace_folders.course_id and courses.user_id = auth.uid())
);
create policy "messages own course" on public.chat_messages for all using (
  exists (select 1 from public.courses where courses.id = chat_messages.course_id and courses.user_id = auth.uid())
) with check (
  exists (select 1 from public.courses where courses.id = chat_messages.course_id and courses.user_id = auth.uid())
);
create policy "progress own course" on public.course_progress for all using (
  exists (select 1 from public.courses where courses.id = course_progress.course_id and courses.user_id = auth.uid())
) with check (
  exists (select 1 from public.courses where courses.id = course_progress.course_id and courses.user_id = auth.uid())
);
create policy "subscriptions own rows" on public.subscriptions for select using (auth.uid() = user_id);
create policy "usage own rows" on public.usage_events for select using (auth.uid() = user_id);
create policy "learner profiles own rows" on public.learner_profiles for select using ((select auth.uid()) = user_id);
create policy "course assessments own rows" on public.course_assessments for select using ((select auth.uid()) = user_id);
create policy "rag documents readable" on public.rag_documents for select using (true);
create policy "rag chunks readable" on public.rag_chunks for select using (true);
create policy "exercise attempts own rows" on public.exercise_attempts for select using ((select auth.uid()) = user_id);
create policy "exercise daily state own rows" on public.exercise_daily_state for select using ((select auth.uid()) = user_id);
create policy "xp ledger own rows" on public.xp_ledger for select using ((select auth.uid()) = user_id);
create policy "badges own rows" on public.user_badges for select using ((select auth.uid()) = user_id);
create policy "section completions own rows" on public.course_section_completions for select using ((select auth.uid()) = user_id);

create index if not exists exercise_attempts_user_updated_idx on public.exercise_attempts (user_id, updated_at desc);
create index if not exists xp_ledger_user_date_idx on public.xp_ledger (user_id, earned_on desc);
create index if not exists xp_ledger_user_language_date_idx on public.xp_ledger (user_id, language, earned_on desc);
create index if not exists course_section_completions_course_idx on public.course_section_completions (course_id);
create index if not exists learner_profiles_updated_idx on public.learner_profiles (updated_at desc);
create index if not exists course_assessments_user_created_idx on public.course_assessments (user_id, created_at desc);
create index if not exists rag_chunks_document_idx on public.rag_chunks (document_id);
create index if not exists rag_chunks_subject_tags_idx on public.rag_chunks using gin (subject_tags);
create index if not exists rag_chunks_task_tags_idx on public.rag_chunks using gin (task_tags);
create index if not exists rag_chunks_embedding_idx on public.rag_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function public.match_rag_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  match_subject text default null,
  match_task text default null
) returns table (
  id uuid,
  chunk_id text,
  source_type text,
  kind text,
  block_kind text,
  title text,
  url text,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    rag_chunks.id,
    rag_chunks.chunk_key as chunk_id,
    rag_documents.source_type,
    rag_chunks.kind,
    rag_chunks.block_kind,
    rag_chunks.title,
    rag_documents.url,
    rag_chunks.content,
    1 - (rag_chunks.embedding <=> query_embedding) as similarity
  from public.rag_chunks
  join public.rag_documents on rag_documents.id = rag_chunks.document_id
  where rag_chunks.embedding is not null
    and (
      match_subject is null
      or rag_chunks.subject_tags = '{}'
      or exists (
        select 1 from unnest(rag_chunks.subject_tags) tag
        where lower(match_subject) like '%' || lower(tag) || '%'
      )
    )
    and (
      match_task is null
      or rag_chunks.task_tags = '{}'
      or match_task = any(rag_chunks.task_tags)
    )
  order by rag_chunks.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

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

  return jsonb_build_object('awarded', true, 'award_id', v_award_id, 'xp', p_xp);
end;
$$;

revoke all on function public.award_exercise_completion(uuid, uuid, text, text, text, text, integer, date, integer) from public, anon, authenticated;
grant execute on function public.award_exercise_completion(uuid, uuid, text, text, text, text, integer, date, integer) to service_role;
