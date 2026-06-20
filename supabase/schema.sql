create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text not null,
  mode text not null check (mode in ('fundamentals', 'project', 'leetcode', 'mixed')),
  checkpoint text not null,
  description text,
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  path text not null,
  content text not null default '',
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
  created_at timestamptz not null default now()
);

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

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.workspace_files enable row level security;
alter table public.chat_messages enable row level security;
alter table public.course_progress enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "courses own rows" on public.courses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "files own course" on public.workspace_files for all using (
  exists (select 1 from public.courses where courses.id = workspace_files.course_id and courses.user_id = auth.uid())
) with check (
  exists (select 1 from public.courses where courses.id = workspace_files.course_id and courses.user_id = auth.uid())
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
