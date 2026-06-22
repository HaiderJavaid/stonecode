create table if not exists public.workspace_folders (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, path)
);

alter table public.workspace_folders enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_folders'
      and policyname = 'folders own course'
  ) then
    create policy "folders own course" on public.workspace_folders for all using (
      exists (select 1 from public.courses where courses.id = workspace_folders.course_id and courses.user_id = auth.uid())
    ) with check (
      exists (select 1 from public.courses where courses.id = workspace_folders.course_id and courses.user_id = auth.uid())
    );
  end if;
end
$$;

notify pgrst, 'reload schema';
