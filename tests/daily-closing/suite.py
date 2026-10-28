"""End-to-end test: Daily Closing System on PrimeBook (sample day Vancouver 2026-10-27)."""
import json,os
from boot import *
R=[]
def ok(name,cond,detail=''):
    R.append((bool(cond),name,detail));print(('PASS ' if cond else 'FAIL ')+name+(('  -> '+str(detail)[:400]) if not cond else ''))
D='2026-10-27'
JS="""window.QA={
 as(i){S.me=i;go()},
 toasts:[],
 rd(b,d){return cpcReady(b||'b1',d||'%s').items.reduce((o,i)=>(o[i.id]=i.ok,o),{})},
 tb(){let d=0,c=0,by={};S.j.forEach(x=>x.lines.forEach(y=>{d+=+y[1]||0;c+=+y[2]||0;by[y[0]]=Math.round(((by[y[0]]||0)+(+y[1]||0)-(+y[2]||0))*100)/100}));return{d:Math.round(d*100)/100,c:Math.round(c*100)/100,by}},
 last(){const x=S.j[S.j.length-1];return{id:x.id,vno:x.vno,lines:x.lines,date:x.date,br:x.br,mk:x.mk,appr:x.appr}},
};
window.rpToast=(m,b)=>{QA.toasts.push((b?'ERR ':'OK ')+m)};"""%D
def boot(p,**kw):
    b,pg,errs=open_app(p,**kw);pg.evaluate(JS)
    pg.evaluate("(d)=>{window.__dxt='clo';window.__cpd=d;window.__cpb='b1';window.__cpv='recon';go()}",D);pg.wait_for_timeout(300);return b,pg,errs
def toast(pg): return pg.evaluate("()=>QA.toasts[QA.toasts.length-1]||''")
def click(pg,sel):
    for _ in range(3):
        n=pg.evaluate("()=>QA.toasts.length")
        try: pg.click(sel,timeout=5000)
        except Exception: pg.wait_for_timeout(300);continue
        for _ in range(20):
            if pg.evaluate("()=>QA.toasts.length")>n: pg.wait_for_timeout(120);return
            pg.wait_for_timeout(100)
    raise AssertionError('no response to '+sel)
def tab(pg,v): pg.evaluate("(v)=>{window.__cpv=v;go()}",v);pg.wait_for_timeout(150)

with sync_playwright() as p:
    b,pg,errs=boot(p)
    E=pg.evaluate
    # ---------- setup and policy ----------
    rd=E("()=>QA.rd()")
    ok('New readiness checks appear: opening, bank, stock, adjustments, rates',all(k in rd for k in ['dcsopn','dcsbnk','dcsfx','dcsadj','dcsrt']),rd)
    ok('Opening balances agree (no earlier lock)',rd['dcsopn'])
    ok('Bank and stock checks start as blockers',rd['dcsbnk']==False and rd['dcsfx']==False)
    E("()=>QA.as(1)")  # Farhan, Cashier
    ok('Cashier cannot add a settlement agent (no form shown)',not pg.query_selector('#dcsagn'))
    E("()=>dcsCfg('reqBank',0)");ok('Cashier cannot change closing requirements','owner' in toast(pg).lower() and E("()=>S.dcs.cfg.reqBank")==1)
    E("()=>QA.as(0)")  # ZAHID owner
    pg.fill('#dcsagn','Taaj System');pg.fill('#dcsagc','1000');click(pg,'text=Add settlement agent')
    ok('Agent cannot use a cash account',E("()=>S.dcs.agents.length")==0 and 'cash' in toast(pg).lower(),toast(pg))
    pg.fill('#dcsagc','1250');click(pg,'text=Add settlement agent')
    ok('Owner adds Taaj System on 1250 Due from Taaj System',E("()=>S.dcs.agents.length")==1 and E("()=>S.dcs.agents[0].code")=='1250')
    ok('Taaj check now required',E("()=>QA.rd().dcsag")==False and E("()=>QA.rd().dcsinc")==True)
    # misuse: receipt from Taaj credited to income
    E("()=>{S.j.push({id:999,date:'%s',br:'b1',acc:'cash|b1',tt:'Deposit',party:'Taaj System',memo:'Cash from Taaj',by:'Farhan',at:new Date().toISOString(),lines:[['1000',100,0],['4100',0,100]]})}"%D)
    ok('A Taaj receipt booked to income blocks the close',E("()=>QA.rd().dcsinc")==False)
    E("()=>{S.j=S.j.filter(x=>x.id!=999)}")
    ok('Commission on a Taaj payout (TX-002) is not flagged',E("()=>QA.rd().dcsinc")==True)

    # ---------- bank reconciliation (Farhan) ----------
    E("()=>QA.as(1)");tab(pg,'recon')
    pg.fill('#dcsbk0b','18200');pg.fill('#dcsbk0r','RBC statement 27-Oct-2026');click(pg,'text=Save bank reconciliation')
    ok('Bank difference without a reason is refused','reason' in toast(pg).lower() and not E("()=>S.dcs.bstm['bank|k1|%s']"%D),toast(pg))
    pg.fill('#dcsbk0b','18300');pg.fill('#dcsbk0i','CHQ 1042; Cheque to landlord, not yet cleared; -50.00');click(pg,'text=Save bank reconciliation')
    ok('Bank reconciled: 18,300.00 − 50.00 = books 18,250.00',E("()=>QA.rd().dcsbnk")==True,toast(pg))

    # ---------- currency stock count ----------
    for c,q in [('USD','2600'),('AED','5000'),('ETB','119500'),('KES','250000')]: pg.fill(f'#dcsfx_{c}_q',q)
    pg.fill('#dcsfxw','Farhan');click(pg,'text=Save currency count')
    ok('ETB short without reason is refused','ETB' in toast(pg),toast(pg))
    pg.fill('#dcsfx_ETB_r','Recount confirmed ETB 500 short; likely overpaid on a sale');pg.fill('#dcsfx_ETB_f','INC-1027')
    click(pg,'text=Save currency count')
    ok('Witness must be a different person','witness' in toast(pg).lower(),toast(pg))
    pg.fill('#dcsfxw','Amina');click(pg,'text=Save currency count')
    st=E("()=>Object.fromEntries(['USD','AED','ETB','KES'].map(c=>{const r=document.evaluate;return[c,null]}))")
    fx=E("()=>Object.fromEntries((window.__x=1,[...document.querySelectorAll('.dcs-t tbody tr')]).filter(t=>t.children.length==9&&/^(USD|AED|ETB|KES)$/.test(t.children[0].textContent.trim())).map(t=>[t.children[0].textContent.trim(),t.children[t.children.length-1].textContent.trim()]))")
    ok('USD, AED, KES balanced; ETB needs an adjustment',fx.get('USD','').startswith('Balanced') and fx.get('KES','').startswith('Balanced') and 'Explained' in fx.get('ETB',''),fx)
    ok('Stock check still blocks while ETB is unadjusted',E("()=>QA.rd().dcsfx")==False)
    click(pg,'text=Request adjustment')
    adj=E("()=>S.dcs.adj[0]")
    ok('Adjustment raised at average cost: ETB −500 × 0.0096 = CAD 4.80',adj['st']=='Pending approval' and adj['qty']==-500 and adj['cad']==4.8,adj)
    ok('Pending adjustment blocks the close',E("()=>QA.rd().dcsadj")==False)
    E("(id)=>dcsAdjDo(id,1)",adj['id'])
    ok('Cashier cannot approve the adjustment',E("()=>S.dcs.adj[0].st")=='Pending approval' and 'manager' in toast(pg).lower(),toast(pg))
    E("()=>QA.as(2)")  # Amina manager
    n0=E("()=>S.j.length")
    click(pg,'text=Approve and post')
    j=E("()=>QA.last()")
    ok('Manager approves: Dr 6500 / Cr 1100 CAD 4.80, maker and approver recorded',E("()=>S.j.length")==n0+1 and j['lines']==[['6500',4.8,0],['1100',0,4.8]] and j['mk']=='Farhan' and j['appr']['by']=='Amina',j)
    ok('ETB stock now 119,500 and status Adjusted',E("()=>S.pos['b1|ETB'].q")==119500 and E("()=>QA.rd().dcsfx")==True)
    ok('Ledger 1100 still agrees with currency stock',E("()=>chkAll().find(c=>/Currency stock/.test(c[0]))[1]"))

    # ---------- Taaj settlement ----------
    E("()=>QA.as(1)");tab(pg,'recon')
    gid=E("()=>S.dcs.agents[0].id")
    pg.fill(f'#dcsag_{gid}_b','2500');pg.fill(f'#dcsag_{gid}_r','TJ-STMT-20261027');click(pg,'text=Save settlement reconciliation')
    ok('Taaj difference without reason refused','reason' in toast(pg).lower())
    pg.fill(f'#dcsag_{gid}_b','2535');click(pg,'text=Save settlement reconciliation')
    ok('Taaj matched: books 3,200 + 835 − 1,500 = 2,535.00',E("()=>QA.rd().dcsag")==True,E("()=>S.dcs.agst"))

    # ---------- closing rates ----------
    E("()=>QA.as(3)")  # Daniel accountant
    for c,r in [('USD','1.38'),('AED','0.375'),('ETB','0.0098'),('KES','0.0104')]:
        pg.fill(f'#dcsrt_{c}_r',r);pg.fill(f'#dcsrt_{c}_s','Treasury closing rates CR-20261027');pg.click(f'button[onclick="dcsRateSave(\'{D}\',\'{c}\',\'b1\')"]');pg.wait_for_timeout(80)
    ok('Accountant enters four rates with source (pending)',E("(d)=>Object.values(S.dcs.rates[d]).every(x=>x.st=='Pending approval'&&x.src)",D) and len(E("(d)=>Object.keys(S.dcs.rates[d])",D))==4)
    E("(d)=>dcsRateAp(d,'USD')",D);ok('Accountant cannot approve rates',E("(d)=>S.dcs.rates[d].USD.st",D)=='Pending approval')
    E("()=>QA.as(2)")
    for c in ['USD','AED','ETB','KES']: E("([d,c])=>dcsRateAp(d,c)",[D,c])
    ok('Manager approves rates; rate check passes',E("()=>QA.rd().dcsrt")==True)

    # ---------- cash count (closing wizard result) and lock gate ----------
    E("""(d)=>{S.closings.push({acc:'cash|b1',br:'b1',date:d,accLabel:'Cash on Hand – Vancouver',rows:[{ccy:'CAD',open:1514,i:2058,o:2172,exp:1400,counted:1400,variance:0,reason:''}],by:'Farhan',at:'2026-10-27 17:05',apprBy:'Amina',apprAt:'2026-10-27 17:20',base:0,je:[]});save();go()}""",D)
    ok('Day is Closed once every account closing is approved',E("(d)=>cpcState('b1',d)",D)=='CLOSED')
    # temporarily undo bank rec to prove lock refuses blockers
    bk=E("(d)=>{const x=S.dcs.bstm['bank|k1|'+d];delete S.dcs.bstm['bank|k1|'+d];return x}",D)
    E("(d)=>cpcLock('b1',d)",D)
    ok('Lock refused while a blocker remains',not E("(d)=>!!(S.cpd['b1|'+d]||{}).lock",D) and 'blocker' in toast(pg).lower(),toast(pg))
    E("([d,x])=>{S.dcs.bstm['bank|k1|'+d]=x}",[D,bk])
    rd=E("()=>QA.rd()")
    ok('All readiness checks pass',all(rd.values()),{k:v for k,v in rd.items() if not v})
    E("()=>QA.as(1)");E("(d)=>cpcLock('b1',d)",D)
    ok('Cashier cannot lock',not E("(d)=>!!(S.cpd['b1|'+d]||{}).lock",D))
    E("()=>QA.as(2)");E("(d)=>cpcLock('b1',d)",D)
    lk=E("(d)=>{const l=S.cpd['b1|'+d].lock;return{by:l.by,hash:l.hash,dcs:!!(l.snap.dcs&&l.snap.dcs.close),err:l.snap.dcs&&l.snap.dcs.err}}",D)
    ok('Manager locks; snapshot contains the closing data',lk['by']=='Amina' and lk['dcs'],lk)

    # ---------- locked-day guard ----------
    n0=E("()=>S.j.length")
    m=E("(d)=>{try{post({date:d,br:'b1',acc:'cash|b1',tt:'Expense',memo:'late',lines:[['6100',5,0],['1000',0,5]]});return'posted'}catch(e){return e.message}}",D)
    ok('Posting to the locked day is refused',E("()=>S.j.length")==n0 and 'locked' in m,m)
    m=E("()=>{try{post({date:'2026-10-27',br:'b2',acc:'cash|b2',tt:'Opening',memo:'other branch',lines:[['1000',5,0],['3000',0,5]]});return'posted'}catch(e){return e.message}}")
    ok('Other branches can still post on that date',m=='posted',m)
    E("()=>{S.j.pop()}")
    E("()=>QA.as(1)");tab(pg,'recon')
    ok('Locked day: reconciliation forms are read-only',not pg.query_selector('#dcsbk0b') and not pg.query_selector('#dcsfx_USD_q'))

    # ---------- reports ----------
    tab(pg,'reports')
    secs=E("()=>[...document.querySelectorAll('.dcs-rep')].map(e=>e.id)")
    ok('14 closing reports render',len(secs)==14,secs)
    ok('Reports say they come from the locked snapshot',E("()=>document.querySelector('.dcs-hd').textContent.includes('locked snapshot')"))
    tbt=E("()=>document.querySelector('#dr3 tfoot').textContent")
    ok('Trial balance balanced',('Balanced' in tbt),tbt)
    ie=E("(d)=>window.dcsSnap('b1',d).ie",D)
    ok('Day result CAD 23.53 (35.00 + 15.33 − 22.00 − 4.80)',ie['net']==23.53 and ie['ti']==50.33 and ie['te']==26.8,ie)
    reg=E("()=>[...document.querySelectorAll('#dr2 tbody tr')].map(t=>t.children[0].textContent)")
    op=E("(d)=>S.cpd['b1|'+d].lock.snap.dcs.open.rows.filter(r=>r.code=='1100').map(r=>[r.ccy,r.cad])",D)
    ok('27-Oct opening shows currency stock at cost 8,357.00, not today\'s quantities',op==[['CAD',8357]],op)
    E("()=>{window.__cpd='2026-10-28';go()}")
    o28=E("()=>window.dcsSnap('b1','2026-10-28').open.rows.filter(r=>r.code=='1100').map(r=>[r.ccy,r.fc])")
    ok('28-Oct opening splits stock by currency from the locked close',sorted(o28)==[['AED',5000],['ETB',119500],['KES',250000],['USD',2600]],o28)
    E("(d)=>{window.__cpd=d;go()}",D)
    ok('Register lists TX-001..TX-005 and the adjustment',len(reg)==6 and 'TX-004' in reg,reg)
    ok('Journal trace: every entry balanced',E("()=>[...document.querySelectorAll('#dr14 .dcs-je')].every(j=>j.textContent.includes('Balanced'))") and E("()=>document.querySelectorAll('#dr14 .dcs-je').length")==6)
    fx=E("(d)=>window.dcsSnap('b1',d).fx.map(f=>[f.ccy,f.q,f.book,f.val,f.unr,f.rate.kind])",D)
    usd=[f for f in fx if f[0]=='USD'][0]
    ok('USD 2,600 book 3,527.33 at 1.3800 = 3,588.00, unrealized 60.67 (approved daily rate)',abs(usd[2]-3527.33)<.02 and usd[3]==3588 and abs(usd[4]-60.67)<.02 and usd[5]=='Daily closing rate',fx)
    ok('No cross-currency total of foreign amounts',E("()=>!/Total/.test([...document.querySelectorAll('#dr7 tfoot td')].slice(1,3).map(t=>t.textContent).join(''))"))
    nx=E("(d)=>{const s=S.cpd['b1|'+d].lock.snap.dcs.close;let dr=0,cr=0;s.rows.forEach(r=>{if(r.cad>0)dr+=r.cad;else cr-=r.cad});if(s.earn<0)dr-=s.earn;else cr+=s.earn;return{dr:Math.round(dr*100)/100,cr:Math.round(cr*100)/100,earn:s.earn,ie:s.rows.filter(r=>!['Assets','Liabilities','Equity'].includes(acType(r.code))).length}}",D)
    ok('Next-day opening: assets CAD 41,344.53 = liabilities + equity; income and expense at zero',nx['dr']==41344.53 and nx['cr']==41344.53 and nx['ie']==0,nx)
    sod=E("()=>[...document.querySelectorAll('#dr12 .dcs-ck li')].map(l=>l.className)")
    ok('Separation-of-duties checks pass',sod and all(c=='ok' for c in sod),sod)
    ok('Snapshot hash intact',E("(d)=>{const l=S.cpd['b1|'+d].lock;return apw.h53(JSON.stringify(l.snap))===l.hash}",D))
    csv=E("(d)=>dcsRegCsv('b1',d)",D)
    ok('Register CSV export has header and 6 rows',csv.count('\r\n')==6 and 'Debit accounts' in csv)
    pg.query_selector('.cpc').screenshot(path='after_reports.png')

    # ---------- next business day ----------
    E("()=>{window.__cpd='2026-10-28';go()}")
    ok('28-Oct opening agrees with the locked 27-Oct close',E("()=>QA.rd('b1','2026-10-28').dcsopn")==True)
    E("()=>{const x=S.j.find(z=>z.vno=='TX-005');x.lines=[['6100',30,0],['1000',0,30]]}")
    ok('A back-door change to the locked day is caught at the next opening',E("()=>QA.rd('b1','2026-10-28').dcsopn")==False)
    E("()=>{const x=S.j.find(z=>z.vno=='TX-005');x.lines=[['6100',22,0],['1000',0,22]]}")
    # ---------- integrity ----------
    tb=E("()=>QA.tb()")
    ok('Trial balance for the whole ledger balances',abs(tb['d']-tb['c'])<.005,tb)
    bad=E("()=>chkAll().filter(c=>!c[1]).map(c=>c[0])")
    ok('App integrity checks all pass',not bad,bad)
    E("()=>QA.as(4)")
    ok('Viewer has no access to the cash module',E("()=>lvl(me().role,'cash')")=='n')
    errs2=[e for e in errs if 'Failed to load' not in e and 'DIALOG' not in e]
    ok('No JavaScript errors',not errs2,errs2[:5])
    json.dump(E("()=>S"),open('state_after.json','w'))
    b.close()
f=[r for r in R if not r[0]];print(f"\n{len(R)-len(f)}/{len(R)} passed")
for r in f: print('FAILED:',r[1],str(r[2])[:300])
