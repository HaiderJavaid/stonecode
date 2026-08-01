alter table public.usage_events
  add column if not exists generation_job_id uuid references public.generation_jobs(id) on delete set null,
  add column if not exists proposal_id uuid references public.learning_proposals(id) on delete set null,
  add column if not exists cached_input_tokens integer,
  add column if not exists reasoning_tokens integer,
  add column if not exists estimated_cost_microusd bigint,
  add column if not exists pricing_version text;

alter table public.generation_jobs
  add column if not exists heartbeat_at timestamptz,
  add column if not exists estimated_ai_cost_microusd bigint not null default 0,
  add column if not exists input_tokens bigint not null default 0,
  add column if not exists cached_input_tokens bigint not null default 0,
  add column if not exists output_tokens bigint not null default 0,
  add column if not exists reasoning_tokens bigint not null default 0,
  add column if not exists stones_charged integer not null default 0,
  add column if not exists nominal_creation_revenue_microusd bigint not null default 0;

create index if not exists usage_events_generation_job_idx
  on public.usage_events (generation_job_id, created_at);

create index if not exists usage_events_proposal_idx
  on public.usage_events (proposal_id, created_at);

create or replace function public.refresh_stonecode_generation_job_economics(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.generation_jobs jobs
  set estimated_ai_cost_microusd = coalesce((
        select sum(coalesce(events.estimated_cost_microusd, 0))
        from public.usage_events events
        where events.generation_job_id = p_job_id or events.proposal_id = jobs.proposal_id
      ), 0),
      input_tokens = coalesce((
        select sum(coalesce(events.input_tokens, 0))
        from public.usage_events events
        where events.generation_job_id = p_job_id or events.proposal_id = jobs.proposal_id
      ), 0),
      cached_input_tokens = coalesce((
        select sum(coalesce(events.cached_input_tokens, 0))
        from public.usage_events events
        where events.generation_job_id = p_job_id or events.proposal_id = jobs.proposal_id
      ), 0),
      output_tokens = coalesce((
        select sum(coalesce(events.output_tokens, 0))
        from public.usage_events events
        where events.generation_job_id = p_job_id or events.proposal_id = jobs.proposal_id
      ), 0),
      reasoning_tokens = coalesce((
        select sum(coalesce(events.reasoning_tokens, 0))
        from public.usage_events events
        where events.generation_job_id = p_job_id or events.proposal_id = jobs.proposal_id
      ), 0),
      stones_charged = coalesce((
        select reservations.amount from public.credit_reservations reservations
        where reservations.id = jobs.reservation_id
      ), 0),
      nominal_creation_revenue_microusd = coalesce((
        select sum(case when grants.grant_type = 'subscription' then allocations.amount * 90000 else 0 end)
        from public.credit_reservation_allocations allocations
        join public.credit_grants grants on grants.id = allocations.grant_id
        where allocations.reservation_id = jobs.reservation_id
      ), 0)
  where jobs.id = p_job_id;
end;
$$;

create or replace function public.sync_stonecode_generation_usage_economics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.generation_job_id is not null then
    perform public.refresh_stonecode_generation_job_economics(new.generation_job_id);
  elsif new.proposal_id is not null then
    perform public.refresh_stonecode_generation_job_economics(jobs.id)
    from public.generation_jobs jobs
    where jobs.proposal_id = new.proposal_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_stonecode_generation_usage_economics on public.usage_events;
create trigger sync_stonecode_generation_usage_economics
after insert or update of input_tokens, output_tokens, cached_input_tokens, reasoning_tokens, estimated_cost_microusd
on public.usage_events
for each row execute function public.sync_stonecode_generation_usage_economics();

create or replace function public.initialize_stonecode_generation_job_economics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_stonecode_generation_job_economics(new.id);
  return new;
end;
$$;

drop trigger if exists initialize_stonecode_generation_job_economics on public.generation_jobs;
create trigger initialize_stonecode_generation_job_economics
after insert on public.generation_jobs
for each row execute function public.initialize_stonecode_generation_job_economics();

update public.credit_reservations
set expires_at = greatest(expires_at, created_at + interval '90 minutes')
where status = 'reserved';

alter table public.credit_reservations
  alter column expires_at set default (now() + interval '90 minutes');

update public.generation_jobs set heartbeat_at = coalesce(heartbeat_at, started_at, created_at);

create or replace function public.claim_stonecode_generation_job(p_job_id uuid)
returns setof public.generation_jobs
language sql
security definer
set search_path = public
as $$
  update public.generation_jobs
  set status = 'running',
      progress = greatest(progress, 2),
      attempt_count = attempt_count + 1,
      started_at = now(),
      heartbeat_at = now()
  where id = p_job_id and status = 'queued' and attempt_count < 3
  returning *;
$$;

revoke all on function public.refresh_stonecode_generation_job_economics(uuid) from public, anon, authenticated;
grant execute on function public.refresh_stonecode_generation_job_economics(uuid) to service_role;
revoke all on function public.initialize_stonecode_generation_job_economics() from public, anon, authenticated;
grant execute on function public.initialize_stonecode_generation_job_economics() to service_role;
revoke all on function public.claim_stonecode_generation_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_stonecode_generation_job(uuid) to service_role;
