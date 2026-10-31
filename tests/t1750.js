const {chromium}=require('playwright');let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1300}});p.on('pageerror',e=>{f++;console.log('PAGEERR',e.message)});p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};
const b0=S.br[0].id;S.users=[{name:'Admin',role:'Owner',br:'All',id:'U1'},{name:'Cara',role:'Cashier',br:'All',id:'U2'},{name:'Mo',role:'Manager',br:'All',id:'U3'},{name:'Omar',role:'Owner',br:'All',id:'U4'}];S.me=0;
S.banks=[{id:'k1',name:'Main Bank',no:'111',ccy:S.base,br:b0,od:0}];
post({date:today(),br:b0,acc:'cash|'+b0,tt:'Opening',memo:'cap',lines:[['1000',5000,0],['3000',0,5000]]});
addAcct('4310','Consulting Income');addAcct('6100','Rent Expense');
window.as=n=>{S.me=S.users.findIndex(u=>u.name==n);go()};br=b0;view='dtx';go()});await p.waitForTimeout(400);
const ev=(f,a)=>p.evaluate(f,a);
const jn=()=>ev(()=>S.j.length);
// ---- 1 cashier submits a cash-in (UI)
await ev(()=>as('Cara'));await p.waitForTimeout(200);
const j0=await jn(),c0=await ev(()=>bal(1000,S.j));
await ev(()=>cbxAct('inc'));await p.waitForTimeout(300);
let t=await p.innerText('#cbxov');
ok(/Submit for manager approval/.test(t)&&/Save draft/.test(t)&&!/Post and add another/.test(t),'cashier form offers Submit for approval / Save draft, not Post');
ok(/Needs approval from an Owner or Manager/.test(await p.innerText('#cbxpv')),'preview says approval needed');
await p.fill('#cbxf_amt','250');await p.selectOption('#cbxf_cat','4310');await p.fill('#cbxf_desc','Consulting fee');await p.fill('#cbxf_ref','R-100');
await p.click('[data-cbxs="post"]');await p.waitForTimeout(300);
ok(await jn()==j0,'submit created NO journal');
let r=await ev(()=>({n:S.apr.length,st:S.apr[0]&&S.apr[0].st,ver:S.apr[0]&&S.apr[0].ver,by:S.apr[0]&&S.apr[0].by,ev:S.apl.length,cash:bal(1000,S.j)}));
ok(r.n==1&&r.st=='Pending approval'&&r.ver==1&&r.by=='Cara','record is Pending approval v1 by Cara '+JSON.stringify(r));
ok(r.cash==await ev(()=>bal(1000,S.j)),'balance check');
// duplicate submission (double click) -> idempotent
const d1=await ev(()=>{const x=S.apr[0],s=x.vers[0].s;return apw.submit('cb',x.srcId,JSON.parse(JSON.stringify(s)),x.meta)});
ok(d1.ok&&d1.again&&await ev(()=>S.apr.length)==1,'duplicate submit of same version is idempotent');
const d2=await ev(()=>{const x=S.apr[0],s=JSON.parse(JSON.stringify(x.vers[0].s));s.sid='other';return apw.submit('cb','other',s,x.meta)});
ok(!d2.ok&&/identical entry/.test(d2.err),'identical second submission refused: '+d2.err);
// ---- 2 bypass attempts
const by=await ev(()=>{let e='';try{post({date:today(),br:S.br[0].id,acc:'cash|'+S.br[0].id,tt:'Other income',vno:'RV-9',memo:'x',lines:[['1000',99,0],['4300',0,99]]})}catch(x){e=x.message}return e});
ok(/cannot post this directly/.test(by),'direct post() by cashier is refused: '+by);
const by2=await ev(()=>{let e='';try{post({date:today(),br:S.br[0].id,acc:'bank|k1',bank:'k1',tt:'Deposit',vno:'RV-10',memo:'x',lines:[['1010',99,0],['1200',0,99]]})}catch(x){e=x.message}return e});
ok(/cannot post this directly/.test(by2),'deposit via post() refused');
ok(await jn()==j0,'no journal after bypass attempts');
// cashier cannot approve
const ca=await ev(()=>apw.approve(S.apr[0].id,1));
ok(!ca.ok&&/Only an Owner or Manager/.test(ca.err)&&await jn()==j0,'cashier cannot approve: '+ca.err);
// ---- 3 manager reviews in Approval Centre
await ev(()=>as('Mo'));await p.waitForTimeout(200);
await ev(()=>{window.__dxt='apc';view='dtx';go()});await p.waitForTimeout(300);
t=await p.innerText('.apc');
ok(/Pending approval/.test(t)&&/250\.00/.test(t)&&/Cara/.test(t),'centre shows the pending item');
ok(/pending value by currency/i.test(t)&&new RegExp(await ev(()=>S.base)).test(t),'pending value by currency shown');
await p.click('tr.apc-r');await p.waitForTimeout(200);
t=await p.innerText('#apwov');
ok(/Consulting fee/.test(t)&&/R-100/.test(t)&&/Cara/.test(t)&&/Main Branch/.test(t),'detail shows full transaction');
ok(/4310 · Consulting Income/.test(t)&&/Income/.test(t)&&/Cash on Hand/.test(t),'shows selected account and corresponding account with classification');
ok(/ledger balance/i.test(t)&&t.includes((c0).toLocaleString('en-US',{minimumFractionDigits:2}))&&t.includes((c0+250).toLocaleString('en-US',{minimumFractionDigits:2})),'before/after balances shown');
const badck=await p.$$eval('#apwov .apc-ck .bad',a=>a.map(x=>x.innerText));ok(/accounting validation/i.test(t)&&!badck.length,'checklist has no blockers '+JSON.stringify(badck));
ok(/Approve and post/.test(t)&&/Return for correction/.test(t)&&/Reject with reason/.test(t),'three decision buttons');
await p.click('#apc_ok');await p.waitForTimeout(400);
r=await ev(()=>{const j=S.j[S.j.length-1];return{n:S.j.length,by:j.by,ap:j.apprBy,apw:j.apw,vno:j.vno,st:S.apr[0].st,jno:S.apr[0].jno,cash:bal(1000,S.j),i:bal(4310,S.j)}});
ok(r.n==j0+1&&r.by=='Cara'&&r.ap=='Mo'&&r.apw=='APR-00001'&&r.st=='Posted'&&r.jno==r.vno,'approved: one journal, maker Cara, approver Mo, linked '+JSON.stringify(r));
ok(r.cash==c0+250&&r.i==-250,'balances moved only now');
// retry cannot duplicate
const rt=await ev(()=>apw.approve('APR-00001',1));
ok(!rt.ok&&await jn()==j0+1,'second approve call refused, no duplicate');
const rt2=await ev(()=>{const x=apw.byId('APR-00001');x.st='Pending approval';const o=apw.approve('APR-00001',1);return o});
ok(!rt2.ok&&await jn()==j0+1&&/already exists|already posted/i.test(rt2.err||''),'even a forced re-open cannot double-post: '+rt2.err);
await ev(()=>{apw.byId('APR-00001').st='Posted'});
// ---- 4 return, correct, resubmit
await ev(()=>as('Cara'));
await ev(()=>{cbxAct('exp')});await p.waitForTimeout(300);
await p.fill('#cbxf_amt','80');await p.selectOption('#cbxf_cat','6100');await p.fill('#cbxf_desc','Rent part');
await p.click('[data-cbxs="post"]');await p.waitForTimeout(300);
ok(await ev(()=>S.apr.length)==2,'second submission recorded');
await ev(()=>as('Mo'));
let x=await ev(()=>apw.decide('APR-00002','return','Amount should include the late fee',1));
ok(x.ok&&await ev(()=>S.apr[1].st)=='Returned'&&await jn()==j0+1,'returned, nothing posted');
const x2=await ev(()=>apw.decide('APR-00002','return','again',1));
ok(!x2.ok,'cannot decide on a returned entry');
await ev(()=>as('Cara'));await ev(()=>window.apwEdit('APR-00002'));await p.waitForTimeout(300);
ok(await p.inputValue('#cbxf_amt')=='80'&&await p.inputValue('#cbxf_desc')=='Rent part','correction form re-opens with the saved values');
await p.fill('#cbxf_amt','95');await p.click('[data-cbxs="post"]');await p.waitForTimeout(300);
r=await ev(()=>({st:S.apr[1].st,ver:S.apr[1].ver,vers:S.apr[1].vers.length,cm:S.apr[1].cm.map(c=>c.text),a1:S.apr[1].vers[0].meta.amt,a2:S.apr[1].vers[1].meta.amt}));
ok(r.st=='Pending approval'&&r.ver==2&&r.vers==2&&r.a1==80&&r.a2==95&&/late fee/.test(r.cm[0]),'resubmitted as v2; v1 and the reviewer comment preserved '+JSON.stringify(r));
// ---- 5 concurrent edit: approver opened v2, maker cycle makes v3
await ev(()=>as('Mo'));await ev(()=>apwOpen('APR-00002'));
await ev(()=>{const o=window.__apwSeen;o['APR-00002']=2;apw.decide('APR-00002','return','one more thing',2)});
await ev(()=>{as('Cara');const x=apw.byId('APR-00002'),s=JSON.parse(JSON.stringify(x.vers[1].s));s.amt='96';const m={...x.meta,amt:96,base:96};apw.submit('cb',x.srcId,s,m)});
await ev(()=>as('Mo'));
x=await ev(()=>apw.approve('APR-00002',2));
ok(!x.ok&&/changed/.test(x.err)&&await jn()==j0+1,'approval of a stale version is refused: '+x.err);
// ---- 6 reject keeps the record
x=await ev(()=>apw.decide('APR-00002','reject','Not a business expense',3));
ok(x.ok&&await ev(()=>S.apr[1].st)=='Rejected'&&await jn()==j0+1,'rejected, not posted');
x=await ev(()=>{as('Cara');const r=apw.byId('APR-00002');return apw.submit('cb',r.srcId,r.vers[2].s,r.meta)});
ok(!x.ok&&/rejected/i.test(x.err),'rejected entry cannot be resubmitted');
ok(await ev(()=>S.apr[1].cm.some(c=>c.k=='reject'&&/business expense/.test(c.text))&&S.apl.some(e=>e.rid=='APR-00002'&&e.act=='Rejected')),'reason and audit event retained');
// ---- 7 self-approval
await ev(()=>as('Mo'));
await ev(()=>{const s={k:'inc',date:today(),acct:'cash|'+S.br[0].id,amt:'60',cat:'4310',ref:'M1',desc:'Mo own',ccy:S.base,rate:'',rtype:'inc',br:'all',sid:'bm1'};apw.submit('cb','bm1',s,{rule:'inc',kind:'Cash in',br:S.br[0].id,ccy:S.base,rate:1,amt:60,base:60,date:today(),acct:s.acct,cat:'4310',ref:'M1',desc:'Mo own'})});
x=await ev(()=>apw.approve('APR-00003',1));
ok(!x.ok&&/Another Owner or Manager must approve/.test(x.err),'maker cannot approve own entry: '+x.err);
await ev(()=>as('Omar'));
x=await ev(()=>apw.approve('APR-00003',1));
ok(x.ok&&await jn()==j0+2,'a different approver can approve it '+JSON.stringify(x));
// ---- 8 wrong account classification
await ev(()=>as('Cara'));
await ev(()=>{const mk=(id,cat,rule)=>{const s={k:'inc',date:today(),acct:'cash|'+S.br[0].id,amt:'40',cat,ref:id,desc:id,ccy:S.base,rate:'',rtype:rule,br:'all',sid:id};return apw.submit('cb',id,s,{rule,kind:'Cash in',br:S.br[0].id,ccy:S.base,rate:1,amt:40,base:40,date:today(),acct:s.acct,cat,ref:id,desc:id})};mk('w1','6100','inc');mk('w2','4310','loan')});
await ev(()=>as('Mo'));
x=await ev(()=>apw.approve('APR-00004',1));
ok(!x.ok&&/Income/.test(x.err)&&/6100|Rent/.test(x.err)||/Income account/.test(x.err),'income credited to an expense account is blocked: '+x.err);
x=await ev(()=>apw.approve('APR-00005',1));
ok(!x.ok&&/loan is a liability/.test(x.err),'a loan cannot be booked as income: '+x.err);
ok(await jn()==j0+2,'nothing posted for wrong accounts');
// inactive account
await ev(()=>{S.coaOff={'4310':1}});
x=await ev(()=>{apw.byId('APR-00005').vers[0].s.rtype='inc';apw.byId('APR-00005').meta.rule='inc';return apw.approve('APR-00005',1)});
ok(!x.ok&&/Inactive account 4310/.test(x.err),'inactive account blocked: '+x.err);
await ev(()=>{S.coaOff={}});
// closed day
await ev(()=>{S.closings=[{br:S.br[0].id,acc:'cash|'+S.br[0].id,date:today()}]});
x=await ev(()=>apw.approve('APR-00005',1));
ok(!x.ok&&/closed|loan is a liability/.test(x.err),'closed cash day blocked: '+x.err);
await ev(()=>{S.closings=[]});
// ---- 9 failed posting is atomic
await ev(()=>{apw.byId('APR-00005').vers[0].s.cat='4310';apw.byId('APR-00005').meta.cat='4310';apw.byId('APR-00005').meta.rule='inc'});
await ev(()=>{window.__apwFail=0});
x=await ev(()=>apw.approve('APR-00005',1));
r=await ev(()=>({n:S.j.length,st:S.apr[4].st,pf:S.apr[4].pf}));
ok(!x.ok&&r.n==j0+2&&r.st=='Post failed'&&/simulated|could not/i.test(r.pf||x.err),'failed posting leaves nothing and shows Post failed: '+JSON.stringify(r));
await ev(()=>{window.__apwFail=null});
x=await ev(()=>apw.approve('APR-00005',1));
ok(x.ok&&await jn()==j0+3&&await ev(()=>S.apr[4].st)=='Posted','retry after failure posts exactly once');
// ---- 10 second approval
await ev(()=>{S.apwset={two:1000,solo:0}});
await ev(()=>as('Cara'));
await ev(()=>{const s={k:'inc',date:today(),acct:'cash|'+S.br[0].id,amt:'1500',cat:'4310',ref:'BIG',desc:'Big',ccy:S.base,rate:'',rtype:'inc',br:'all',sid:'big'};apw.submit('cb','big',s,{rule:'inc',kind:'Cash in',br:S.br[0].id,ccy:S.base,rate:1,amt:1500,base:1500,date:today(),acct:s.acct,cat:'4310',ref:'BIG',desc:'Big'})});
await ev(()=>as('Mo'));
x=await ev(()=>apw.approve('APR-00006',1));
ok(x.ok&&x.stage=='first'&&await jn()==j0+3&&await ev(()=>S.apr[5].st)=='Pending second approval','first approval only moves it to second approval, nothing posted');
x=await ev(()=>apw.approve('APR-00006',1));
ok(!x.ok&&/different approver/.test(x.err),'same person cannot give the second approval: '+x.err);
await ev(()=>as('Omar'));
x=await ev(()=>apw.approve('APR-00006',1));
ok(x.ok&&x.stage=='posted'&&await jn()==j0+4,'second approver posts it');

// ---- 12 database confirmation: cloud mode keeps it 'Posting' until the push confirms; storage failure rolls back
await ev(()=>{as('Cara');const s={k:'inc',date:today(),acct:'cash|'+S.br[0].id,amt:'33',cat:'4310',ref:'CL1',desc:'cloud',ccy:S.base,rate:'',rtype:'inc',br:'all',sid:'cl1'};apw.submit('cb','cl1',s,{rule:'inc',kind:'Cash in',br:S.br[0].id,ccy:S.base,rate:1,amt:33,base:33,date:today(),acct:s.acct,cat:'4310',ref:'CL1',desc:'cloud'});as('Omar')});
const nCl=await ev(()=>S.apr.length);
await ev(()=>{window.PB_CLOUD={};window.pbUid=()=>'u1'});
let cx=await ev((id)=>{const o=apw.approve(id,1);return{o,st:apw.byId(id).st,marks:apwMarks()}},'APR-0000'+nCl);
ok(cx.o.ok&&cx.st=='Posting'&&cx.marks.length==1,'cloud mode: posted locally but not "Posted" until the database confirms: '+cx.st);
await ev((id)=>{apwPushed([id],7)},'APR-0000'+nCl);
cx=await ev((id)=>({st:apw.byId(id).st,c:apw.byId(id).conf,last:S.apl[S.apl.length-1].act}),'APR-0000'+nCl);
ok(cx.st=='Posted'&&cx.c.mode=='cloud'&&cx.c.ver==7&&cx.last=='Posting confirmed','confirmed after the cloud push (version 7)');
await ev(()=>{window.PB_CLOUD=null;window.pbUid=null});
await ev(()=>{as('Cara');const s={k:'inc',date:today(),acct:'cash|'+S.br[0].id,amt:'21',cat:'4310',ref:'ST1',desc:'store fail',ccy:S.base,rate:'',rtype:'inc',br:'all',sid:'st1'};apw.submit('cb','st1',s,{rule:'inc',kind:'Cash in',br:S.br[0].id,ccy:S.base,rate:1,amt:21,base:21,date:today(),acct:s.acct,cat:'4310',ref:'ST1',desc:'store fail'});as('Omar')});
const nSt=await ev(()=>S.apr.length),jb=await jn();
await ev(()=>{window.__oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(String(k).startsWith('fd_data'))throw new Error('quota');return window.__oldSet.call(this,k,v)}});
x=await ev((id)=>apw.approve(id,1),'APR-0000'+nSt);
await ev(()=>{Storage.prototype.setItem=window.__oldSet});
ok(!x.ok&&/did not confirm/.test(x.err)&&await jn()==jb&&await ev((id)=>apw.byId(id).st,'APR-0000'+nSt)=='Post failed','if the store does not confirm the write, the posting is rolled back');
// ---- 11 audit chain
let v=await ev(()=>apw.verify());ok(v.ok&&v.n>10,'audit chain verifies ('+v.n+' events)');
await ev(()=>{S.apl[3].note='tampered'});v=await ev(()=>apw.verify());ok(!v.ok&&v.at==4,'tampering is detected at event 4');
ok(await ev(()=>S.apl.every(e=>e.by&&e.t&&e.act)),'every event has actor, time and action');
console.log(f?'t1750 FAIL '+f:'ALL PASS');await b.close()})();
