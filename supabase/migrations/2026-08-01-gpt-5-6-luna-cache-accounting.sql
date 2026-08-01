-- GPT-5.6 bills cache writes separately from uncached and cache-read input.
-- Keep that usage visible without changing historical event rows.
alter table public.usage_events
  add column if not exists cache_write_input_tokens integer;

alter table public.generation_jobs
  add column if not exists cache_write_input_tokens bigint not null default 0;

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
      cache_write_input_tokens = coalesce((
        select sum(coalesce(events.cache_write_input_tokens, 0))
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

drop trigger if exists sync_stonecode_generation_usage_economics on public.usage_events;
create trigger sync_stonecode_generation_usage_economics
after insert or update of input_tokens, output_tokens, cached_input_tokens, cache_write_input_tokens, reasoning_tokens, estimated_cost_microusd
on public.usage_events
for each row execute function public.sync_stonecode_generation_usage_economics();
