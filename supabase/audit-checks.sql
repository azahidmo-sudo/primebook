-- =====================================================================
-- PrimeBook audit checks (read-only). Changes nothing.
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Paste the results back into the audit so finding C8 (tenant isolation
-- of public.books) can be closed or escalated.
-- =====================================================================

-- 1. Columns of public.books
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'books'
 order by ordinal_position;

-- 2. Is row-level security on, and is it forced?
select relname, relrowsecurity as rls_on, relforcerowsecurity as rls_forced
  from pg_class where oid = 'public.books'::regclass;

-- 3. Every policy on public.books (expect: owner-only for all commands)
select policyname, permissive, roles, cmd, qual as using_expr, with_check
  from pg_policies where schemaname = 'public' and tablename = 'books'
 order by policyname;

-- 4. Table privileges per role (anon should have none)
select grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'books'
 group by grantee order by grantee;

-- 5. Books per owner and size (no contents shown)
--    Replace owner_id with the real owner column from check 1 if it differs.
-- select owner_id, count(*) as books, pg_size_pretty(sum(pg_column_size(data))) as size
--   from public.books group by owner_id order by 2 desc;

-- 6. Triggers on public.books (book-history.sql adds pb_books_history)
select tgname, pg_get_triggerdef(oid) from pg_trigger
 where tgrelid = 'public.books'::regclass and not tgisinternal;

-- 7. Other public tables without row-level security (each one is exposed to the API)
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
 order by 1;
