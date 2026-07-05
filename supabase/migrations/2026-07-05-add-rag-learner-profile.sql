create extension if not exists vector;

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

alter table public.learner_profiles enable row level security;
alter table public.course_assessments enable row level security;
alter table public.rag_documents enable row level security;
alter table public.rag_chunks enable row level security;

drop policy if exists "learner profiles own rows" on public.learner_profiles;
create policy "learner profiles own rows" on public.learner_profiles for select using ((select auth.uid()) = user_id);

drop policy if exists "course assessments own rows" on public.course_assessments;
create policy "course assessments own rows" on public.course_assessments for select using ((select auth.uid()) = user_id);

drop policy if exists "rag documents readable" on public.rag_documents;
create policy "rag documents readable" on public.rag_documents for select using (true);

drop policy if exists "rag chunks readable" on public.rag_chunks;
create policy "rag chunks readable" on public.rag_chunks for select using (true);

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
