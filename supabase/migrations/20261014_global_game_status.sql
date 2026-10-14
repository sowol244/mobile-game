-- Shared game statuses: visitors may read them; only the Edge Function may write them.
create table if not exists public.game_status_config (
  id smallint primary key default 1 check (id = 1),
  statuses jsonb not null default '{}'::jsonb
    check (jsonb_typeof(statuses) = 'object'),
  updated_at timestamptz not null default now()
);

insert into public.game_status_config (id, statuses)
values (1, '{"super-jump":"maintenance"}'::jsonb)
on conflict (id) do nothing;

alter table public.game_status_config enable row level security;
revoke all on table public.game_status_config from anon, authenticated;
grant select on table public.game_status_config to anon, authenticated;

drop policy if exists "Anyone can read game statuses"
  on public.game_status_config;
create policy "Anyone can read game statuses"
  on public.game_status_config
  for select
  to anon, authenticated
  using (true);

-- Failed admin password attempts are private to the Edge Function service role.
create table if not exists public.admin_login_attempts (
  ip_hash text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  window_started_at timestamptz not null default now()
);

alter table public.admin_login_attempts enable row level security;
revoke all on table public.admin_login_attempts from anon, authenticated;
grant all on table public.admin_login_attempts to service_role;

create or replace function public.record_admin_login_failure(p_ip_hash text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_attempts integer;
begin
  insert into public.admin_login_attempts (ip_hash, failed_attempts, window_started_at)
  values (p_ip_hash, 1, now())
  on conflict (ip_hash) do update
  set failed_attempts = case
        when public.admin_login_attempts.window_started_at <= now() - interval '15 minutes' then 1
        else public.admin_login_attempts.failed_attempts + 1
      end,
      window_started_at = case
        when public.admin_login_attempts.window_started_at <= now() - interval '15 minutes' then now()
        else public.admin_login_attempts.window_started_at
      end
  returning failed_attempts into next_attempts;

  return next_attempts;
end;
$$;

revoke all on function public.record_admin_login_failure(text) from public, anon, authenticated;
grant execute on function public.record_admin_login_failure(text) to service_role;
