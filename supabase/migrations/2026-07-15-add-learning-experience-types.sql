alter table public.courses
  add column if not exists experience_type text not null default 'course'
    check (experience_type in ('course', 'short_course', 'exercise', 'guided_project')),
  add column if not exists client_request_id text;

update public.courses
set experience_type = 'course'
where experience_type is null;

create unique index if not exists courses_user_client_request_id_idx
  on public.courses (user_id, client_request_id)
  where client_request_id is not null;
