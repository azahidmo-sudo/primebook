drop database if exists dct; create database dct;
\c dct
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','owner@x.com',now()),
 ('00000000-0000-0000-0000-00000000000b','teller@x.com',now()),
 ('00000000-0000-0000-0000-00000000000c','mgr@x.com',now()),
 ('00000000-0000-0000-0000-00000000000d','aud@x.com',now()),
 ('00000000-0000-0000-0000-00000000000e','stranger@x.com',now()),
 ('00000000-0000-0000-0000-00000000000f','unconf@x.com',null);
