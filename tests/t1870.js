const {chromium}=require('playwright');let bad=0;const ok=(n,c,x)=>{if(!c)bad++;console.log(c?'PASS':'FAIL',n,c?'':JSON.stringify(x))};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:1900}});const er=[];p.on('pageerror',e=>er.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
const E=(f,a)=>p.evaluate(f,a);
await E(()=>{new MutationObserver(()=>document.getElementById('rmd')?.remove()).observe(document.body,{childList:true});document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';S.co={name:'BRIMAPAY Financial Services Inc.'};
window.B=S.br[0].id;S.users=[{name:'Owner One',role:'Owner',br:'All'},{name:'Viewer V',role:'Viewer',br:B}];S.me=0;S.j=[];S.closings=[];addAcct('1050','Clearing');addAcct('2150','Customer Deposits');addAcct('4200','Foreign Exchange Gain/Loss');addAcct('6100','Rent');addAcct('6200','Salaries');addAcct('6300','Utilities');addAcct('2300','Bank Loan');addAcct('4100','Service Fees');
S.banks=[{id:'tdb',name:'TD Bank CAD',ccy:'CAD',br:B,od:500},{id:'usb',name:'Euro Bank',ccy:'EUR',br:B}];
post({date:today(),br:B,acc:'cash|'+B,tt:'Opening',memo:'Opening',lines:[['1000',5000,0],['3000',0,5000]]});
post({date:today(),br:B,acc:'bank|tdb',bank:'tdb',tt:'Opening',memo:'Opening bank',lines:[['1010',100,0],['3000',0,100]]});
view='dtx';go()});
await p.waitForTimeout(300);
const open=async t=>{await E(t=>{mfOpen({type:t,date:today(),...(t=='dp'||t=='wd'?{party:'other'}:{})})},t);await p.waitForTimeout(200)};
const sel=id=>E(id=>[...document.getElementById(id).options].map(o=>o.value+'|'+o.text),id);
// ---- cash in dropdowns
await open('dp');
await p.selectOption('#cx_party','other');await p.waitForTimeout(150);
let acc=await sel('cx_acct');
ok('Received into lists only cash/bank accounts',acc.length>=3&&acc.every(x=>/^(cash|bank)\|/.test(x)),acc);
ok('Received into shows branch and currency',acc.every(x=>/CAD/.test(x))&&acc.some(x=>/Airport/.test(x)),acc);
ok('no income/expense/liability/equity names in Received into',!acc.some(x=>/Rent|Revenue|Salar|Loan|Capital|Fees|Deposits/i.test(x)),acc);
let cat=await sel('cx_cat');
ok('Income category: active income accounts only',cat.length>0&&cat.every(x=>/^4\d{3}\|/.test(x))&&!cat.some(x=>/^4200/.test(x)),cat);
ok('cash/bank never offered as category',!cat.some(x=>/^(1000|1010|1050|1100)/.test(x)),cat);
ok('receipt type list present',(await sel('cx_purpose')).length==5);
for(const [pu,re,nre] of [['owner',/^3\d{3}\|/,/^3100/],['loan',/^2\d{3}\|/,/^(2000|2150)/],['deposit',/^2150\|/,/^$/]]){await p.selectOption('#cx_purpose',pu);await p.waitForTimeout(120);const c=await sel('cx_cat');ok('purpose '+pu+' lists correct accounts',c.length>0&&c.every(x=>re.test(x))&&!c.some(x=>nre.test(x)&&x),c)}
await p.selectOption('#cx_purpose','other');await p.waitForTimeout(120);let co=await sel('cx_cat');ok('other non-income has no income/expense accounts',!co.some(x=>/^[456]\d{3}\|/.test(x)),co);
// ---- earned income validation + posting
await p.selectOption('#cx_purpose','income');await p.waitForTimeout(120);
await p.fill('#cx_amt','250');await p.waitForTimeout(100);
let st=await p.innerText('#cx_side');ok('payee required message',/Enter the customer or source/.test(st),st.slice(0,200));
await p.selectOption('#cx_cat','4100');await p.fill('#cx_payee','Acme Ltd');await p.fill('#cx_ref','REF-77');await p.waitForTimeout(150);
await p.setInputFiles('#cx_file',{name:'slip.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64')});await p.waitForTimeout(250);
ok('attachment shown',await p.locator('.cx-att').count()==1);
const n0=await E(()=>S.j.length);await p.click('#cx_sv');await p.waitForTimeout(400);
let j=await E(()=>S.j.slice(-1)[0]);
ok('earned income posts Dr cash / Cr income 4100',j&&j.lines.some(l=>l[0]=='1000'&&l[1]==250)&&j.lines.some(l=>l[0]=='4100'&&l[2]==250),j);
ok('payee, purpose, attachment, reference stored',j.payee=='Acme Ltd'&&j.purp=='income'&&j.att&&j.att.name=='slip.png'&&j.ref=='REF-77',{p:j.payee,pu:j.purp,r:j.ref});
// ---- loan: never revenue
await E(()=>{MD=null;go()});await open('dp');await p.selectOption('#cx_party','other');await p.selectOption('#cx_purpose','loan');await p.waitForTimeout(100);await p.fill('#cx_amt','1000');await p.fill('#cx_payee','City Bank');await p.waitForTimeout(100);await p.selectOption('#cx_cat','2300');await p.click('#cx_sv');await p.waitForTimeout(400);
j=await E(()=>S.j.slice(-1)[0]);ok('loan credits liability, not income',j.lines.some(l=>l[0]=='2300'&&l[2]==1000)&&!j.lines.some(l=>/^4/.test(l[0])),j.lines);
await E(()=>{MD=null;go()});await open('dp');await p.selectOption('#cx_party','other');await p.selectOption('#cx_purpose','deposit');await p.waitForTimeout(100);await p.fill('#cx_amt','300');await p.click('#cx_sv');await p.waitForTimeout(400);
j=await E(()=>S.j.slice(-1)[0]);ok('customer deposit credits 2150',j.lines.some(l=>l[0]=='2150'&&l[2]==300),j.lines);
await E(()=>{MD=null;go()});await open('dp');await p.selectOption('#cx_party','other');await p.selectOption('#cx_purpose','owner');await p.waitForTimeout(100);await p.fill('#cx_amt','400');await p.click('#cx_sv');await p.waitForTimeout(400);
j=await E(()=>S.j.slice(-1)[0]);ok('owner contribution credits equity 3000',j.lines.some(l=>l[0]=='3000'&&l[2]==400),j.lines);
// ---- cash out
await E(()=>{S.coaOff={'6300':true};MD=null;go()});await open('wd');
acc=await sel('cx_acct');ok('Paid from only cash/bank',acc.length>=3&&acc.every(x=>/^(cash|bank)\|/.test(x)),acc);
cat=await sel('cx_cat');ok('Expense category: active expense accounts only',cat.length>0&&cat.every(x=>/^[56]\d{3}\|/.test(x))&&!cat.some(x=>/^6300/.test(x))&&!cat.some(x=>/^6500/.test(x)),cat);
ok('inactive account hidden',!cat.some(x=>/Utilities/.test(x)),cat);
await p.selectOption('#cx_party','other');await p.waitForTimeout(100);
await p.fill('#cx_amt','80');await p.waitForTimeout(100);st=await p.innerText('#cx_side');ok('payee required (cash out)',/Enter the payee/.test(st),st.slice(0,200));
await p.fill('#cx_payee','Landlord Inc');await p.selectOption('#cx_cat','6100');await p.click('#cx_sv');await p.waitForTimeout(400);
j=await E(()=>S.j.slice(-1)[0]);ok('expense posts Dr 6100 / Cr cash',j.lines.some(l=>l[0]=='6100'&&l[1]==80)&&j.lines.some(l=>l[0]=='1000'&&l[2]==80)&&/Landlord/.test(j.memo),j);
// overdraft rule: TD has 100 + od 500
await E(()=>{MD=null;go()});await open('wd');await p.selectOption('#cx_party','other');await p.selectOption('#cx_acct','bank|tdb');await p.fill('#cx_amt','700');await p.fill('#cx_payee','X');await p.waitForTimeout(150);
st=await p.innerText('#cx_side');ok('overdraft limit exceeded is blocked',/Not enough CAD in TD Bank/.test(st)&&/overdraft limit of 500/.test(st),st.slice(0,400));
await p.fill('#cx_amt','450');await p.waitForTimeout(150);st=await p.innerText('#cx_side');ok('within overdraft shows a warning but is allowed',/uses 350.00 of the 500.00 overdraft/.test(st)&&!/Complete these to post/.test(st),st.slice(0,300));
// cash with no overdraft
await p.selectOption('#cx_acct','cash|'+await E(()=>B));await p.fill('#cx_amt','999999');await p.waitForTimeout(150);st=await p.innerText('#cx_side');ok('insufficient cash blocked',/Not enough CAD in Cash/.test(st),st.slice(0,200));
// ---- transfers
await E(()=>{MD=null;go()});await open('tr');
const f1=await sel('cx_acct'),t1=await sel('cx_to');ok('transfer: from/to are cash or bank only',f1.every(x=>/^(cash|bank)\|/.test(x))&&t1.every(x=>/^(cash|bank)\|/.test(x)),{f1,t1});
ok('transfer: destination excludes source',!t1.some(x=>x.split('|')[0]+'|'+x.split('|')[1]==(f1[0].split('|')[0]+'|'+f1[0].split('|')[1])),{f1,t1});
await p.fill('#cx_amt','100');await p.waitForTimeout(100);
// cross-currency: CAD cash -> USD bank, rate 1.35, fee 2
await p.selectOption('#cx_ccy2','EUR');await p.waitForTimeout(150);await p.selectOption('#cx_to','bank|usb');await p.waitForTimeout(150);
await p.fill('#cx_fee','2');await p.fill('#cx_rate2','1.4');await p.fill('#cx_amt2','70');await p.waitForTimeout(150);
st=await p.innerText('#cx_side');ok('cross-currency shows FX and balanced preview',/realized FX/i.test(st),st.slice(0,500));
await p.click('#cx_sv');await p.waitForTimeout(500);
const tj=await E(()=>S.j.slice(-2));const dr=tj.reduce((s,x)=>s+x.lines.reduce((a,l)=>a+l[1],0),0),cr=tj.reduce((s,x)=>s+x.lines.reduce((a,l)=>a+l[2],0),0);
ok('cross-currency transfer posts 2 balanced legs with fee and FX',tj.length==2&&Math.abs(dr-cr)<.005&&tj.some(x=>x.lines.some(l=>l[0]=='6700'))&&tj.some(x=>x.lines.some(l=>l[0]=='4200')),tj.map(x=>x.lines));
ok('both currency amounts preserved',tj.some(x=>x.ccy=='EUR'&&Math.abs(x.fa-70)<.005)&&tj.some(x=>x.ccy==undefined||x.ccy=='CAD'),tj.map(x=>[x.ccy,x.fa,x.rate]));
// all journals balanced; TB nets to zero
const tb=await E(()=>{let d=0,c=0;S.j.forEach(x=>x.lines.forEach(l=>{d+=l[1];c+=l[2]}));return[d,c]});ok('trial balance: total debits = total credits',Math.abs(tb[0]-tb[1])<.01,tb);
// dynamic CoA + category search + branch line
await E(()=>{S.me=0;S.coaOff={};['6410','6420','6430','6440','6450','6460','6470'].forEach((c,i)=>addAcct(c,'Test Expense '+i));addAcct('4500','Rental Income');MD=null;go()});await open('wd');await p.selectOption('#cx_party','other');await p.waitForTimeout(150);
let cat2=await sel('cx_cat');ok('new CoA expense accounts appear without code changes',cat2.some(x=>/^6430/.test(x)),cat2.length);
ok('category search box appears for long lists',await p.locator('#cx_cq').count()==1);
await p.fill('#cx_cq','Test Expense 3');await p.waitForTimeout(150);cat2=await sel('cx_cat');ok('category search filters the list',cat2.length>=1&&cat2.every(x=>/Test Expense 3/.test(x)||x.split('|')[0]==cat2[0].split('|')[0]),cat2);
ok('account shows branch and currency line',/Branch: .*Currency: CAD/.test(await p.innerText('#cx_form')));
await E(()=>{MD=null;go()});await open('dp');await p.selectOption('#cx_party','other');await p.waitForTimeout(150);cat=await sel('cx_cat');ok('new income account appears in Income category',cat.some(x=>/^4500/.test(x)),cat);
// permissions
await E(()=>{S.me=1;MD=null;go()});
const den=await E(()=>{const n=S.j.length;mfOpen({type:'dp',party:'other'});try{cxSave0(false)}catch(e){}return{n:S.j.length==n,w:canW('cash')}});ok('Viewer cannot post cash entries',den.n&&den.w===false,den);
ok('Viewer has no New entry menu',await E(()=>!/cbx-btn/.test(document.getElementById('m').innerHTML)));
console.log('ERRS',JSON.stringify(er));console.log(bad?'FAILED '+bad:'ALL PASS');await b.close()})();
