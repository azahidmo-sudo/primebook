-- =====================================================================
-- PrimeBook server-side session guard
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is idempotent (safe to run again) and does not touch your data.
--
-- What it enforces on the SERVER, whatever the browser does:
--   * 8-hour hard session limit, measured from the real sign-in time
--     (auth.sessions.created_at), so it cannot be extended by refreshing.
--   * Idle timeout: 15 minutes by default; 5 minutes in high-security
--     mode (the client may choose any value from 5 to 15, never more).
--   * A signed-out or revoked session stops working immediately, even
--     though its access token has not reached its own expiry yet.
--   * Every request from a signed-in user is checked (PostgREST
--     pre-request hook) and every table with row level security gets a
--     restrictive policy, so an expired session reads and writes nothing.
-- An expired session receives HTTP 401 with the message PB_SESSION_EXPIRED.
--
-- To remove it, run the ROLLBACK block at the bottom of this file.
-- =====================================================================

create table if not exists public.pb_session_activity (
  session_id   uuid primary key,
  user_id      uuid not null,
  last_seen    timestamptz not null default now(),
  idle_seconds integer not null default 900 check (idle_seconds between 300 and 900),
  updated_at   timestamptz not null default now()
);
alter table public.pb_session_activity enable row level security;
revoke all on public.pb_session_activity from anon, authenticated;

-- Current session state, derived from the JWT's session_id.
create or replace function public.pb_session_status()
returns table(ok boolean, reason text, idle_left integer, max_left integer)
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare
  claims   jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  sid      uuid;
  s_made   timestamptz;
  s_after  timestamptz;
  a_last   timestamptz;
  a_idle   integer;
  v_idle   integer;
  v_max    integer;
  hard_cap constant integer := 8 * 3600;   -- 8 hours
  grace    constant integer := 30;         -- seconds, covers network latency for the final save
begin
  begin sid := (claims->>'session_id')::uuid; exception when others then sid := null; end;
  if sid is null then
    return query select false, 'no_session'::text, 0, 0; return;
  end if;
  select s.created_at, s.not_after into s_made, s_after from auth.sessions s where s.id = sid;
  if not found then
    return query select false, 'revoked'::text, 0, 0; return;
  end if;
  select a.last_seen, a.idle_seconds into a_last, a_idle from public.pb_session_activity a where a.session_id = sid;
  if a_last is null then a_last := s_made; a_idle := 900; end if;
  v_idle := a_idle + grace - floor(extract(epoch from (now() - a_last)))::integer;
  v_max  := hard_cap - floor(extract(epoch from (now() - s_made)))::integer;
  if s_after is not null and s_after < now() then
    return query select false, 'expired'::text, 0, 0; return;
  end if;
  if v_max <= 0 then
    return query select false, 'max_lifetime'::text, greatest(v_idle, 0), 0; return;
  end if;
  if v_idle <= 0 then
    return query select false, 'idle'::text, 0, v_max; return;
  end if;
  return query select true, 'ok'::text, v_idle, v_max;
end $$;

-- Raises HTTP 401 for a signed-in user whose session is not valid.
-- anon and service_role requests (sign-in, server jobs) are not affected.
create or replace function public.pb_session_ok()
returns boolean
language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  r record;
begin
  if coalesce(claims->>'role', '') <> 'authenticated' then return true; end if;
  select * into r from public.pb_session_status();
  if not r.ok then
    raise sqlstate 'PT401' using message = 'PB_SESSION_EXPIRED: ' || r.reason,
      hint = 'Sign in again.';
  end if;
  return true;
end $$;

-- PostgREST pre-request hook: runs before EVERY API request.
create or replace function public.pb_pre_request()
returns void language plpgsql stable security definer
set search_path = public, auth, pg_temp
as $$ begin perform public.pb_session_ok(); end $$;

-- Heartbeat from the app. Records real user activity; refuses (401) if the
-- session is already expired, so an expired session can never be revived.
create or replace function public.pb_session_touch(p_idle_min integer default 15, p_idle_s integer default 0)
returns jsonb
language plpgsql volatile security definer
set search_path = public, auth, pg_temp
as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  r record;
  sid uuid;
  v_idle integer := least(greatest(coalesce(p_idle_min, 15), 5), 15) * 60;
  v_ago  integer := least(greatest(coalesce(p_idle_s, 0), 0), 900);
begin
  select * into r from public.pb_session_status();
  if not r.ok then
    raise sqlstate 'PT401' using message = 'PB_SESSION_EXPIRED: ' || r.reason, hint = 'Sign in again.';
  end if;
  sid := (claims->>'session_id')::uuid;
  insert into public.pb_session_activity(session_id, user_id, last_seen, idle_seconds, updated_at)
  values (sid, (claims->>'sub')::uuid, now() - make_interval(secs => v_ago), v_idle, now())
  on conflict (session_id) do update
    set last_seen = greatest(public.pb_session_activity.last_seen, excluded.last_seen),
        idle_seconds = excluded.idle_seconds, updated_at = now();
  delete from public.pb_session_activity a
   where a.updated_at < now() - interval '2 days'
     and not exists (select 1 from auth.sessions s where s.id = a.session_id);
  select * into r from public.pb_session_status();
  return jsonb_build_object('ok', r.ok, 'idle_left', r.idle_left, 'max_left', r.max_left, 'idle_limit', v_idle);
end $$;

-- Status without side effects.
create or replace function public.pb_session_check()
returns jsonb language sql stable security definer
set search_path = public, auth, pg_temp
as $$ select to_jsonb(s) from public.pb_session_status() s $$;

-- Called at sign-out: forget the activity record.
create or replace function public.pb_session_end()
returns void language plpgsql volatile security definer
set search_path = public, auth, pg_temp
as $$
declare claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
begin
  begin delete from public.pb_session_activity where session_id = (claims->>'session_id')::uuid;
  exception when others then null; end;
end $$;

revoke all on function public.pb_session_status(), public.pb_session_ok(), public.pb_pre_request(),
  public.pb_session_touch(integer, integer), public.pb_session_check(), public.pb_session_end() from public;
grant execute on function public.pb_session_ok(), public.pb_pre_request() to anon, authenticated, service_role;
grant execute on function public.pb_session_touch(integer, integer), public.pb_session_check(),
  public.pb_session_end() to authenticated;

-- Restrictive policy on every table that has row level security.
-- (Restrictive policies are ANDed with your existing policies, which stay as they are.)
do $$
declare t record;
begin
  for t in select schemaname, tablename from pg_tables
           where schemaname = 'public' and rowsecurity and tablename <> 'pb_session_activity'
  loop
    execute format('drop policy if exists pb_session_guard on %I.%I', t.schemaname, t.tablename);
    execute format('create policy pb_session_guard on %I.%I as restrictive for all to authenticated '
                   'using (public.pb_session_ok()) with check (public.pb_session_ok())', t.schemaname, t.tablename);
  end loop;
end $$;

-- Turn on the API-wide hook, then reload PostgREST's configuration.
alter role authenticator set pgrst.db_pre_request = 'public.pb_pre_request';
notify pgrst, 'reload config';

-- Check: this should return one row with ok = true once you are signed in
-- through the app (run it from the app's API, not the SQL editor).
--   select public.pb_session_check();

-- ---------------------------------------------------------------------
-- ROLLBACK (run only if you want to remove the guard)
-- ---------------------------------------------------------------------
-- alter role authenticator reset pgrst.db_pre_request;
-- notify pgrst, 'reload config';
-- do $$ declare t record; begin
--   for t in select schemaname, tablename from pg_tables where schemaname='public' and rowsecurity loop
--     execute format('drop policy if exists pb_session_guard on %I.%I', t.schemaname, t.tablename);
--   end loop; end $$;
-- drop function if exists public.pb_session_touch(integer, integer), public.pb_session_check(),
--   public.pb_session_end(), public.pb_pre_request(), public.pb_session_ok(), public.pb_session_status();
-- drop table if exists public.pb_session_activity;
