const {chromium}=require('playwright');let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1200}});const errs=[];p.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERR',e.message)});p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};
const b0=S.br[0].id;S.rates.EUR=S.rates.EUR||{b:1.05,s:1.1};
S.banks=[{id:'k1',name:'Main Bank',no:'111',ccy:S.base,br:b0,od:200},{id:'k2',name:'Euro Bank',no:'222',ccy:'EUR',br:b0,od:0},{id:'k3',name:'Closed Bank',no:'333',ccy:S.base,br:b0,closed:true}];
post({date:today(),br:b0,acc:'cash|'+b0,tt:'Opening',memo:'cap',lines:[['1000',1000,0],['3000',0,1000]]});
post({date:today(),br:b0,acc:'bank|k1',bank:'k1',tt:'Opening',memo:'cap',lines:[['1010',500,0],['3000',0,500]]});
addAcct('4310','Consulting Income');addAcct('6100','Rent Expense');addAcct('2300','Bank Loan');S.coaOff={'6100x':1};
br=b0;view='dtx';go()});await p.waitForTimeout(500);
const ev=(f,a)=>p.evaluate(f,a);
const opts=s=>p.$$eval(s+' option',a=>a.map(o=>o.textContent.trim()));
await ev(()=>cbxAct('inc'));await p.waitForTimeout(300);
let t=await p.innerText('#cbxov');
ok(/Received into/.test(t)&&/Income category/.test(t)&&/Customer/.test(t)&&/Reference/.test(t)&&/Supporting document/.test(t)&&/Branch/.test(t),'cash-in fields present');
let ac=await opts('#cbxf_acct');console.log(ac);
ok(ac.some(x=>/Cash on Hand/.test(x))&&ac.some(x=>/Main Bank/.test(x))&&!ac.some(x=>/Closed Bank/.test(x))&&!ac.some(x=>/Euro Bank/.test(x)),'received-into lists active cash/bank of matching currency only');
ok(ac.every(x=>/·/.test(x)),'options show branch and currency');
let cats=await opts('#cbxf_cat');console.log(cats);
ok(cats.length>=2&&cats.every(x=>/^4\d{3}/.test(x))&&cats.some(x=>/4310/.test(x)),'income category = income accounts only');
ok(!cats.some(x=>/^(1|2|3|6)\d{3}/.test(x))&&!cats.some(x=>/^(4000|4200|4400)/.test(x)),'no cash/bank/liability/equity/expense or system income');
// currency switch to EUR shows euro bank
await p.selectOption('#cbxf_ccy','EUR');await p.waitForTimeout(200);ac=await opts('#cbxf_acct');ok(ac.some(x=>/Euro Bank/.test(x))&&!ac.some(x=>/Main Bank/.test(x)),'currency filter: EUR account only');
ok(await p.locator('#cbxf_rate').count()==1,'exchange rate field for foreign currency');
// post EUR income
await p.selectOption('#cbxf_acct',{label:(await opts('#cbxf_acct')).find(x=>/Euro Bank/.test(x))});await p.fill('#cbxf_amt','100');await p.fill('#cbxf_rate','1.2');await p.selectOption('#cbxf_cat','4310');await p.fill('#cbxf_payee','Acme');await p.fill('#cbxf_ref','R-1');
await p.setInputFiles('#cbxf_file',{name:'r.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64')});await p.waitForTimeout(300);
ok(await p.locator('.cbx-at img').count()==1,'attachment preview shown');
await p.click('[data-cbxs=post]');await p.waitForTimeout(400);
let j=await ev(()=>S.j[S.j.length-1]);console.log(JSON.stringify({l:j.lines,ccy:j.ccy,rate:j.rate,fa:j.fa,att:!!j.att,payee:j.payee}));
ok(j.lines.some(l=>l[0]=='1010'&&l[1]==120)&&j.lines.some(l=>l[0]=='4310'&&l[2]==120)&&j.ccy=='EUR'&&j.fa==100&&j.rate==1.2,'EUR income: Dr bank 120 / Cr 4310 120, original EUR 100 kept');
ok(!!j.att&&j.payee=='Acme','attachment and payee stored');
// handoff for non-income receipt types
await ev(()=>cbxAct('inc'));await p.waitForTimeout(200);await p.selectOption('#cbxf_rtype','cap');await p.waitForTimeout(300);ok(/Owner Capital/.test(await p.innerText('#cbxov')),'owner contribution routed to Owner Capital (equity, not income)');await ev(()=>document.querySelector('[data-cbxx]').click());
await ev(()=>cbxAct('inc'));await p.selectOption('#cbxf_rtype','loan');await p.waitForTimeout(200);cats=await opts('#cbxf_cat');ok(cats.length==1&&/2300/.test(cats[0]),'loan received lists liability accounts only: '+cats);
await p.fill('#cbxf_amt','50');await p.click('[data-cbxs=post]');await p.waitForTimeout(300);j=await ev(()=>S.j[S.j.length-1]);ok(j.lines.some(l=>l[0]=='2300'&&l[2]==50)&&j.tt=='Loan received','loan credits liability, not income');
// cash out
await ev(()=>cbxAct('exp'));await p.waitForTimeout(300);t=await p.innerText('#cbxov');ok(/Paid from/.test(t)&&/Expense category/.test(t)&&/Supplier/.test(t)&&/Supporting document/.test(t)&&/Approval/.test(t),'cash-out fields');
cats=await opts('#cbxf_cat');console.log(cats);ok(cats.every(x=>/^[56]\d{3}/.test(x))&&cats.some(x=>/6100/.test(x))&&!cats.some(x=>/6700/.test(x)),'expense category = expense accounts only');
// cash overdraw blocked
await p.selectOption('#cbxf_acct',{label:(await opts('#cbxf_acct')).find(x=>/Cash on Hand/.test(x))});await p.fill('#cbxf_amt','5000000');await p.click('[data-cbxs=post]');await p.waitForTimeout(300);
ok(/Not enough funds/.test(await p.innerText('#cbxpv'))&&(await ev(()=>S.j[S.j.length-1].lines.some(l=>l[0]=='6100')))==false,'cash cannot go negative');
// bank overdraft limit 200: balance 500
await p.selectOption('#cbxf_acct',{label:(await opts('#cbxf_acct')).find(x=>/Main Bank/.test(x))});await p.fill('#cbxf_amt','650');await p.waitForTimeout(200);ok(/overdraft/i.test(await p.innerText('#cbxpv'))&&!/Not enough/.test(await p.innerText('#cbxpv')),'within overdraft limit: warning only');
await p.fill('#cbxf_amt','800');await p.waitForTimeout(200);await p.click('[data-cbxs=post]');await p.waitForTimeout(300);ok(/Not enough funds/.test(await p.innerText('#cbxpv'))&&/overdraft limit of 200/.test(await p.innerText('#cbxpv')),'beyond overdraft limit blocked');
await p.fill('#cbxf_amt','300');await p.selectOption('#cbxf_cat','6100');await p.fill('#cbxf_payee','Landlord');await p.click('[data-cbxs=post]');await p.waitForTimeout(400);
j=await ev(()=>S.j[S.j.length-1]);ok(j.lines.some(l=>l[0]=='6100'&&l[1]==300)&&j.lines.some(l=>l[0]=='1010'&&l[2]==300),'expense: Dr 6100 / Cr bank');
// ledger integrity
const tb=await ev(()=>{let d=0,c=0;S.j.forEach(e=>e.lines.forEach(l=>{d+=l[1];c+=l[2]}));return [d,c]});ok(Math.abs(tb[0]-tb[1])<.005,'trial balance: debits = credits '+tb);
const pos=await ev(()=>{const P=cpos(S.j);return [P['bank|k1#'+S.base]&&P['bank|k1#'+S.base].b,P['bank|k2#EUR']&&P['bank|k2#EUR'].b]});console.log(pos);ok(pos[0]==200&&pos[1]==100,'account balances per currency: main 500-300=200, EUR 100');
ok(errs.length==0,'no page errors');console.log(f?'FAILED '+f:'ALL PASS');await b.close()})();
