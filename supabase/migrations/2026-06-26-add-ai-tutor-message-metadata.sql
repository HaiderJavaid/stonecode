alter table public.chat_messages
  add column if not exists message_kind text not null default 'chat'
    check (message_kind in ('chat', 'lesson-intro', 'exercise-hint')),
  add column if not exists generated_key text;

create unique index if not exists chat_messages_generated_key_idx
  on public.chat_messages (course_id, generated_key)
  where generated_key is not null;

alter table public.exercise_attempts
  add column if not exists hint_used_on date;
