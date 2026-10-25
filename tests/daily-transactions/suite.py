"""End-to-end suite for the Daily transactions cash desk (DX3)."""
import json,base64,os
from boot import *
HERE=os.path.dirname(os.path.abspath(__file__))
R=[]
def ok(name,cond,detail=''):
    R.append((bool(cond),name,detail));print(('PASS ' if cond else 'FAIL ')+name+(('  -> '+str(detail)) if not cond and detail!='' else ''))
JS_HELP="""
window.QA={
 as(i){S.me=i;go()},
 tb(){let d=0,c=0;const by={};S.j.forEach(x=>x.lines.forEach(y=>{d+=+y[1]||0;c+=+y[2]||0;by[y[0]]=Math.round(((by[y[0]]||0)+(+y[1]||0)-(+y[2]||0))*100)/100}));return{d:Math.round(d*100)/100,c:Math.round(c*100)/100,by}},
 unbal(){return S.j.filter(x=>Math.abs(x.lines.reduce((s,y)=>s+(+y[1]||0)-(+y[2]||0),0))>.005).map(x=>x.vno||x.id)},
 last(n){return S.j.slice(-(n||1)).map(x=>({id:x.id,vno:x.vno,acc:x.acc,tt:x.tt,cls:x.cls,ccy:x.ccy,rate:x.rate,fa:x.fa,cust:x.cust,party:x.party,br:x.br,lines:x.lines,revBy:x.revBy,rev:x.rev,appr:x.appr,mk:x.mk,att:!!x.att,dxg:x.dxg}))},
 bal(id,ccy){const D=dx3(),a=D.liq().find(q=>q.id==id);return D.balOf(a,ccy||a.ccy)},
 post(st){const D=dx3();const r=D.calc({touched:{},tried:true,...st});if(!r.ok)return{err:r.er,wn:r.wn,appr:r.appr};if(r.appr)return{appr:r.appr};const ids=D.postAll(r);save();return{ids,r:{cad:r.cad,gain:r.gain,fx:r.fx,book:r.book,inC:r.inC,feeC:r.feeC,wn:r.wn}}},
 calc(st){const r=dx3().calc({touched:{},tried:true,...st});return{ok:r.ok,er:r.er,wn:r.wn,appr:r.appr,entries:r.entries.map(e=>({acc:e.acc,lines:e.lines,ccy:e.ccy,rate:e.rate})),cad:r.cad,gain:r.gain,avail:r.avail,after:r.after}},
 opts(name){return[...document.querySelectorAll('.d3-cb[data-cb="'+name+'"] li[role=option]')].map(li=>li.dataset.cbv)},
};"""
def boot(p,**kw):
    b,pg,errs=open_app(p,**kw);pg.evaluate(JS_HELP);return b,pg,errs
def pick(pg,name,text):
    pg.click(f'#d3f_{name}');pg.fill(f'.d3-cb[data-cb="{name}"] .d3-cbq',text);pg.keyboard.press('Enter');pg.wait_for_timeout(120)

with sync_playwright() as p:
    b,pg,errs=boot(p)
    E=pg.evaluate
    # ---------- 1. Chart-of-accounts driven dropdown filtering ----------
    E("()=>{S.coa['1020']='Petty Cash Float';CH['1020']='Petty Cash Float';S.coa['4210']='Unrealized FX Gain/Loss';CH['4210']=S.coa['4210'];save()}")
    liq=E("()=>dx3().elig().map(a=>a.id)")
    ok('Received-into list = active cash & bank accounts only',sorted(liq)==sorted(['cash|b1','cash|b2','bank|k1','bank|k2']),liq)
    ok('Inactive bank (TD Old Account) excluded',all('k3' not in x for x in liq))
    ok('Cash equivalent 1020 hidden until approved','coa|1020' not in liq)
    inc=E("()=>dx3().cats('in','inc').map(o=>o.v)");exp=E("()=>dx3().cats('out','exp').map(o=>o.v)")
    ok('Income categories are Income accounts only',inc and all(E("c=>acType(c)",c)=='Income' for c in inc),inc)
    ok('System FX accounts never offered as income',not({'4200','4210','4220'}&set(inc)),inc)
    ok('Expense categories are Expense accounts only',exp and all(E("c=>acType(c)",c)=='Expenses' for c in exp),exp)
    ok('Cash Over/Short (6500) not offered as an expense','6500' not in exp)
    allc=set()
    for k,cl in [('in','inc'),('in','ar'),('in','dep'),('in','loan'),('in','cap'),('in','ref'),('out','exp'),('out','ap'),('out','dep'),('out','loan'),('out','drw')]:
        allc|=set(E(f"()=>dx3().cats('{k}','{cl}').map(o=>o.v)"))
    ok('No cash/bank/clearing account ever offered as a category',not({'1000','1010','1020','1050'}&allc),sorted(allc))
    ok('Deposit classification offers 2150 liability (auto-created), not income',E("()=>dx3().cats('in','dep').map(o=>o.v)")==['2150'])
    ok('Owner contribution offers equity only, excludes drawings',E("()=>dx3().cats('in','cap').map(o=>o.v)")==['3000'])
    # UI: dropdown contents
    pg.click('[data-d3="new:in"]');pg.wait_for_timeout(300)
    ui=E("()=>QA.opts('acct')")
    ok('UI Received-into combobox shows the same 4 accounts',sorted(ui)==sorted(liq),ui)
    pg.click('label.d3-ct:has-text("Earned income")');pg.wait_for_timeout(200)
    uic=E("()=>QA.opts('cat')")
    ok('UI Income category combobox = income accounts',sorted(uic)==sorted(inc),uic)
    pg.click('#d3f_acct');pg.fill('.d3-cb[data-cb="acct"] .d3-cbq','usd');pg.wait_for_timeout(100)
    vis=E("()=>[...document.querySelectorAll('.d3-cb[data-cb=acct] li[role=option]:not([hidden])')].map(l=>l.dataset.cbv)")
    ok('Account search filters options (usd -> RBC USD)',vis==['bank|k2'],vis)
    pg.keyboard.press('Escape');pg.keyboard.press('Escape');pg.wait_for_timeout(150)
    ok('Escape closes the sheet',E("()=>!document.getElementById('d3ov')"))
    # approve the cash equivalent, deactivate a category via Controls UI
    pg.click('[data-d3="ctl"]');pg.wait_for_timeout(200)
    pg.check('[data-cc="ceq:coa|1020"]');pg.uncheck('[data-cc="cat:6600"]');pg.fill('#d3thr','2000')
    pg.click('[data-d3="ccsave"]');pg.wait_for_timeout(300)
    ok('Approved cash equivalent 1020 now selectable','coa|1020' in E("()=>dx3().elig().map(a=>a.id)"))
    ok('Deactivated category 6600 no longer offered','6600' not in E("()=>dx3().cats('out','exp').map(o=>o.v)"))
    ok('Approval threshold saved (CAD 2,000)',E("()=>S.cbk.thr")==2000)

    # ---------- 2. Cash in through the UI ----------
    pg.click('[data-d3="new:in"]');pg.wait_for_timeout(300)
    pg.click('[data-d3="review"]');pg.wait_for_timeout(200)
    errtxt=E("()=>[...document.querySelectorAll('#d3ov .d3-er')].map(e=>e.textContent)")
    ok('Inline validation: type, category, amount, party required',any('Only earned income' in t for t in errtxt) and any('amount' in t.lower() for t in errtxt) and any('came from' in t for t in errtxt),errtxt)
    ok('Validation keeps the form open (no posting)',E("()=>S.j.length")==3)
    pg.click('label.d3-ct:has-text("Earned income")');pick(pg,'cat','commission')
    pg.fill('#d3f_amt','250');pg.fill('#d3f_party','Walk-in customer');pg.fill('#d3f_ref','R-1001');pg.fill('#d3f_desc','FX commission')
    pg.click('[data-d3="review"]');pg.wait_for_timeout(200)
    ok('Confirmation step shown before posting',E("()=>!!document.querySelector('#d3ov .d3-cf')"))
    pg.click('[data-d3="commit"]');pg.wait_for_timeout(300)
    ok('Success state shown',E("()=>!!document.querySelector('#d3ov .d3-done')"))
    j=E("()=>QA.last()[0]")
    ok('Cash in journal: Dr 1000 / Cr 4500 CAD 250 on cash|b1',j['lines']==[['1000',250,0],['4500',0,250]] and j['acc']=='cash|b1' and j['vno']=='RV-0001',j)
    pg.click('#d3ov [data-d3="close"]');pg.wait_for_timeout(200)

    # ---------- 3. Non-income receipts ----------
    r=E("()=>QA.post({k:'in',cls:'dep',acct:'bank|k1',cat:'2150',amt:'1000',date:'2026-10-24',cust:'c2'})")
    j=E("()=>QA.last()[0]")
    ok('Customer deposit -> Cr 2150 liability (created), linked to customer, no revenue',j['lines']==[['1010',1000,0],['2150',0,1000]] and j['cust']=='c2' and E("()=>CH['2150']")=='Customer Deposits',[r,j])
    r=E("()=>QA.post({k:'in',cls:'dep',acct:'bank|k1',cat:'2150',amt:'10',date:'2026-10-24',party:'someone'})")
    ok('Customer deposit without a registered customer is rejected','party' in (r.get('err') or {}),r)
    E("()=>QA.post({k:'in',cls:'loan',acct:'bank|k1',cat:'2500',amt:'5000',date:'2026-10-24',party:'BDC'})")
    j=E("()=>QA.last()[0]")
    ok('Loan received -> Cr 2500 Loans Payable',j['lines']==[['1010',5000,0],['2500',0,5000]],j)
    E("()=>QA.post({k:'in',cls:'cap',acct:'cash|b1',cat:'3000',amt:'500',date:'2026-10-24',party:'ZAHID'})")
    ok('Owner contribution -> Cr 3000 equity',E("()=>QA.last()[0].lines")==[['1000',500,0],['3000',0,500]])
    r=E("()=>QA.calc({k:'in',cls:'inc',acct:'cash|b1',cat:'2150',amt:'5',date:'2026-10-24',party:'x'})")
    ok('Liability account refused as an income category',not r['ok'] and 'cat' in r['er'],r)
    r=E("()=>QA.calc({k:'in',cls:'inc',acct:'cash|b1',cat:'4500',amt:'5',date:'2026-10-24',party:'x',desc:'customer deposit held for remittance'})")
    ok('Warning when "income" text looks like a deposit',any('not income' in w for w in r['wn']),r['wn'])
    # foreign currency cash in
    E("()=>QA.post({k:'in',cls:'inc',acct:'bank|k2',cat:'4500',amt:'200',rate:'1.40',date:'2026-10-24',party:'US client'})")
    j=E("()=>QA.last()[0]")
    ok('USD cash in keeps original amount and rate; CAD ledger 280',j['ccy']=='USD' and abs(j['rate']-1.4)<1e-9 and j['fa']==200 and j['lines']==[['1010',280,0],['4500',0,280]],j)
    r=E("()=>QA.calc({k:'in',cls:'inc',acct:'bank|k2',cat:'4500',amt:'5',rate:'1.4',ccy:'CAD',date:'2026-10-24',party:'x'})")
    ok('Currency must match the account currency',not r['ok'] and 'ccy' in r['er'],r['er'])
    r=E("()=>QA.calc({k:'in',cls:'inc',acct:'cash|b1',cat:'4500',amt:'5',date:'2099-01-01',party:'x'})")
    ok('Future date rejected',not r['ok'] and 'date' in r['er'])
    r=E("()=>QA.calc({k:'in',cls:'inc',acct:'cash|b1',cat:'4500',amt:'5.555',date:'2026-10-24',party:'x'})")
    ok('More than two decimals rejected',not r['ok'] and 'amt' in r['er'])

    # ---------- 4. Cash out ----------
    pg.click('[data-d3="new:out"]');pg.wait_for_timeout(300)
    pick(pg,'acct','rbc operating');pg.click('label.d3-ct:has-text("Expense")');pick(pg,'cat','rent')  # label match first
    pg.fill('#d3f_amt','1200');pg.fill('#d3f_party','Landlord Inc.');pg.fill('#d3f_ref','INV-77')
    png=os.path.join(HERE,'receipt.png')
    if not os.path.exists(png):
        open(png,'wb').write(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))
    with pg.expect_file_chooser() as fc: pg.click('[data-d3="att"]')
    fc.value.set_files(png);pg.wait_for_timeout(300)
    ok('Receipt attached in form',E("()=>dx3().F&&dx3().F.att&&dx3().F.att.name")=='receipt.png')
    pg.click('[data-d3="review"]');pg.click('[data-d3="commit"]');pg.wait_for_timeout(300)
    j=E("()=>QA.last()[0]");RENT=j['id']
    ok('Cash out journal: Dr 6100 / Cr 1010 CAD 1,200 with receipt',j['lines']==[['6100',1200,0],['1010',0,1200]] and j['att'] and j['acc']=='bank|k1' and j['vno']=='PV-0001',j)
    pg.click('#d3ov [data-d3="close"]');pg.wait_for_timeout(200)
    r=E("()=>QA.calc({k:'out',cls:'exp',acct:'cash|b2',cat:'6100',amt:'10',date:'2026-10-24',party:'x'})")
    ok('Insufficient cash blocks the payment (cash never overdrawn)',not r['ok'] and 'Not enough funds' in r['er'].get('amt',''),r['er'])
    E("()=>{S.dxc.acc['bank|k1']={odl:5000};save()}")
    bk1=E("()=>QA.bal('bank|k1')")
    r=E(f"()=>QA.calc({{k:'out',cls:'exp',acct:'bank|k1',cat:'6100',amt:'{bk1+100}',date:'2026-10-24',party:'x'}})")
    ok('Bank payment within overdraft limit: allowed with warning',r['ok'] and any('overdraft' in w for w in r['wn']),r)
    r=E(f"()=>QA.calc({{k:'out',cls:'exp',acct:'bank|k1',cat:'6100',amt:'{bk1+5000.01}',date:'2026-10-24',party:'x'}})")
    ok('Bank payment beyond overdraft limit: blocked',not r['ok'] and 'overdraft limit' in r['er'].get('amt',''),r['er'])
    # USD cash out: realized FX at book vs spot
    book=E("()=>{const D=dx3();return D.carry(D.liq().find(a=>a.id=='bank|k2'),'USD')}")
    ok('USD book rate = CAD carrying / USD held = 1630/1200',abs(book-1630/1200)<1e-6,book)
    res=E("()=>QA.post({k:'out',cls:'exp',acct:'bank|k2',cat:'6400',amt:'100',rate:'1.38',date:'2026-10-24',party:'Courier US'})")
    j=E("()=>QA.last()[0]")
    exp_cr=round(100*1630/1200,2)
    ok('USD expense at spot (138.00), bank relieved at book, FX difference to 4220',j['lines'][0]==['6400',138,0] and j['lines'][1]==['1010',0,exp_cr] and j['lines'][2][0]=='4220' and abs((j['lines'][2][2]-j['lines'][2][1])-(138-exp_cr))<.006,j)
    ok('USD balance reduced by exactly 100 USD',abs(E("()=>QA.bal('bank|k2')")-1100)<.01,E("()=>QA.bal('bank|k2')"))

    # ---------- 5. Transfers ----------
    r=E("()=>QA.calc({k:'xfr',acct:'cash|b1',to:'cash|b1',amt:'10',date:'2026-10-24'})")
    ok('Same source and destination rejected',not r['ok'] and 'different' in r['er'].get('to',''),r['er'])
    pg.click('[data-d3="new:xfr"]');pg.wait_for_timeout(300)
    to_opts=E("()=>QA.opts('to')")
    ok('UI: destination list excludes the source account',E("()=>dx3().F.acct") not in to_opts and len(to_opts)>0,to_opts)
    pick(pg,'to','rbc operating');pg.fill('#d3f_amt','1000');pg.fill('#d3f_desc','Bank the till')
    pg.click('[data-d3="review"]');pg.click('[data-d3="commit"]');pg.wait_for_timeout(300)
    L=E("()=>QA.last(2)")
    ok('Same-currency transfer: Cr 1000 / Dr 1050, Dr 1010 / Cr 1050, linked',L[0]['lines']==[['1050',1000,0],['1000',0,1000]] and L[1]['lines']==[['1010',1000,0],['1050',0,1000]] and L[0]['dxg']==L[1]['dxg'] and L[0]['vno']==L[1]['vno']=='TV-0001',L)
    pg.click('#d3ov [data-d3="close"]');pg.wait_for_timeout(200)
    # CAD -> USD with fee
    r=E("()=>QA.post({k:'xfr',acct:'bank|k1',to:'bank|k2',amt:'1370',xr:'0.72',tamt:'986.40',fee:'15',feeAcct:'6700',date:'2026-10-24',desc:'Fund USD'})")
    L=E("()=>QA.last(3)")
    legs=[x for x in L if x['vno']==L[-1]['vno']]
    ok('CAD→USD: two legs, no FX gain (source is functional currency)',len(legs)==2 and abs(r['r']['gain'])<.005,[r,legs])
    ok('CAD→USD: fee 15 to 6700 Bank Charges from source',legs[0]['lines']==[['1050',1370,0],['1010',0,1385],['6700',15,0]],legs[0])
    ok('CAD→USD: destination keeps USD 986.40 at implied rate',legs[1]['ccy']=='USD' and legs[1]['fa']==986.4 and legs[1]['lines']==[['1010',1370,0],['1050',0,1370]],legs[1])
    usd_after=E("()=>QA.bal('bank|k2')")
    ok('USD balance = 1100 + 986.40',abs(usd_after-2086.4)<.01,usd_after)
    # USD -> CAD at 1.42 with realized FX
    book2=E("()=>{const D=dx3();return D.carry(D.liq().find(a=>a.id=='bank|k2'),'USD')}")
    r=E("()=>QA.post({k:'xfr',acct:'bank|k2',to:'bank|k1',amt:'300',xr:'1.42',tamt:'426',date:'2026-10-24'})")
    L=E("()=>QA.last(3)")
    gain=round(426-round(300*book2,2),2)
    ok('USD→CAD: realized FX gain/loss posted to 4220 and clears 1050',abs(r['r']['gain']-gain)<.006 and L[2]['lines'][0][0] in('1050','4220') and any(l[0]=='4220' for l in L[2]['lines']),[r,L[2],gain])
    ok('Clearing account 1050 nets to zero after all transfers',abs(E("()=>QA.tb().by['1050']||0"))<.005,E("()=>QA.tb().by['1050']"))
    ok('USD balance after = 2086.40 − 300',abs(E("()=>QA.bal('bank|k2')")-1786.4)<.01)
    r=E("()=>QA.calc({k:'xfr',acct:'bank|k2',to:'bank|k1',amt:'100',xr:'1.42',tamt:'150',date:'2026-10-24'})")
    ok('Mismatched rate/amount rejected',not r['ok'] and 'tamt' in r['er'],r['er'])
    r=E("()=>QA.calc({k:'xfr',acct:'cash|b2',to:'cash|b1',amt:'50',date:'2026-10-24'})")
    ok('Transfer from an empty till blocked',not r['ok'] and 'amt' in r['er'])

    # ---------- 6. Approvals and permissions ----------
    E("()=>QA.as(2)")  # Carl, Cashier, VANCOUVER only
    ok('Cashier sees only own-branch accounts',sorted(E("()=>dx3().elig().map(a=>a.id)"))==sorted(['cash|b1','bank|k1','bank|k2','coa|1020']),E("()=>dx3().elig().map(a=>a.id)"))
    r=E("()=>QA.calc({k:'in',cls:'inc',acct:'cash|b2',cat:'4500',amt:'5',date:'2026-10-24',party:'x'})")
    ok('Cashier cannot post to another branch account',not r['ok'] and 'acct' in r['er'],r['er'])
    n0=E("()=>S.j.length");k1=E("()=>QA.bal('bank|k1')")
    pg.click('[data-d3="new:out"]');pg.wait_for_timeout(300)
    pick(pg,'acct','rbc operating');pg.click('label.d3-ct:has-text("Expense")');pick(pg,'cat','salaries')
    pg.fill('#d3f_amt','2500');pg.fill('#d3f_party','Payroll');pg.wait_for_timeout(100)
    ok('Approval status shown in form (needs approval)',E("()=>document.querySelector('#d3pv .d3-ap.wn')!=null"))
    pg.click('[data-d3="review"]');pg.click('[data-d3="commit"]');pg.wait_for_timeout(300)
    ok('Over-threshold cashier entry queued, not posted',E("()=>S.j.length")==n0 and E("()=>S.dxq.length")==1 and E("()=>S.dxq[0].st")=='Pending approval')
    ok('Pending entry does not change the balance',abs(E("()=>QA.bal('bank|k1')")-k1)<.005)
    pg.click('#d3ov [data-d3="close"]');pg.wait_for_timeout(200)
    qid=E("()=>S.dxq[0].id")
    ok('Maker (cashier) cannot approve',E("q=>dx3().qApprove(q)",qid)!='' and E("()=>S.dxq[0].st")=='Pending approval')
    E("()=>QA.as(2)")
    E("()=>{const r=dx3().calc({k:'out',cls:'exp',acct:'bank|k1',cat:'6300',amt:'2100',date:'2026-10-24',party:'BC Hydro',touched:{},tried:true});S.dxq.push({id:'dqX',k:'out',vno:r.entries[0].vno,s:{k:'out',cls:'exp',acct:'bank|k1',cat:'6300',amt:'2100',date:'2026-10-24',party:'BC Hydro',vno:r.entries[0].vno},st:'Pending approval',by:'Carl',at:new Date().toISOString(),cad:2100,ccy:'CAD',amt:2100,hist:[{at:new Date().toISOString(),by:'Carl',act:'Submitted for approval'}]});save()}")
    ok('Pending items in history with status',E("()=>{W=window.__dx3;W.acc='bank|k1';go();return document.querySelectorAll('.d3-ht [data-d3^=\"q:\"]').length}")==2)
    E("()=>QA.as(1)")  # Mia, Manager
    pg.click(f'[data-d3="q:{qid}"]');pg.wait_for_timeout(250)
    pg.click('[data-d3="qok"]');pg.wait_for_timeout(300)
    j=E("()=>QA.last()[0]")
    ok('Manager approves → posted with approver and maker recorded',E("()=>S.dxq[0].st")=='Posted' and j['appr'] and j['appr']['by']=='Mia' and j['mk']=='Carl' and j['lines']==[['6200',2500,0],['1010',0,2500]],j)
    pg.click('[data-d3="drx"]');pg.wait_for_timeout(100)
    m=E("()=>dx3().qReject('dqX','')")
    ok('Reject requires a reason',m!='' and E("()=>S.dxq[1].st")=='Pending approval',m)
    m=E("()=>dx3().qReject('dqX','Duplicate of the October bill')")
    ok('Manager rejects with reason; nothing posted',m=='' and E("()=>S.dxq[1].st")=='Rejected')
    E("()=>QA.as(4)")  # Viewer
    ok('Viewer (no cash permission) cannot reach Daily transactions',E("()=>lvl(me().role,'cash')")=='n')
    E("()=>{S.perm={Viewer:{cash:'v'}};view='dtx';go()}")
    ok('View-only cash role: register visible, no entry buttons, read-only notice',E("()=>!document.querySelector('[data-d3=\"new:in\"]')&&!!document.querySelector('.d3-ro-n')&&!!document.querySelector('.d3-reg')"))
    E("()=>dx3Open('in')");pg.wait_for_timeout(150)
    ok('Viewer cannot open an entry form',E("()=>!document.getElementById('d3ov')"))
    ok('Viewer cannot reverse',E(f"()=>dx3().reverse({RENT},'test')")!='')
    E("()=>QA.as(2)")
    ok('Cashier cannot reverse','Only an Owner' in E(f"()=>dx3().reverse({RENT},'test')"))

    # ---------- 7. Reversal / correction ----------
    E("()=>{delete S.perm;QA.as(0);view='dtx';go()}")
    k1=E("()=>QA.bal('bank|k1')")
    pg.evaluate("()=>{window.__dx3.acc='bank|k1';window.__dx3.f.per='day';go()}");pg.wait_for_timeout(150)
    pg.click(f'[data-d3="x:{RENT}"]');pg.wait_for_timeout(250)
    ok('Detail drawer shows receipt preview',E("()=>!!document.querySelector('#d3dr .d3-rcp img')"))
    ok('Detail drawer shows audit trail',E("()=>document.querySelectorAll('#d3dr .d3-tl li').length")>=1)
    ok('No edit control on posted entries',E("()=>!document.querySelector('#d3dr [data-d3=edit]')"))
    pg.click('#d3dr [data-d3="rev"]');pg.click('#d3dr [data-d3="revgo"]');pg.wait_for_timeout(150)
    ok('Reversal requires a reason',E("()=>(document.querySelector('#d3dr .d3-er')||{}).textContent||''").find('reason')>=0)
    pg.fill('#d3rw','Paid twice; landlord refunded');pg.click('#d3dr [data-d3="revgo"]');pg.wait_for_timeout(300)
    j=E("()=>QA.last()[0]")
    ok('Reversal posts opposite lines and links both entries',j['lines']==[['6100',0,1200],['1010',1200,0]] and j['rev']==RENT and E(f"()=>S.j.find(x=>x.id=={RENT}).revBy")==j['id'],j)
    ok('Balance restored by reversal',abs(E("()=>QA.bal('bank|k1')")-(k1+1200))<.005)
    ok('Second reversal of the same entry blocked','Already reversed' in E(f"()=>dx3().reverse({RENT},'again')"))
    pg.click('[data-d3="drx"]')
    # reverse & correct the USD receipt (RV with fa 200) -> 210
    usdin=E("()=>S.j.find(x=>x.fa==200&&x.dxk=='in').id")
    pg.click(f'[data-d3="acc:bank|k2"]');pg.wait_for_timeout(200)
    pg.click(f'[data-d3="x:{usdin}"]');pg.wait_for_timeout(250)
    pg.click('#d3dr [data-d3="revcor"]');pg.fill('#d3rw','Amount keyed wrong');pg.click('#d3dr [data-d3="revgo"]');pg.wait_for_timeout(350)
    F=E("()=>{const f=dx3().F;return f&&{k:f.k,cls:f.cls,acct:f.acct,cat:f.cat,amt:f.amt,rate:f.rate,corr:f.corr}}")
    ok('Reverse & correct opens a prefilled form',F and F['k']=='in' and F['acct']=='bank|k2' and F['cat']=='4500' and F['amt']=='200' and abs(float(F['rate'])-1.4)<1e-9 and F['corr']==usdin,F)
    pg.fill('#d3f_amt','210');pg.click('[data-d3="review"]');pg.click('[data-d3="commit"]');pg.wait_for_timeout(300)
    j=E("()=>QA.last()[0]")
    ok('Corrected entry posted and linked to the original',j['fa']==210 and E(f"()=>S.j.find(x=>x.id=={usdin}).corrBy")==j['vno'],j)
    pg.click('#d3ov [data-d3="close"]');pg.wait_for_timeout(150)

    # ---------- 8. Closed day ----------
    E("()=>{S.closings.push({acc:'cash|b2',br:'b2',date:'2026-10-23',rows:[{ccy:'CAD',exp:0,counted:0}],base:0,by:'ZAHID',at:new Date().toISOString(),accLabel:'Cash – SURREY'});save()}")
    r=E("()=>QA.calc({k:'in',cls:'inc',acct:'cash|b2',cat:'4500',amt:'5',date:'2026-10-23',party:'x'})")
    ok('Posting into a closed cash day is blocked',not r['ok'] and 'closed' in r['er'].get('date',''),r['er'])

    # ---------- 9. Ledger, trial balance and daily closing figures ----------
    tb=E("()=>QA.tb()")
    ok('Trial balance: total debits = total credits',abs(tb['d']-tb['c'])<.005,tb)
    ok('Every journal entry balances',E("()=>QA.unbal()")==[])
    by=tb['by']
    # expected balances, computed independently
    exp_cash_b1=5000+250+500-1000
    ok('GL 1000 (cash) = 5,000 + 250 + 500 − 1,000',abs(by['1000']-exp_cash_b1)<.005,by['1000'])
    ok('Revenue 4500 = 250 + 280 − 280 + 294 (corrected USD receipt)',abs(-by['4500']-(250+280-280+294))<.005,by['4500'])
    ok('Customer deposits 2150 is a liability of 1,000 (not revenue)',abs(-by['2150']-1000)<.005)
    ok('Loans payable 2500 = 5,000',abs(-by['2500']-5000)<.005)
    ok('Rent 6100 nets to zero after reversal',abs(by.get('6100',0))<.005)
    st=E("""()=>{const D=dx3();window.__dx3.acc='bank|k1';go();return [...document.querySelectorAll('.d3-k b')].map(b=>b.textContent)}""")
    ok('Register KPIs render 8 cards',len(st)==8,st)
    chk=E("""()=>{const D=dx3(),L=D.ledger(),a=D.liq().find(x=>x.id=='bank|k1');let op=0,ci=0,co=0,ti=0,to=0;const ls=new Set(['1000','1010','1020','1050']);
      L.R.filter(r=>r.aid==a.id).forEach(r=>{if(r.x.date<'2026-10-24')op+=r.b;else{const xf=r.x.dxk=='xfr'||(!r.x.dxk&&r.x.lines.every(y=>ls.has(String(y[0]))));if(xf){if(r.b>0)ti+=r.b;else to-=r.b}else{if(r.b>0)ci+=r.b;else co-=r.b}}});
      return{op,ci,co,ti,to,ex:op+ci-co+ti-to,bal:D.balOf(a,'CAD'),gl:S.j.filter(x=>String(x.acc)=='bank|k1').reduce((s,x)=>s+x.lines.filter(y=>y[0]=='1010').reduce((t,y)=>t+(+y[1]||0)-(+y[2]||0),0),0)}}""")
    ok('Daily closing: opening + in − out + transfers = book balance (RBC Operating)',abs(chk['ex']-chk['bal'])<.005 and abs(chk['bal']-chk['gl'])<.005,chk)
    exp_txt=E("()=>[...document.querySelectorAll('.d3-k')].find(k=>k.textContent.includes('Expected book')).querySelector('b').textContent")
    ok('Expected book balance KPI matches ledger',exp_txt.replace('CAD','').replace(',','').strip().replace('−','-')==f"{chk['ex']:.2f}",[exp_txt,chk['ex']])
    # existing app integrity check (if available)
    rc=E("()=>{try{return typeof chkAll=='function'?JSON.stringify(chkAll()).slice(0,400):'n/a'}catch(e){return 'ERR '+e.message}}")
    print('   app chkAll():',rc[:300])
    old=E("()=>{const a=(typeof accounts=='function')?null:null;return S.banks.map(k=>k.id)}")
    # existing cashbook figures agree for CAD bank
    cb=E("()=>{const v=S.j.filter(x=>x.lines.some(y=>+y[0]==1010)&&aId(x)=='bank|k1').reduce((s,x)=>s+x.lines.filter(y=>+y[0]==1010).reduce((a,y)=>a+(+y[1]||0)-(+y[2]||0),0),0);return Math.round(v*100)/100}")
    ok('Existing Cashbook bank balance agrees with the register',abs(cb-chk['bal'])<.005,[cb,chk['bal']])
    # CSV
    c=E("()=>{window.__dx3.acc='all';window.__dx3.f.per='30';go();const r=dx3Csv();return{rows:r.rows,head:r.text.split('\\r\\n')[0]}}")
    ok('CSV export of filtered movements',c['rows']>=10 and 'Voucher' in c['head'],c)
    E("()=>{window.__dx3.f.typ='xfr';go()}")
    ok('Type filter: transfers only',E("()=>[...document.querySelectorAll('.d3-ht tbody tr')].every(t=>/Transfer/.test(t.children[2].textContent))"))
    E("()=>{window.__dx3.f={q:'INV-77',per:'30',typ:'',st:'',from:'',to:''};go()}")
    ok('Search filter by reference',E("()=>document.querySelectorAll('.d3-ht tbody tr').length")>=1 and E("()=>[...document.querySelectorAll('.d3-ht tbody tr')].every(t=>t.textContent.includes('INV-77')||t.textContent.includes('PV-0001'))"))
    E("()=>{window.__dx3.f={q:'',per:'day',typ:'',st:'',from:'',to:''};window.__dx3.acc='bank|k1';go()}")
    ok('Single-account history lists only that account',E("()=>[...document.querySelectorAll('.d3-ht tbody tr[data-d3^=\"x:\"]')].every(t=>{const id=t.dataset.d3.slice(2);const x=S.j.find(z=>String(z.id)==id);return x.acc=='bank|k1'||(!x.acc&&x.lines.some(y=>y[0]=='1010'))})&&document.querySelectorAll('.d3-ht tbody tr').length>0"))
    last_run=E("()=>{const b=[...document.querySelectorAll('.d3-ht tbody tr')].find(t=>t.dataset.d3.startsWith('x:'));return b.children[7].textContent}")
    ok('Top running balance equals expected book balance',last_run.replace(',','')==f"{chk['ex']:.2f}",[last_run,chk['ex']])
    pg.screenshot(path='after_reg.png',full_page=True)
    # menu routing
    pg.click('.cdk-hr [data-cbxm]');pg.wait_for_timeout(150)
    pg.click('.cdk-hr [data-cbxa="exp"]');pg.wait_for_timeout(250)
    ok('"New entry → Expense" opens the CoA-driven Cash out form preset to Expense',E("()=>{const f=dx3().F;return f&&f.k=='out'&&f.cls=='exp'}"))
    pg.screenshot(path='menu_exp.png')
    pg.keyboard.press('Escape')
    errs2=[e for e in errs if 'Failed to load' not in e and 'DIALOG' not in e]
    ok('No JavaScript errors during the run',not errs2,errs2[:5])
    json.dump(E("()=>S"),open(os.path.join(HERE,'state_after.json'),'w'))
    b.close()
f=[r for r in R if not r[0]]
print(f"\n{len(R)-len(f)}/{len(R)} passed")
for r in f: print('FAILED:',r[1],r[2])
