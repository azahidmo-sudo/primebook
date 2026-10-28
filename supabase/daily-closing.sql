-- =====================================================================
-- PrimeBook Daily Closing (web app at /closing)
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Idempotent: safe to run again. Does not touch your existing tables.
-- If you use supabase/session-guard.sql, run it FIRST: this file adds the
-- same session protection to its own tables when the guard is installed.
--
-- What it stores
--   dc_books    one closing book per branch (for example "vancouver")
--   dc_members  who may use a book, by email, with a role:
--               Owner, Manager, Teller, Finance or Auditor
--   dc_state    the book's revision number and settings (rate board, counters)
--   dc_days     one row per business day: the day's ledger and its audit trail
--   dc_saves    a server-written log of every save: who, when, which revision
--
-- What the SERVER enforces, whatever the browser does
--   * Only active members can read a book. Nobody writes the tables directly:
--     every change goes through the functions below.
--   * Auditors read only. Saves need Owner, Manager, Teller or Finance.
--   * Every save carries the revision it was based on. If someone else saved
--     first, the save is refused (DC_CONFLICT) and nothing is written.
--   * The audit trail of a day is append-only: earlier entries can never be
--     changed or removed.
--   * A locked day can never change again (only its "next day generated"
--     marker may be added once).
--   * Approving or locking a day needs a Manager, Finance or Owner, and the
--     approver must be a different person from the one who submitted it.
--   * Staff are linked to a book by their email, and only after that email
--     address has been confirmed.
-- =====================================================================

create table if not exists public.dc_books (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name        text not null,
  base        text not null default 'CAD',
  owner_id    uuid not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.dc_members (
  book_id      text not null references public.dc_books(id) on delete cascade,
  email        text not null check (email = lower(email) and position('@' in email) > 1),
  user_id      uuid,
  display_name text not null check (length(display_name) between 1 and 60),
  role         text not null check (role in ('Owner','Manager','Teller','Finance','Auditor')),
  active       boolean not null default true,
  added_by     uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (book_id, email)
);
create index if not exists dc_members_user_idx on public.dc_members (user_id);
-- display names are what the ledger records as "by"; they must be unique within a book
create unique index if not exists dc_members_name_uq on public.dc_members (book_id, lower(display_name));

create table if not exists public.dc_state (
  book_id      text primary key references public.dc_books(id) on delete cascade,
  rev          integer not null default 0,
  meta         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  updated_name text not null default ''
);

create table if not exists public.dc_days (
  book_id     text not null references public.dc_books(id) on delete cascade,
  date        date not null,
  status      text not null,
  day         jsonb not null,
  audit       jsonb not null default '[]'::jsonb,
  rev         integer not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  primary key (book_id, date),
  check (jsonb_typeof(audit) = 'array'),
  check (pg_column_size(day) + pg_column_size(audit) < 2000000)
);

create table if not exists public.dc_saves (
  id        bigserial primary key,
  book_id   text not null references public.dc_books(id) on delete cascade,
  rev       integer not null,
  user_id   uuid,
  email     text,
  name      text,
  role      text,
  note      text,
  at        timestamptz not null default now()
);
create index if not exists dc_saves_book_idx on public.dc_saves (book_id, id desc);

alter table public.dc_books   enable row level security;
alter table public.dc_members enable row level security;
alter table public.dc_state   enable row level security;
alter table public.dc_days    enable row level security;
alter table public.dc_saves   enable row level security;
revoke all on public.dc_books, public.dc_members, public.dc_state, public.dc_days, public.dc_saves from anon, authenticated;
grant select on public.dc_books, public.dc_members, public.dc_state, public.dc_days, public.dc_saves to authenticated;

-- ---------- helpers ----------
-- The caller's active membership in a book (null when none).
create or replace function public.dc_member(p_book text)
returns public.dc_members
language sql stable security definer set search_path = public, pg_temp as $$
  select m.* from public.dc_members m
   where m.book_id = p_book and m.user_id = auth.uid() and m.active
   limit 1
$$;
create or replace function public.dc_role(p_book text)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select (public.dc_member(p_book)).role
$$;
revoke all on function public.dc_member(text), public.dc_role(text) from public, anon;
grant execute on function public.dc_member(text), public.dc_role(text) to authenticated;

-- PrimeBook session guard (supabase/session-guard.sql), when installed, also applies to these functions
create or replace function public.dc_guard()
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare ok boolean;
begin
  if to_regprocedure('public.pb_session_ok()') is not null then
    execute 'select public.pb_session_ok()' into ok;
    if ok is false then raise exception 'PB_SESSION_EXPIRED: sign in again' using errcode = 'PT401'; end if;
  end if;
end $$;
revoke all on function public.dc_guard() from public, anon;
grant execute on function public.dc_guard() to authenticated;

-- ---------- read access: active members only ----------
drop policy if exists dc_books_read   on public.dc_books;
drop policy if exists dc_members_read on public.dc_members;
drop policy if exists dc_state_read   on public.dc_state;
drop policy if exists dc_days_read    on public.dc_days;
drop policy if exists dc_saves_read   on public.dc_saves;
create policy dc_books_read   on public.dc_books   for select to authenticated using (public.dc_role(id) is not null);
create policy dc_members_read on public.dc_members for select to authenticated using (public.dc_role(book_id) is not null);
create policy dc_state_read   on public.dc_state   for select to authenticated using (public.dc_role(book_id) is not null);
create policy dc_days_read    on public.dc_days    for select to authenticated using (public.dc_role(book_id) is not null);
create policy dc_saves_read   on public.dc_saves   for select to authenticated using (public.dc_role(book_id) is not null);

-- ---------- link my confirmed email to the books I was added to ----------
create or replace function public.dc_claim()
returns integer
language plpgsql volatile security definer set search_path = public, auth, pg_temp as $$
declare v_email text; v_ok boolean; n integer;
begin
  perform public.dc_guard();
  if auth.uid() is null then raise exception 'DC_SIGNED_OUT' using errcode = 'PT401'; end if;
  select lower(u.email), (u.email_confirmed_at is not null) into v_email, v_ok from auth.users u where u.id = auth.uid();
  if v_email is null or not coalesce(v_ok, false) then return 0; end if;
  update public.dc_members set user_id = auth.uid(), updated_at = now()
   where email = v_email and (user_id is null or user_id = auth.uid());
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- my books ----------
create or replace function public.dc_my_books()
returns table(book_id text, name text, base text, role text, display_name text)
language sql stable security definer set search_path = public, pg_temp as $$
  select b.id, b.name, b.base, m.role, m.display_name
    from public.dc_members m join public.dc_books b on b.id = m.book_id
   where m.user_id = auth.uid() and m.active
   order by b.name
$$;

-- ---------- create a book (the creator becomes its Owner) ----------
create or replace function public.dc_create_book(p_id text, p_name text, p_display text)
returns text
language plpgsql volatile security definer set search_path = public, auth, pg_temp as $$
declare v_email text; v_ok boolean;
begin
  perform public.dc_guard();
  if auth.uid() is null then raise exception 'DC_SIGNED_OUT' using errcode = 'PT401'; end if;
  select lower(u.email), (u.email_confirmed_at is not null) into v_email, v_ok from auth.users u where u.id = auth.uid();
  if not coalesce(v_ok, false) then raise exception 'DC_EMAIL_NOT_CONFIRMED: confirm your email address first'; end if;
  if (select count(*) from public.dc_books where owner_id = auth.uid()) >= 20 then raise exception 'DC_LIMIT: at most 20 books per owner'; end if;
  if p_id !~ '^[a-z0-9][a-z0-9-]{1,39}$' then raise exception 'DC_BAD_ID: use 2-40 lowercase letters, digits or dashes'; end if;
  if exists (select 1 from public.dc_books where id = p_id) then raise exception 'DC_TAKEN: that book code is already used'; end if;
  insert into public.dc_books(id, name, owner_id) values (p_id, left(trim(p_name), 80), auth.uid());
  insert into public.dc_members(book_id, email, user_id, display_name, role, added_by)
       values (p_id, v_email, auth.uid(), left(trim(coalesce(nullif(p_display, ''), v_email)), 60), 'Owner', auth.uid());
  insert into public.dc_state(book_id, rev, meta, updated_by) values (p_id, 0, '{}'::jsonb, auth.uid());
  insert into public.dc_saves(book_id, rev, user_id, email, name, role, note) values (p_id, 0, auth.uid(), v_email, p_display, 'Owner', 'Book created');
  return p_id;
end $$;

-- ---------- team: add, change or deactivate a member (Owner only) ----------
create or replace function public.dc_member_set(p_book text, p_email text, p_name text, p_role text, p_active boolean)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare me public.dc_members; v_email text := lower(trim(p_email)); owners integer;
begin
  perform public.dc_guard();
  me := public.dc_member(p_book);
  if me.role is distinct from 'Owner' then raise exception 'DC_FORBIDDEN: only the book owner manages the team'; end if;
  if p_role not in ('Owner','Manager','Teller','Finance','Auditor') then raise exception 'DC_BAD_ROLE'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'DC_BAD_EMAIL: enter a valid email address'; end if;
  if length(trim(coalesce(p_name, ''))) < 1 then raise exception 'DC_BAD_NAME: enter the person''s name'; end if;
  select count(*) into owners from public.dc_members where book_id = p_book and role = 'Owner' and active and email <> v_email;
  if owners = 0 and (p_role <> 'Owner' or not p_active) then raise exception 'DC_LAST_OWNER: a book must keep at least one active owner'; end if;
  insert into public.dc_members(book_id, email, display_name, role, active, added_by)
       values (p_book, v_email, left(trim(p_name), 60), p_role, coalesce(p_active, true), auth.uid())
  on conflict (book_id, email) do update
     set display_name = excluded.display_name, role = excluded.role, active = excluded.active, updated_at = now();
  -- link at once if that person already has a confirmed account
  update public.dc_members m set user_id = u.id
    from auth.users u
   where m.book_id = p_book and m.email = v_email and m.user_id is null
     and lower(u.email) = v_email and u.email_confirmed_at is not null;
  insert into public.dc_saves(book_id, rev, user_id, email, name, role, note)
       select p_book, s.rev, auth.uid(), me.email, me.display_name, me.role,
              'Team: ' || v_email || ' as ' || p_role || case when p_active then '' else ' (inactive)' end
         from public.dc_state s where s.book_id = p_book;
end $$;

-- ---------- save: atomic, revision-checked, history-preserving ----------
create or replace function public.dc_save(p_book text, p_base_rev integer, p_meta jsonb, p_days jsonb, p_note text default '')
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  me public.dc_members;
  cur integer;
  d jsonb;
  old public.dc_days;
  v_date date;
  v_day jsonb; v_audit jsonb; v_status text; old_status text;
  n_old integer;
  found_old boolean;
begin
  perform public.dc_guard();
  me := public.dc_member(p_book);
  if me.role is null then raise exception 'DC_FORBIDDEN: you are not a member of this book'; end if;
  if me.role = 'Auditor' then raise exception 'DC_FORBIDDEN: auditors have read-only access'; end if;
  if jsonb_typeof(p_days) <> 'array' or jsonb_typeof(p_meta) <> 'object' then raise exception 'DC_BAD_REQUEST'; end if;

  select rev into cur from public.dc_state where book_id = p_book for update;
  if cur is null then raise exception 'DC_NOT_FOUND'; end if;
  if cur <> p_base_rev then raise exception 'DC_CONFLICT: someone else saved first (revision %)', cur; end if;

  for d in select * from jsonb_array_elements(p_days) loop
    v_date := (d->>'date')::date;
    v_day := d->'day'; v_audit := coalesce(d->'audit', '[]'::jsonb);
    v_status := coalesce(v_day->>'status', '');
    if v_day is null or jsonb_typeof(v_day) <> 'object' or jsonb_typeof(v_audit) <> 'array' then raise exception 'DC_BAD_REQUEST'; end if;
    if v_day->>'date' is distinct from d->>'date' then raise exception 'DC_BAD_REQUEST: day date mismatch'; end if;
    select * into old from public.dc_days where book_id = p_book and date = v_date;
    found_old := found;
    old_status := coalesce(old.status, 'Not opened');
    n_old := 0;
    if found_old then
      -- audit trail is append-only
      n_old := jsonb_array_length(old.audit);
      if jsonb_array_length(v_audit) < n_old
         or (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from jsonb_array_elements(v_audit) with ordinality t(e, i) where i <= n_old) <> old.audit then
        raise exception 'DC_AUDIT: the audit trail of % cannot be changed, only added to', v_date;
      end if;
    end if;
    -- every new audit entry must carry the account of the person saving it
    if exists (select 1 from jsonb_array_elements(v_audit) with ordinality t(e, i)
                where i > coalesce(n_old, 0) and (e->>'acct') is distinct from auth.uid()::text) then
      raise exception 'DC_AUDIT: new audit entries must be recorded under your own account';
    end if;
    if found_old then
      -- a locked day never changes (except the one-time "next day generated" marker)
      if old.status = 'Locked' and ((v_day - 'next') <> (old.day - 'next')
         or (coalesce(old.day->'next', 'null'::jsonb) <> 'null'::jsonb and v_day->'next' is distinct from old.day->'next')) then
        raise exception 'DC_LOCKED: % is locked and cannot be changed', v_date;
      end if;
    end if;
    -- approving and locking need a different, senior person
    if v_status in ('Approved','Locked') and old_status not in ('Approved','Locked') then
      if me.role not in ('Owner','Manager','Finance') then raise exception 'DC_FORBIDDEN: only a Manager, Finance or Owner can approve a day'; end if;
      if v_day->'approved'->>'by' is distinct from me.display_name then raise exception 'DC_FORBIDDEN: the approval must be recorded under your own name'; end if;
      if v_day->'approved'->>'by' = v_day->'submitted'->>'by' or v_day->'approved'->>'by' = v_day->'opened'->>'by' then
        raise exception 'DC_SOD: the person who prepared or submitted the day cannot approve it';
      end if;
    end if;
    if v_status = 'Locked' and old_status <> 'Locked' and me.role not in ('Owner','Manager','Finance') then
      raise exception 'DC_FORBIDDEN: only a Manager, Finance or Owner can lock a day';
    end if;
    insert into public.dc_days(book_id, date, status, day, audit, rev, updated_by)
         values (p_book, v_date, v_status, v_day, v_audit, cur + 1, auth.uid())
    on conflict (book_id, date) do update
       set status = excluded.status, day = excluded.day, audit = excluded.audit, rev = excluded.rev,
           updated_at = now(), updated_by = excluded.updated_by;
  end loop;

  -- no business day may disappear from the book
  if exists (select 1 from public.dc_days x where x.book_id = p_book
              and not (coalesce(p_meta->'dates', '[]'::jsonb) ? to_char(x.date, 'YYYY-MM-DD'))) then
    raise exception 'DC_BAD_REQUEST: a saved business day is missing from the book';
  end if;

  update public.dc_state set rev = cur + 1, meta = p_meta, updated_at = now(), updated_by = auth.uid(), updated_name = me.display_name
   where book_id = p_book;
  insert into public.dc_saves(book_id, rev, user_id, email, name, role, note)
       values (p_book, cur + 1, auth.uid(), me.email, me.display_name, me.role, left(coalesce(p_note, ''), 200));
  return cur + 1;
end $$;

-- ---------- start over (Owner only, and only while no day is locked) ----------
create or replace function public.dc_reset(p_book text)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare me public.dc_members; cur integer;
begin
  perform public.dc_guard();
  me := public.dc_member(p_book);
  if me.role is distinct from 'Owner' then raise exception 'DC_FORBIDDEN: only the book owner can start over'; end if;
  if exists (select 1 from public.dc_days where book_id = p_book and status = 'Locked') then
    raise exception 'DC_LOCKED: a book with locked days cannot be erased. Create a separate book for training.';
  end if;
  select rev into cur from public.dc_state where book_id = p_book for update;
  delete from public.dc_days where book_id = p_book;
  update public.dc_state set rev = cur + 1, meta = '{}'::jsonb, updated_at = now(), updated_by = auth.uid(), updated_name = me.display_name where book_id = p_book;
  insert into public.dc_saves(book_id, rev, user_id, email, name, role, note) values (p_book, cur + 1, auth.uid(), me.email, me.display_name, me.role, 'Book erased to start over');
  return cur + 1;
end $$;

revoke all on function public.dc_claim(), public.dc_my_books(), public.dc_create_book(text, text, text),
  public.dc_member_set(text, text, text, text, boolean), public.dc_save(text, integer, jsonb, jsonb, text), public.dc_reset(text) from public, anon;
grant execute on function public.dc_claim(), public.dc_my_books(), public.dc_create_book(text, text, text),
  public.dc_member_set(text, text, text, text, boolean), public.dc_save(text, integer, jsonb, jsonb, text), public.dc_reset(text) to authenticated;

-- ---------- session guard (only if supabase/session-guard.sql is installed) ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'pb_session_ok') then
    foreach t in array array['dc_books','dc_members','dc_state','dc_days','dc_saves'] loop
      execute format('drop policy if exists pb_session_guard on public.%I', t);
      execute format('create policy pb_session_guard on public.%I as restrictive for all to authenticated using (public.pb_session_ok()) with check (public.pb_session_ok())', t);
    end loop;
  end if;
end $$;

-- ---------- ROLLBACK (removes the closing tables and everything in them) ----------
-- drop function if exists public.dc_reset(text), public.dc_save(text, integer, jsonb, jsonb, text),
--   public.dc_member_set(text, text, text, text, boolean), public.dc_create_book(text, text, text),
--   public.dc_my_books(), public.dc_claim(), public.dc_role(text), public.dc_member(text);
-- drop table if exists public.dc_saves, public.dc_days, public.dc_state, public.dc_members, public.dc_books;
