#!/bin/sh
cd "$(dirname "$0")"
psql -h /var/tmp/dcpg -p 5499 -U postgres -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='dct' and pid<>pg_backend_pid()" >/dev/null
psql -h /var/tmp/dcpg -p 5499 -U postgres -q -f stub.sql >/dev/null 2>&1
psql -h /var/tmp/dcpg -p 5499 -U postgres -d dct -q -c "delete from auth.users"
psql -h /var/tmp/dcpg -p 5499 -U postgres -d dct -q -v ON_ERROR_STOP=1 -f "$(cd "$(dirname "$0")/../.." && pwd)/supabase/daily-closing.sql" 2>&1 | grep -v NOTICE
true
