const {chromium}=require('playwright');let bad=0;const ok=(n,c,x)=>{if(!c)bad++;console.log(c?'PASS':'FAIL',n,c?'':JSON.stringify(x))};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:2200}});const er=[];p.on('pageerror',e=>er.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
const E=(f,a)=>p.evaluate(f,a);const row=async x=>{await E(()=>{window.__cdrx={};MD=null;go()});await p.waitForTimeout(200);await p.click('tr[data-cdrx]:has-text("'+x+'")');await p.waitForTimeout(250)};const near=(a,b)=>Math.abs(a-b)<.01;
await E(()=>{new MutationObserver(()=>document.getElementById('rmd')?.remove()).observe(document.body,{childList:true});document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';S.co={name:'BRIMAPAY Financial Services Inc.'};
window.B=S.br[0].id;S.users=[{name:'Owner One',role:'Owner',br:'All'},{name:'Cash Cathy',role:'Cashier',br:B},{name:'Manny Manager',role:'Manager',br:'All'},{name:'Viv Viewer',role:'Viewer',br:B}];S.me=0;S.j=[];S.closings=[];S.revq=[];addAcct('1050','Clearing');addAcct('4100','Service Fees');addAcct('6100','Rent');addAcct('6700','Bank Charges');addAcct('4200','FX');
S.banks=[{id:'tdb',name:'TD Bank CAD',ccy:'CAD',br:B},{id:'eub',name:'Euro Bank',ccy:'EUR',br:B}];
const d=today();window.__d=d;
post({date:d,br:B,acc:'cash|'+B,tt:'Opening',memo:'Opening',lines:[['1000',5000,0],['3000',0,5000]],by:'Owner One'});
post({date:d,br:B,acc:'cash|'+B,tt:'Deposit',memo:'Received from Acme',payee:'Acme',purp:'income',ref:'R1',vno:'RV-0001',by:'Cash Cathy',att:{name:'slip.png',type:'image/png',size:90,data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='},lines:[['1000',900,0],['4100',0,900]]});
post({date:d,br:B,acc:'cash|'+B,tt:'Withdrawal',memo:'Paid to Landlord',payee:'Landlord',purp:'expense',vno:'PV-0001',by:'Cash Cathy',lines:[['6100',300,0],['1000',0,300]]});
post({date:d,br:B,acc:'cash|'+B,tt:'Transfer',memo:'Bank transfer: Cash to TD',vno:'TV-0001',by:'Owner One',lines:[['1050',1000,0],['1000',0,1000]]});
post({date:d,br:B,acc:'bank|tdb',bank:'tdb',tt:'Bank',memo:'Bank transfer: Cash to TD',vno:'TV-0001',by:'Owner One',lines:[['1010',1000,0],['1050',0,1000]]});
post({date:d,br:B,acc:'bank|eub',bank:'eub',tt:'Bank',memo:'Euro receipt',ccy:'EUR',rate:1.5,fa:200,payee:'EU Client',purp:'income',vno:'RV-0002',by:'Owner One',lines:[['1010',300,0],['4100',0,300]]});
const a=accts().find(x=>x.id=='cash|'+B);S.closings.push({id:'c1',date:d,br:B,acc:a.id,accLabel:a.label,by:'Owner One',at:'18:00',notes:'',base:-50,rows:[{ccy:'CAD',open:5000,i:900,o:1300,exp:4600,counted:4550,variance:-50,reason:'x',rnote:''}],counts:{c:{}}});
S.cpd=S.cpd||{};window.__tb=()=>{let dr=0,cr=0;S.j.forEach(x=>x.lines.forEach(l=>{dr+=l[1];cr+=l[2]}));return[dr,cr]};
window.__gl=c=>S.j.reduce((s,x)=>s+x.lines.filter(l=>String(l[0])==c).reduce((a,l)=>a+l[1]-l[2],0),0);
view='dtx';window.__dxt='reg';go()});
await p.waitForTimeout(400);
let t=await p.innerText('#m');
ok('header: Cash in / Cash out / Transfer buttons',await p.locator('.dxn-g button').count()==3);
ok('tabs include Movement history',/Movement history/.test(t));
ok('daily position card present',/Daily position by account/i.test(t)&&/Expected book balance/i.test(t)&&/Physical count/i.test(t)&&/Closing variance/i.test(t),t.slice(0,200));
const pos=await E(()=>dtxPos(today(),'').map(r=>({a:r.a.label,c:r.ccy,o:r.open,i:r.i,u:r.o,xi:r.xi,xo:r.xo,e:r.exp,cn:r.counted,v:r.vr})));
const cash=pos.find(r=>/Cash on Hand/.test(r.a)&&r.c=='CAD'&&r.o==5000),td=pos.find(r=>/TD Bank/.test(r.a)),eu=pos.find(r=>r.c=='EUR');
ok('cash row: opening 5000, in 900, out 300, transfers out 1000',cash&&near(cash.o,5000)&&near(cash.i,900)&&near(cash.u,300)&&near(cash.xo,1000)&&near(cash.xi,0),cash);
ok('cash expected 4600, counted 4550, variance -50',near(cash.e,4600)&&near(cash.cn,4550)&&near(cash.v,-50),cash);
ok('bank row shows transfer in 1000',td&&near(td.xi,1000)&&near(td.e,1000),td);
ok('EUR kept in its own currency (200)',eu&&near(eu.i,200)&&near(eu.e,200),eu);
ok('separate totals per currency',/Total CAD/.test(t)&&/Total EUR/.test(t),t.slice(0,100));
// detail
await p.click('tr[data-cdrx]:has-text("Received from Acme")');await p.waitForTimeout(250);
t=await p.innerText('#m');
ok('detail: audit trail, details, journal',/audit trail/i.test(t)&&/entered by/i.test(t)&&/Cash Cathy/.test(t)&&/4100/.test(t)&&/Acme/.test(t),t.slice(-600));
ok('detail: receipt preview + voucher + reverse buttons for Owner',await p.locator('[data-dxu^="prev:"]').count()==1&&await p.locator('[data-dxu^="vch:"]').count()==1&&await p.locator('[data-dxu^="rev:"]').count()==1);
await p.click('[data-dxu^="prev:"]');await p.waitForTimeout(250);
ok('receipt preview shows image',await p.locator('.dxm img[alt=Receipt]').count()==1);
await row('Received from Acme');
await p.click('[data-dxu^="vch:"]');await p.waitForTimeout(250);
ok('voucher printable view',/receipt voucher/i.test(await p.innerText('.cxm'))&&/RV-0001/.test(await p.innerText('.cxm')));
// reversal of the income entry
const before=await E(()=>({n:S.j.length,gl4100:__gl('4100'),gl1000:__gl('1000')}));
await row('Received from Acme');
await p.click('[data-dxu^="rev:"]');await p.waitForTimeout(250);
await p.click('.dxm .plf');await p.waitForTimeout(150);
ok('reason required',/reason of at least 5/.test(await p.innerText('#dxm_e')));
await p.fill('#dxm_r','Entered twice');await p.click('.dxm .plf');await p.waitForTimeout(400);
const after=await E(()=>({n:S.j.length,gl4100:__gl('4100'),gl1000:__gl('1000'),orig:S.j.find(x=>x.vno=='RV-0001'),rv:S.j.filter(x=>x.rev),tb:__tb()}));
ok('reversal posted as a new entry (original not edited)',after.n==before.n+1&&after.orig.revd==1&&after.orig.lines[0][1]==900&&after.rv.length==1,{n:after.n,rv:after.rv.length});
ok('GL effect: income -900 and cash -900 reversed',near(after.gl4100,before.gl4100+900)&&near(after.gl1000,before.gl1000-900),after);
ok('reason recorded on original and reversal',after.orig.revWhy=='Entered twice'&&after.rv[0].revWhy=='Entered twice');
ok('trial balance still balances',near(after.tb[0],after.tb[1]),after.tb);
t=await p.innerText('#m');
ok('row now shows Reversed',/Reversed/.test(t));
ok('audit log has reversal',await E(()=>(S.alog||[]).some(x=>x.k=='Reversal'&&/Entered twice/.test(x.m))));
// cannot reverse twice
await row('Received from Acme');
ok('no reverse button on reversed entry',await p.locator('[data-dxu^="rev:"]').count()==0&&/Already reversed|Reversed/.test(await p.innerText('.dxu-ac')));
// transfer reversal (2 legs)
const tb0=await E(()=>({n:S.j.length,g1050:__gl('1050'),g1010:__gl('1010'),g1000:__gl('1000')}));
await row('Bank transfer: Cash to TD');
await p.click('[data-dxu^="rev:"]');await p.waitForTimeout(250);await p.fill('#dxm_r','Wrong account chosen');await p.click('.dxm .plf');await p.waitForTimeout(400);
const tb1=await E(()=>({n:S.j.length,g1050:__gl('1050'),g1010:__gl('1010'),g1000:__gl('1000'),legs:S.j.filter(x=>x.vno=='TV-0001').map(x=>!!x.revd),tb:__tb()}));
ok('both transfer legs reversed together',tb1.legs.length==2&&tb1.legs.every(Boolean)&&tb1.n==tb0.n+2,tb1);
ok('clearing nets to zero, bank & cash restored',near(tb1.g1050,0)&&near(tb1.g1010,300)&&near(tb1.g1000,tb0.g1000+1000),{tb0,tb1});
ok('trial balance balances after transfer reversal',near(tb1.tb[0],tb1.tb[1]));
// Cashier: request only
await E(()=>{S.me=1});await row('Paid to Landlord');
ok('Cashier sees Request reversal, not Reverse',await p.locator('[data-dxu^="req:"]').count()==1&&await p.locator('[data-dxu^="rev:"]').count()==0);
await p.click('[data-dxu^="req:"]');await p.waitForTimeout(250);await p.fill('#dxm_r','Wrong amount');await p.click('.dxm .plf');await p.waitForTimeout(300);
const n2=await E(()=>({q:S.revq.length,r:S.revq[0]&&S.revq[0].st,rv:S.j.filter(x=>x.rev).length}));
ok('request stored pending; nothing posted',n2.q==1&&n2.r=='pending'&&n2.rv==3,n2);
await row('Paid to Landlord');
ok('Cashier cannot approve own request',await p.locator('[data-dxu^="rqa:"]').count()==0);
// Cashier direct call is denied
const den=await E(()=>{const n=S.j.length;document.querySelector('body').insertAdjacentHTML('beforeend','<i id="fk" data-dxu="rev:'+S.j.find(x=>x.vno=="PV-0001").id+'"></i>');document.getElementById('fk').click();return S.j.length==n&&!MD});ok('Cashier cannot reverse directly',den);
// Manager approves
await E(()=>{S.me=2});await row('Paid to Landlord');
ok('Manager sees approve/decline',await p.locator('[data-dxu^="rqa:"]').count()==1&&await p.locator('[data-dxu^="rqd:"]').count()==1);
await p.click('[data-dxu^="rqa:"]');await p.waitForTimeout(400);
const n3=await E(()=>({st:S.revq[0].st,ap:S.revq[0].apprBy,orig:S.j.find(x=>x.vno=='PV-0001').revd,gl6100:__gl('6100'),tb:__tb()}));
ok('approved request executes reversal',n3.st=='approved'&&n3.ap=='Manny Manager'&&n3.orig==1&&near(n3.gl6100,0)&&near(n3.tb[0],n3.tb[1]),n3);
// closed day blocks reversal
await E(()=>{S.me=0;const x=S.j.find(z=>z.vno=='RV-0002');S.cpd[B+'|'+today()]={lock:1};});await row('Euro receipt');await p.click('[data-dxu^="rev:"]');await p.waitForTimeout(250);await p.fill('#dxm_r','Test locked day');await p.click('.dxm .plf');await p.waitForTimeout(300);
ok('locked day blocks reversal with a helpful message',/closed|Reopen/i.test(await p.innerText('#dxm_e'))&&await E(()=>!S.j.find(x=>x.vno=='RV-0002').revd),await p.innerText('#dxm_e'));
await E(()=>{S.cpd={};MD=null;go()});
// Movement history
await E(()=>{window.__dxt='his';go()});await p.waitForTimeout(300);
t=await p.innerText('#m');
ok('history lists movements with status and filters',/movement history/i.test(t)&&/status/i.test(t)&&/Reversed/.test(t)&&/Acme/.test(t)&&/Landlord/.test(t),t.slice(0,300));
await p.selectOption('.cdr-sel label:has-text("Status") select','Reversed');await p.waitForTimeout(250);
const hs=await E(()=>window.__dxhRows.map(r=>r.st));ok('status filter works',hs.length>0&&hs.every(x=>x=='Reversed'),hs);
await p.selectOption('.cdr-sel label:has-text("Status") select','');await p.waitForTimeout(200);
await p.fill('#dxhq','Euro');await p.waitForTimeout(300);const hr=await E(()=>window.__dxhRows.map(r=>r.e.vno));ok('text search works',hr.length==1&&hr[0]=='RV-0002',hr);
await p.fill('#dxhq','');await p.waitForTimeout(300);
await p.click('tr[data-dxh]:has-text("Acme") >> nth=0');await p.waitForTimeout(250);ok('history row expands with audit trail',/audit trail/i.test(await p.innerText('#m')));
const csv=await E(()=>{let t='';const o=URL.createObjectURL;URL.createObjectURL=b=>{b.text().then(x=>window.__csv=x);return o.call(URL,b)};dxhCsv();return 1});await p.waitForTimeout(300);
const ct=await E(()=>window.__csv||'');ok('CSV export includes voucher, status, user',/RV-0001/.test(ct)&&/Reversed/.test(ct)&&/Cash Cathy/.test(ct),ct.slice(0,200));
// Viewer: no actions
await E(()=>{S.me=3;window.__dxt='reg';MD=null;go()});await p.waitForTimeout(300);
ok('Viewer cannot open Daily transactions (redirected)',await E(()=>view!='dtx'&&!document.querySelector('.dxn-g')));
await E(()=>{S.me=0;view='dtx';window.__dxt='reg';window.__cdrx={};go()});await p.waitForTimeout(400);
await p.screenshot({path:'dtx_reg.png',fullPage:true});
console.log('ERRS',JSON.stringify(er));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close()})();
