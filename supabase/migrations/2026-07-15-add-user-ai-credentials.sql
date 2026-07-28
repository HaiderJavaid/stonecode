create table if not exists public.user_ai_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null default 'openai' check (provider in ('openai')),
  encrypted_secret text not null,
  secret_iv text not null,
  secret_tag text not null,
  last_four text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_ai_credentials enable row level security;

comment on table public.user_ai_credentials is
  'Server-only encrypted user AI credentials. No authenticated-user RLS policy is intentionally defined.';
