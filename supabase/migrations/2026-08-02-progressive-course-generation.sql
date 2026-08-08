alter table public.generation_jobs
  add column if not exists launch_ready_at timestamptz,
  add column if not exists background_completed_at timestamptz,
  add column if not exists generation_state jsonb not null default '{}'::jsonb;

alter table public.course_progress
  add column if not exists highest_lesson_index integer not null default 0
    check (highest_lesson_index >= 0);

update public.course_progress
set highest_lesson_index = greatest(highest_lesson_index, lesson_index);

create or replace function public.preserve_stonecode_highest_lesson_index()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.highest_lesson_index := greatest(
    coalesce(new.highest_lesson_index, 0),
    coalesce(new.lesson_index, 0),
    case when tg_op = 'UPDATE' then coalesce(old.highest_lesson_index, 0) else 0 end
  );
  return new;
end;
$$;

drop trigger if exists preserve_stonecode_highest_lesson_index on public.course_progress;
create trigger preserve_stonecode_highest_lesson_index
before insert or update of lesson_index, highest_lesson_index on public.course_progress
for each row execute function public.preserve_stonecode_highest_lesson_index();

create or replace function public.claim_stonecode_generation_job(p_job_id uuid)
returns setof public.generation_jobs
language sql
security definer
set search_path = public
as $$
  update public.generation_jobs
  set status = 'running',
      progress = case when launch_ready_at is null then greatest(progress, 2) else 100 end,
      attempt_count = attempt_count + 1,
      started_at = now(),
      heartbeat_at = now()
  where id = p_job_id
    and status = 'queued'
    and attempt_count < case when launch_ready_at is null then 3 else 8 end
  returning *;
$$;

create or replace function public.launch_stonecode_generation_job(
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
  if job_row.launch_ready_at is not null and job_row.result_course_id = p_course_id then return; end if;
  if job_row.status <> 'running' or job_row.reservation_id <> p_reservation_id then
    raise exception 'generation_job_not_launchable';
  end if;
  if not exists (select 1 from public.courses where id = p_course_id and user_id = p_user_id) then
    raise exception 'generated_course_not_owned';
  end if;

  perform public.settle_stonecode_credit_reservation(p_user_id, p_reservation_id);
  update public.generation_jobs
  set progress = 100,
      result_course_id = p_course_id,
      launch_ready_at = now(),
      error_code = null,
      error_message = null
  where id = p_job_id;
end;
$$;

create or replace function public.complete_stonecode_progressive_generation_job(
  p_user_id uuid,
  p_job_id uuid,
  p_course_id uuid
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
  if job_row.status <> 'running'
     or job_row.launch_ready_at is null
     or job_row.result_course_id <> p_course_id then
    raise exception 'progressive_generation_job_not_completable';
  end if;
  if not exists (select 1 from public.courses where id = p_course_id and user_id = p_user_id) then
    raise exception 'generated_course_not_owned';
  end if;

  update public.generation_jobs
  set status = 'succeeded',
      progress = 100,
      background_completed_at = now(),
      completed_at = now(),
      error_code = null,
      error_message = null
  where id = p_job_id;
end;
$$;

revoke all on function public.launch_stonecode_generation_job(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.launch_stonecode_generation_job(uuid, uuid, uuid, uuid) to service_role;
revoke all on function public.complete_stonecode_progressive_generation_job(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_stonecode_progressive_generation_job(uuid, uuid, uuid) to service_role;
revoke all on function public.claim_stonecode_generation_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_stonecode_generation_job(uuid) to service_role;
