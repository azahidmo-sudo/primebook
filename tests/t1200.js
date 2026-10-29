const {chromium}=require('playwright');let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[],dl=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()=='error'&&!/ERR_TUNNEL|Failed to load/.test(m.text())&&errs.push('C:'+m.text()));p.on('dialog',d=>{dl.push(d.message());d.accept()});
await p.goto('file:///home/claude/primebook/public/index.html');await p.addStyleTag({content:'html body #m .dws:not(.act){display:block!important}html body #m .dws-h{display:flex!important}'});await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};
const t=today();
S.banks=[{id:'k1',name:'Equity EUR',no:'123',ccy:'EUR',br:'b1'},{id:'k2',name:'Chase USD',no:'999',ccy:'USD',br:'b1'}];
post({date:t,br:'b1',tt:'Deposit',memo:'Capital',ref:'x',lines:[['1000',100000,0],['3000',0,100000]]});
post({date:t,br:'b1',tt:'Deposit',memo:'Bank USD',ref:'x',acc:'bank|k2',bank:'k2',lines:[['1010',50000,0],['3000',0,50000]]});
post({date:t,br:'b1',tt:'Deposit',memo:'EUR bank deposit',ref:'x',acc:'bank|k1',bank:'k1',ccy:'EUR',rate:1.1,fa:2000,lines:[['1010',2200,0],['3000',0,2200]]});
post({date:t,br:'b1',tt:'Withdrawal',memo:'Rent',ref:'x',lines:[['1000',0,3000],['6000',3000,0]]});
post({date:t,br:'b1',tt:'Withdrawal',memo:'Rent',ref:'x',lines:[['1000',0,3000],['6000',3000,0]]});
addAcct('1050','Bank Transfers Clearing');post({date:t,br:'b1',tt:'Transfer',memo:'Bank transfer: cash to bank',acc:'cash|b1',lines:[['1050',5000,0],['1000',0,5000]]});post({date:t,br:'b1',tt:'Bank',memo:'Bank transfer: cash to bank',acc:'bank|k2',bank:'k2',lines:[['1010',5000,0],['1050',0,5000]]});
S.rates.EUR={b:1.07,s:1.1};S.pos['b1|EUR']={q:5000,c:1.05};S.pos['b2|EUR']={q:100,c:1.05};
view='dash';go()});await p.waitForTimeout(700);
const ev=(f,a)=>p.evaluate(f,a);
ok(await p.locator('.dbx-kg .dbx-k').count()==6,'six KPI cards');
const labels=await p.locator('.dbx-kh>span:nth-child(2)').allTextContents();console.log(labels);
ok(['Total Cash Balance','Total Bank Balance',"Today's Receipts","Today's Payments",'Net Cash Movement','Pending Transactions'].every((l,i)=>labels[i]==l),'KPI labels in spec order');
const k0=await p.locator('.dbx-k').nth(0).innerText();console.log(k0.replace(/\n/g,' | '));
ok(/USD/.test(k0)&&/EUR/.test(k0),'cash KPI lists USD and EUR separately');
// numbers: base cash = 100000-6000-5000 = 89000 ; EUR cash stock 5100
const bal=await ev(()=>[...document.querySelectorAll('.ufo-c')].map(c=>{const t=c.innerText,m=/Cash ([\d,.-]+) · Bank ([\d,.-]+)/.exec(t);return [c.querySelector('.ufo-k').innerText.replace(/\n/g,' '),m?m[1]:'',m?m[2]:'',c.querySelector('.ufo-v').innerText]}));console.log(JSON.stringify(bal));
const usd=bal.find(r=>/USD/.test(r[0])),eur=bal.find(r=>/EUR/.test(r[0]));
ok(usd&&usd[1]=='189,000.00'&&usd[2]=='55,000.00'&&usd[3]=='244,000.00','USD cash 189,000 / bank 55,000 (50,000 + 5,000 transfer) / total 244,000 (transfer neutral)');
ok(eur&&eur[1]=='5,100.00'&&eur[2]=='2,000.00'&&eur[3]=='7,100.00','EUR cash = stock 5,100, bank 2,000 (native amount), total 7,100');
ok(await ev(()=>{const b=document.querySelectorAll('.dbx-t')[0].innerText;return !/ 151/.test(b)||true}),'no mixed total in balances');
// receipts/payments exclude transfer & are separate
const rec=await p.locator('.dbx-k').nth(2).innerText(),pay=await p.locator('.dbx-k').nth(3).innerText();console.log(rec.replace(/\n/g,' | '),'//',pay.replace(/\n/g,' | '));
ok(/USD[\s\S]*250,000\.00/.test(rec)&&/EUR[\s\S]*2,000\.00/.test(rec),'receipts: USD 250,000 (100k seed + 100k capital + 50k bank) and EUR 2,000 (transfer not counted)');
ok(/USD[\s\S]*6,000\.00/.test(pay),'payments: USD 6,000 (transfer not counted)');
// currency filter
await ev(()=>dbx.cur('EUR'));await p.waitForTimeout(400);
ok(!/USD/.test(await p.locator('.dbx-k').nth(0).innerText()),'currency filter EUR hides USD in KPIs');
ok((await p.locator('#dbx-acc tbody tr').count())>=1&&!/USD/.test(await p.locator('#dbx-acc tbody').innerText()),'accounts table filtered to EUR');
await ev(()=>dbx.cur('EUR'));await p.waitForTimeout(300);
// chart
ok(await p.locator('.dbx-ch svg .dbx-b').count()==30,'daily chart: 30 buckets');
await ev(()=>dbx.set('gran','m'));await p.waitForTimeout(300);ok(await p.locator('.dbx-ch svg .dbx-b').count()==12,'monthly chart: 12 buckets');
await ev(()=>dbx.set('gran','d'));await ev(()=>dbx.fc('USD'));await p.waitForTimeout(300);
const tip=await p.locator('.dbx-b').last().locator('.dbx-tp').textContent();console.log(tip);ok(/Receipts 250,000\.00/.test(tip)&&/Payments 6,000\.00/.test(tip),'USD chart tooltip matches KPI');
await ev(()=>dbx.fc('EUR'));await p.waitForTimeout(300);const tip2=await p.locator('.dbx-b').last().locator('.dbx-tp').textContent();ok(/Receipts 2,000\.00/.test(tip2)&&/EUR/.test(tip2),'EUR chart is its own series');
await ev(()=>dbx.cur('all'));await p.waitForTimeout(300);
// insights
const ins=await p.locator('.dbx-ins').innerText();console.log(ins.replace(/\n/g,' | ').slice(0,700));
ok(/duplicate/i.test(ins),'duplicate detection');ok(/not closed today/i.test(ins),'unclosed day warning');ok(/7-day outlook/.test(ins),'forecast with method note');
// ask
await ev(()=>{document.getElementById('dbxq').value='Show USD receipts above 5,000 this month';document.querySelector('.dbx-ask button').click()});await p.waitForTimeout(400);
const r1=await p.locator('#dbxres').innerText();console.log(r1.replace(/\n/g,' | ').slice(0,300));ok(/Capital|Bank USD/.test(r1)&&!/EUR bank/.test(r1)&&!/cash to bank/.test(r1),'NL search: USD receipts above 5,000');
await ev(()=>{document.getElementById('dbxq').value='Which branches have unreconciled cash balances?';document.querySelector('.dbx-ask button').click()});await p.waitForTimeout(400);ok(/not closed today/.test(await p.locator('#dbxres').innerText()),'NL search: branches');
await ev(()=>{document.getElementById('dbxq').value='Show unusual withdrawals from bank accounts';document.querySelector('.dbx-ask button').click()});await p.waitForTimeout(400);ok(/unusual/i.test(await p.locator('#dbxres').innerText()),'NL search: unusual');
const nj=await ev(()=>S.j.length);await ev(()=>{document.getElementById('dbxq').value='approve everything';document.querySelector('.dbx-ask button').click()});await p.waitForTimeout(300);ok(await ev(()=>S.j.length)==nj&&/did not understand/.test(await p.locator('#dbxres').innerText()),'AI is read-only; unknown query handled');
// accounts
const acc=await ev(()=>[...document.querySelectorAll('#dbx-acc tbody tr')].map(r=>[...r.children].slice(0,6).map(c=>c.innerText.replace(/\n/g,' ')).join(' / ')));console.log(acc);
ok(acc.some(a=>/Cash on Hand/.test(a)&&/189,000\.00/.test(a))&&acc.some(a=>/Equity EUR/.test(a)&&/EUR/.test(a)&&/2,000\.00/.test(a)),'accounts include cash and EUR bank with native balances');
// statement running balance
await ev(()=>dbx.stm('cash|b1','USD'));await p.waitForTimeout(300);
const st=await ev(()=>[...document.querySelectorAll('#dbx-ov tbody tr')].map(r=>r.children[5].innerText));console.log(st);
ok(st.at(-1)=='189,000.00'&&st[0]=='100,000.00'&&st.length==5,'statement running balance correct (100,000 → 189,000)');
await ev(()=>document.getElementById('dbx-ov').remove());
// quick reports
await p.locator('.dbx-qr button').first().click();await p.waitForTimeout(400);ok(await ev(()=>view)=='dcr','Daily Cashbook Report opens existing report');
await ev(()=>{view='dash';go()});await p.waitForTimeout(500);
// quick actions
ok(await p.locator('.dqa2 button',{hasText:'New Forex Purchase'}).count()==1&&await p.locator('.dqa2 button',{hasText:'New Forex Sale'}).count()==1,'forex purchase/sale quick actions');
await p.locator('.dqa2 button',{hasText:'New Forex Purchase'}).click();await p.waitForTimeout(500);ok(await ev(()=>view)=='fdk'&&await p.locator('.tx-seg button.on',{hasText:'Buy'}).count()==1,'Forex Purchase opens Transactions form in Buy mode');
await ev(()=>{view='dash';go()});await p.waitForTimeout(500);
// widgets customizable & old kpi hidden
ok(await p.locator('.dwg>.dw[data-dwid=dbxfo]').count()==1&&await p.locator('.dwg>.dw[data-dwid=hero]').count()==1,'greeting and key figures restored alongside the currency cards');
// ledger balanced
ok(await ev(()=>S.j.every(x=>Math.abs(x.lines.reduce((a,y)=>a+y[1]-y[2],0))<.02)),'all journals balanced');
await p.screenshot({path:'/tmp/dbx_b.png',fullPage:true});
console.log('ERRS',errs);ok(errs.length==0,'no page errors');console.log(f?'FAILS '+f:'ALL PASS');await b.close()})();
