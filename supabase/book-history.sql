-- =====================================================================
-- PrimeBook server-side book history (Phase 0 containment, F-P0-4)
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Idempotent: safe to run again. Does not change any existing book data.
--
-- What it does, on the SERVER, whatever the browser sends:
--   * Before every save or delete of a row in public.books, the previous
--     version is copied into public.books_history. Nothing in the app can
--     edit or delete that history.
--   * A save must move the version forward by exactly one, so a stale or
--     tampered client cannot jump versions or rewind them.
--   * Signed-in users can no longer delete a book row through the API.
--   * Owners can list their book's versions and restore one. A restore is
--     itself a new version, so it can be undone the same way.
--   * The app checks pb_book_history_ok() before allowing "Reset data" on
--     an online book (Reset stays off until this file is installed).
--
-- Reads use the books table's own row-level security: you can only see the
-- history of books you can already see.
--
-- To remove it, run the ROLLBACK block at the bottom of this file.
-- =====================================================================

create table if not exists public.books_history (
  hist_id     bigint generated always as identity primary key,
  book_id     text        not null,                       -- books.id as text (works for uuid or integer ids)
  version     integer     not null,
  name        text,
  data        jsonb       not null,
  saved_at    timestamptz not null default now(),
  saved_by    uuid,                                   -- auth.uid() of the session that replaced this version
  reason      text        not null check (reason in ('update','delete','restore'))
);
create index if not exists books_history_book_idx on public.books_history (book_id, version desc);

alter table public.books_history enable row level security;
revoke all on public.books_history from anon, authenticated;
grant select on public.books_history to authenticated;

drop policy if exists bh_read on public.books_history;
create policy bh_read on public.books_history for select to authenticated
  using (exists (select 1 from public.books b where b.id::text = books_history.book_id));

-- Keep the previous version, and refuse version jumps.
create or replace function public.pb_books_keep_history()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.version is distinct from old.version + 1 then
      raise exception 'PB_VERSION: expected version %, got %', old.version + 1, new.version
        using errcode = '40001', hint = 'Another device saved first. Reload the books.';
    end if;
    insert into public.books_history(book_id, version, name, data, saved_by, reason)
    values (old.id::text, old.version, old.name, old.data, auth.uid(),
            coalesce(nullif(current_setting('pb.reason', true), ''), 'update'));
    return new;
  else
    insert into public.books_history(book_id, version, name, data, saved_by, reason)
    values (old.id::text, old.version, old.name, old.data, auth.uid(), 'delete');
    return old;
  end if;
end $$;

drop trigger if exists pb_books_history on public.books;
create trigger pb_books_history before update or delete on public.books
  for each row execute function public.pb_books_keep_history();

-- The app never deletes a book; stop the API from doing it.
revoke delete on public.books from anon, authenticated;

-- Used by the app before an online "Reset data".
create or replace function public.pb_book_history_ok()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$ select exists (select 1 from pg_trigger where tgname = 'pb_books_history' and not tgisinternal) $$;

-- Versions of a book the caller can see (newest first, without the data).
create or replace function public.pb_book_versions(p_book text)
returns table(version integer, saved_at timestamptz, reason text, journals integer)
language sql stable security invoker
set search_path = public, pg_temp
as $$
  select h.version, h.saved_at, h.reason,
         coalesce(jsonb_array_length(h.data->'j'), 0)
    from public.books_history h
   where h.book_id = p_book
   order by h.version desc
   limit 500
$$;

-- Restore an earlier version as a NEW version. Runs with the caller's rights,
-- so the books table's own policies decide who may do it.
create or replace function public.pb_book_restore(p_book text, p_version integer)
returns integer
language plpgsql volatile security invoker
set search_path = public, pg_temp
as $$
declare d jsonb; v integer;
begin
  select h.data into d from public.books_history h
   where h.book_id = p_book and h.version = p_version
   order by h.hist_id desc limit 1;
  if d is null then raise exception 'PB_RESTORE: version % not found', p_version; end if;
  perform set_config('pb.reason', 'restore', true);
  update public.books set data = d, version = version + 1, updated_at = now()
   where id::text = p_book returning version into v;
  if v is null then raise exception 'PB_RESTORE: book not found or not yours'; end if;
  return v;
end $$;

revoke all on function public.pb_book_history_ok(), public.pb_book_versions(text),
  public.pb_book_restore(text, integer) from public, anon;
grant execute on function public.pb_book_history_ok(), public.pb_book_versions(text),
  public.pb_book_restore(text, integer) to authenticated;

-- Keep the session guard on the new table (if installed).
do $$
begin
  if to_regprocedure('public.pb_session_ok()') is not null then
    execute 'drop policy if exists pb_session_guard on public.books_history';
    execute 'create policy pb_session_guard on public.books_history as restrictive for all to authenticated '
            'using (public.pb_session_ok()) with check (public.pb_session_ok())';
  end if;
end $$;

notify pgrst, 'reload schema';

-- Check (run from the SQL editor): should return true.
--   select public.pb_book_history_ok();

-- ---------------------------------------------------------------------
-- ROLLBACK (keeps books_history so no saved version is lost; drop it by hand if you are sure)
-- ---------------------------------------------------------------------
-- drop trigger if exists pb_books_history on public.books;
-- drop function if exists public.pb_book_restore(text, integer), public.pb_book_versions(text),
--   public.pb_book_history_ok(), public.pb_books_keep_history();
-- grant delete on public.books to authenticated;   -- only if you granted it before
