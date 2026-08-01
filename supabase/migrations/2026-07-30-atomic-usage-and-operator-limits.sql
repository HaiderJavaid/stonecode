create table if not exists public.plan_usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('tutor_reply', 'ai_image', 'judge0_action', 'learning_proposal')),
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature, period_start)
);

create table if not exists public.operator_usage_counters (
  feature text not null check (feature in ('judge0_action')),
  period_start date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (feature, period_start)
);

alter table public.plan_usage_counters enable row level security;
alter table public.operator_usage_counters enable row level security;

drop policy if exists "plan usage own rows" on public.plan_usage_counters;
create policy "plan usage own rows" on public.plan_usage_counters
for select using ((select auth.uid()) = user_id);

create or replace function public.consume_stonecode_plan_usage(
  p_user_id uuid,
  p_feature text,
  p_period_start date,
  p_limit integer,
  p_amount integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_used integer;
begin
  if p_user_id is null or p_period_start is null then raise exception 'usage_counter_input_invalid'; end if;
  if p_feature not in ('tutor_reply', 'ai_image', 'judge0_action', 'learning_proposal') then raise exception 'usage_counter_feature_invalid'; end if;
  if p_limit < 0 or p_amount < 1 then raise exception 'usage_counter_limit_invalid'; end if;
  if p_amount > p_limit then
    select coalesce(used, 0) into next_used from public.plan_usage_counters
    where user_id = p_user_id and feature = p_feature and period_start = p_period_start;
    return jsonb_build_object('allowed', false, 'used', coalesce(next_used, 0), 'limit', p_limit);
  end if;

  insert into public.plan_usage_counters (user_id, feature, period_start, used)
  values (p_user_id, p_feature, p_period_start, p_amount)
  on conflict (user_id, feature, period_start) do update
  set used = public.plan_usage_counters.used + excluded.used,
      updated_at = now()
  where public.plan_usage_counters.used + excluded.used <= p_limit
  returning used into next_used;

  if next_used is null then
    select used into next_used from public.plan_usage_counters
    where user_id = p_user_id and feature = p_feature and period_start = p_period_start;
    return jsonb_build_object('allowed', false, 'used', coalesce(next_used, 0), 'limit', p_limit);
  end if;
  return jsonb_build_object('allowed', true, 'used', next_used, 'limit', p_limit);
end;
$$;

create or replace function public.release_stonecode_plan_usage(
  p_user_id uuid,
  p_feature text,
  p_period_start date,
  p_amount integer default 1
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_used integer;
begin
  if p_amount < 1 then raise exception 'usage_counter_amount_invalid'; end if;
  update public.plan_usage_counters
  set used = greatest(0, used - p_amount), updated_at = now()
  where user_id = p_user_id and feature = p_feature and period_start = p_period_start
  returning used into next_used;
  return coalesce(next_used, 0);
end;
$$;

create or replace function public.consume_stonecode_operator_usage(
  p_feature text,
  p_period_start date,
  p_limit integer,
  p_amount integer default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_used integer;
begin
  if p_period_start is null or p_feature <> 'judge0_action' then raise exception 'operator_usage_input_invalid'; end if;
  if p_limit < 0 or p_amount < 1 then raise exception 'operator_usage_limit_invalid'; end if;
  if p_amount > p_limit then
    select coalesce(used, 0) into next_used from public.operator_usage_counters
    where feature = p_feature and period_start = p_period_start;
    return jsonb_build_object('allowed', false, 'used', coalesce(next_used, 0), 'limit', p_limit);
  end if;

  insert into public.operator_usage_counters (feature, period_start, used)
  values (p_feature, p_period_start, p_amount)
  on conflict (feature, period_start) do update
  set used = public.operator_usage_counters.used + excluded.used,
      updated_at = now()
  where public.operator_usage_counters.used + excluded.used <= p_limit
  returning used into next_used;

  if next_used is null then
    select used into next_used from public.operator_usage_counters
    where feature = p_feature and period_start = p_period_start;
    return jsonb_build_object('allowed', false, 'used', coalesce(next_used, 0), 'limit', p_limit);
  end if;
  return jsonb_build_object('allowed', true, 'used', next_used, 'limit', p_limit);
end;
$$;

create or replace function public.release_stonecode_operator_usage(
  p_feature text,
  p_period_start date,
  p_amount integer default 1
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_used integer;
begin
  if p_amount < 1 then raise exception 'operator_usage_amount_invalid'; end if;
  update public.operator_usage_counters
  set used = greatest(0, used - p_amount), updated_at = now()
  where feature = p_feature and period_start = p_period_start
  returning used into next_used;
  return coalesce(next_used, 0);
end;
$$;

revoke all on function public.consume_stonecode_plan_usage(uuid, text, date, integer, integer) from public, anon, authenticated;
revoke all on function public.release_stonecode_plan_usage(uuid, text, date, integer) from public, anon, authenticated;
revoke all on function public.consume_stonecode_operator_usage(text, date, integer, integer) from public, anon, authenticated;
revoke all on function public.release_stonecode_operator_usage(text, date, integer) from public, anon, authenticated;
grant execute on function public.consume_stonecode_plan_usage(uuid, text, date, integer, integer) to service_role;
grant execute on function public.release_stonecode_plan_usage(uuid, text, date, integer) to service_role;
grant execute on function public.consume_stonecode_operator_usage(text, date, integer, integer) to service_role;
grant execute on function public.release_stonecode_operator_usage(text, date, integer) to service_role;
