-- Test for supabase/book-history.sql on plain PostgreSQL 15+ with a minimal Supabase mock.
-- Run: psql -v ON_ERROR_STOP=1 -f tests/book-history.test.sql   (from the repo root)
-- Every check raises an exception on failure, so a clean exit means all checks passed.

\set QUIET on
\pset tuples_only on
set client_min_messages = warning;
drop schema if exists auth cascade;
drop table if exists public.books_history, public.books cascade;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_extension where extname='pgcrypto') then
    begin create extension pgcrypto; exception when others then null; end;
  end if;
end $$;

-- A books table shaped like the one the app uses, with owner-only RLS (the assumed production setup).
create table public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text, data jsonb not null, version integer not null default 1,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.books enable row level security;
create policy own on public.books for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
grant select, insert, update, delete on public.books to authenticated;
-- PostgREST would ignore this NOTIFY target; plain Postgres accepts it.

\i supabase/book-history.sql

-- Two tenants.
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''

set role authenticated;
select set_config('request.jwt.claim.sub', :A, false);
insert into public.books(name, data) values ('A books', '{"j":[{"id":1},{"id":2}]}');
-- normal save: version 1 -> 2 keeps v1 in history
update public.books set data='{"j":[{"id":1},{"id":2},{"id":3}]}', version=2;
do $$ begin
  if (select count(*) from public.books_history where version=1) <> 1 then raise exception 'FAIL: v1 not kept'; end if;
end $$;
-- version jump refused
do $$ begin
  begin update public.books set data='{"j":[]}', version=9; raise exception 'FAIL: version jump allowed';
  exception when serialization_failure then null; end;
end $$;
-- a "reset" (empty book) is a normal save, and recoverable
update public.books set data='{"j":[]}', version=3;
do $$ declare bid text := (select id::text from public.books); v int; begin
  v := public.pb_book_restore(bid, 2);
  if v <> 4 then raise exception 'FAIL: restore returned %', v; end if;
  if (select jsonb_array_length(data->'j') from public.books) <> 3 then raise exception 'FAIL: restore content'; end if;
  if (select reason from public.books_history where version=3) <> 'restore' then raise exception 'FAIL: restore not labelled'; end if;
end $$;
-- delete is refused for the API role
do $$ begin
  begin delete from public.books; raise exception 'FAIL: delete allowed';
  exception when insufficient_privilege then null; end;
end $$;
-- history is not writable by the API role
do $$ begin
  begin update public.books_history set data='{}'; raise exception 'FAIL: history editable';
  exception when insufficient_privilege then null; end;
  begin delete from public.books_history; raise exception 'FAIL: history deletable';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  if not public.pb_book_history_ok() then raise exception 'FAIL: history_ok false'; end if;
  if (select count(*) from public.pb_book_versions((select id::text from public.books))) <> 3 then raise exception 'FAIL: versions list'; end if;
end $$;

-- Tenant B sees none of A's history and cannot restore A's book.
reset role;
select set_config('pb.bid', id::text, false) from public.books;
set role authenticated;
select set_config('request.jwt.claim.sub', :B, false);
do $$ begin
  if (select count(*) from public.books_history) <> 0 then raise exception 'FAIL: B reads A history'; end if;
end $$;
do $$ begin
  begin perform public.pb_book_restore(current_setting('pb.bid'), 1); raise exception 'FAIL: B restored A book';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
reset role;
\echo 'book-history: all checks passed'
