alter table public.courses
  add column if not exists languages text[] not null default '{}',
  add column if not exists tags text[] not null default '{}',
  add column if not exists course_content jsonb,
  add column if not exists content_generation_state text not null default 'roadmap'
    check (content_generation_state in ('roadmap', 'first_chapter', 'full_course'));
