import json, subprocess, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); SQL = os.path.join(ROOT, 'supabase', 'daily-closing.sql')
from pgq import q, admin, lit
subprocess.run('psql -h /var/tmp/dcpg -p 5499 -U postgres -q -f stub.sql >/dev/null 2>&1; psql -h /var/tmp/dcpg -p 5499 -U postgres -d dct -q -v ON_ERROR_STOP=1 -f '+SQL+' 2>&1 | grep -v NOTICE',shell=True,check=False)
U={k:'00000000-0000-0000-0000-00000000000'+k for k in 'abcdef'}
R=[]
def check(name, cond, info=''):
    R.append(cond); print(('PASS ' if cond else 'FAIL ')+name+('' if cond else '  -> '+str(info)))
def rpc(u, fn, **a):
    args=', '.join(f"{k} => {lit(v)}" + ('::jsonb' if isinstance(v,(dict,list)) else '') for k,v in a.items())
    return q(U[u] if u else None, f"select to_jsonb(x) from public.{fn}({args}) x;")
def sel(u, sql): return q(U[u], sql)

ok,o=rpc('f','dc_create_book',p_id='van',p_name='Vancouver',p_display='F'); check('unconfirmed email cannot create a book', not ok and 'CONFIRMED' in o, o)
ok,o=rpc(None,'dc_my_books'); check('anonymous cannot call functions', not ok, o)
ok,o=rpc('a','dc_create_book',p_id='van',p_name='Vancouver',p_display='Asha'); check('owner creates book', ok, o)
ok,o=rpc('e','dc_create_book',p_id='van',p_name='X',p_display='E'); check('duplicate book code refused', not ok and 'TAKEN' in o, o)
ok,o=rpc('a','dc_create_book',p_id='Bad Id',p_name='X',p_display='E'); check('bad book code refused', not ok and 'BAD_ID' in o, o)
for em,nm,rl in [('TELLER@x.com','Farhan','Teller'),('mgr@x.com','Amina','Manager'),('aud@x.com','Sara','Auditor'),('unconf@x.com','Una','Teller')]:
    ok,o=rpc('a','dc_member_set',p_book='van',p_email=em,p_name=nm,p_role=rl,p_active=True); check('owner adds '+nm, ok, o)
ok,o=rpc('b','dc_member_set',p_book='van',p_email='e@x.com',p_name='Eve',p_role='Owner',p_active=True); check('teller cannot add members', not ok and 'FORBIDDEN' in o, o)
ok,o=rpc('a','dc_member_set',p_book='van',p_email='owner@x.com',p_name='Asha',p_role='Manager',p_active=True); check('last owner cannot demote self', not ok and 'LAST_OWNER' in o, o)
ok,o=rpc('a','dc_member_set',p_book='van',p_email='z@x.com',p_name='farhan',p_role='Teller',p_active=True); check('duplicate display name refused', not ok, o)
ok,o=sel('b',"select json_agg(book_id) from dc_my_books();"); check('teller linked at once (confirmed account)', ok and 'van' in o, o)
ok,o=sel('f',"select count(*) from dc_members;"); check('unconfirmed user sees nothing', ok and o=='0', o)
ok,o=rpc('f','dc_claim'); check('unconfirmed email does not claim membership', ok and o=='0', o)
ok,o=sel('e',"select (select count(*) from dc_books)+(select count(*) from dc_members)+(select count(*) from dc_state)+(select count(*) from dc_saves);"); check('stranger reads nothing', ok and o=='0', o)
ok,o=sel('d',"select count(*) from dc_members;"); check('auditor reads the team', ok and o=='5', o)
ok,o=sel('b',"insert into dc_days(book_id,date,status,day,rev) values('van','2026-10-27','Open','{}',1);"); check('no direct table writes', not ok, o)
ok,o=sel('b',"update dc_state set rev=99;"); check('no direct state update', not ok, o)

def day(date, status='Open', **kw):
    d={'date':date,'status':status,'js':[],'opened':{'by':'Farhan'}}; d.update(kw); return d
def aud(n, acct, start=1, date='2026-10-27'): return [{'seq':i,'date':date,'action':'x','acct':acct} for i in range(start,start+n)]
def save(u, rev, days, dates=None, meta=None):
    m=meta or {'dates':dates or sorted({x['date'] for x in days})}
    return rpc(u,'dc_save',p_book='van',p_base_rev=rev,p_meta=m,p_days=days,p_note='t')

ok,o=save('b',0,[{'date':'2026-10-27','day':day('2026-10-27'),'audit':aud(2,U['b'])}]); check('teller saves day 1', ok and o=='1', o)
ok,o=save('b',0,[{'date':'2026-10-27','day':day('2026-10-27'),'audit':aud(2,U['b'])}]); check('stale revision refused (conflict)', not ok and 'CONFLICT' in o, o)
ok,o=save('d',1,[{'date':'2026-10-27','day':day('2026-10-27'),'audit':aud(2,U['b'])}]); check('auditor cannot save', not ok and 'auditors' in o, o)
ok,o=save('e',1,[{'date':'2026-10-27','day':day('2026-10-27'),'audit':aud(2,U['b'])}]); check('stranger cannot save', not ok and 'FORBIDDEN' in o, o)
ok,o=save('b',1,[{'date':'2026-10-27','day':day('2026-10-27'),'audit':aud(1,U['b'])}]); check('audit entries cannot be removed', not ok and 'DC_AUDIT' in o, o)
a=aud(2,U['b']); a[0]['action']='edited'
ok,o=save('b',1,[{'date':'2026-10-27','day':day('2026-10-27'),'audit':a}]); check('audit entries cannot be edited', not ok and 'DC_AUDIT' in o, o)
ok,o=save('b',1,[{'date':'2026-10-27','day':day('2026-10-27'),'audit':aud(2,U['b'])+aud(1,U['c'],3)}]); check('cannot write audit under another account', not ok and 'own account' in o, o)
ok,o=save('b',1,[{'date':'2026-10-27','day':day('2026-10-27','Submitted',submitted={'by':'Farhan'}),'audit':aud(3,U['b'])}]); check('teller submits', ok and o=='2', o)
ok,o=save('b',2,[{'date':'2026-10-27','day':day('2026-10-27','Approved',submitted={'by':'Farhan'},approved={'by':'Farhan'}),'audit':aud(4,U['b'])}]); check('teller cannot approve', not ok and 'FORBIDDEN' in o, o)
ok,o=save('c',2,[{'date':'2026-10-27','day':day('2026-10-27','Approved',submitted={'by':'Farhan'},approved={'by':'Farhan'}),'audit':aud(3,U['b'])+aud(1,U['c'],4)}]); check('manager cannot approve under another name', not ok and 'own name' in o, o)
ok,o=save('c',2,[{'date':'2026-10-27','day':day('2026-10-27','Approved',opened={'by':'Amina'},submitted={'by':'Farhan'},approved={'by':'Amina'}),'audit':aud(3,U['b'])+aud(1,U['c'],4)}]); check('preparer cannot approve (SoD)', not ok and 'SOD' in o, o)
ok,o=save('c',2,[{'date':'2026-10-27','day':day('2026-10-27','Approved',submitted={'by':'Farhan'},approved={'by':'Amina'}),'audit':aud(3,U['b'])+aud(1,U['c'],4)}]); check('manager approves', ok and o=='3', o)
L=day('2026-10-27','Locked',submitted={'by':'Farhan'},approved={'by':'Amina'},locked={'by':'Amina'},next=None)
ok,o=save('c',3,[{'date':'2026-10-27','day':L,'audit':aud(3,U['b'])+aud(2,U['c'],4)}]); check('manager locks', ok and o=='4', o)
L2=dict(L); L2['js']=[{'ref':'TX-099'}]
ok,o=save('b',4,[{'date':'2026-10-27','day':L2,'audit':aud(3,U['b'])+aud(2,U['c'],4)}]); check('locked day cannot change', not ok and 'LOCKED' in o, o)
L3=dict(L); L3['next']={'date':'2026-10-28','by':'Amina'}
ok,o=save('c',4,[{'date':'2026-10-27','day':L3,'audit':aud(3,U['b'])+aud(3,U['c'],4)},{'date':'2026-10-28','day':day('2026-10-28','Not opened',opened=None),'audit':[]}]); check('next-day marker added once and day 2 created', ok and o=='5', o)
L4=dict(L); L4['next']={'date':'2026-10-29','by':'Amina'}
ok,o=save('c',5,[{'date':'2026-10-27','day':L4,'audit':aud(3,U['b'])+aud(3,U['c'],4)}],dates=['2026-10-27','2026-10-28']); check('next-day marker cannot change later', not ok and 'LOCKED' in o, o)
ok,o=save('c',5,[{'date':'2026-10-27','day':L3,'audit':aud(3,U['b'])+aud(4,U['c'],4)}],dates=['2026-10-27','2026-10-28']); check('audit can still be appended to a locked day', ok, o)
ok,o=save('c',6,[],dates=['2026-10-27']); check('a saved day cannot be dropped from the book', not ok and 'missing' in o, o)
ok,o=rpc('a','dc_reset',p_book='van'); check('book with locked days cannot be erased', not ok and 'LOCKED' in o, o)
ok,o=sel('d',"select json_agg(json_build_object('d',date,'s',status) order by date) from dc_days;"); check('auditor reads days', ok and 'Locked' in o, o)
ok,o=sel('d',"select count(*) from dc_saves where book_id='van';"); check('save log written by server', ok and int(o)>=7, o)
ok,o=rpc('a','dc_member_set',p_book='van',p_email='teller@x.com',p_name='Farhan',p_role='Teller',p_active=False); check('owner deactivates teller', ok, o)
ok,o=sel('b',"select count(*) from dc_days;"); check('deactivated member loses read access', ok and o=='0', o)
ok,o=save('b',6,[],dates=['2026-10-27','2026-10-28']); check('deactivated member cannot save', not ok, o)
# second book isolation
ok,o=rpc('e','dc_create_book',p_id='sur',p_name='Surrey',p_display='Eve'); check('another owner creates own book', ok, o)
ok,o=sel('e',"select json_agg(distinct book_id) from dc_days;"); check('books are isolated', ok and o=='', o)
# reset allowed without locked days
ok,o=rpc('e','dc_reset',p_book='sur'); check('owner can erase a book with no locked days', ok, o)
# re-run idempotent
r=subprocess.run('psql -h /var/tmp/dcpg -p 5499 -U postgres -d dct -q -v ON_ERROR_STOP=1 -f '+SQL+'',shell=True,capture_output=True,text=True)
ok,o=sel('c',"select count(*) from dc_days where book_id='van';"); check('script re-run keeps data', r.returncode==0 and o=='2', (r.stderr[-300:],o))
print(f"\n{sum(R)}/{len(R)} passed"); sys.exit(0 if all(R) else 1)
