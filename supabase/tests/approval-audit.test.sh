#!/bin/bash
# Tests supabase/approval-workflow.sql on a throwaway local Postgres 16 (needs the postgres OS user). Run as root.
D=/tmp/pgdata; rm -rf $D; mkdir -p $D; chown postgres $D
runuser -u postgres -- /usr/lib/postgresql/16/bin/initdb -D $D -A trust >/dev/null
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D $D -o "-p 54329 -k /tmp" -l /tmp/pg.log start >/dev/null
sleep 2
P="psql -h /tmp -p 54329 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create schema if not exists auth; create or replace function auth.uid() returns uuid language sql as \$\$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid \$\$; create role anon nologin; create role authenticated nologin; grant usage on schema public,auth to authenticated; grant execute on function auth.uid() to authenticated;"
$P -f /home/claude/primebook/supabase/approval-workflow.sql
$P -f /home/claude/primebook/supabase/approval-workflow.sql   # idempotent
echo INSTALLED
cat > /tmp/pgtest2.sh <<"EOT"
P="psql -h /tmp -p 54329 -U postgres -q -t -A"
U1=11111111-1111-1111-1111-111111111111; U2=22222222-2222-2222-2222-222222222222
run(){ $P -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" 2>&1 | tail -1; }
echo "1 first event ok:      $(run $U1 "insert into pb_apw_audit(n,actor,role,act,rid,ver,note,prev_hash,hash,body) values(1,'Cara','Cashier','Submitted','APR-1',1,'x','0','h1','{}'); select 'ok'")"
echo "2 chain continues:     $(run $U1 "insert into pb_apw_audit(n,actor,act,prev_hash,hash) values(2,'Mo','Approved','h1','h2'); select 'ok'")"
echo "3 gap refused:         $(run $U1 "insert into pb_apw_audit(n,actor,act,prev_hash,hash) values(5,'Mo','x','h2','h5'); select 'ok'")"
echo "4 fork refused:        $(run $U1 "insert into pb_apw_audit(n,actor,act,prev_hash,hash) values(3,'Mo','x','WRONG','h3'); select 'ok'")"
echo "5 update refused:      $(run $U1 "update pb_apw_audit set note='edited' where n=1; select 'ok'")"
echo "6 delete refused:      $(run $U1 "delete from pb_apw_audit where n=1; select 'ok'")"
echo "7 truncate refused:    $(run $U1 "truncate pb_apw_audit; select 'ok'")"
echo "8 other user isolated: $(run $U2 "select count(*) from pb_apw_audit")  (expect 0)"
echo "9 other user can't forge for U1: $(run $U2 "insert into pb_apw_audit(user_id,n,actor,act,prev_hash,hash) values('$U1',3,'x','x','h2','h3'); select 'ok'")"
echo "10 own rows visible:   $(run $U1 "select count(*) from pb_apw_audit") (expect 2)"
echo "11 server stamp:       $(run $U1 "select length(server_hash) from pb_apw_audit where n=2")  (expect 64)"
echo "12 owner (postgres) update still refused: $($P -c "update pb_apw_audit set note='x'" 2>&1 | tail -1)"
echo "13 row count unchanged: $($P -c "select count(*) from pb_apw_audit")"
EOT
bash /tmp/pgtest2.sh
runuser -u postgres -- /usr/lib/postgresql/16/bin/pg_ctl -D $D stop >/dev/null
