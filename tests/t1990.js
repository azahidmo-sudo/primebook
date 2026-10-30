const {chromium}=require('playwright');let f=0;const ok=(n,c)=>{console.log(c?'ok':'FAIL',n);if(!c)f++};
const D1='2026-10-27',D2='2026-10-28';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1100}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{errs.push('DIALOG '+d.message().slice(0,120));d.accept()});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';S.co={name:'X'};window.B=S.br[0].id;S.users=[{name:'Z',role:'Owner',br:'All'},{name:'M',role:'Manager',br:'All'}];S.me=0;S.dwl={};S.bdays=[];S.j=[];S.closings=[];
window.D1='2026-10-27';window.D2='2026-10-28';
post({date:D1,br:B,acc:'cash|'+B,tt:'Receipt',memo:'Seed cash',vno:'RV-1',by:'Z',lines:[['1000',1000,0],['3000',0,1000]]});
view='dcw';go()});await p.waitForTimeout(400);
const T=s=>p.evaluate(s=>document.querySelector('#m').innerText,s);
ok('nav renamed',await p.evaluate(()=>[...document.querySelectorAll('nav [data-v]')].some(x=>/daily closing/i.test(x.textContent)&&x.dataset.v=='dcw')&&![...document.querySelectorAll('nav [data-v]')].some(x=>x.dataset.v=='fdk')));
// select branch/date
await p.fill('input[type=date][aria-label="Business date"]',D1);await p.dispatchEvent('input[type=date][aria-label="Business date"]','change');await p.waitForTimeout(300);
ok('not open shows guidance',/No business day is open/.test(await T()));
// posting still allowed for legacy (no days yet)
// open day D1
await p.click('.dcw-mini:not([disabled])');await p.waitForTimeout(300);
ok('step2 open',/Open business day/.test(await T()));
await p.click('.dcw-b.pri:has-text("Open day")');await p.waitForTimeout(400);
let r=await p.evaluate(()=>({s:S.bdays[0]&&S.bdays[0].status,o:S.bdays[0]&&JSON.stringify(S.bdays[0].opening)}));
ok('day opened',r.s=='Open');
// duplicate prevented
const dup=await p.evaluate(()=>{dcw.open();return S.bdays.length});ok('no duplicate',dup==1);
// posting blocked on a date that is not opened (D2) via guard
ok('posting blocked on unopened day',await p.evaluate(()=>blockedDay(B,D2)===true));
ok('posting allowed on open day',await p.evaluate(()=>!blockedDay(B,D1)));
// post a txn on D1 and a USD one
await p.evaluate(()=>{post({date:D1,br:B,acc:'cash|'+B,tt:'Payment',memo:'Rent',vno:'PV-1',by:'Z',lines:[['6000',200,0],['1000',0,200]]});post({date:D1,br:B,acc:'cash|'+B,tt:'Receipt',memo:'Fx sale',vno:'RV-2',by:'Z',ccy:'USD',rate:1.35,lines:[['1000',135,0],['3000',0,135]]});go()});
await p.evaluate(()=>dcw.step(3));await p.waitForTimeout(300);
ok('step3 lists transactions',/RV-2/.test(await T())&&/PV-1/.test(await T()));
ok('8 categories',(await p.$$('.dcw-cat')).length==8);
// reconcile
await p.evaluate(()=>dcw.step(4));await p.waitForTimeout(300);
let rows=await p.$$('#m .dcw-t tbody tr');ok('rows per account/currency (CAD+USD)',rows.length==2);
// expected CAD 1000-200=800 ; USD 100
ok('expected shows 800.00',/800\.00/.test(await T()));
// try submitting early
await p.evaluate(()=>{dcw.step(5)});await p.waitForTimeout(300);
ok('submit disabled when unreconciled',await p.evaluate(()=>document.querySelector('.dcw-ft .dcw-b.pri').disabled));
await p.evaluate(()=>dcw.step(4));await p.waitForTimeout(200);
const ins=await p.$$('#m input.dcw-in:not(.w)');
await ins[0].fill('795');await ins[0].dispatchEvent('change');await p.waitForTimeout(300);
ok('variance -5 short flagged',/Short/.test(await T()));
await p.evaluate(()=>dcw.step(5));await p.waitForTimeout(300);
ok('blocked: missing reason',/needs an explanation|need an explanation/.test(await T()));
await p.evaluate(()=>dcw.step(4));await p.waitForTimeout(200);
const re=await p.$$('#m input.dcw-in.w');await re[0].fill('Counting error on coins');await re[0].dispatchEvent('change');await p.waitForTimeout(200);
const ins2=await p.$$('#m input.dcw-in:not(.w)');await ins2[1].fill('100');await ins2[1].dispatchEvent('change');await p.waitForTimeout(300);
await p.evaluate(()=>dcw.step(5));await p.waitForTimeout(300);
ok('submit enabled',await p.evaluate(()=>!document.querySelector('.dcw-ft .dcw-b.pri').disabled));
ok('no ledger adjustment for variance',await p.evaluate(()=>S.j.every(x=>!/over\/short/i.test(x.memo||''))));
await p.click('.dcw-ft .dcw-b.pri');await p.waitForTimeout(400);
ok('submitted',await p.evaluate(()=>S.bdays[0].status=='Submitted'&&S.bdays[0].submittedBy=='Z'));
ok('posting blocked after submit',await p.evaluate(()=>blockedDay(B,D1)===true));
// preparer cannot approve own (2 managers exist)
await p.evaluate(()=>dcw.approve());await p.waitForTimeout(200);
ok('segregation of duties',await p.evaluate(()=>S.bdays[0].status=='Submitted')&&/preparer cannot approve/.test(await T()));
// switch to manager M
await p.evaluate(()=>{S.me=1;go()});await p.waitForTimeout(300);
await p.evaluate(()=>dcw.approve());await p.waitForTimeout(200);
ok('variance must be approved',await p.evaluate(()=>S.bdays[0].status=='Submitted'));
await p.evaluate(()=>{const c=document.querySelector('.dcw-chk input');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}))});await p.waitForTimeout(200);
await p.evaluate(()=>dcw.approve());await p.waitForTimeout(300);
r=await p.evaluate(()=>({s:S.bdays[0].status,by:S.bdays[0].approvedBy,h:!!S.bdays[0].hash,f:!!S.bdays[0].final}));
ok('approved and locked',r.s=='Locked'&&r.by=='M'&&r.h&&r.f);
ok('report shown',/Daily Closing Report/.test(await T()));
// next day opens with counted balances: CAD 795, USD 100
await p.evaluate(()=>dcw.sel('date',D2));await p.waitForTimeout(300);
await p.evaluate(()=>dcw.step(2));await p.waitForTimeout(300);
ok('next day opening = approved counted close',/795\.00/.test(await T()));
await p.evaluate(()=>{S.me=0;go()});await p.waitForTimeout(200);
await p.evaluate(()=>dcw.open());await p.waitForTimeout(300);
ok('D2 opened',await p.evaluate(()=>S.bdays.length==2&&S.bdays[1].opening&&Object.values(S.bdays[1].opening).some(o=>o.amt==795)));
// locked day cannot be reopened while later day exists; owner reopen needs reason
await p.evaluate(()=>{dcw.sel('date',D1)});await p.waitForTimeout(200);
await p.evaluate(()=>{dcw.exc('');dcw.reopen()});await p.waitForTimeout(200);
ok('reopen needs reason',await p.evaluate(()=>S.bdays[0].status=='Locked'));
await p.evaluate(()=>{dcw.exc('Correct a missed entry here');dcw.reopen()});await p.waitForTimeout(200);
ok('reopen blocked while later day exists',await p.evaluate(()=>S.bdays[0].status=='Locked'));
// dashboard widget under Transactions
await p.evaluate(()=>{S.dwl={};view='dash';go()});await p.waitForTimeout(500);
await p.click('.dsv-i[data-dws=tx]');await p.waitForTimeout(300);
ok('dashboard Transactions has Daily Closing',/Daily Closing/.test(await T()));
ok('today close widget hidden (no duplicate)',!(await p.$('.dxd')) || !(await p.$eval('.dxd',e=>e.offsetParent!==null)));
await p.click('.dcw-dash .dcw-b.pri');await p.waitForTimeout(300);
ok('widget opens page',await p.evaluate(()=>view=='dcw'));
await p.setViewportSize({width:390,height:800});await p.waitForTimeout(300);
console.log(await p.evaluate(()=>{const w=innerWidth,o=[];document.querySelectorAll('#m *, nav, .top').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>w+2&&r.width>0&&!e.closest('.dcw-w'))o.push(e.tagName+'.'+String(e.className).slice(0,30)+' '+Math.round(r.right))});return [document.documentElement.scrollWidth,innerWidth,o.slice(0,6)]}));
ok('mobile no h-scroll',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2));
ok('no errors',errs.length==0);if(errs.length)console.log(errs);
await b.close();process.exit(f?1:0)})();
