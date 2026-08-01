create table if not exists public.credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_type text not null check (grant_type in ('registration', 'subscription', 'adjustment')),
  original_amount integer not null check (original_amount > 0),
  remaining_amount integer not null check (remaining_amount >= 0 and remaining_amount <= original_amount),
  expires_at timestamptz,
  external_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_key)
);

create table if not exists public.credit_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_version text not null default 'credit-quote/v1',
  experience_type text not null check (experience_type in ('course', 'project', 'exercise', 'marketplace_clone')),
  scope jsonb not null,
  credits integer not null check (credits between 1 and 25),
  status text not null default 'active' check (status in ('active', 'reserved', 'consumed', 'expired', 'cancelled')),
  idempotency_key text not null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id uuid not null references public.credit_quotes(id) on delete cascade,
  amount integer not null check (amount > 0),
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released', 'expired')),
  idempotency_key text not null,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  settled_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.credit_reservation_allocations (
  reservation_id uuid not null references public.credit_reservations(id) on delete cascade,
  grant_id uuid not null references public.credit_grants(id) on delete cascade,
  amount integer not null check (amount > 0),
  primary key (reservation_id, grant_id)
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('grant', 'reserve', 'settle', 'release', 'expire', 'adjustment')),
  amount integer not null,
  reference_type text,
  reference_id uuid,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.learning_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version text not null default 'learning-proposal/v1',
  brief jsonb not null,
  proposal jsonb not null,
  quote_id uuid references public.credit_quotes(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'finalized', 'cancelled', 'expired')),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid not null references public.learning_proposals(id) on delete cascade,
  reservation_id uuid not null references public.credit_reservations(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0,
  result_course_id uuid references public.courses(id) on delete set null,
  error_code text,
  error_message text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create table if not exists public.technology_manifests (
  technology_id text primary key,
  display_name text not null,
  editor_id text not null,
  default_file_path text not null,
  runtime_type text not null check (runtime_type in ('browser', 'judge0')),
  rag_corpus_key text not null,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.rag_corpora (
  id uuid primary key default gen_random_uuid(),
  corpus_key text not null,
  technology_id text not null references public.technology_manifests(technology_id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'ingesting', 'evaluating', 'enabled', 'disabled')),
  top_five_relevance numeric(5,4),
  provenance_complete boolean not null default false,
  cross_language_leakage_count integer not null default 0,
  created_at timestamptz not null default now(),
  enabled_at timestamptz,
  unique (corpus_key, version)
);

alter table public.rag_documents
  add column if not exists corpus_id uuid references public.rag_corpora(id) on delete cascade,
  add column if not exists source_version text,
  add column if not exists license text,
  add column if not exists retrieved_at timestamptz;

create table if not exists public.rag_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  corpus_id uuid not null references public.rag_corpora(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  source_count integer not null default 0,
  chunk_count integer not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rag_evaluation_cases (
  id uuid primary key default gen_random_uuid(),
  corpus_id uuid not null references public.rag_corpora(id) on delete cascade,
  case_key text not null,
  query text not null,
  expected_chunk_keys text[] not null default '{}',
  forbidden_technology_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (corpus_id, case_key)
);

create table if not exists public.rag_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  corpus_id uuid not null references public.rag_corpora(id) on delete cascade,
  relevance numeric(5,4) not null,
  provenance_complete boolean not null,
  leakage_count integer not null default 0,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tutor_visuals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  chat_message_id uuid references public.chat_messages(id) on delete set null,
  step_id text not null,
  cue_key text not null,
  visual_kind text not null check (visual_kind in ('deterministic_svg', 'ai_image')),
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed', 'moderated')),
  storage_path text,
  inline_svg text,
  alt_text text not null,
  caption text not null,
  prompt_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (course_id, step_id, cue_key)
);

alter table public.chat_messages
  add column if not exists client_message_id text,
  add column if not exists tool_payload jsonb;

alter table public.usage_events
  add column if not exists feature text,
  add column if not exists latency_ms integer,
  add column if not exists cost_category text;

alter table public.usage_events drop constraint if exists usage_events_event_type_check;
alter table public.usage_events add constraint usage_events_event_type_check
  check (event_type in ('tutor_message', 'ai_generation', 'grading', 'ai_image', 'tool_call', 'code_run'));

create unique index if not exists chat_messages_client_message_idx
  on public.chat_messages (course_id, client_message_id)
  where client_message_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tutor-visuals', 'tutor-visuals', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.marketplace_templates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_course_id uuid references public.courses(id) on delete set null,
  title text not null,
  description text not null,
  tags text[] not null default '{}',
  technologies text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'unpublished', 'suspended')),
  current_version integer not null default 1,
  star_count integer not null default 0,
  clone_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.marketplace_templates(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table if not exists public.marketplace_stars (
  template_id uuid not null references public.marketplace_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_id, user_id)
);

create table if not exists public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.marketplace_templates(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (template_id, reporter_user_id, reason)
);

create index if not exists credit_grants_user_expiry_idx on public.credit_grants (user_id, expires_at, created_at) where remaining_amount > 0;
create index if not exists credit_ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);
create index if not exists generation_jobs_user_status_idx on public.generation_jobs (user_id, status, created_at desc);
create index if not exists tutor_visuals_course_step_idx on public.tutor_visuals (course_id, step_id);
create index if not exists marketplace_templates_public_idx on public.marketplace_templates (status, star_count desc, created_at desc);

alter table public.credit_accounts enable row level security;
alter table public.credit_grants enable row level security;
alter table public.credit_quotes enable row level security;
alter table public.credit_reservations enable row level security;
alter table public.credit_reservation_allocations enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.learning_proposals enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.technology_manifests enable row level security;
alter table public.rag_corpora enable row level security;
alter table public.rag_ingestion_runs enable row level security;
alter table public.rag_evaluation_cases enable row level security;
alter table public.rag_evaluation_runs enable row level security;
alter table public.tutor_visuals enable row level security;
alter table public.marketplace_templates enable row level security;
alter table public.marketplace_template_versions enable row level security;
alter table public.marketplace_stars enable row level security;
alter table public.marketplace_reports enable row level security;

create policy "credit accounts own rows" on public.credit_accounts for select using ((select auth.uid()) = user_id);
create policy "credit grants own rows" on public.credit_grants for select using ((select auth.uid()) = user_id);
create policy "credit quotes own rows" on public.credit_quotes for select using ((select auth.uid()) = user_id);
create policy "credit reservations own rows" on public.credit_reservations for select using ((select auth.uid()) = user_id);
create policy "credit allocations own rows" on public.credit_reservation_allocations for select using (
  exists (select 1 from public.credit_reservations where credit_reservations.id = reservation_id and credit_reservations.user_id = (select auth.uid()))
);
create policy "credit ledger own rows" on public.credit_ledger for select using ((select auth.uid()) = user_id);
create policy "learning proposals own rows" on public.learning_proposals for select using ((select auth.uid()) = user_id);
create policy "generation jobs own rows" on public.generation_jobs for select using ((select auth.uid()) = user_id);
create policy "technology manifests readable" on public.technology_manifests for select using (true);
create policy "rag corpora readable" on public.rag_corpora for select using (status = 'enabled');
drop policy if exists "rag documents readable" on public.rag_documents;
create policy "rag documents readable" on public.rag_documents for select using (
  source_type = 'stonecode-curriculum'
  or exists (select 1 from public.rag_corpora where rag_corpora.id = corpus_id and rag_corpora.status = 'enabled')
);
drop policy if exists "rag chunks readable" on public.rag_chunks;
create policy "rag chunks readable" on public.rag_chunks for select using (
  exists (
    select 1
    from public.rag_documents
    left join public.rag_corpora on rag_corpora.id = rag_documents.corpus_id
    where rag_documents.id = document_id
      and (rag_documents.source_type = 'stonecode-curriculum' or rag_corpora.status = 'enabled')
  )
);
create policy "tutor visuals own rows" on public.tutor_visuals for select using ((select auth.uid()) = user_id);
create policy "marketplace templates public or owned" on public.marketplace_templates for select using (status = 'published' or owner_user_id = (select auth.uid()));
create policy "marketplace versions public or owned" on public.marketplace_template_versions for select using (
  exists (select 1 from public.marketplace_templates where marketplace_templates.id = template_id and (marketplace_templates.status = 'published' or marketplace_templates.owner_user_id = (select auth.uid())))
);
create policy "marketplace stars readable" on public.marketplace_stars for select using (true);
create policy "marketplace reports own rows" on public.marketplace_reports for select using ((select auth.uid()) = reporter_user_id);

create or replace function public.ensure_stonecode_credit_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_user_id uuid;
begin
  insert into public.credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing
  returning user_id into inserted_user_id;

  if inserted_user_id is not null then
    insert into public.credit_grants (user_id, grant_type, original_amount, remaining_amount, external_key)
    values (p_user_id, 'registration', 10, 10, 'registration:v1');
    insert into public.credit_ledger (user_id, entry_type, amount, reference_type, idempotency_key)
    values (p_user_id, 'grant', 10, 'registration', 'registration:v1');
  end if;
end;
$$;

create or replace function public.grant_stonecode_monthly_credits(
  p_user_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_amount integer default 100
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_key text := 'subscription:' || to_char(p_period_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  inserted_grant_id uuid;
begin
  perform public.ensure_stonecode_credit_account(p_user_id);
  insert into public.credit_grants (user_id, grant_type, original_amount, remaining_amount, expires_at, external_key)
  values (p_user_id, 'subscription', p_amount, p_amount, p_period_end, grant_key)
  on conflict (user_id, external_key) do nothing
  returning id into inserted_grant_id;
  if inserted_grant_id is not null then
    insert into public.credit_ledger (user_id, entry_type, amount, reference_type, reference_id, idempotency_key)
    values (p_user_id, 'grant', p_amount, 'credit_grant', inserted_grant_id, grant_key);
  end if;
end;
$$;

create or replace function public.reserve_stonecode_credits(
  p_user_id uuid,
  p_quote_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_row public.credit_quotes%rowtype;
  existing_id uuid;
  reservation_id uuid;
  grant_row public.credit_grants%rowtype;
  remaining integer;
  allocated integer;
begin
  perform public.ensure_stonecode_credit_account(p_user_id);
  select id into existing_id from public.credit_reservations where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if existing_id is not null then return existing_id; end if;

  select * into quote_row from public.credit_quotes where id = p_quote_id and user_id = p_user_id for update;
  if quote_row.id is null or quote_row.status <> 'active' or quote_row.expires_at <= now() then
    raise exception 'credit_quote_unavailable';
  end if;

  select coalesce(sum(remaining_amount), 0)::integer into remaining
  from public.credit_grants
  where user_id = p_user_id and remaining_amount > 0 and (expires_at is null or expires_at > now());
  if remaining < quote_row.credits then raise exception 'insufficient_credits'; end if;

  insert into public.credit_reservations (user_id, quote_id, amount, idempotency_key)
  values (p_user_id, quote_row.id, quote_row.credits, p_idempotency_key)
  returning id into reservation_id;

  remaining := quote_row.credits;
  for grant_row in
    select * from public.credit_grants
    where user_id = p_user_id and remaining_amount > 0 and (expires_at is null or expires_at > now())
    order by expires_at asc nulls last, created_at asc
    for update
  loop
    exit when remaining = 0;
    allocated := least(remaining, grant_row.remaining_amount);
    update public.credit_grants set remaining_amount = remaining_amount - allocated where id = grant_row.id;
    insert into public.credit_reservation_allocations (reservation_id, grant_id, amount) values (reservation_id, grant_row.id, allocated);
    remaining := remaining - allocated;
  end loop;

  update public.credit_quotes set status = 'reserved' where id = quote_row.id;
  insert into public.credit_ledger (user_id, entry_type, amount, reference_type, reference_id, idempotency_key)
  values (p_user_id, 'reserve', -quote_row.credits, 'credit_reservation', reservation_id, 'reserve:' || p_idempotency_key);
  return reservation_id;
end;
$$;

create or replace function public.settle_stonecode_credit_reservation(p_user_id uuid, p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.credit_reservations%rowtype;
begin
  select * into reservation_row from public.credit_reservations where id = p_reservation_id and user_id = p_user_id for update;
  if reservation_row.id is null then raise exception 'credit_reservation_not_found'; end if;
  if reservation_row.status = 'settled' then return; end if;
  if reservation_row.status <> 'reserved' then raise exception 'credit_reservation_not_settleable'; end if;
  update public.credit_reservations set status = 'settled', settled_at = now() where id = p_reservation_id;
  update public.credit_quotes set status = 'consumed' where id = reservation_row.quote_id;
  insert into public.credit_ledger (user_id, entry_type, amount, reference_type, reference_id, idempotency_key)
  values (p_user_id, 'settle', 0, 'credit_reservation', p_reservation_id, 'settle:' || p_reservation_id::text)
  on conflict (user_id, idempotency_key) do nothing;
end;
$$;

create or replace function public.release_stonecode_credit_reservation(p_user_id uuid, p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row public.credit_reservations%rowtype;
  allocation_row record;
begin
  select * into reservation_row from public.credit_reservations where id = p_reservation_id and user_id = p_user_id for update;
  if reservation_row.id is null then raise exception 'credit_reservation_not_found'; end if;
  if reservation_row.status = 'released' then return; end if;
  if reservation_row.status <> 'reserved' then raise exception 'credit_reservation_not_releasable'; end if;
  for allocation_row in select * from public.credit_reservation_allocations where reservation_id = p_reservation_id loop
    update public.credit_grants set remaining_amount = remaining_amount + allocation_row.amount where id = allocation_row.grant_id;
  end loop;
  update public.credit_reservations set status = 'released', released_at = now() where id = p_reservation_id;
  update public.credit_quotes set status = 'active' where id = reservation_row.quote_id and expires_at > now();
  insert into public.credit_ledger (user_id, entry_type, amount, reference_type, reference_id, idempotency_key)
  values (p_user_id, 'release', reservation_row.amount, 'credit_reservation', p_reservation_id, 'release:' || p_reservation_id::text)
  on conflict (user_id, idempotency_key) do nothing;
end;
$$;

create or replace function public.release_expired_stonecode_reservations(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation_row record;
  released_count integer := 0;
begin
  for reservation_row in
    select id from public.credit_reservations
    where user_id = p_user_id and status = 'reserved' and expires_at <= now()
    for update
  loop
    perform public.release_stonecode_credit_reservation(p_user_id, reservation_row.id);
    update public.generation_jobs
      set status = 'failed', error_code = 'credit_reservation_expired', error_message = 'Generation reservation expired before completion.', completed_at = now()
      where reservation_id = reservation_row.id and status in ('queued', 'running');
    released_count := released_count + 1;
  end loop;
  return released_count;
end;
$$;

create or replace function public.claim_stonecode_generation_job(p_job_id uuid)
returns setof public.generation_jobs
language sql
security definer
set search_path = public
as $$
  update public.generation_jobs
  set status = 'running',
      progress = 2,
      attempt_count = attempt_count + 1,
      started_at = now()
  where id = p_job_id and status = 'queued'
  returning *;
$$;

create or replace function public.finalize_stonecode_learning_proposal(
  p_user_id uuid,
  p_proposal_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal_row public.learning_proposals%rowtype;
  job_row public.generation_jobs%rowtype;
  v_reservation_id uuid;
begin
  select * into proposal_row
  from public.learning_proposals
  where id = p_proposal_id and user_id = p_user_id
  for update;

  if proposal_row.id is null then raise exception 'learning_proposal_not_found'; end if;
  if proposal_row.status not in ('draft', 'finalized') then raise exception 'learning_proposal_immutable'; end if;
  if proposal_row.quote_id is null then raise exception 'learning_proposal_quote_missing'; end if;

  select * into job_row
  from public.generation_jobs
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if job_row.id is not null then
    return jsonb_build_object('job', to_jsonb(job_row), 'idempotent', true);
  end if;

  v_reservation_id := public.reserve_stonecode_credits(
    p_user_id,
    proposal_row.quote_id,
    'generation-reservation:' || p_idempotency_key
  );

  insert into public.generation_jobs (user_id, proposal_id, reservation_id, idempotency_key)
  values (p_user_id, proposal_row.id, v_reservation_id, p_idempotency_key)
  returning * into job_row;

  update public.learning_proposals
  set status = 'finalized', updated_at = now()
  where id = proposal_row.id;

  return jsonb_build_object('job', to_jsonb(job_row), 'idempotent', false);
end;
$$;

create or replace function public.complete_stonecode_generation_job(
  p_user_id uuid,
  p_job_id uuid,
  p_course_id uuid,
  p_reservation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.generation_jobs%rowtype;
begin
  select * into job_row
  from public.generation_jobs
  where id = p_job_id and user_id = p_user_id
  for update;

  if job_row.id is null then raise exception 'generation_job_not_found'; end if;
  if job_row.status = 'succeeded' and job_row.result_course_id = p_course_id then return; end if;
  if job_row.status <> 'running' or job_row.reservation_id <> p_reservation_id then
    raise exception 'generation_job_not_completable';
  end if;
  if not exists (select 1 from public.courses where id = p_course_id and user_id = p_user_id) then
    raise exception 'generated_course_not_owned';
  end if;

  perform public.settle_stonecode_credit_reservation(p_user_id, p_reservation_id);
  update public.generation_jobs
  set status = 'succeeded',
      progress = 100,
      result_course_id = p_course_id,
      completed_at = now(),
      error_code = null,
      error_message = null
  where id = p_job_id;
end;
$$;

insert into public.technology_manifests (technology_id, display_name, editor_id, default_file_path, runtime_type, rag_corpus_key, enabled, metadata)
values
  ('javascript', 'JavaScript', 'javascript', 'main.js', 'browser', 'language:javascript:v1', true, '{"output":true,"grading":true}'),
  ('typescript', 'TypeScript', 'typescript', 'main.ts', 'judge0', 'language:typescript:v1', true, '{"grading":true}'),
  ('python', 'Python', 'python', 'main.py', 'judge0', 'language:python:v1', true, '{"grading":true}'),
  ('ruby', 'Ruby', 'ruby', 'main.rb', 'judge0', 'language:ruby:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('php', 'PHP', 'php', 'index.php', 'judge0', 'language:php:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('java', 'Java', 'java', 'Main.java', 'judge0', 'language:java:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('csharp', 'C#', 'csharp', 'Program.cs', 'judge0', 'language:csharp:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('cpp', 'C++', 'cpp', 'main.cpp', 'judge0', 'language:cpp:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('c', 'C', 'c', 'main.c', 'judge0', 'language:c:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('go', 'Go', 'go', 'main.go', 'judge0', 'language:go:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('rust', 'Rust', 'rust', 'main.rs', 'judge0', 'language:rust:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('swift', 'Swift', 'swift', 'main.swift', 'judge0', 'language:swift:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('kotlin', 'Kotlin', 'kotlin', 'Main.kt', 'judge0', 'language:kotlin:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('dart', 'Dart', 'dart', 'main.dart', 'judge0', 'language:dart:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('sql', 'SQL', 'sql', 'query.sql', 'judge0', 'language:sql:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('r', 'R', 'r', 'main.R', 'judge0', 'language:r:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('julia', 'Julia', 'julia', 'main.jl', 'judge0', 'language:julia:v1', false, '{"hiddenUntilRuntime":true,"grading":true,"launchStatus":"pending_review"}'),
  ('fortran', 'Fortran', 'fortran', 'main.f90', 'judge0', 'language:fortran:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('cobol', 'COBOL', 'cobol', 'main.cob', 'judge0', 'language:cobol:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('basic', 'BASIC', 'basic', 'main.bas', 'judge0', 'language:basic:v1', false, '{"grading":true,"launchStatus":"pending_review"}'),
  ('html', 'HTML', 'html', 'index.html', 'browser', 'language:html:v1', true, '{"output":true,"grading":true}'),
  ('css', 'CSS', 'css', 'styles.css', 'browser', 'language:css:v1', true, '{"output":true,"grading":true}')
on conflict (technology_id) do update set
  display_name = excluded.display_name,
  editor_id = excluded.editor_id,
  default_file_path = excluded.default_file_path,
  runtime_type = excluded.runtime_type,
  rag_corpus_key = excluded.rag_corpus_key,
  enabled = excluded.enabled,
  metadata = excluded.metadata,
  updated_at = now();

create or replace function public.prevent_marketplace_version_update()
returns trigger language plpgsql as $$
begin
  raise exception 'marketplace_versions_are_immutable';
end;
$$;

drop trigger if exists marketplace_versions_immutable on public.marketplace_template_versions;
create trigger marketplace_versions_immutable before update on public.marketplace_template_versions
for each row execute function public.prevent_marketplace_version_update();

insert into public.rag_corpora (corpus_key, technology_id, version, status)
select rag_corpus_key, technology_id, 1, 'draft'
from public.technology_manifests
on conflict (corpus_key, version) do nothing;

drop function if exists public.match_rag_chunks(vector, integer, text, text);
create or replace function public.match_rag_chunks(
  query_embedding vector(1536),
  match_count integer default 8,
  match_subject text default null,
  match_task text default null,
  match_technology text default null,
  include_draft boolean default false
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
  left join public.rag_corpora on rag_corpora.id = rag_documents.corpus_id
  where rag_chunks.embedding is not null
    and (
      rag_documents.source_type = 'stonecode-curriculum'
      or (
        (include_draft or rag_corpora.status = 'enabled')
        and match_technology is not null
        and rag_corpora.technology_id = match_technology
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

create or replace function public.handle_new_stonecode_credit_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_stonecode_credit_account(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_stonecode_credits on auth.users;
create trigger on_auth_user_created_stonecode_credits
after insert on auth.users
for each row execute function public.handle_new_stonecode_credit_account();

revoke all on function public.ensure_stonecode_credit_account(uuid) from public, anon, authenticated;
revoke all on function public.grant_stonecode_monthly_credits(uuid, timestamptz, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.reserve_stonecode_credits(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.settle_stonecode_credit_reservation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_stonecode_credit_reservation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_expired_stonecode_reservations(uuid) from public, anon, authenticated;
revoke all on function public.claim_stonecode_generation_job(uuid) from public, anon, authenticated;
revoke all on function public.finalize_stonecode_learning_proposal(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.complete_stonecode_generation_job(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_stonecode_credit_account(uuid) to service_role;
grant execute on function public.grant_stonecode_monthly_credits(uuid, timestamptz, timestamptz, integer) to service_role;
grant execute on function public.reserve_stonecode_credits(uuid, uuid, text) to service_role;
grant execute on function public.settle_stonecode_credit_reservation(uuid, uuid) to service_role;
grant execute on function public.release_stonecode_credit_reservation(uuid, uuid) to service_role;
grant execute on function public.release_expired_stonecode_reservations(uuid) to service_role;
grant execute on function public.claim_stonecode_generation_job(uuid) to service_role;
grant execute on function public.finalize_stonecode_learning_proposal(uuid, uuid, text) to service_role;
grant execute on function public.complete_stonecode_generation_job(uuid, uuid, uuid, uuid) to service_role;
