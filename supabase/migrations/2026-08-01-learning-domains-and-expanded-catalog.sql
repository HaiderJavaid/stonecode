-- Add non-language learning domains without weakening technology-isolated RAG.
-- This migration prepares draft manifests only. Approval tooling must verify
-- hashes, licenses, attribution, retrieval quality, and leakage before enabling.

-- Repair deletion cascades for databases that already applied the production
-- foundation migration. Restrict edges between rows owned by the same user can
-- otherwise block the auth.users cascade and leave an account undeletable.
alter table public.credit_reservations
  drop constraint if exists credit_reservations_quote_id_fkey,
  add constraint credit_reservations_quote_id_fkey
    foreign key (quote_id) references public.credit_quotes(id) on delete cascade;

alter table public.credit_reservation_allocations
  drop constraint if exists credit_reservation_allocations_grant_id_fkey,
  add constraint credit_reservation_allocations_grant_id_fkey
    foreign key (grant_id) references public.credit_grants(id) on delete cascade;

alter table public.generation_jobs
  drop constraint if exists generation_jobs_reservation_id_fkey,
  add constraint generation_jobs_reservation_id_fkey
    foreign key (reservation_id) references public.credit_reservations(id) on delete cascade;

create table if not exists public.learning_domain_manifests (
  domain_id text primary key,
  display_name text not null,
  description text not null default '',
  rag_corpus_key text not null unique,
  technology_required_for text[] not null default '{}',
  default_technology_id text references public.technology_manifests(technology_id) on delete set null,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (technology_required_for <@ array['course', 'project', 'exercise']::text[])
);

alter table public.learning_domain_manifests enable row level security;
drop policy if exists "learning domain manifests readable" on public.learning_domain_manifests;
create policy "learning domain manifests readable" on public.learning_domain_manifests for select using (true);

alter table public.rag_corpora
  add column if not exists domain_id text references public.learning_domain_manifests(domain_id) on delete cascade;

alter table public.rag_corpora alter column technology_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rag_corpora_exactly_one_scope'
      and conrelid = 'public.rag_corpora'::regclass
  ) then
    alter table public.rag_corpora
      add constraint rag_corpora_exactly_one_scope
      check ((technology_id is not null)::integer + (domain_id is not null)::integer = 1);
  end if;
end $$;

alter table public.rag_evaluation_cases
  add column if not exists forbidden_domain_ids text[] not null default '{}';

insert into public.learning_domain_manifests (
  domain_id, display_name, description, rag_corpus_key,
  technology_required_for, default_technology_id, enabled, metadata
) values
  ('computer_fundamentals', 'Computer & IT Fundamentals', 'Computer hardware, operating systems, files, security, troubleshooting, and everyday IT.', 'domain:computer-fundamentals:v1', array['project', 'exercise'], null, false, '{"launchStatus":"pending_review"}'::jsonb),
  ('internet_web', 'Internet & Web Fundamentals', 'Networks, the internet, browsers, servers, URLs, HTTP, and web standards.', 'domain:internet-web:v1', array['project', 'exercise'], null, false, '{"launchStatus":"pending_review"}'::jsonb),
  ('algorithms_data_structures', 'Algorithms & Data Structures', 'Problem solving, complexity, common algorithms, and data structures with runnable code.', 'domain:algorithms-data-structures:v1', array['course', 'project', 'exercise'], 'python', false, '{"launchStatus":"pending_review"}'::jsonb),
  ('math_for_programmers', 'Math for Programmers', 'Algebra, functions, discrete reasoning, probability, and statistics through runnable code.', 'domain:math-for-programmers:v1', array['course', 'project', 'exercise'], 'python', false, '{"launchStatus":"pending_review"}'::jsonb)
on conflict (domain_id) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  rag_corpus_key = excluded.rag_corpus_key,
  technology_required_for = excluded.technology_required_for,
  default_technology_id = excluded.default_technology_id,
  updated_at = now();

insert into public.rag_corpora (corpus_key, technology_id, domain_id, version, status)
select rag_corpus_key, null, domain_id, 1, 'draft'
from public.learning_domain_manifests
on conflict (corpus_key, version) do nothing;

drop policy if exists "rag documents readable" on public.rag_documents;
create policy "rag documents readable" on public.rag_documents for select using (
  (source_type = 'stonecode-curriculum' and corpus_id is null)
  or exists (
    select 1 from public.rag_corpora
    where rag_corpora.id = corpus_id and rag_corpora.status = 'enabled'
  )
);

drop policy if exists "rag chunks readable" on public.rag_chunks;
create policy "rag chunks readable" on public.rag_chunks for select using (
  exists (
    select 1
    from public.rag_documents
    left join public.rag_corpora on rag_corpora.id = rag_documents.corpus_id
    where rag_documents.id = document_id
      and (
        (rag_documents.source_type = 'stonecode-curriculum' and rag_documents.corpus_id is null)
        or rag_corpora.status = 'enabled'
      )
  )
);

drop function if exists public.match_rag_chunks(vector, integer, text, text, text, boolean);
drop function if exists public.match_rag_chunks(vector, integer, text, text, text, boolean, text);
create function public.match_rag_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  match_subject text default null,
  match_task text default null,
  match_technology text default null,
  include_draft boolean default false,
  match_domain text default null
) returns table (
  id uuid,
  chunk_id text,
  source_type text,
  kind text,
  block_kind text,
  title text,
  url text,
  content text,
  technology_id text,
  domain_id text,
  corpus_version integer,
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
    rag_corpora.technology_id,
    rag_corpora.domain_id,
    rag_corpora.version,
    1 - (rag_chunks.embedding <=> query_embedding) as similarity
  from public.rag_chunks
  join public.rag_documents on rag_documents.id = rag_chunks.document_id
  left join public.rag_corpora on rag_corpora.id = rag_documents.corpus_id
  where rag_chunks.embedding is not null
    and (
      (rag_documents.source_type = 'stonecode-curriculum' and rag_documents.corpus_id is null)
      or (
        (include_draft or rag_corpora.status = 'enabled')
        and (
          (match_technology is not null and rag_corpora.technology_id = match_technology)
          or (match_domain is not null and rag_corpora.domain_id = match_domain)
        )
      )
    )
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
