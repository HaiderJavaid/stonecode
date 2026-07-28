alter table public.courses
  add column if not exists skill_ids text[] not null default '{}',
  add column if not exists domain_ids text[] not null default '{}';

alter table public.exercise_attempts
  add column if not exists primary_skill text,
  add column if not exists parent_language text,
  add column if not exists topic_ids text[] not null default '{}',
  add column if not exists domain_ids text[] not null default '{}',
  add column if not exists exercise_kind text not null default 'code'
    check (exercise_kind in ('mcq', 'code', 'chat'));

alter table public.xp_ledger
  add column if not exists primary_skill text,
  add column if not exists parent_language text,
  add column if not exists topic_ids text[] not null default '{}',
  add column if not exists domain_ids text[] not null default '{}',
  add column if not exists exercise_kind text not null default 'code'
    check (exercise_kind in ('mcq', 'code', 'chat'));

update public.courses
set skill_ids = array(
  select distinct value
  from jsonb_array_elements_text(coalesce(to_jsonb(languages), '[]'::jsonb)) as value
)
where cardinality(skill_ids) = 0 and jsonb_typeof(coalesce(to_jsonb(languages), '[]'::jsonb)) = 'array';

update public.courses
set domain_ids = case
  when lower(subject || ' ' || title) ~ '(full.?stack)' then array['frontend', 'backend']
  when lower(subject || ' ' || title) ~ '(react|front.?end|html|css|web page|website)' then array['frontend']
  when lower(subject || ' ' || title) ~ '(back.?end|node|express|django|flask|fastapi|spring|laravel|rails|server api)' then array['backend']
  when lower(subject || ' ' || title) ~ '(game|pygame|unity|unreal|godot|phaser)' then array['game']
  when lower(subject || ' ' || title) ~ '(mobile|ios|android|flutter|react native|swiftui|jetpack compose)' then array['mobile']
  else '{}'
end
where cardinality(domain_ids) = 0;

update public.exercise_attempts
set
  primary_skill = coalesce(primary_skill, language),
  parent_language = coalesce(parent_language, language),
  exercise_kind = case
    when source = 'course-mcq' then 'mcq'
    when source = 'course-chat' then 'chat'
    else exercise_kind
  end
where primary_skill is null or parent_language is null;

update public.xp_ledger
set
  primary_skill = coalesce(primary_skill, language),
  parent_language = coalesce(parent_language, language),
  exercise_kind = case
    when source = 'course-mcq' then 'mcq'
    when source = 'course-chat' then 'chat'
    else exercise_kind
  end
where primary_skill is null or parent_language is null;

update public.exercise_attempts as attempt
set domain_ids = course.domain_ids
from public.courses as course
where attempt.course_id = course.id
  and cardinality(attempt.domain_ids) = 0
  and cardinality(course.domain_ids) > 0;

update public.xp_ledger as ledger
set domain_ids = course.domain_ids
from public.courses as course
where ledger.course_id = course.id
  and cardinality(ledger.domain_ids) = 0
  and cardinality(course.domain_ids) > 0;

update public.exercise_attempts
set domain_ids = array['frontend']
where cardinality(domain_ids) = 0 and lower(primary_skill) in ('html', 'css', 'react', 'vue', 'svelte', 'angular');

update public.xp_ledger
set domain_ids = array['frontend']
where cardinality(domain_ids) = 0 and lower(primary_skill) in ('html', 'css', 'react', 'vue', 'svelte', 'angular');

create index if not exists xp_ledger_user_skill_idx
  on public.xp_ledger (user_id, primary_skill, earned_on desc);

create index if not exists xp_ledger_user_parent_language_idx
  on public.xp_ledger (user_id, parent_language, earned_on desc);

create index if not exists courses_user_domains_idx
  on public.courses using gin (domain_ids);
