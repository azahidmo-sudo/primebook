-- =====================================================================
-- PrimeBook client portal (real client login)
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Idempotent: safe to run again. Does not touch your existing tables.
-- Run supabase/session-guard.sql FIRST (this file extends its protection
-- to the new tables when it is installed).
--
-- How it works
--   * Each client signs up on /portal with their own email and password
--     (a normal Supabase Auth user) and enters a one-time access code that
--     the business generated for them in PrimeBook.
--   * The business app publishes a read-only copy of each client's own
--     records (balance, invoices, appointments, memberships ...) into
--     portal_data. A client can read ONLY the rows linked to their own
--     login. They can never read the business book, other clients, or
--     anything the business did not tick under "Can do".
--   * Clients can send payment notices, appointment requests and messages
--     into portal_inbox. The business app imports them as pending items.
--   * Access codes are stored only as SHA-256 hashes, expire, and are
--     locked after 5 wrong tries (15 minute lock).
-- =====================================================================

create table if not exists public.portal_clients (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null,                       -- the business account (auth.uid() of the PrimeBook user)
  client_ref    text not null,                       -- customer id inside the business book
  name          text not null default '',
  email         text not null,
  company       text not null default '',
  status        text not null default 'invited' check (status in ('invited','active','suspended')),
  perms         jsonb not null default '{}'::jsonb,
  auth_user     uuid,                                -- the client's own login, set when the code is claimed
  invite_hash   text,
  invite_expires timestamptz,
  last_login    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (owner_id, client_ref)
);
create index if not exists portal_clients_email_idx on public.portal_clients (lower(email));
create index if not exists portal_clients_auth_idx  on public.portal_clients (auth_user);

create table if not exists public.portal_data (
  owner_id    uuid not null,
  client_ref  text not null,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (owner_id, client_ref)
);

create table if not exists public.portal_inbox (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null,
  client_ref  text not null,
  kind        text not null check (kind in ('payment','appointment','message')),
  body        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  handled     boolean not null default false,
  check (pg_column_size(body) < 4000)
);
create index if not exists portal_inbox_owner_idx on public.portal_inbox (owner_id, handled, created_at);

create table if not exists public.portal_attempts (
  email        text primary key,
  fails        integer not null default 0,
  locked_until timestamptz
);

alter table public.portal_clients  enable row level security;
alter table public.portal_data     enable row level security;
alter table public.portal_inbox    enable row level security;
alter table public.portal_attempts enable row level security;
revoke all on public.portal_clients, public.portal_data, public.portal_inbox, public.portal_attempts from anon;
revoke all on public.portal_attempts from authenticated;

-- ---------- portal_clients ----------
drop policy if exists pc_owner  on public.portal_clients;
drop policy if exists pc_client on public.portal_clients;
create policy pc_owner  on public.portal_clients for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy pc_client on public.portal_clients for select to authenticated
  using (auth_user = auth.uid());

-- ---------- portal_data ----------
drop policy if exists pd_owner  on public.portal_data;
drop policy if exists pd_client on public.portal_data;
create policy pd_owner  on public.portal_data for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy pd_client on public.portal_data for select to authenticated
  using (exists (select 1 from public.portal_clients pc
                 where pc.owner_id = portal_data.owner_id and pc.client_ref = portal_data.client_ref
                   and pc.auth_user = auth.uid() and pc.status = 'active'));

-- ---------- portal_inbox ----------
drop policy if exists pi_owner         on public.portal_inbox;
drop policy if exists pi_client_read   on public.portal_inbox;
drop policy if exists pi_client_insert on public.portal_inbox;
create policy pi_owner on public.portal_inbox for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy pi_client_read on public.portal_inbox for select to authenticated
  using (exists (select 1 from public.portal_clients pc
                 where pc.owner_id = portal_inbox.owner_id and pc.client_ref = portal_inbox.client_ref
                   and pc.auth_user = auth.uid() and pc.status = 'active'));
-- A client may only add items for their own link, and only for the things the business allowed.
create policy pi_client_insert on public.portal_inbox for insert to authenticated
  with check (
    handled = false
    and exists (select 1 from public.portal_clients pc
                where pc.owner_id = portal_inbox.owner_id and pc.client_ref = portal_inbox.client_ref
                  and pc.auth_user = auth.uid() and pc.status = 'active'
                  and (portal_inbox.kind = 'message'
                       or (portal_inbox.kind = 'payment'     and coalesce(pc.perms->>'pay','0')  = '1')
                       or (portal_inbox.kind = 'appointment' and coalesce(pc.perms->>'book','0') = '1'))));

-- At most 30 items per client per day (a trigger, so it can count without re-entering the policy).
create or replace function public.portal_inbox_limit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.portal_inbox x
       where x.owner_id = new.owner_id and x.client_ref = new.client_ref
         and x.created_at > now() - interval '1 day') >= 30 then
    raise exception 'Too many requests today. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists portal_inbox_limit on public.portal_inbox;
create trigger portal_inbox_limit before insert on public.portal_inbox
  for each row execute function public.portal_inbox_limit();

-- ---------- claim an access code ----------
-- Returns jsonb. Failures are returned (not raised) so the attempt counter is kept.
create or replace function public.portal_claim(p_code text)
returns jsonb
language plpgsql volatile security definer
set search_path = public, auth, pg_temp
as $$
declare
  claims  jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_email text  := lower(coalesce(claims->>'email', ''));
  v_uid   uuid;
  v_hash  text;
  a       public.portal_attempts%rowtype;
  r       public.portal_clients%rowtype;
begin
  begin v_uid := (claims->>'sub')::uuid; exception when others then v_uid := null; end;
  if v_uid is null or coalesce(claims->>'role','') <> 'authenticated' or v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'signin');
  end if;
  insert into public.portal_attempts(email) values (v_email) on conflict (email) do nothing;
  select * into a from public.portal_attempts where email = v_email for update;
  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  v_hash := encode(sha256(convert_to(upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g')), 'utf8')), 'hex');
  select * into r from public.portal_clients
   where lower(email) = v_email and invite_hash = v_hash and status = 'invited'
     and (invite_expires is null or invite_expires > now())
   order by created_at desc limit 1;
  if not found then
    update public.portal_attempts
       set fails = case when locked_until is not null and locked_until <= now() then 1 else fails + 1 end,
           locked_until = case when fails + 1 >= 5 then now() + interval '15 minutes' else null end
     where email = v_email;
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  update public.portal_clients
     set auth_user = v_uid, status = 'active', invite_hash = null, invite_expires = null,
         last_login = now(), updated_at = now()
   where id = r.id;
  update public.portal_attempts set fails = 0, locked_until = null where email = v_email;
  return jsonb_build_object('ok', true, 'company', r.company, 'name', r.name);
end $$;

-- Record a portal sign-in time on every link of the signed-in client.
create or replace function public.portal_seen()
returns void language sql volatile security definer
set search_path = public, auth, pg_temp
as $$ update public.portal_clients set last_login = now() where auth_user = auth.uid() $$;

revoke all on function public.portal_claim(text), public.portal_seen() from public, anon;
grant execute on function public.portal_claim(text), public.portal_seen() to authenticated;

-- ---------- keep the session guard on the new tables (if installed) ----------
do $$
declare t text;
begin
  if to_regprocedure('public.pb_session_ok()') is not null then
    foreach t in array array['portal_clients','portal_data','portal_inbox'] loop
      execute format('drop policy if exists pb_session_guard on public.%I', t);
      execute format('create policy pb_session_guard on public.%I as restrictive for all to authenticated '
                     'using (public.pb_session_ok()) with check (public.pb_session_ok())', t);
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- ROLLBACK (removes the portal tables and every client link)
-- ---------------------------------------------------------------------
-- drop function if exists public.portal_claim(text), public.portal_seen();
-- drop table if exists public.portal_inbox, public.portal_data, public.portal_clients, public.portal_attempts;
