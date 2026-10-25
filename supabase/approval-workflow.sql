-- =====================================================================
-- PrimeBook approval workflow: server-side immutable audit trail
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Idempotent (safe to run again). Does not touch your books data.
--
-- What this gives you on the SERVER, whatever the browser does:
--   * Every approval event the app records (submitted, returned, rejected,
--     approved, posted, policy changed) is copied into pb_apw_audit.
--   * Rows can only be INSERTED. UPDATE, DELETE and TRUNCATE are refused
--     by a trigger and by missing privileges, even for the table owner's
--     API role. The chain is gap-free: each row must carry the hash of
--     the previous row, so rows cannot be dropped, re-ordered or forked.
--   * The server stamps its own time and its own SHA-256 of every row.
--
-- What it does NOT do: it does not decide who may approve. Staff roles
-- live inside your books data and all staff share one cloud login, so the
-- database cannot tell a cashier from a manager. Role rules are enforced
-- by the app. This table is the tamper-proof witness of what happened.
-- =====================================================================

create table if not exists public.pb_apw_audit (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid(),
  n           integer not null check (n > 0),
  logged_at   timestamptz not null default now(),
  actor       text,
  role        text,
  act         text not null,
  rid         text,
  ver         integer,
  note        text,
  prev_hash   text not null,
  hash        text not null,
  server_hash text,
  body        jsonb,
  unique (user_id, n)
);
create index if not exists pb_apw_audit_rid on public.pb_apw_audit (user_id, rid);

alter table public.pb_apw_audit enable row level security;
drop policy if exists pb_apw_sel on public.pb_apw_audit;
drop policy if exists pb_apw_ins on public.pb_apw_audit;
create policy pb_apw_sel on public.pb_apw_audit for select to authenticated using (user_id = auth.uid());
create policy pb_apw_ins on public.pb_apw_audit for insert to authenticated with check (user_id = auth.uid());

revoke all on public.pb_apw_audit from anon, authenticated;
grant select, insert on public.pb_apw_audit to authenticated;

-- Chain check + server stamp on insert.
create or replace function public.pb_apw_audit_ins() returns trigger
language plpgsql security definer set search_path = public as $$
declare last_n integer; last_h text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 7));
  select n, hash into last_n, last_h from public.pb_apw_audit
   where user_id = new.user_id order by n desc limit 1;
  if last_n is null then
    if new.n <> 1 or new.prev_hash <> '0' then
      raise exception 'PB_AUDIT_CHAIN: the first event must be number 1 with previous hash 0' using errcode = 'P0001';
    end if;
  elsif new.n <> last_n + 1 or new.prev_hash <> last_h then
    raise exception 'PB_AUDIT_CHAIN: expected event % after hash %', last_n + 1, last_h using errcode = 'P0001';
  end if;
  new.logged_at   := now();
  new.server_hash := encode(sha256(convert_to(
      coalesce(last_h, '0') || '|' || new.n::text || '|' || coalesce(new.actor, '') || '|' ||
      new.act || '|' || coalesce(new.rid, '') || '|' || coalesce(new.ver::text, '') || '|' ||
      coalesce(new.note, '') || '|' || new.hash, 'UTF8')), 'hex');
  return new;
end $$;

create or replace function public.pb_apw_audit_block() returns trigger
language plpgsql as $$
begin
  raise exception 'PB_AUDIT_IMMUTABLE: pb_apw_audit is append-only' using errcode = 'P0001';
end $$;

drop trigger if exists pb_apw_audit_ins_t on public.pb_apw_audit;
create trigger pb_apw_audit_ins_t before insert on public.pb_apw_audit
  for each row execute function public.pb_apw_audit_ins();
drop trigger if exists pb_apw_audit_upd_t on public.pb_apw_audit;
create trigger pb_apw_audit_upd_t before update or delete on public.pb_apw_audit
  for each row execute function public.pb_apw_audit_block();
drop trigger if exists pb_apw_audit_trunc_t on public.pb_apw_audit;
create trigger pb_apw_audit_trunc_t before truncate on public.pb_apw_audit
  for each statement execute function public.pb_apw_audit_block();

-- Keep the session guard on the new table (if it is installed).
do $$
begin
  if to_regprocedure('public.pb_session_ok()') is not null then
    execute 'drop policy if exists pb_session_guard on public.pb_apw_audit';
    execute 'create policy pb_session_guard on public.pb_apw_audit as restrictive for all to authenticated '
            'using (public.pb_session_ok()) with check (public.pb_session_ok())';
  end if;
end $$;

notify pgrst, 'reload schema';

-- ROLLBACK (removes the audit copy; your books are not affected):
--   drop table if exists public.pb_apw_audit;
--   drop function if exists public.pb_apw_audit_ins(), public.pb_apw_audit_block();
