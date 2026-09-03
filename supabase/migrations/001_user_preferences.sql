-- Supabase free tier - run in SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- Persists selected GitHub repo per GitHub user id -> cross-device

create table if not exists public.user_preferences (
  github_user_id bigint primary key,
  github_login text not null,
  selected_owner text not null,
  selected_repo text not null,
  selected_branch text not null default 'main',
  updated_at timestamptz not null default now()
);

-- Enable RLS and allow service_role to bypass; anon would be blocked by RLS (we use service_role on server)
alter table public.user_preferences enable row level security;

-- Permissive policy for service_role (server) - if you use anon key, keep this; service_role bypasses RLS anyway
drop policy if exists "Allow all for service_role" on public.user_preferences;
create policy "Allow all for service_role"
  on public.user_preferences
  for all
  to service_role
  using (true)
  with check (true);

-- Optional: allow authenticated to read/write own row if you switch to supabase auth later
drop policy if exists "Users can manage own preference" on public.user_preferences;
create policy "Users can manage own preference"
  on public.user_preferences
  for all
  to anon, authenticated
  using (true)
  with check (true);

create index if not exists user_preferences_login_idx on public.user_preferences (github_login);
