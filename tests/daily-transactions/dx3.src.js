/*DX3*/(function(){
'use strict';
/* =====================================================================
   Daily transactions – cash desk engine (BRIMAPAY)
   - Account lists come from the Chart of Accounts (CH, S.par, S.acx) and the
     cash/bank register (accts()); nothing is hard-coded except the system
     clearing/FX accounts the ledger itself needs.
   - Every posting goes through post(); a multi-entry transfer is atomic
     (rolled back if any leg fails).
   - Posted entries are never edited: reversal (and reverse-and-correct) only.
   ===================================================================== */
const $=id=>document.getElementById(id);
const A=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const R2=v=>Math.round(((+v||0)+Number.EPSILON)*100)/100;
const RT=v=>+(+v||0).toFixed(8);
const mf=n=>Number(n||0).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
const sm=n=>(n<-.004?'−':'')+mf(Math.abs(n));
const rf=n=>Number(n||0).toLocaleString('en-CA',{maximumFractionDigits:6});
const toast=(m,bad)=>{try{window.rpToast?rpToast(m,bad):alert(m)}catch(e){}};
const BASE=()=>S.base||'CAD';
const now=()=>new Date().toISOString();
const stamp=t=>{if(!t)return'';const d=new Date(t);if(isNaN(d))return String(t);const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())};
const ME=()=>me()||{};
const role=()=>ME().role||'';
const uname=()=>ME().name||'';
const isAppr=()=>['Owner','Manager'].includes(role());
const canRev=()=>['Owner','Manager','Accountant'].includes(role());
const canPost=()=>{try{return canW('cash')}catch(e){return false}};
const logA=(k,m)=>{try{if(window.alog)alog(k,m)}catch(e){}};
const midR=c=>c==BASE()?1:(typeof mid=='function'?+mid(c)||0:0);
const W=window.__dx3=window.__dx3||{acc:'',f:{q:'',per:'day',typ:'',st:'',from:'',to:''},d:''};
const bizDate=()=>{const e=$('twdate');return(view=='dtx'&&e&&e.value)||W.d||today()};
const CLR='1050',RFX='4220',FEE='6700';
const SYS_CAT=['1050','4200','4210','4220','6500'];          // system-managed, never offered as a category
const CFG=()=>{const c=S.dxc=S.dxc||{};c.acc=c.acc||{};c.cat=c.cat||{};return c};
const thr=()=>+((S.cbk||{}).thr)||0;
const ICO={in:'<path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/>',out:'<path d="M12 20V8m0 0L8 12m4-4l4 4M5 4h14"/>',xfr:'<path d="M4 8h14m0 0l-4-4m4 4l-4 4M20 16H6m0 0l4-4m-4 4l4 4"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',chev:'<path d="M6 9l6 6 6-6"/>',srch:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',ok:'<path d="M5 12l5 5 9-10"/>',warn:'<path d="M12 4l9 16H3zM12 10v4M12 17v.5"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',bank:'<path d="M3 10l9-6 9 6zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',ceq:'<path d="M4 7h16v10H4zM8 7V5h8v2M9 12h6"/>',clip:'<path d="M20 12l-8 8a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8"/>',dl:'<path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>',undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>'};
const ic=(k,s,c)=>`<svg viewBox="0 0 24 24" width="${s||16}" height="${s||16}" class="${c||''}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]||''}</svg>`;

/* ---------------- Chart of Accounts helpers ---------------- */
const gDef=c=>{const n=+c;return n<1100?'Cash & Bank':n<1200?'Foreign Currency Stock':n<1300?'Receivables':n<1500?'Inventory':n<1700?'Other Current Assets':n<2000?'Fixed Assets':n<2100?'Payables':n<2500?'Other Current Liabilities':n<3000?'Long-term Liabilities':n<3900?"Owner's Equity":n<4000?'Retained Earnings':n<4100?'Operating Income':n<4300?'Forex Income':n<5000?'Other Income':n<6000?'Cost of Sales':n<7000?'Operating Expenses':'Other Expenses'};
const ax=c=>(S.acx&&S.acx[c])||{};
const grpOf=(c,g)=>{c=String(c);g=g||0;if(ax(c).grp)return ax(c).grp;const p=par(c);return p&&g<20?grpOf(p,g+1):gDef(c)};
const curOf=(c,g)=>{c=String(c);g=g||0;if(ax(c).cur)return ax(c).cur;const p=par(c);return p&&g<20?curOf(p,g+1):(['1000','1010','1100','1200','2000','4200'].includes(c)?'*':'base')};
const under=(c,root)=>{c=String(c);let p=par(c),g=0;while(p&&g++<20){if(String(p)==root)return true;p=par(p)}return false};
const catOff=c=>!!(CFG().cat[c]||{}).off;
const nm=c=>c+' · '+(CH[c]||'Account '+c);

/* ---------------- cash-desk accounts (Received into / Paid from / transfers) ---------------- */
function liq(){const C=CFG().acc,out=[],B=BASE();
 accts().forEach(a=>{const gl=String(a.gl),bk=a.bank?(S.banks||[]).find(k=>k.id==a.bank):null;
  const ccy=a.sub?(a.ccy=='*'?'*':(a.ccy||B)):a.kind=='Bank'?(a.ccy||B):B;
  out.push({id:a.id,gl,kind:a.kind=='Bank'?'bank':'cash',name:a.sub?(CH[a.sub]||a.label):a.kind=='Bank'?(bk?bk.name:a.label):'Cash – '+bn(a.br),no:a.sub?a.sub:(a.no||''),br:(a.shared&&a.kind=='Bank')?'':a.br,ccy,sub:a.sub||'',bank:a.bank||'',sysOff:!!a.off})});
 Object.keys(CH).forEach(c=>{c=String(c);if(acType(c)!='Assets'||grpOf(c)!='Cash & Bank'||['1000','1010',CLR].includes(c)||under(c,'1000')||under(c,'1010'))return;
  if(Object.keys(CH).some(k=>String(par(k))==c))return;const cu=curOf(c);out.push({id:'coa|'+c,gl:c,kind:'ceq',name:CH[c],no:c,br:'',ccy:cu=='base'?B:cu,ceq:1})});
 out.forEach(a=>{const o=C[a.id]||{};a.typeOk=acType(a.gl)=='Assets'&&grpOf(a.gl)=='Cash & Bank';a.off=!!(a.sysOff||o.off||(a.ceq&&!o.ceq)||!a.typeOk);a.odl=a.kind=='bank'?Math.max(0,+o.odl||0):0;
  a.why=a.sysOff?'Bank account is inactive':!a.typeOk?'Not a cash or bank asset in the Chart of Accounts':o.off?'Turned off for the cash desk':(a.ceq&&!o.ceq)?'Cash equivalent not approved for the cash desk':''});
 return out}
const canSee=a=>{const u=ME().br;return!u||u=='All'||!a.br||a.br==u};
const inScope=a=>br=='all'||!a.br||a.br==br;
const elig=()=>liq().filter(a=>!a.off&&canSee(a));
const accById=id=>liq().find(a=>a.id==id);
const kindL=k=>k=='bank'?'Bank':k=='ceq'?'Cash equivalent':'Cash';
const brL=a=>a.br?bn(a.br):'All branches';

/* ---------------- ledger index: one row per liquidity line ---------------- */
function ledger(){const L=liq(),by={};L.forEach(a=>by[a.id]=a);const B=BASE(),R=[];
 S.j.forEach(x=>{x.lines.forEach((y,i)=>{const c=String(y[0]);let aid=null;const ac=String(x.acc||'');
  if(c=='1000')aid=(ac.startsWith('cash|')||(ac.startsWith('sub|')&&by[ac]&&by[ac].gl=='1000'))?ac:'cash|'+x.br;
  else if(c=='1010')aid=(ac.startsWith('bank|')||(ac.startsWith('sub|')&&by[ac]&&by[ac].gl=='1010'))?ac:'bank|'+(x.bank||ac.replace('bank|',''));
  else if(by['coa|'+c])aid='coa|'+c;
  if(!aid)return;const b=(+y[1]||0)-(+y[2]||0),cc=x.ccy&&x.ccy!=B?x.ccy:B,r=cc==B?1:(+x.rate||1);R.push({x,aid,ccy:cc,b,n:b/r,li:i})})});
 return{R,by}}
const dccy=a=>!a||a.ccy=='*'?BASE():a.ccy;
const valIn=(r,a)=>{const c=dccy(a);return c==BASE()?r.b:(r.ccy==c?r.n:r.b/(midR(c)||1))};
const LIQSET=()=>{const s=new Set(['1000','1010',CLR]);liq().forEach(a=>s.add(a.gl));return s};
function isXfr(x,ls){if(x.dxk=='xfr')return true;if(x.dxk)return false;return x.lines.every(y=>ls.has(String(y[0])))&&x.lines.some(y=>String(y[0])!=CLR)}
function balOf(a,ccy,upto,L){L=L||ledger();let b=0;L.R.forEach(r=>{if(r.aid!=a.id||(upto&&r.x.date>upto))return;if(a.ccy=='*'){if(r.ccy==ccy)b+=ccy==BASE()?r.b:r.n}else b+=valIn(r,a)});return R2(b)}
function carry(a,ccy,upto,L){if(ccy==BASE())return 1;L=L||ledger();let b=0,n=0;L.R.forEach(r=>{if(r.aid!=a.id||r.ccy!=ccy||(upto&&r.x.date>upto))return;b+=r.b;n+=r.n});return n>.0001&&b>0?RT(b/n):RT(midR(ccy)||1)}
const Q=()=>S.dxq=S.dxq||[];
const qOut=(aid,ccy,skip)=>R2(Q().filter(q=>q.st=='Pending approval'&&q.vno!=skip).reduce((s,q)=>{const t=q.s;if(t.acct!=aid)return s;if(q.k=='out'||q.k=='xfr')return s+(+t.amt||0)+(q.k=='xfr'?(+t.fee||0):0);return s},0));

/* ---------------- what the money is: classifications and their CoA filters ---------------- */
const CLS={
 in:{
  inc:{t:'Earned income',d:'Fees, commissions, sales or other revenue the business has earned.',types:['Income'],def:'4300',lab:'Income category',note:'Credits an income account. Use this only for money the business has earned.'},
  ar:{t:'Customer payment',d:'A customer pays an amount they already owe (an invoice).',codes:['1200'],def:'1200',party:'cust',lab:'Receivable account',note:'Reduces the customer’s receivable. This is not new income.'},
  dep:{t:'Customer deposit',d:'Money held for a customer: an advance, a remittance or a deposit.',grps:['Other Current Liabilities','Payables'],excl:['2000'],def:'2150',mk:['2150','Customer Deposits'],party:'cust',lab:'Liability account',note:'Held as a liability until it is used or refunded. Not income.'},
  loan:{t:'Loan received',d:'Money borrowed from a bank, a lender or a shareholder.',types:['Liabilities'],excl:['2000','2150'],def:'2500',mk:['2500','Loans Payable'],lab:'Loan account',note:'Recorded as a liability. Not income.'},
  cap:{t:'Owner contribution',d:'Capital the owner puts into the business.',types:['Equity'],excl:['3100'],exclGrp:['Retained Earnings'],def:'3000',lab:'Equity account',note:'Increases owner’s equity. Not income.'},
  ref:{t:'Refund of a cost',d:'A supplier refunds or rebates something you paid for.',types:['Expenses'],def:'6000',lab:'Expense account to reduce',note:'Reduces the expense it refunds. Not income.'}},
 out:{
  exp:{t:'Expense',d:'Rent, wages, utilities, supplies and other running costs.',types:['Expenses'],def:'6000',lab:'Expense category',note:'Debits an expense account.'},
  ap:{t:'Supplier payment',d:'Pay a supplier bill you already recorded.',codes:['2000'],def:'2000',party:'sup',lab:'Payable account',note:'Reduces accounts payable. The expense was booked with the bill.'},
  dep:{t:'Customer deposit refund',d:'Pay back money held for a customer.',grps:['Other Current Liabilities'],def:'2150',mk:['2150','Customer Deposits'],party:'cust',lab:'Liability account',note:'Reduces the customer deposit liability.'},
  loan:{t:'Loan repayment',d:'Repay principal on a loan.',types:['Liabilities'],excl:['2000','2150'],def:'2500',mk:['2500','Loans Payable'],lab:'Loan account',note:'Reduces the loan liability. Interest belongs under Expense.'},
  drw:{t:'Owner drawings',d:'Money the owner takes out of the business.',codes:['3100'],def:'3100',lab:'Equity account',note:'Reduces owner’s equity. Not an expense.'}}};
function cats(k,cls){const c=(CLS[k]||{})[cls];if(!c)return[];const ls=LIQSET();
 const ok=code=>{code=String(code);if(ls.has(code)||SYS_CAT.includes(code)||catOff(code))return false;if(grpOf(code)=='Cash & Bank'||grpOf(code)=='Foreign Currency Stock')return false;if(c.excl&&c.excl.includes(code))return false;if(c.exclGrp&&c.exclGrp.includes(grpOf(code)))return false;
  if(c.codes)return c.codes.includes(code);if(c.grps&&!c.grps.includes(grpOf(code)))return false;if(c.types&&!c.types.includes(acType(code)))return false;return!!(c.types||c.grps)};
 const L=Object.keys(CH).filter(ok).sort().map(code=>({v:code,l:code+' · '+CH[code],s:acType(code)+' · '+grpOf(code)+(Object.keys(CH).some(k=>String(par(k))==code)?' · has sub-accounts':''),g:grpOf(code)}));
 if(c.mk&&!CH[c.mk[0]]&&!catOff(c.mk[0]))L.unshift({v:c.mk[0],l:c.mk[0]+' · '+c.mk[1],s:'Added to the Chart of Accounts when you post',g:'New account'});
 return L}
const custs=t=>(S.cust||[]).filter(c=>c.type==(t=='sup'?'Supplier':'Customer')&&(c.status||'Active')!='Inactive');

/* ---------------- vouchers ---------------- */
const nextV=p=>{let m=0;const re=new RegExp('^'+p+'-(\\d+)$');S.j.forEach(x=>{const r=re.exec(String(x.vno||''));if(r)m=Math.max(m,+r[1])});Q().forEach(q=>{const r=re.exec(String(q.vno||''));if(r)m=Math.max(m,+r[1])});return p+'-'+String(m+1).padStart(4,'0')};
const PFX={in:'RV',out:'PV',xfr:'TV'};

/* =====================================================================
   Engine: validate + build exact post() payloads (preview == what posts)
   ===================================================================== */
function calc(st,opt){opt=opt||{};const L=ledger(),B=BASE(),er={},wn=[],E=(f,m)=>{if(!er[f])er[f]=m};const k=st.k,date=st.date,t0=today();
 const all=liq(),A0=all.find(a=>a.id==st.acct),A=A0&&!A0.off&&canSee(A0)?A0:null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))E('date','Choose the transaction date.');else if(date>t0)E('date','The date cannot be in the future.');else if(+date.slice(0,4)<2000)E('date','Choose a valid date.');else if(S.fxlk&&date<=S.fxlk)E('date','The books are locked through '+S.fxlk+'. Choose a later date or ask an Owner to reopen the period.');
 if(!st.acct)E('acct',k=='in'?'Choose the account that received the money.':k=='out'?'Choose the account the money was paid from.':'Choose the account the money leaves.');
 else if(!A0)E('acct','That account no longer exists. Choose another.');
 else if(A0.off)E('acct',A0.name+' cannot be used: '+A0.why.toLowerCase()+'.');
 else if(!canSee(A0))E('acct','You do not have access to '+bn(A0.br)+'.');
 const bra=A?(A.br||st.br||(br!='all'?br:'')||(ME().br&&ME().br!='All'?ME().br:'')):'';
 if(A&&!A.br&&!bra)E('br','Choose the branch this belongs to.');
 if(A&&date&&!er.date&&bra&&closedDay(bra,date))E('date','The cash day '+date+' is closed for '+bn(bra)+'. Choose another date or reopen the day in Daily closing.');
 const ccy=A?(A.ccy=='*'?(st.ccy||B):A.ccy):(st.ccy||B);
 if(A&&A.ccy=='*'&&!st.ccy)E('ccy','Choose the currency.');
 if(A&&A.ccy!='*'&&st.ccy&&st.ccy!=A.ccy)E('ccy',A.name+' holds '+A.ccy+' only. The amount must be in '+A.ccy+'.');
 const amt=R2(st.amt);if(st.amt===''||st.amt==null)E('amt','Enter the amount.');else if(!(amt>0))E('amt','The amount must be greater than zero.');else if(amt>1e11)E('amt','The amount is too large.');else if(Math.abs(+st.amt-amt)>1e-9)E('amt','Use at most two decimal places.');
 let rate=1;if(ccy!=B&&k!='xfr'){rate=+st.rate;if(!(rate>0))E('rate','Enter the '+ccy+' to '+B+' rate.');else if(midR(ccy)>0&&Math.abs(rate/midR(ccy)-1)>.25)wn.push('The rate differs from today’s board rate ('+rf(midR(ccy))+') by more than 25%. Check it.')}
 const res={er,wn,A,ccy,amt,rate,bra,entries:[],cad:0,k};
 if(st.desc&&st.desc.length>200)E('desc','Keep the description under 200 characters.');
 if(st.ref&&st.ref.length>40)E('ref','Keep the reference under 40 characters.');
 const memoBase=(st.desc||'').trim();
 const party=(st.party||'').trim(),cuObj=st.cust?(S.cust||[]).find(c=>c.id==st.cust):null;
 if(k=='in'||k=='out'){const C=(CLS[k]||{})[st.cls];
  if(!C)E('cls',k=='in'?'Choose what this money is. Only earned income is recorded as revenue.':'Choose what this payment is for.');
  else{const L2=cats(k,st.cls);if(!st.cat)E('cat','Choose the '+C.lab.toLowerCase()+'.');else if(!L2.some(o=>o.v==st.cat))E('cat','That account cannot be used here. Choose one from the list.');
   if(C.party&&!cuObj)E('party',C.party=='sup'?'Choose the supplier. Supplier payments must be linked to a registered supplier.':'Choose the customer. '+C.t+'s must be linked to a registered customer.');}
  if(k=='out'&&!party&&!cuObj)E('party','Enter who was paid.');
  if(k=='in'&&!party&&!cuObj)E('party','Enter who the money came from.');
  if(k=='in'&&st.cls=='inc'&&/deposit|advance|loan|capital|remit|hold for|on behalf/i.test(memoBase+' '+(st.ref||'')))wn.push('The description mentions a deposit, loan, capital or remittance. If so, this is not income: choose that type instead.');
 }
 const ok0=!Object.keys(er).length;
 const avail=A?R2(balOf(A,ccy,'',L)-qOut(A.id,ccy,st.vno)):0;
 const od=A=>A.kind=='bank'?A.odl:0;
 const chkFunds=(need,f)=>{if(!A||!(need>0))return;const after=R2(avail-need);res.avail=avail;res.after=after;const lim=od(A);const noNeg=A.kind=='cash'&&((S.br||[]).find(b=>b.id==A.br)||{}).noNeg===0;
  if(after<-lim-.004&&!noNeg)E(f,(A.kind=='bank'&&lim>0?'This exceeds the '+ccy+' '+mf(lim)+' overdraft limit on '+A.name+'.':'Not enough funds in '+A.name+'.')+' Available '+ccy+' '+sm(avail)+', this needs '+ccy+' '+mf(need)+'.');
  else if(after<-.004)wn.push(noNeg?A.name+' will go below zero (allowed for this branch).':'This uses '+ccy+' '+mf(-after)+' of the overdraft on '+A.name+'.');
  else if(avail>0&&after<avail*.1)wn.push('Low balance: '+A.name+' will have '+ccy+' '+mf(after)+' left.')};
 const vno=st.vno||nextV(PFX[k]),grp=st.grp||uid('dxg');
 const meta={dx3:1,dxk:k,dxg:grp,vno,ref:(st.ref||'').trim()||vno,party:party||(cuObj?cuObj.name:''),...(cuObj?{cust:cuObj.id}:{}),...(st.att?{att:st.att}:{}),...(st.note?{note:st.note}:{}),...(st.corr?{corr:st.corr}:{})};
 const acx=X=>({acc:X.id,...(X.bank?{bank:X.bank}:{})});
 if(k=='in'&&A&&ok0){const C=CLS.in[st.cls],cad=R2(amt*rate);res.cad=cad;
  res.entries.push({date,br:bra,...acx(A),tt:'Cash in',cls:st.cls,memo:C.t+' · '+(CH[st.cat]||(C.mk&&C.mk[1])||st.cat)+(meta.party?' · '+meta.party:'')+(memoBase?': '+memoBase:''),...meta,...(ccy!=B?{ccy,rate:RT(rate),fa:amt}:{}),lines:[[A.gl,cad,0],[st.cat,0,cad]]});
  res.mk=C.mk&&st.cat==C.mk[0]&&!CH[C.mk[0]]?C.mk:null}
 if(k=='out'&&A){chkFunds(amt,'amt');if(ok0&&!er.amt){const C=CLS.out[st.cls],book=carry(A,ccy,date,L),dr=R2(amt*rate),crd=ccy==B?dr:R2(amt*book),fx=R2(crd-dr);res.cad=dr;res.book=book;res.fx=fx;
  const lines=[[st.cat,dr,0],[A.gl,0,crd]];if(Math.abs(fx)>.004)lines.push([RFX,fx>0?fx:0,fx<0?-fx:0]);
  res.entries.push({date,br:bra,...acx(A),tt:'Cash out',cls:st.cls,memo:C.t+' · '+(CH[st.cat]||(C.mk&&C.mk[1])||st.cat)+(meta.party?' · '+meta.party:'')+(memoBase?': '+memoBase:''),...meta,...(ccy!=B?{ccy,rate:RT(book),fa:amt,spot:RT(rate)}:{}),lines});
  res.mk=C.mk&&st.cat==C.mk[0]&&!CH[C.mk[0]]?C.mk:null;if(Math.abs(fx)>.004)res.needFx=1}
  if(!st.att)wn.push('No receipt attached. Attach the receipt or invoice if you have it.')}
 if(k=='xfr'){const T0=all.find(a=>a.id==st.to),T=T0&&!T0.off&&canSee(T0)?T0:null;res.T=T;
  if(!st.to)E('to','Choose the account the money goes to.');else if(st.to==st.acct)E('to','The destination must be a different account from the source.');else if(!T0)E('to','That account no longer exists.');else if(T0.off)E('to',T0.name+' cannot be used: '+T0.why.toLowerCase()+'.');else if(!canSee(T0))E('to','You do not have access to '+bn(T0.br)+'.');
  const tb=T?(T.br||st.tbr||bra):'';if(T&&!er.date&&tb&&date&&closedDay(tb,date))E('date','The cash day '+date+' is closed for '+bn(tb)+'.');
  const tc=T?(T.ccy=='*'?(st.tccy||ccy):T.ccy):ccy;res.tc=tc;
  const fee=st.fee===''||st.fee==null?0:R2(st.fee);if(fee<0)E('fee','The fee cannot be negative.');res.fee=fee;
  if(fee>0){if(!st.feeAcct)E('feeAcct','Choose the expense account for the fee.');else if(!cats('out','exp').some(o=>o.v==st.feeAcct))E('feeAcct','The fee must go to an active expense account.')}
  let xr=1,tamt=amt;if(tc!=ccy){xr=+st.xr;tamt=R2(st.tamt);if(!(xr>0))E('xr','Enter the exchange rate ('+ccy+' to '+tc+').');if(!(tamt>0))E('tamt','Enter the amount received in '+tc+'.');else if(xr>0&&amt>0&&Math.abs(R2(amt*xr)-tamt)>Math.max(.011,tamt*1e-6))E('tamt','The amounts do not match the rate: '+mf(amt)+' × '+rf(xr)+' = '+mf(R2(amt*xr))+'.');
   const ref=midR(tc)>0&&midR(ccy)>0?midR(ccy)/midR(tc):0;if(ref&&xr>0&&Math.abs(xr/ref-1)>.25)wn.push('The exchange rate differs from the board cross rate ('+rf(ref)+') by more than 25%. Check it.')}
  res.xr=xr;res.tamt=tamt;chkFunds(R2(amt+fee),'amt');
  if(T&&!Object.keys(er).length){const book=carry(A,ccy,date,L),out=ccy==B?amt:R2(amt*book),feeC=ccy==B?fee:R2(fee*book);
   let inC,tr;if(tc==ccy){inC=out;tr=ccy==B?1:book}else if(ccy==B){inC=out;tr=RT(out/tamt)}else if(tc==B){inC=tamt;tr=1}else{tr=RT(midR(tc)||1);inC=R2(tamt*tr)}
   const gain=R2(inC-out);res.cad=out;res.book=book;res.inC=inC;res.gain=gain;res.feeC=feeC;
   const memo='Transfer '+A.name+' → '+T.name+(memoBase?': '+memoBase:'');
   const L1=[[CLR,out,0],[A.gl,0,R2(out+feeC)]];if(feeC>0)L1.push([st.feeAcct,feeC,0]);
   res.entries.push({date,br:bra,...acx(A),tt:'Transfer',memo,...meta,leg:'from',...(ccy!=B?{ccy,rate:RT(book),fa:R2(amt+fee)}:{}),...(fee>0?{fee,feeAcct:st.feeAcct}:{}),xto:T.id,lines:L1});
   res.entries.push({date,br:tb,...acx(T),tt:'Transfer',memo,...meta,leg:'to',...(tc!=B?{ccy:tc,rate:RT(tr),fa:tamt}:{}),xfrom:A.id,...(tc!=ccy?{xr:RT(xr),fccy:ccy,famt:amt}:{}),lines:[[T.gl,inC,0],[CLR,0,inC]]});
   if(Math.abs(gain)>.004)res.entries.push({date,br:bra,tt:'Transfer',memo:'Realized FX '+(gain>0?'gain':'loss')+' on '+vno+' ('+ccy+' → '+tc+')',...meta,leg:'fx',lines:gain>0?[[CLR,gain,0],[RFX,0,gain]]:[[RFX,-gain,0],[CLR,0,-gain]]});
   if(Math.abs(gain)>.004)res.needFx=1}}
 if(res.cad>0||res.entries.length){const t=thr(),lim=window.rbxLimit?+rbxLimit()||0:0,cad=k=='xfr'?R2((res.cad||0)+(res.feeC||0)):res.cad;
  res.appr=role()=='Owner'?null:(t>0&&cad>=t)?'Over the '+B+' '+mf(t)+' approval threshold':(lim>0&&cad>lim+.004)?'Over your '+B+' '+mf(lim)+' entry limit':null}
 if(A&&!er.amt&&amt>0&&date){const du=S.j.find(x=>x.date==date&&String(x.acc||aId(x))==A.id&&!x.rev&&!x.revBy&&(x.fa?Math.abs(x.fa-amt)<.005:x.lines.some(y=>Math.abs((+y[1]||0)+(+y[2]||0)-R2(amt*rate))<.005))&&(!st.ref||x.ref==st.ref.trim()));if(du)wn.push('A similar entry already exists on '+date+' ('+(du.vno||'#'+du.id)+'). Check that this is not a duplicate.')}
 res.ok=!Object.keys(er).length;return res}

/* atomic posting of one or more entries */
function postAll(res,extra){const n0=S.j.length,coa0=JSON.stringify([S.coa||{}]);const ids=[];
 try{if(res.mk&&typeof addAcct=='function')addAcct(res.mk[0],res.mk[1]);if(res.entries.some(e=>e.lines.some(l=>String(l[0])==CLR))&&!CH[CLR])addAcct(CLR,'Bank Transfers Clearing');if(res.needFx&&!CH[RFX])addAcct(RFX,'Realized FX Gain/Loss');
  if(res.entries.some(e=>e.lines.some(l=>String(l[0])==FEE))&&!CH[FEE])addAcct(FEE,'Bank Charges');
  const sd=window.__dxPosting;window.__dxPosting=1;
  try{res.entries.forEach(e=>{post({...e,...(extra||{}),aud:[{at:now(),by:uname(),act:(extra&&extra.appr)?'Posted after approval':'Posted'}]});const z=S.j[S.j.length-1];ids.push(z.id)})}finally{window.__dxPosting=sd}
  const tot=r=>R2(r.lines.reduce((s,y)=>s+(+y[1]||0)-(+y[2]||0),0));if(S.j.slice(n0).some(z=>Math.abs(tot(z))>.005))throw PE('Calculation error: the entry does not balance. Nothing was saved.');
  return ids}catch(e){S.j.length=n0;try{const c=JSON.parse(coa0)[0];if(JSON.stringify(S.coa||{})!=JSON.stringify(c)){Object.keys(S.coa||{}).forEach(k=>{if(!(k in c)){delete S.coa[k];delete CH[k]}})}}catch(_){}throw e}}

/* =====================================================================
   Entry sheet (Cash in / Cash out / Transfer)
   ===================================================================== */
let F=null;const CBO={};
const TT={in:['Cash in','Money received into a cash, bank or cash-equivalent account.'],out:['Cash out','Money paid out of a cash, bank or cash-equivalent account.'],xfr:['Transfer between accounts','Move money between your own cash and bank accounts, in the same or another currency.']};
function defAcct(k,L){const pb=br!='all'?br:(ME().br&&ME().br!='All'?ME().br:'');const sel=W.acc&&L.find(a=>a.id==W.acc)?W.acc:'';return sel||((L.find(a=>a.br==pb&&a.kind=='cash')||L.find(a=>a.br==pb)||L[0])||{}).id||''}
function open(k,pre){if(!canPost()){toast('Your role ('+role()+') can view the cash desk but cannot record entries. Ask an Owner to change your permissions.',1);return}
 const L=elig();if(!L.length){toast('There is no active cash or bank account you can use. Add one in Banks or the Chart of Accounts.',1);return}
 const d=bizDate();F={k,cls:'',acct:defAcct(k,L),cat:'',amt:'',ccy:'',rate:'',date:d,party:'',cust:'',ref:'',desc:'',att:null,note:'',br:'',to:'',tamt:'',xr:'',fee:'',feeAcct:'',touched:{},tried:false,step:'form',dirty:false,...(pre||{})};
 syncAcct();if(F.cls)pickCls(F.cls,true);if(k=='xfr'&&!F.to){const o=L.find(a=>a.id!=F.acct&&a.ccy==(accById(F.acct)||{}).ccy)||L.find(a=>a.id!=F.acct);F.to='';F._sug=o?o.id:''}
 if(k=='xfr'&&F.to)syncTo();render();setTimeout(()=>{const f=$(F.cls||k=='xfr'?'d3f_amt':'d3f_cls0');if(f)f.focus()},40)}
function syncAcct(){const a=accById(F.acct);if(!a)return;const B=BASE();if(a.ccy!='*')F.ccy=a.ccy;else if(!F.ccy)F.ccy=B;if(F.ccy!=B){if(!F.rate||F.rate=='1'||(F._rateFor&&F._rateFor!=F.ccy))F.rate=String(midR(F.ccy)||'');F._rateFor=F.ccy}else{F.rate='1';F._rateFor=B}if(a.br)F.br=''}
function syncTo(){const a=accById(F.acct),t=accById(F.to);if(!a||!t)return;const sc=a.ccy=='*'?F.ccy:a.ccy,tc=t.ccy=='*'?(F.tccy||sc):t.ccy;if(tc!=sc){if(!F.xr||(F._xrFor&&F._xrFor!=sc+tc)){const r=midR(sc)&&midR(tc)?midR(sc)/midR(tc):'';F.xr=r?String(RT(r)):'';F.tamt=''}F._xrFor=sc+tc;if(F.amt&&+F.xr>0&&!F.tamt)F.tamt=String(R2(+F.amt*+F.xr))}else{F.xr='';F.tamt='';F._xrFor=sc+tc}}
function pickCls(c){F.cls=c;const C=(CLS[F.k]||{})[c];if(!C)return;const L=cats(F.k,c);if(!L.some(o=>o.v==F.cat))F.cat=(L.find(o=>o.v==C.def)||(L.length==1?L[0]:null)||{}).v||'';if(!C.party)F.cust='';else if(F.cust&&!custs(C.party).some(x=>x.id==F.cust))F.cust=''}
/* ---------- combobox ---------- */
function cbox(name,opts,sel,ph,lab,err){CBO[name]=opts;const o=opts.find(x=>x.v==sel);const g={};
 const items=opts.map((x,i)=>{const gh=x.g&&!g[x.g]?(g[x.g]=1,`<li class="d3-cg" role="presentation">${A(x.g)}</li>`):'';return gh+`<li role="option" id="d3o_${name}_${i}" data-cbv="${A(x.v)}" data-cbl="${A(x.l.toLowerCase())}" data-cbs="${A(((x.s||'')+' '+(x.r||'')).toLowerCase())}" aria-selected="${x.v==sel}" class="${x.v==sel?'on':''}${x.dis?' dis':''}" ${x.dis?'aria-disabled="true"':''}><span class="d3-oi">${x.ic?ic(x.ic,16):''}</span><span class="d3-ot"><b>${A(x.l)}</b>${x.s?`<small>${A(x.s)}</small>`:''}</span>${x.r?`<span class="d3-or">${A(x.r)}</span>`:''}</li>`}).join('');
 return`<div class="d3-cb" data-cb="${name}">${name=='reg'?'<span class="d3-vh" id="d3l_reg">Account</span>':''}<button type="button" class="d3-cbb${err?' bad':''}" id="d3f_${name}" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="d3l_${name} d3f_${name}" ${err?`aria-invalid="true" aria-describedby="d3e_${name}"`:''}>${o?`<span class="d3-oi">${o.ic?ic(o.ic,16):''}</span><span class="d3-cbv"><b>${A(o.l)}</b>${o.s?`<small>${A(o.s)}</small>`:''}</span>${o.r?`<span class="d3-or">${A(o.r)}</span>`:''}`:`<span class="d3-cbph">${A(ph)}</span>`}${ic('chev',16,'d3-cbc')}</button><div class="d3-cbp" hidden><div class="d3-cbs">${ic('srch',15)}<input type="text" class="d3-cbq" placeholder="Search ${A(lab.toLowerCase())}…" aria-label="Search ${A(lab.toLowerCase())}" role="combobox" aria-expanded="true" aria-controls="d3ul_${name}" aria-autocomplete="list" autocomplete="off"></div><ul role="listbox" id="d3ul_${name}" aria-label="${A(lab)}">${items||'<li class="d3-cg">Nothing available</li>'}</ul><p class="d3-cbn" hidden>No match. Try another word.</p></div></div>`}
function accOpts(L,ex){const B=BASE(),lg=ledger();return L.filter(a=>a.id!=ex).sort((x,y)=>(x.kind>y.kind?1:x.kind<y.kind?-1:0)||x.name.localeCompare(y.name)).map(a=>{const c=a.ccy=='*'?B:a.ccy;return{v:a.id,l:a.name+(a.no&&a.kind!='cash'?' ('+a.no+')':''),s:kindL(a.kind)+' · '+brL(a)+' · '+(a.ccy=='*'?'Multi-currency':a.ccy)+' · GL '+a.gl,r:c+' '+sm(balOf(a,c,'',lg)),g:a.kind=='bank'?'Bank accounts':a.kind=='ceq'?'Cash equivalents':'Cash accounts',ic:a.kind}})}
/* ---------- render ---------- */
const fe=(r,f)=>(F.tried||F.touched[f])&&r.er[f]?r.er[f]:'';
const fld=(f,lab,inner,r,hint,req)=>{const e=fe(r,f);return`<div class="d3-f${e?' bad':''}" data-fw="${f}"><label class="d3-lb" id="d3l_${f}" for="d3f_${f}">${A(lab)}${req?' <em aria-hidden="true">*</em>':''}</label>${inner}${e?`<p class="d3-er" id="d3e_${f}" role="alert">${ic('warn',14)}${A(e)}</p>`:hint?`<p class="d3-hn">${hint}</p>`:''}</div>`};
const inp=(f,v,r,o)=>{o=o||{};const e=fe(r,f);return`<input class="d3-in" id="d3f_${f}" data-d3f="${f}" type="${o.type||'text'}" value="${A(v)}" ${o.ph?`placeholder="${A(o.ph)}"`:''} ${o.im?`inputmode="${o.im}"`:''} ${o.max?`maxlength="${o.max}"`:''} ${o.list?`list="${o.list}"`:''} ${o.mx?`max="${o.mx}"`:''} ${o.dis?'disabled':''} autocomplete="off" ${e?`aria-invalid="true" aria-describedby="d3e_${f}"`:''}>`};
function formHtml(r){const k=F.k,B=BASE(),L=elig(),a=r.A,ccy=r.ccy;let h='';
 if(F.corr){const o=S.j.find(x=>x.id==F.corr);h+=`<div class="d3-bn info" role="note">${ic('undo',16)}<span>Correcting <b>${A(o?(o.vno||'#'+o.id):'')}</b>. The original was reversed; this posts the corrected entry.</span></div>`}
 if(k!='xfr'){const C=CLS[k],e=fe(r,'cls');h+=`<fieldset class="d3-fs${e?' bad':''}"><legend class="d3-lb">${k=='in'?'What is this money?':'What is this payment?'} <em aria-hidden="true">*</em></legend><div class="d3-cls" role="radiogroup">${Object.keys(C).map((c,i)=>`<label class="d3-ct${F.cls==c?' on':''}"><input type="radio" name="d3cls" id="d3f_cls${i}" data-d3f="cls" value="${c}" ${F.cls==c?'checked':''}><b>${A(C[c].t)}</b><small>${A(C[c].d)}</small></label>`).join('')}</div>${e?`<p class="d3-er" role="alert">${ic('warn',14)}${A(e)}</p>`:''}</fieldset>`}
 h+=`<div class="d3-g2">`;
 h+=fld('acct',k=='in'?'Received into':k=='out'?'Paid from':'From account',cbox('acct',accOpts(L),F.acct,'Select a cash or bank account…','Accounts',fe(r,'acct')),r,'Active cash, bank and approved cash-equivalent accounts you have access to.',1);
 if(k=='xfr')h+=fld('to','To account',cbox('to',accOpts(L,F.acct),F.to,F._sug&&!F.to?'Select the destination…':'Select the destination…','Accounts',fe(r,'to')),r,F.acct?'The source account is not listed.':'',1);
 else{const C=CLS[k][F.cls];h+=fld('cat',C?C.lab:(k=='in'?'Income category':'Expense category'),C?cbox('cat',cats(k,F.cls),F.cat,'Select an account…',C.lab,fe(r,'cat')):`<div class="d3-ro">Choose the type first</div>`,r,C?A(C.note):'',1)}
 h+=`</div>`;
 if(a&&!a.br)h+=`<div class="d3-g2">`+fld('br','Branch',`<select class="d3-in" id="d3f_br" data-d3f="br"><option value="">Choose…</option>${S.br.filter(b=>{const u=ME().br;return!u||u=='All'||b.id==u}).map(b=>`<option value="${A(b.id)}" ${(F.br||r.bra)==b.id?'selected':''}>${A(b.name)}</option>`).join('')}</select>`,r,'This bank is shared by all branches.',1)+`<div></div></div>`;
 /* amounts */
 const ccyF=a&&a.ccy=='*'?`<select class="d3-in" id="d3f_ccy" data-d3f="ccy">${[B,...Object.keys(S.rates||{})].map(c=>`<option ${c==F.ccy?'selected':''}>${A(c)}</option>`).join('')}</select>`:`<div class="d3-ro" id="d3f_ccy">${ic('lock',14)}${A(ccy)}</div>`;
 const rowA=[fld('amt','Amount'+(ccy?' ('+ccy+')':''),`<div class="d3-am"><span>${A(ccy)}</span>${inp('amt',F.amt,r,{type:'number',im:'decimal',ph:'0.00'})}</div>`,r,'',1),fld('ccy','Currency',ccyF,r,a&&a.ccy=='*'?'This account holds several currencies.':a?(k=='xfr'?'Set by the source account.':a.name+' holds '+ccy+' only.'):'',1)];
 if(ccy&&ccy!=B&&k!='xfr')rowA.push(fld('rate','Rate (1 '+ccy+' = ? '+B+')',inp('rate',F.rate,r,{type:'number',im:'decimal'}),r,(r.amt>0&&+F.rate>0?B+' '+mf(R2(r.amt*+F.rate))+' at this rate'+(k=='out'&&r.book&&Math.abs(r.book-(+F.rate))>1e-9?' · book rate '+rf(r.book):''):'Board rate '+rf(midR(ccy))),1));
 h+=`<div class="${rowA.length>2?'d3-g3':'d3-g2 d3-amr'}">${rowA.join('')}</div>`;
 if(k=='xfr'&&r.T){const tc=r.tc;if(tc!=ccy)h+=`<div class="d3-fxb"><div class="d3-g3">`+fld('xr','Exchange rate (1 '+ccy+' = ? '+tc+')',inp('xr',F.xr,r,{type:'number',im:'decimal'}),r,'Board cross rate '+(midR(ccy)&&midR(tc)?rf(midR(ccy)/midR(tc)):'n/a'),1)+fld('tamt','Amount received ('+tc+')',`<div class="d3-am"><span>${A(tc)}</span>${inp('tamt',F.tamt,r,{type:'number',im:'decimal',ph:'0.00'})}</div>`,r,'Change the rate or this amount; the other updates.',1)+fld('tc','Destination currency',`<div class="d3-ro">${A(tc)}</div>`,r,'')+`</div></div>`;
  else h+=`<p class="d3-hn d3-pl">Same currency (${A(ccy)}): the destination receives ${A(ccy)} ${mf(r.amt||0)}${r.fee>0?'; the fee is charged to the source':''}.</p>`}
 const rowB=[fld('date','Transaction date',inp('date',F.date,r,{type:'date',mx:today()}),r,'',1)];
 if(k=='xfr'){rowB.push(fld('fee','Fee ('+(ccy||'')+')',inp('fee',F.fee,r,{type:'number',im:'decimal',ph:'0.00'}),r,'Optional. Bank or courier charge, taken from the source.'));if(+F.fee>0)rowB.push(fld('feeAcct','Fee expense account',cbox('feeAcct',cats('out','exp'),F.feeAcct,'Select…','Expense accounts',fe(r,'feeAcct')),r,'',1))}
 h+=`<div class="${rowB.length>2?'d3-g3':'d3-g2'}">${rowB.join('')}</div>`;
 /* parties & references */
 const C=k!='xfr'?CLS[k][F.cls]:null,pt=C&&C.party;
 h+=`<div class="d3-g2">`;
 if(k!='xfr'){const lst=custs(pt=='sup'?'sup':k=='out'&&!pt?'sup':'cust');
  if(pt)h+=fld('party',pt=='sup'?'Supplier':'Customer',`<select class="d3-in" id="d3f_party" data-d3f="cust"><option value="">Choose a registered ${pt=='sup'?'supplier':'customer'}…</option>${custs(pt).map(c=>`<option value="${A(c.id)}" ${F.cust==c.id?'selected':''}>${A(c.name)}${c.code?' · '+A(c.code):''}</option>`).join('')}</select>`,r,'',1);
  else h+=fld('party',k=='in'?'Customer / source':'Payee',inp('party',F.party,r,{ph:k=='in'?'Who paid you':'Who was paid',list:'d3pl',max:80})+`<datalist id="d3pl">${[...custs('cust'),...custs('sup')].map(c=>`<option value="${A(c.name)}">`).join('')}</datalist>`,r,'',1)}
 h+=fld('ref','Reference no.',inp('ref',F.ref,r,{ph:k=='out'?'Receipt or invoice no.':'Receipt, slip or wire no.',max:40}),r,'Optional. Defaults to the voucher number.')+`</div>`;
 h+=fld('desc','Description',`<textarea class="d3-in" id="d3f_desc" data-d3f="desc" rows="2" maxlength="200" placeholder="What is this for?">${A(F.desc)}</textarea>`,r,'');
 /* attachment */
 h+=`<div class="d3-f"><span class="d3-lb">${k=='out'?'Receipt':'Attachment'}</span>${F.att?`<div class="d3-at"><span>${ic('clip',16)}<b>${A(F.att.name)}</b><small>${Math.max(1,Math.round(F.att.size/1024))} KB</small></span><button type="button" class="d3-lk" data-d3="attx">Remove</button></div>`:`<button type="button" class="d3-dz" data-d3="att">${ic('clip',18)}<span><b>Attach a file</b><small>PDF, JPG or PNG, up to 1 MB</small></span></button>`}</div>`;
 return h}
function pvHtml(r){const B=BASE(),rows=[];r.entries.forEach(e=>e.lines.forEach(y=>rows.push({c:String(y[0]),d:+y[1]||0,cr:+y[2]||0,e})));const lab=c=>{const a=liq().find(x=>x.gl==c&&(r.A&&x.id==r.A.id||r.T&&x.id==r.T.id));return CH[c]||(r.mk&&r.mk[0]==c?r.mk[1]:c)};
 const td=R2(rows.reduce((s,x)=>s+x.d,0)),tc=R2(rows.reduce((s,x)=>s+x.cr,0));
 const accLab=(x)=>{const id=x.e.acc;const a=id&&liq().find(q=>q.id==id);return a&&a.gl==x.c?a.name:''};
 let h=`<div class="d3-ph">${ic('shield',15)}Journal entry · ${A(B)}</div>`;
 if(!rows.length)h+=`<p class="d3-mu">The journal appears here as you fill in the form.</p>`;
 else h+=`<table class="d3-jt"><thead><tr><th>Account</th><th class="n">Debit</th><th class="n">Credit</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${A(x.c)} · ${A(lab(x.c))}</b>${accLab(x)?`<small>${A(accLab(x))}</small>`:''}${x.c==RFX?'<small>Realized foreign exchange</small>':x.c==CLR?'<small>Clearing (nets to zero)</small>':''}</td><td class="n">${x.d?mf(x.d):''}</td><td class="n">${x.cr?mf(x.cr):''}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="n">${mf(td)}</td><td class="n">${mf(tc)}</td></tr></tfoot></table><p class="d3-bal ${Math.abs(td-tc)<.005?'ok':'bad'}">${ic(Math.abs(td-tc)<.005?'ok':'warn',14)}${Math.abs(td-tc)<.005?'Balanced: debits equal credits.':'Out of balance by '+mf(Math.abs(td-tc))}</p>`;
 if(r.k=='xfr'&&r.T&&r.entries.length){h+=`<dl class="d3-kv"><div><dt>Leaves ${A(r.A.name)}</dt><dd>${A(r.ccy)} ${mf(R2(r.amt+(r.fee||0)))}</dd></div><div><dt>Arrives in ${A(r.T.name)}</dt><dd>${A(r.tc)} ${mf(r.tamt)}</dd></div>${r.ccy!=B?`<div><dt>Book rate of ${A(r.ccy)}</dt><dd>${rf(r.book)}</dd></div>`:''}${Math.abs(r.gain||0)>.004?`<div><dt>Realized FX ${r.gain>0?'gain':'loss'}</dt><dd class="${r.gain>0?'in':'out'}">${A(B)} ${mf(Math.abs(r.gain))}</dd></div>`:''}</dl>`}
 if(r.k=='out'&&Math.abs(r.fx||0)>.004)h+=`<p class="d3-mu">The ${A(r.ccy)} leaves the account at its book rate (${rf(r.book)}); the expense is recorded at the transaction rate. The difference is a realized FX ${r.fx>0?'loss':'gain'} of ${A(B)} ${mf(Math.abs(r.fx))}.</p>`;
 if(r.A&&r.avail!=null){const c=r.ccy;h+=`<div class="d3-blc"><span>Available in ${A(r.A.name)}</span><b>${A(c)} ${sm(r.avail)}</b>${ic('xfr',14)}<b class="${r.after<-.004?'out':''}">${A(c)} ${sm(r.after)}</b></div>`}
 else if(r.A&&r.k=='in'&&r.amt>0){const c=r.ccy,b=balOf(r.A,c);h+=`<div class="d3-blc"><span>Balance of ${A(r.A.name)}</span><b>${A(c)} ${sm(b)}</b>${ic('xfr',14)}<b class="in">${A(c)} ${sm(R2(b+r.amt))}</b></div>`}
 if(r.amt>0)h+=`<div class="d3-ap ${r.appr?'wn':'ok'}">${ic(r.appr?'clock':'ok',15)}<span><b>${r.appr?'Needs approval':'Posts immediately'}</b>${r.appr?A(r.appr)+'. An Owner or Manager other than you must approve it before it reaches the ledger.':'Within your posting authority.'}</span></div>`;
 const er=Object.values(r.er);if(F.tried&&er.length)h+=`<ul class="d3-nt bad" role="alert">${er.map(e=>`<li>${ic('warn',14)}${A(e)}</li>`).join('')}</ul>`;
 if(r.wn.length)h+=`<ul class="d3-nt wn">${r.wn.map(e=>`<li>${ic('warn',14)}${A(e)}</li>`).join('')}</ul>`;
 return h}
function confirmHtml(r){const B=BASE(),a=r.A;const kv=(l,v)=>v?`<div><dt>${l}</dt><dd>${v}</dd></div>`:'';const C=F.k!='xfr'?CLS[F.k][F.cls]:null;
 return`<div class="d3-cf"><h3>${r.appr?'Submit for approval?':'Post this entry?'}</h3><p class="d3-mu">${r.appr?'It will wait in the approval queue and will not change any balance until it is approved.':'Posted entries cannot be edited. Mistakes are fixed with a reversing entry.'}</p><dl class="d3-kv d3-kvl">${kv('Type',A(TT[F.k][0]+(C?' · '+C.t:'')))}${kv('Voucher',A(r.entries[0]?r.entries[0].vno:''))}${kv('Date',A(F.date))}${kv(F.k=='in'?'Received into':F.k=='out'?'Paid from':'From',A(a.name)+' · '+A(brL(a)))}${F.k=='xfr'?kv('To',A(r.T.name)+' · '+A(brL(r.T))):kv(C?C.lab:'Category',A(nm(F.cat)))}${kv('Amount',`<b>${A(r.ccy)} ${mf(r.amt)}</b>`+(r.ccy!=B?` <small>${A(B)} ${mf(F.k=='xfr'?r.cad:r.cad)}</small>`:''))}${F.k=='xfr'&&r.tc!=r.ccy?kv('Received',A(r.tc)+' '+mf(r.tamt)+' at '+rf(r.xr)):''}${F.k=='xfr'&&r.fee>0?kv('Fee',A(r.ccy)+' '+mf(r.fee)+' → '+A(nm(F.feeAcct))):''}${kv(F.k=='in'?'From':'Payee',A(r.entries[0]?r.entries[0].party:''))}${kv('Reference',A(r.entries[0]?r.entries[0].ref:''))}${kv('Description',A(F.desc))}${kv('Attachment',F.att?A(F.att.name):'None')}</dl></div>`}
function doneHtml(){const d=F.res;return`<div class="d3-done" role="status"><span class="d3-dic ${d.q?'wn':''}">${ic(d.q?'clock':'ok',30)}</span><h3>${d.q?'Submitted for approval':'Posted to the ledger'}</h3><p>${A(d.msg)}</p><dl class="d3-kv"><div><dt>Voucher</dt><dd><b>${A(d.vno)}</b></dd></div><div><dt>Status</dt><dd>${d.q?'<span class="d3-st wn">Pending approval</span>':'<span class="d3-st ok">Posted</span>'}</dd></div>${d.n>1?`<div><dt>Journal entries</dt><dd>${d.n} linked entries, balanced</dd></div>`:''}</dl></div>`}
function render(){const ov0=$('d3ov');const k=F.k,r=calc(F);F._r=r;
 const step=F.step,foot=step=='done'?`<span class="d3-sp"></span><button type="button" class="d3-b" data-d3="another">Record another</button>${F.res&&!F.res.q?`<button type="button" class="d3-b" data-d3="viewres">View entry</button>`:''}<button type="button" class="d3-b dk" data-d3="close">Done</button>`:step=='confirm'?`<button type="button" class="d3-b" data-d3="back">Back to edit</button><span class="d3-sp"></span><button type="button" class="d3-b dk" data-d3="commit" id="d3commit">${ic(r.appr?'clock':'ok',16)}${r.appr?'Submit for approval':'Post entry'}</button>`:`<span class="d3-hint">Ctrl + Enter to review</span><span class="d3-sp"></span><button type="button" class="d3-b" data-d3="close">Cancel</button><button type="button" class="d3-b dk" data-d3="review">${r.appr?'Review and submit':'Review and post'}</button>`;
 const body=step=='done'?doneHtml():`<div class="d3-cols"><div class="d3-main">${step=='confirm'?confirmHtml(r):formHtml(r)}</div><div class="d3-side" id="d3pv" role="complementary" aria-live="polite" aria-label="Journal preview">${pvHtml(r)}</div></div>`;
 const html=`<div class="d3-sh" role="document"><header class="d3-hd"><span class="d3-hi ${k}">${ic(k,20)}</span><div><h2 id="d3t">${A(TT[k][0])}</h2><p>${A(TT[k][1])}</p></div><span class="d3-vn">${step=='done'?'':A(r.entries[0]?r.entries[0].vno:(F.vno||nextV(PFX[k])))}</span><button type="button" class="d3-x" data-d3="close" aria-label="Close">${ic('x',18)}</button></header><div class="d3-bd" id="d3bd">${body}</div><footer class="d3-ft">${foot}</footer></div>`;
 const ocb=document.querySelector('#d3ov .d3-cb .d3-cbp:not([hidden])'),ocn=ocb&&ocb.parentNode.dataset.cb,ocq=ocb&&ocb.querySelector('.d3-cbq').value;
 const fx=document.activeElement,fid=fx&&fx.id,sel=fx&&fx.selectionStart!=null&&fx.type!='number'?[fx.selectionStart,fx.selectionEnd]:null,sc=$('d3bd')?$('d3bd').scrollTop:0;
 if(ov0)ov0.innerHTML=html;else{document.body.insertAdjacentHTML('beforeend',`<div class="d3-ov" id="d3ov" role="dialog" aria-modal="true" aria-labelledby="d3t">${html}</div>`);document.body.classList.add('d3-lock')}
 if($('d3bd'))$('d3bd').scrollTop=sc;if(fid&&$(fid)){$(fid).focus();if(sel)try{$(fid).setSelectionRange(sel[0],sel[1])}catch(e){}}
 if(ocn){const w=document.querySelector('#d3ov .d3-cb[data-cb="'+ocn+'"]');if(w){cbOpen(w,true);const q=w.querySelector('.d3-cbq');q.value=ocq||'';cbFilter(w,q.value)}}}
function soft(){if(!F||F.step!='form')return;const r=calc(F);F._r=r;const p=$('d3pv');if(p)p.innerHTML=pvHtml(r);
 document.querySelectorAll('#d3ov [data-fw]').forEach(w=>{const f=w.dataset.fw,e=fe(r,f);let p=w.querySelector(':scope>.d3-er');const h=w.querySelector(':scope>.d3-hn');w.classList.toggle('bad',!!e);const c=w.querySelector('#d3f_'+f);
  if(e){if(!p){p=document.createElement('p');p.className='d3-er';p.id='d3e_'+f;p.setAttribute('role','alert');w.appendChild(p)}if(p.dataset.m!==e){p.dataset.m=e;p.innerHTML=ic('warn',14)+A(e)}if(h)h.hidden=true;if(c){c.setAttribute('aria-invalid','true');c.setAttribute('aria-describedby','d3e_'+f)}if(c&&c.classList.contains('d3-cbb'))c.classList.add('bad')}
  else{if(p)p.remove();if(h)h.hidden=false;if(c){c.removeAttribute('aria-invalid');c.removeAttribute('aria-describedby');c.classList.remove('bad')}}});
 const v=document.querySelector('#d3ov .d3-vn');if(v&&r.entries[0])v.textContent=r.entries[0].vno}
let fT=0;function full(){clearTimeout(fT);fT=setTimeout(()=>{if(F)render()},0)}
function close(force){if(!F)return;if(!force&&F.step=='form'&&F.dirty&&!confirm('Discard this entry? Nothing has been saved.'))return;F=null;const o=$('d3ov');if(o)o.remove();if(!$('d3dr')&&!$('d3cc'))document.body.classList.remove('d3-lock')}
function review(){F.tried=true;const r=calc(F);if(!r.ok){render();const e=document.querySelector('#d3ov .d3-f.bad, #d3ov .d3-fs.bad');if(e){e.scrollIntoView({block:'center',behavior:'smooth'});const i=e.querySelector('input,button,select,textarea');if(i)i.focus()}return}F.vno=r.entries[0].vno;F.grp=r.entries[0].dxg;F.step='confirm';render();setTimeout(()=>{const b=$('d3commit');if(b)b.focus()},30)}
function commit(){const r=calc(F);if(!r.ok){F.step='form';F.tried=true;render();return}const B=BASE();
 if(r.appr){const q={id:uid('dq'),k:F.k,vno:r.entries[0].vno,s:clean(F),st:'Pending approval',by:uname(),role:role(),at:now(),br:r.bra,cad:R2((r.cad||0)+(r.feeC||0)),ccy:r.ccy,amt:r.amt,why:r.appr,hist:[{at:now(),by:uname(),act:'Submitted for approval',note:r.appr}]};Q().push(q);save();logA('Cash desk',q.vno+' submitted for approval: '+r.ccy+' '+mf(r.amt)+' ('+r.appr+')');
  F.res={q:1,vno:q.vno,msg:TT[F.k][0]+' of '+r.ccy+' '+mf(r.amt)+' is waiting for an Owner or Manager to approve it.'};F.step='done';render();toast(q.vno+' submitted for approval.');go();return}
 try{const ids=postAll(r);const o=F.corr?S.j.find(x=>x.id==F.corr):null;if(o){o.corrBy=r.entries[0].vno}save();
  const msg=TT[F.k][0]+' of '+r.ccy+' '+mf(r.amt)+(r.ccy!=B?' ('+B+' '+mf(r.cad)+')':'')+' posted as '+r.entries[0].vno+'.';logA('Cash desk',msg+(o?' Correction of '+(o.vno||'#'+o.id)+'.':''));
  F.res={vno:r.entries[0].vno,msg,n:ids.length,id:ids[0]};F.step='done';render();toast(msg);go()}
 catch(e){if(!e||!e.pe)console.error(e);F.step='form';F.tried=true;render();const p=$('d3pv');if(p)p.insertAdjacentHTML('afterbegin',`<ul class="d3-nt bad" role="alert"><li>${ic('warn',14)}${A((e&&e.message)||'The entry could not be posted.')}</li></ul>`)}}
const clean=s=>{const o={};['k','cls','acct','cat','amt','ccy','rate','date','party','cust','ref','desc','att','note','br','to','tamt','xr','fee','feeAcct','tccy','vno','grp','corr'].forEach(k=>{if(s[k]!=null&&s[k]!=='')o[k]=s[k]});return o};
function setF(f,v,el,touch){if(!F)return;F.dirty=true;if(touch)F.touched[f]=1;let re=false;
 if(f=='cls'){pickCls(v);re=true}
 else if(f=='acct'){F.acct=v;F.ccy=(accById(v)||{}).ccy=='*'?F.ccy:'';F.rate='';syncAcct();if(F.k=='xfr'){if(F.to==v)F.to='';F.xr='';F.tamt='';syncTo()}re=true}
 else if(f=='to'){F.to=v;F.xr='';F.tamt='';syncTo();re=true}
 else if(f=='ccy'){F.ccy=v;F.rate='';syncAcct();re=true}
 else if(f=='cust'){F.cust=v;F.touched.party=1;F.touched.cust=1;re=true}
 else if(f=='amt'){F.amt=v;if(F.k=='xfr'&&+F.xr>0)F.tamt=v?String(R2(+v*+F.xr)):'';if(F.k=='xfr'){const t=$('d3f_tamt');if(t&&document.activeElement!=t)t.value=F.tamt}}
 else if(f=='xr'){F.xr=v;if(+v>0&&+F.amt>0){F.tamt=String(R2(+F.amt*+v));const t=$('d3f_tamt');if(t)t.value=F.tamt}}
 else if(f=='tamt'){F.tamt=v;if(+v>0&&+F.amt>0){F.xr=String(RT(+v/+F.amt));const t=$('d3f_xr');if(t)t.value=F.xr}}
 else if(f=='fee'){const had=+F.fee>0;F.fee=v;if(+v>0&&!F.feeAcct){const L=cats('out','exp');F.feeAcct=(L.find(o=>o.v==FEE)||L[0]||{}).v||''}if(had!=(+v>0))re=true}
 else if(f=='date'){F.date=v;re=true}
 else if(f=='br'){F.br=v;re=true}
 else F[f]=v;
 if(re)render();else soft()}
function attach(){const i=document.createElement('input');i.type='file';i.accept='image/png,image/jpeg,image/webp,application/pdf';i.style.display='none';i.addEventListener('change',()=>{const f=i.files[0];i.remove();if(!f||!F)return;if(f.size>1048576){toast('That file is larger than 1 MB. Attach a smaller photo or PDF.',1);return}if(!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(f.type||'')){toast('Attach a PDF, JPG or PNG file.',1);return}const fr=new FileReader();fr.onload=()=>{if(!F)return;F.att={name:f.name,type:f.type,size:f.size,data:fr.result};F.dirty=true;render()};fr.readAsDataURL(f)});document.body.appendChild(i);i.click()}
window.dx3Attach=(o)=>{if(F){F.att=o;F.dirty=true;render()}};

/* =====================================================================
   Approvals, reversals, audit trail
   ===================================================================== */
const apprOthers=mk=>(S.users||[]).filter(u=>['Owner','Manager'].includes(u.role)&&u.name!=mk&&(u.status||'Active')!='Inactive').length;
function canApprove(q){if(!isAppr()||!canPost())return'Only an Owner or Manager can approve.';if(q.by==uname()&&apprOthers(q.by)>0)return'You submitted this entry, so another Owner or Manager must approve it.';const lim=window.rbxLimit?+rbxLimit()||0:0;if(lim>0&&q.cad>lim+.004)return'This is over your '+BASE()+' '+mf(lim)+' limit. An Owner must approve it.';return''}
function qApprove(id){const q=Q().find(x=>x.id==id);if(!q||q.st!='Pending approval')return'This entry is no longer waiting for approval.';const no=canApprove(q);if(no)return no;
 const st={...q.s,k:q.k,vno:q.vno,touched:{},tried:true};const r=calc(st);
 if(!r.ok)return'It cannot be posted as entered: '+Object.values(r.er)[0]+' Reject it so the maker can correct it.';
 try{postAll(r,{appr:{by:uname(),at:now()},mk:q.by});}catch(e){return(e&&e.message)||'It could not be posted.'}
 q.st='Posted';q.hist.push({at:now(),by:uname(),act:'Approved and posted'});q.post=q.vno;save();logA('Cash approval','Approved and posted '+q.vno+' (entered by '+q.by+')');return''}
function qReject(id,why,wd){const q=Q().find(x=>x.id==id);if(!q||q.st!='Pending approval')return'This entry is no longer waiting for approval.';if(!wd){const no=canApprove(q);if(no&&!/over your/.test(no))return no}else if(q.by!=uname())return'Only the person who entered it can withdraw it.';if(!wd&&!String(why||'').trim())return'Write the reason for rejecting it.';
 q.st=wd?'Withdrawn':'Rejected';q.hist.push({at:now(),by:uname(),act:wd?'Withdrawn':'Rejected',note:why||''});save();logA('Cash approval',(wd?'Withdrawn ':'Rejected ')+q.vno+(why?': '+why:''));return''}
const grpOfX=x=>x.dxg?S.j.filter(z=>z.dxg==x.dxg&&!z.rev):[x];
const REVOK=['Cash in','Cash out','Transfer','Deposit','Withdrawal','Expense','Other income','Owner capital','Owner drawings','Bank charges','Bank interest','Bank'];
function revBlock(x){if(!canRev())return'Only an Owner, Manager or Accountant can reverse a posted entry.';if(!canPost())return'Your role cannot make changes in the cash desk.';if(x.rev)return'This is itself a reversing entry.';if(grpOfX(x).some(z=>z.revBy))return'Already reversed by '+((S.j.find(q=>q.id==grpOfX(x).find(z=>z.revBy).revBy)||{}).vno||'a reversing entry')+'.';if(x.tt=='Opening')return'Opening balances are changed in Settings, not reversed here.';if(!x.dx3&&(!REVOK.includes(x.tt)||(x.alloc&&x.alloc.length)))return'This entry is linked to invoices, bills, stock or exchange records. Reverse it from the screen where it was created.';return''}
function reverse(id,why,rdate){const x=S.j.find(z=>z.id==id);if(!x)return'Entry not found.';const b=revBlock(x);if(b)return b;if(!String(why||'').trim())return'Write the reason for the reversal.';
 const d=rdate||bizDate();if(d>today())return'The reversal date cannot be in the future.';const G=grpOfX(x);if(G.some(z=>z.br&&closedDay(z.br,d)))return'The cash day '+d+' is closed. Choose an open date for the reversal.';
 const n0=S.j.length,rv=nextV('RX');
 try{G.forEach(z=>{const{id:_i,vno:_v,at:_a,by:_b,revBy:_rb,aud:_au,appr:_ap,mk:_m,att:_t,corrBy:_cb,...rest}=z;post({...rest,date:d,tt:'Reversal',vno:rv,ref:z.vno||z.ref||('#'+z.id),memo:'Reversal of '+(z.vno||'#'+z.id)+': '+why.trim(),lines:z.lines.map(y=>[y[0],+y[2]||0,+y[1]||0]),rev:z.id,rvw:why.trim(),dx3:1,dxk:z.dxk||(isXfr(z,LIQSET())?'xfr':((z.lines.find(y=>LIQSET().has(String(y[0])))||[0,0,0])[1]>0?'out':'in')),dxg:z.dxg?z.dxg+'r':undefined,aud:[{at:now(),by:uname(),act:'Reversal posted',note:why.trim()}]})});
  S.j.slice(n0).forEach((r,i)=>{G[i].revBy=r.id;(G[i].aud=G[i].aud||[]).push({at:now(),by:uname(),act:'Reversed by '+rv,note:why.trim()})})}
 catch(e){S.j.length=n0;G.forEach(z=>{delete z.revBy});return(e&&e.message)||'The reversal could not be posted.'}
 save();logA('Reversal','Reversed '+(x.vno||'#'+x.id)+' with '+rv+': '+why.trim());return''}
function trail(x){const ev=[];const G=x.dxg?S.j.filter(z=>z.dxg==x.dxg):[x];const q=Q().find(q=>q.vno==x.vno&&!x.rev);
 if(q)q.hist.forEach(h=>ev.push([h.at,h.by,h.act,h.note]));
 if(!q)ev.push([x.at,x.mk||x.by,x.tt=='Reversal'?'Reversal posted':'Created and posted','']);
 if(x.appr)ev.push([x.appr.at,x.appr.by,'Approved','']);
 (x.aud||[]).forEach(h=>{if(/^Posted|Reversal posted/.test(h.act))return;ev.push([h.at,h.by,h.act,h.note])});
 if(x.rev){const o=S.j.find(z=>z.id==x.rev);ev.push([x.at,x.by,'Reverses '+(o?(o.vno||'#'+o.id):'#'+x.rev),x.rvw||''])}
 if(x.corrBy)ev.push(['','','Corrected by '+x.corrBy,'']);
 if(x.corr){const o=S.j.find(z=>z.id==x.corr);ev.push(['','','Correction of '+(o?(o.vno||'#'+o.id):''),''])}
 const key=String(x.vno||'').toLowerCase();if(key.length>3)(S.alog||[]).filter(a=>String(a.m||'').toLowerCase().includes(key)).slice(-6).forEach(a=>{if(!ev.some(e=>e[0]&&a.at&&Math.abs(new Date(e[0])-new Date(a.at))<3000))ev.push([a.at,a.by,a.k,a.m])});
 return ev.filter(e=>e[0]||e[2]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))}

/* =====================================================================
   Register (Daily transactions → Register tab)
   ===================================================================== */
function movements(L,acc,d,scope){const ls=LIQSET();const rows=[];const sel=acc?[acc]:scope;const ids=new Set(sel.map(a=>a.id));
 const by={};L.R.forEach(r=>{if(!ids.has(r.aid))return;const k=r.x.id+'|'+r.aid;const o=by[k]||(by[k]={x:r.x,aid:r.aid,a:L.by[r.aid],v:0,b:0,n:0,ccy:r.ccy});o.v+=valIn(r,L.by[r.aid]);o.b+=r.b;o.n+=r.n});
 Object.values(by).forEach(o=>{o.v=R2(o.v);o.b=R2(o.b);o.xf=isXfr(o.x,ls);rows.push(o)});
 rows.sort((a,b)=>a.x.date.localeCompare(b.x.date)||(+a.x.id)-(+b.x.id));const run={};rows.forEach(o=>{run[o.aid]=R2((run[o.aid]||0)+o.v);o.run=run[o.aid]});return rows}
function dayStats(a,d,M){const dc=dccy(a),pre=M.filter(o=>o.aid==a.id&&o.x.date<d),on=M.filter(o=>o.aid==a.id&&o.x.date==d),s=f=>R2(on.filter(f).reduce((t,o)=>t+o.v,0));
 const op=R2(pre.reduce((t,o)=>t+o.v,0)),ci=s(o=>!o.xf&&o.v>0),co=-s(o=>!o.xf&&o.v<0),ti=s(o=>o.xf&&o.v>0),to=-s(o=>o.xf&&o.v<0),ex=R2(op+ci-co+ti-to);
 const rec=(S.closings||[]).find(c=>c.acc==a.id&&c.date==d&&!c.reopened),q=(S.clq||[]).find(c=>c.acc==a.id&&c.date==d&&c.st=='Pending approval');let cnt=null,vr=null;
 if(rec){const rw=(rec.rows||[]).find(x=>(x.ccy||BASE())==dc)||(rec.rows||[])[0];if(rw&&rw.counted!=null){cnt=R2(+rw.counted);vr=R2(cnt-ex)}else{vr=R2(+rec.base||0)}}
 const pend=Q().filter(x=>x.st=='Pending approval'&&(x.s.acct==a.id||x.s.to==a.id)).length;
 return{a,dc,op,ci,co,ti,to,ex,cnt,vr,rec,q,n:on.length,pend,cad:R2(on.reduce((t,o)=>t+o.b,0)),opc:R2(pre.reduce((t,o)=>t+o.b,0))}}
const STL={posted:['Posted','ok'],reversed:['Reversed','mu'],reversal:['Reversal','info'],pend:['Pending approval','wn'],rej:['Rejected','bad'],wd:['Withdrawn','mu']};
const typL=(o)=>o.x.tt=='Reversal'?'Reversal':o.xf?(o.v>0?'Transfer in':'Transfer out'):(o.v>0?'Cash in':'Cash out');
const contra=(o)=>{const c=o.x.lines.filter(y=>!['1000','1010',o.a?o.a.gl:''].includes(String(y[0]))&&String(y[0])!=CLR).map(y=>String(y[0]));const u=[...new Set(c)];if(o.xf){const other=o.x.xto||o.x.xfrom;const t=other&&accById(other);if(t)return(o.v>0?'From ':'To ')+t.name;const sib=o.x.dxg&&S.j.find(z=>z.dxg==o.x.dxg&&z.id!=o.x.id&&z.acc);if(sib&&accById(sib.acc))return(o.v>0?'From ':'To ')+accById(sib.acc).name;return'Own accounts'}return u.map(c=>CH[c]||c).join(', ')};
const partyOf=x=>x.party||(x.cust&&typeof cn=='function'&&cn(x.cust)!='—'?cn(x.cust):'');
function stOf(x){return x.rev?'reversal':(x.revBy||(x.dxg&&S.j.some(z=>z.dxg==x.dxg&&z.revBy)))?'reversed':'posted'}
const qStat=q=>q.st=='Pending approval'?'pend':q.st=='Rejected'?'rej':q.st=='Withdrawn'?'wd':'';
function period(d){const f=W.f;if(f.per=='day')return[d,d];if(f.per=='7')return[addDays(d,-6),d];if(f.per=='30')return[addDays(d,-29),d];if(f.per=='mtd')return[d.slice(0,8)+'01',d];return[f.from||'0000',f.to||'9999']}
const addDays=(d,n)=>{const t=new Date(d+'T12:00:00');t.setDate(t.getDate()+n);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')};
function histRows(d,acc,scope,M){const f=W.f,[p0,p1]=period(d),q=(f.q||'').trim().toLowerCase();
 let rows=M.filter(o=>o.x.date>=p0&&o.x.date<=p1&&(!acc||o.aid==acc.id)).map(o=>({...o,st:stOf(o.x),typ:typL(o)}));
 const ids=new Set((acc?[acc]:scope).map(a=>a.id));
 Q().filter(z=>z.st!='Posted'&&(ids.has(z.s.acct)||ids.has(z.s.to))&&z.s.date>=p0&&z.s.date<=p1&&(z.st=='Pending approval'||(z.hist[z.hist.length-1]||{}).at>=addDays(d,-30))).forEach(z=>{const a=accById(ids.has(z.s.acct)?z.s.acct:z.s.to);const out=z.k!='in'&&a&&a.id==z.s.acct;rows.push({q:z,x:{id:'q'+z.id,date:z.s.date,vno:z.vno,ref:z.s.ref||z.vno,memo:z.s.desc||'',party:z.s.party||(z.s.cust?cn(z.s.cust):''),by:z.by,at:z.at},aid:a?a.id:'',a,v:out?-(+z.s.amt):+(z.k=='xfr'?(z.s.tamt||z.s.amt):z.s.amt),st:qStat(z),typ:z.k=='xfr'?(out?'Transfer out':'Transfer in'):z.k=='in'?'Cash in':'Cash out',run:null,xf:z.k=='xfr'})});
 if(f.typ)rows=rows.filter(o=>f.typ=='in'?o.typ=='Cash in':f.typ=='out'?o.typ=='Cash out':f.typ=='xfr'?/Transfer/.test(o.typ):o.typ=='Reversal');
 if(f.st)rows=rows.filter(o=>o.st==f.st);
 if(q)rows=rows.filter(o=>[o.x.vno,o.x.ref,o.x.memo,partyOf(o.x)||o.x.party,o.a&&o.a.name,o.x.by,o.q?'':contra(o)].join(' ').toLowerCase().includes(q));
 return rows.sort((a,b)=>b.x.date.localeCompare(a.x.date)||String(b.x.at||'').localeCompare(String(a.x.at||''))||((+String(b.x.id).replace('q',''))||0)-((+String(a.x.id).replace('q',''))||0))}
window.dx3Reg=function(d){W.d=d;const B=BASE(),L=ledger(),all=liq(),scope=all.filter(a=>canSee(a)&&inScope(a)&&(!a.off||L.R.some(r=>r.aid==a.id)));
 let acc=W.acc=='all'?null:scope.find(a=>a.id==W.acc)||scope.find(a=>a.id==window.__dxa)||scope[0]||null;if(acc)W.acc=acc.id;
 const M=movements(L,null,d,scope),ST=scope.map(a=>dayStats(a,d,M)),cw=canPost();
 const sel=acc?ST.find(s=>s.a.id==acc.id):null;const kc=(l,v,s,c,t)=>`<div class="cdk-k d3-k ${c||''}"${t?` title="${A(t)}"`:''}><small>${l}</small><b class="${c||''}">${v}</b>${s?`<span>${s}</span>`:''}</div>`;
 let kp;if(sel){const c=A(sel.dc),eq=v=>sel.dc!=B?B+' '+mf(v):'';const vr=sel.vr;
  kp=kc('Opening balance',c+' '+sm(sel.op),sel.dc!=B?B+' '+sm(sel.opc):'Start of '+A(d))+kc('Cash in',c+' '+mf(sel.ci),'','in')+kc('Cash out',c+' '+mf(sel.co),'','out')+kc('Transfers in',c+' '+mf(sel.ti),'From your other accounts')+kc('Transfers out',c+' '+mf(sel.to),'To your other accounts')+kc('Expected book balance',c+' '+sm(sel.ex),sel.n+' movement'+(sel.n==1?'':'s')+' on '+A(d))+kc('Physical count',sel.cnt!=null?c+' '+sm(sel.cnt):sel.rec?'Closed':'Not counted',sel.rec?'Closed by '+A(sel.rec.by||''):sel.q?'Awaiting approval':(cw&&sel.n?`<button type="button" class="d3-lk" onclick="dxCl('${A(sel.a.id)}')">Count and close</button>`:'—'))+kc('Closing variance',vr==null?'—':Math.abs(vr)<.005?'Balanced':(vr<0?'Short ':'Over ')+c+' '+mf(Math.abs(vr)),vr==null?'Shown after the count':Math.abs(vr)<.005?'Count equals book':'Count − expected',vr==null?'':Math.abs(vr)<.005?'in':vr<0?'out':'wn')}
 else{const s=f=>R2(ST.reduce((t,x)=>t+f(x),0)),cads=f=>R2(M.filter(o=>o.x.date==d&&f(o)).reduce((t,o)=>t+o.b,0));const cnt=ST.filter(x=>x.rec).length,act=ST.filter(x=>x.n).length,vv=R2(ST.filter(x=>x.rec).reduce((t,x)=>t+(+x.rec.base||0),0));
  const ob=R2(ST.reduce((t,x)=>t+x.opc,0));kp=kc('Opening balance',B+' '+sm(ob),'CAD ledger value, all accounts')+kc('Cash in',B+' '+mf(cads(o=>!o.xf&&o.b>0)),'','in')+kc('Cash out',B+' '+mf(-cads(o=>!o.xf&&o.b<0)),'','out')+kc('Transfers in',B+' '+mf(cads(o=>o.xf&&o.b>0)),'')+kc('Transfers out',B+' '+mf(-cads(o=>o.xf&&o.b<0)),'')+kc('Expected book balance',B+' '+sm(R2(ob+cads(()=>true))),'Not a sum of foreign balances')+kc('Physical count',cnt+' of '+act,'accounts counted and closed')+kc('Closing variance',Math.abs(vv)<.005?(cnt?'Balanced':'—'):B+' '+sm(vv),'Across closed accounts',Math.abs(vv)<.005?(cnt?'in':''):vv<0?'out':'wn')}
 const pq=Q().filter(q=>q.st=='Pending approval'&&scope.some(a=>a.id==q.s.acct)),pqc=R2(pq.reduce((t,q)=>t+q.cad,0));
 const accSel=`<div class="d3-rsel">${cbox('reg',[{v:'all',l:'All accounts',s:scope.length+' accounts · CAD ledger values',ic:'ceq'},...accOpts(scope.filter(a=>!a.off)).map(o=>o),...scope.filter(a=>a.off).map(a=>({v:a.id,l:a.name,s:'Inactive · '+a.why,r:'',g:'Inactive (history only)',ic:a.kind}))],acc?acc.id:'all','Choose an account','Accounts','')}</div>`;
 const acts=cw?`<div class="d3-acts"><button type="button" class="cdk-b" data-d3="new:out">${ic('out',16)}Cash out</button><button type="button" class="cdk-b dk" data-d3="new:in">${ic('in',16)}Cash in</button><button type="button" class="cdk-b" data-d3="new:xfr">${ic('xfr',16)}Transfer</button>${isAppr()?`<button type="button" class="cdk-b d3-gh" data-d3="ctl" aria-label="Cash desk controls" title="Cash desk controls">${ic('gear',16)}<span>Controls</span></button>`:''}</div>`:`<p class="d3-ro-n">${ic('lock',15)}View only. Your role (${A(role())}) cannot record cash desk entries.</p>`;
 const strip=pq.length?`<div class="d3-strip" role="status">${ic('clock',16)}<span><b>${pq.length} entr${pq.length==1?'y':'ies'} awaiting approval</b> · ${A(B)} ${mf(pqc)}. Pending entries do not change any balance until approved.</span><button type="button" class="d3-lk" data-d3="fst:pend">Review</button></div>`:'';
 /* balances by account, grouped by currency */
 const byC={};ST.forEach(x=>{(byC[x.dc]=byC[x.dc]||[]).push(x)});const ccys=Object.keys(byC).sort((a,b)=>a==B?-1:b==B?1:a.localeCompare(b));
 const chip=x=>x.rec?(x.vr!=null&&Math.abs(x.vr)>.004?['Closed · '+(x.vr<0?'short':'over'),x.vr<0?'bad':'wn']:['Closed','ok']):x.q?['Awaiting approval','wn']:x.n?(d<today()?['Not closed','bad']:['Open','info']):['No activity','mu'];
 const bal=`<div class="cdk-card d3-card"><div class="d3-ch"><h2>Balances <small>${A(d)} · by account, branch and currency</small></h2></div>${ccys.length?ccys.map(c=>{const g=byC[c],t=f=>R2(g.reduce((s,x)=>s+f(x),0));return`<div class="d3-cg2"><h3><span class="d3-cc">${A(c)}</span>${g.length} account${g.length==1?'':'s'}${c!=B?` <small>Totals are in ${A(c)}; CAD ledger ${A(B)} ${sm(R2(g.reduce((s,x)=>s+x.opc+x.cad,0)))}</small>`:''}</h3><div class="cdk-w"><table class="cdk-t d3-bt"><thead><tr><th>Account</th><th>Branch</th><th class="n">Opening</th><th class="n">In</th><th class="n">Out</th><th class="n">Transfers</th><th class="n">Expected</th><th class="n">Counted</th><th class="n">Variance</th><th>Status</th></tr></thead><tbody>${g.map(x=>{const ch=chip(x);return`<tr class="${acc&&acc.id==x.a.id?'on':''}" data-d3="acc:${A(x.a.id)}" tabindex="0"><td><span class="d3-an">${ic(x.a.kind,15)}<b>${A(x.a.name)}</b></span>${x.a.off?'<small class="d3-mu"> · inactive</small>':''}${x.pend?`<small class="wn"> · ${x.pend} pending</small>`:''}</td><td class="mu">${A(brL(x.a))}</td><td class="n">${sm(x.op)}</td><td class="n in">${x.ci?mf(x.ci):'—'}</td><td class="n out">${x.co?mf(x.co):'—'}</td><td class="n">${x.ti||x.to?(x.ti?'+'+mf(x.ti):'')+(x.ti&&x.to?' / ':'')+(x.to?'−'+mf(x.to):''):'—'}</td><td class="n"><b>${sm(x.ex)}</b></td><td class="n">${x.cnt!=null?sm(x.cnt):'—'}</td><td class="n ${x.vr==null?'':Math.abs(x.vr)<.005?'in':x.vr<0?'out':'wn'}">${x.vr==null?'—':Math.abs(x.vr)<.005?'0.00':sm(x.vr)}</td><td><span class="d3-st ${ch[1]}">${ch[0]}</span></td></tr>`}).join('')}</tbody><tfoot><tr><td colspan="2">Total ${A(c)}</td><td class="n">${sm(t(x=>x.op))}</td><td class="n">${mf(t(x=>x.ci))}</td><td class="n">${mf(t(x=>x.co))}</td><td class="n">${sm(t(x=>x.ti-x.to))}</td><td class="n"><b>${sm(t(x=>x.ex))}</b></td><td></td><td></td><td></td></tr></tfoot></table></div></div>`}).join(''):'<p class="cdk-em">No cash or bank accounts in this branch.</p>'}<p class="cdk-fn" style="margin:12px 0 0">Each currency is totalled on its own. Reporting uses ${A(B)}, the functional currency; foreign balances keep their original amounts.</p></div>`;
 /* movement history */
 const H=histRows(d,acc,scope,M),f=W.f,o=(v,l,cur)=>`<option value="${v}" ${cur==v?'selected':''}>${l}</option>`;
 const dc=acc?dccy(acc):B,showRun=!!acc&&!f.q&&!f.typ&&!f.st;
 const hist=`<div class="cdk-card d3-card"><div class="d3-ch"><h2>Movement history <small>${A(acc?acc.name:'All accounts')} · ${f.per=='day'?A(d):f.per=='c'?A((f.from||'start')+' → '+(f.to||'today')):({'7':'last 7 days','30':'last 30 days','mtd':'month to date'})[f.per]||''}</small></h2><button type="button" class="cdk-b d3-sm" data-d3="csv">${ic('dl',15)}Export CSV</button></div>
 <div class="d3-fl noprint" role="search"><div class="d3-srch">${ic('srch',15)}<input id="d3q" type="search" placeholder="Search voucher, reference, party…" value="${A(f.q)}" aria-label="Search movements" autocomplete="off"></div><select id="d3per" aria-label="Period">${o('day','Business date',f.per)}${o('7','Last 7 days',f.per)}${o('30','Last 30 days',f.per)}${o('mtd','Month to date',f.per)}${o('c','Custom range',f.per)}</select>${f.per=='c'?`<input type="date" id="d3from" aria-label="From" value="${A(f.from)}"><input type="date" id="d3to" aria-label="To" value="${A(f.to)}">`:''}<select id="d3typ" aria-label="Type">${o('','All types',f.typ)}${o('in','Cash in',f.typ)}${o('out','Cash out',f.typ)}${o('xfr','Transfers',f.typ)}${o('rev','Reversals',f.typ)}</select><select id="d3st" aria-label="Status">${o('','All statuses',f.st)}${o('posted','Posted',f.st)}${o('pend','Pending approval',f.st)}${o('rej','Rejected',f.st)}${o('reversed','Reversed',f.st)}${o('reversal','Reversal',f.st)}</select>${f.q||f.typ||f.st||f.per!='day'?'<button type="button" class="d3-lk" data-d3="freset">Clear filters</button>':''}</div>
 ${H.length?`<div class="cdk-w"><table class="cdk-t d3-ht"><thead><tr><th>Date</th><th>Voucher</th><th>Type</th>${acc?'':'<th>Account</th>'}<th>Party · category</th><th>Reference</th><th class="n">In</th><th class="n">Out</th>${showRun?'<th class="n">Balance</th>':''}<th>Status</th><th><span class="d3-vh">Open</span></th></tr></thead><tbody>${H.slice(0,300).map(r=>{const s=STL[r.st]||['',''];const c=r.a?dccy(r.a):B;const pc=[partyOf(r.x)||r.x.party,r.q?(r.q.k=='xfr'?'':((CLS[r.q.k]||{})[r.q.s.cls]||{}).t):contra(r)].filter(Boolean).join(' · ');return`<tr data-d3="${r.q?'q:'+A(r.q.id):'x:'+A(r.x.id)}" tabindex="0" class="${r.st=='reversed'?'d3-strk':''}"><td class="mu">${A(r.x.date)}</td><td><b>${A(r.x.vno||'#'+r.x.id)}</b>${r.x.att?` ${ic('clip',13,'d3-mu')}`:''}</td><td>${A(r.typ)}</td>${acc?'':`<td>${A(r.a?r.a.name:'')} <small class="mu">${A(c)}</small></td>`}<td>${A(pc||r.x.memo||'')}</td><td class="mu">${A(r.x.ref&&r.x.ref!=r.x.vno?r.x.ref:'')}</td><td class="n in">${r.v>0?mf(r.v):''}</td><td class="n out">${r.v<0?mf(-r.v):''}</td>${showRun?`<td class="n"><b>${r.run==null?'':sm(r.run)}</b></td>`:''}<td><span class="d3-st ${s[1]}">${s[0]}</span></td><td class="n"><span class="d3-lk">View</span></td></tr>`}).join('')}</tbody></table></div>${H.length>300?`<p class="cdk-fn">Showing 300 of ${H.length}. Narrow the filters or export to CSV for everything.</p>`:''}`:`<p class="cdk-em">No movements ${f.per=='day'?'on '+A(d):'in this period'}${f.q||f.typ||f.st?' match these filters':''}${acc?' for '+A(acc.name):''}.${f.per=='day'?' Change the business date or the period to see other days.':''}</p>`}</div>`;
 return`<div class="d3-reg"><div class="d3-top">${accSel}${acts}</div>${strip}<div class="cdk-kg d3-kg">${kp}</div>${bal}${hist}</div>`};
/* CSV export of current filters */
function csv(){const d=bizDate(),L=ledger(),all=liq(),scope=all.filter(a=>canSee(a)&&inScope(a));const acc=W.acc=='all'?null:scope.find(a=>a.id==W.acc);const M=movements(L,null,d,scope),H=histRows(d,acc,scope,M),B=BASE();
 const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';const head=['Date','Voucher','Account','Branch','Currency','Type','Party','Category / counter-account','Reference','Description','In','Out','Running balance','Rate to '+B,B+' amount','Status','Entered by','Approved by'];
 const lines=H.map(r=>{const c=r.a?dccy(r.a):B;return[r.x.date,r.x.vno||'#'+r.x.id,r.a?r.a.name:'',r.a?brL(r.a):'',c,r.typ,partyOf(r.x)||r.x.party||'',r.q?'':contra(r),r.x.ref||'',r.x.memo||'',r.v>0?r.v.toFixed(2):'',r.v<0?(-r.v).toFixed(2):'',r.run==null?'':r.run.toFixed(2),r.x.rate||(r.q?r.q.s.rate||'':1),r.q?(r.q.cad||0).toFixed(2):(r.b||0).toFixed(2),(STL[r.st]||[''])[0],r.x.mk||r.x.by||'',r.x.appr?r.x.appr.by:'']});
 const t='﻿'+[head.map(q).join(','),...lines.map(l=>l.map(q).join(','))].join('\r\n');const nmF='daily-transactions-'+(acc?acc.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase():'all-accounts')+'-'+d+'.csv';
 if(window.dlSave)dlSave(nmF,t,'text/csv');logA('Export','Daily transactions CSV ('+H.length+' rows)');return{name:nmF,rows:H.length,text:t}}
window.dx3Csv=csv;

/* ---------------- detail drawer ---------------- */
let DR=null;
function drawer(kind,id){DR={kind,id,err:'',mode:''};drRender()}
function drClose(){DR=null;const o=$('d3dr');if(o)o.remove();if(!$('d3ov')&&!$('d3cc'))document.body.classList.remove('d3-lock')}
function attHtml(att){if(!att||!att.data)return'<p class="d3-mu">No attachment.</p>';const img=/^image\//.test(att.type||'');return`<div class="d3-rcp">${img?`<img src="${A(att.data)}" alt="Attachment: ${A(att.name)}">`:`<object data="${A(att.data)}" type="application/pdf" aria-label="Attachment ${A(att.name)}"><p class="d3-mu">PDF preview is not available in this browser.</p></object>`}<div class="d3-rcf"><span>${ic('clip',14)}${A(att.name)} · ${Math.max(1,Math.round((att.size||0)/1024))} KB</span><button type="button" class="d3-lk" data-d3="attdl">Download</button></div></div>`}
function drRender(){if(!DR)return;const B=BASE();let h='',title='',chip=['',''],acts='';
 if(DR.kind=='x'){const x=S.j.find(z=>String(z.id)==String(DR.id));if(!x){drClose();return}const G=x.dxg?S.j.filter(z=>z.dxg==x.dxg):[x];const st=stOf(x),s=STL[st];chip=s;title=(x.vno||'#'+x.id);
  const a=accById(x.acc||aId(x)),C=x.dxk&&CLS[x.dxk]?CLS[x.dxk][x.cls]:null;const kv=(l,v)=>v?`<div><dt>${l}</dt><dd>${v}</dd></div>`:'';
  const fa=x.fa?A(x.ccy)+' '+mf(x.fa):'';h+=`<dl class="d3-kv d3-kvl">${kv('Type',A(x.tt+(C?' · '+C.t:'')))}${kv('Date',A(x.date))}${kv('Account',a?A(a.name)+' · '+A(kindL(a.kind)):'')}${kv('Branch',A(bn(x.br)))}${kv('Amount',fa?`<b>${fa}</b> <small>${A(B)} ${mf(R2(x.lines.filter(y=>LIQSET().has(String(y[0]))).reduce((t,y)=>t+Math.max(+y[1]||0,+y[2]||0),0)))}</small>`:`<b>${A(B)} ${mf(R2(x.lines.reduce((t,y)=>t+(+y[1]||0),0)))}</b>`)}${x.ccy&&x.ccy!=B?kv('Rate',rf(x.rate)+(x.spot?' book · '+rf(x.spot)+' transaction':'')):''}${x.xr?kv('Exchange rate','1 '+A(x.fccy)+' = '+rf(x.xr)+' '+A(x.ccy)):''}${kv(x.dxk=='out'?'Payee':'From',A(partyOf(x)))}${kv('Reference',A(x.ref&&x.ref!=x.vno?x.ref:''))}${kv('Description',A(x.memo))}${kv('Entered by',A((x.mk||x.by||'')+(x.at?' · '+stamp(x.at):'')))}${x.appr?kv('Approved by',A(x.appr.by+' · '+stamp(x.appr.at))):''}</dl>`;
  const rows=[];G.forEach(z=>z.lines.forEach(y=>rows.push([z,y])));const td=R2(rows.reduce((t,r)=>t+(+r[1][1]||0),0)),tc=R2(rows.reduce((t,r)=>t+(+r[1][2]||0),0));
  h+=`<h4>Journal${G.length>1?' · '+G.length+' linked entries':''}</h4><table class="d3-jt"><thead><tr><th>Account</th><th class="n">Debit</th><th class="n">Credit</th></tr></thead><tbody>${rows.map(([z,y])=>{const ac=accById(z.acc);return`<tr class="${z.revBy?'d3-strk':''}"><td><b>${A(y[0])} · ${A(CH[y[0]]||'')}</b>${ac&&ac.gl==String(y[0])?`<small>${A(ac.name)}${z.ccy&&z.ccy!=B?' · '+A(z.ccy)+' '+mf(R2((+y[1]||+y[2]||0)/(+z.rate||1))):''}</small>`:''}</td><td class="n">${+y[1]?mf(+y[1]):''}</td><td class="n">${+y[2]?mf(+y[2]):''}</td></tr>`}).join('')}</tbody><tfoot><tr><td>Total ${A(B)}</td><td class="n">${mf(td)}</td><td class="n">${mf(tc)}</td></tr></tfoot></table><p class="d3-bal ${Math.abs(td-tc)<.005?'ok':'bad'}">${ic(Math.abs(td-tc)<.005?'ok':'warn',14)}${Math.abs(td-tc)<.005?'Balanced':'Out of balance by '+mf(Math.abs(td-tc))}</p>`;
  const att=G.map(z=>z.att).find(Boolean);h+=`<h4>${x.dxk=='out'?'Receipt':'Attachment'}</h4>`+attHtml(att);DR.att=att;
  h+=`<h4>Audit trail</h4><ol class="d3-tl">${trail(x).map(e=>`<li><i></i><div><b>${A(e[2])}</b><small>${A(e[1]||'')}${e[0]?' · '+A(stamp(e[0])):''}</small>${e[3]?`<span>${A(e[3])}</span>`:''}</div></li>`).join('')}</ol>`;
  const blk=revBlock(x);
  if(DR.mode=='rev')acts=`<div class="d3-rv"><label class="d3-lb" for="d3rw">Reason for reversal <em>*</em></label><textarea class="d3-in" id="d3rw" rows="2" maxlength="200" placeholder="For example: wrong account, duplicate entry"></textarea><label class="d3-lb" for="d3rd">Reversal date</label><input class="d3-in" type="date" id="d3rd" value="${A(bizDate())}" max="${A(today())}"><p class="d3-hn">A reversing entry with opposite debits and credits is posted on this date. The original stays in the ledger, marked reversed.${DR.corr?' The form then opens with the original values so you can post the corrected entry.':''}</p>${DR.err?`<p class="d3-er" role="alert">${ic('warn',14)}${A(DR.err)}</p>`:''}<div class="d3-ra"><button type="button" class="d3-b" data-d3="revcancel">Cancel</button><button type="button" class="d3-b dg" data-d3="revgo">${ic('undo',15)}${DR.corr?'Reverse and correct':'Post reversal'}</button></div></div>`;
  else acts=blk?`<p class="d3-mu">${ic('lock',14)} Posted entries are never edited. ${A(blk)}</p>`:`<p class="d3-mu">${ic('lock',14)} Posted entries are never edited. Use a reversal to cancel it, or reverse and correct to replace it.</p><div class="d3-ra"><button type="button" class="d3-b" data-d3="rev">${ic('undo',15)}Reverse</button>${x.dx3&&x.dxk&&canPost()?`<button type="button" class="d3-b dk" data-d3="revcor">Reverse and correct</button>`:''}</div>`;
 }else{const q=Q().find(z=>z.id==DR.id);if(!q){drClose();return}const s=STL[qStat(q)]||['Posted','ok'];chip=s;title=q.vno;const t=q.s,a=accById(t.acct),T=t.to&&accById(t.to),C=q.k!='xfr'?(CLS[q.k]||{})[t.cls]:null;const kv=(l,v)=>v?`<div><dt>${l}</dt><dd>${v}</dd></div>`:'';
  h+=`<div class="d3-bn wn" role="note">${ic('clock',16)}<span>${q.st=='Pending approval'?'Not in the ledger yet. Balances change only after approval.':q.st=='Rejected'?'Rejected. Nothing was posted.':'Withdrawn. Nothing was posted.'} ${A(q.why||'')}</span></div><dl class="d3-kv d3-kvl">${kv('Type',A(TT[q.k][0]+(C?' · '+C.t:'')))}${kv('Date',A(t.date))}${kv(q.k=='in'?'Received into':'From',a?A(a.name):'')}${T?kv('To',A(T.name)):kv(C?C.lab:'',A(t.cat?nm(t.cat):''))}${kv('Amount',`<b>${A(q.ccy)} ${mf(q.amt)}</b> <small>${A(B)} ${mf(q.cad)}</small>`)}${kv(q.k=='out'?'Payee':'From',A(t.party||(t.cust?cn(t.cust):'')))}${kv('Reference',A(t.ref))}${kv('Description',A(t.desc))}${kv('Submitted by',A(q.by+' · '+stamp(q.at)))}</dl>`;
  const r=calc({...t,k:q.k,vno:q.vno,touched:{},tried:true});if(r.entries.length){const rows=[];r.entries.forEach(z=>z.lines.forEach(y=>rows.push(y)));h+=`<h4>Journal to be posted</h4><table class="d3-jt"><thead><tr><th>Account</th><th class="n">Debit</th><th class="n">Credit</th></tr></thead><tbody>${rows.map(y=>`<tr><td><b>${A(y[0])} · ${A(CH[y[0]]||(r.mk&&r.mk[1])||'')}</b></td><td class="n">${+y[1]?mf(+y[1]):''}</td><td class="n">${+y[2]?mf(+y[2]):''}</td></tr>`).join('')}</tbody></table>`}else if(q.st=='Pending approval')h+=`<p class="d3-er">${ic('warn',14)}It cannot be posted as entered: ${A(Object.values(r.er)[0]||'')}</p>`;
  h+=`<h4>Attachment</h4>`+attHtml(t.att);DR.att=t.att;h+=`<h4>Audit trail</h4><ol class="d3-tl">${q.hist.map(e=>`<li><i></i><div><b>${A(e.act)}</b><small>${A(e.by)} · ${A(stamp(e.at))}</small>${e.note?`<span>${A(e.note)}</span>`:''}</div></li>`).join('')}</ol>`;
  if(q.st=='Pending approval'){const no=canApprove(q),mine=q.by==uname();acts=(no?`<p class="d3-mu">${ic('lock',14)} ${A(no)}</p>`:'')+(!no||mine?`<label class="d3-lb" for="d3rw">${mine&&no?'Reason (optional)':'Comment (required to reject)'}</label><textarea class="d3-in" id="d3rw" rows="2" maxlength="200"></textarea>`:'')+(DR.err?`<p class="d3-er" role="alert">${ic('warn',14)}${A(DR.err)}</p>`:'')+`<div class="d3-ra">${mine?`<button type="button" class="d3-b" data-d3="qwd">Withdraw</button>`:''}${!no?`<button type="button" class="d3-b dg" data-d3="qrej">Reject</button><button type="button" class="d3-b dk" data-d3="qok">${ic('ok',15)}Approve and post</button>`:''}</div>`}}
 const html=`<div class="d3-dr" role="dialog" aria-modal="true" aria-labelledby="d3drt"><header class="d3-hd"><div><h2 id="d3drt">${A(title)}</h2><span class="d3-st ${chip[1]}">${A(chip[0])}</span></div><button type="button" class="d3-x" data-d3="drx" aria-label="Close">${ic('x',18)}</button></header><div class="d3-bd">${h}</div><footer class="d3-ft d3-dft">${acts}</footer></div>`;
 let o=$('d3dr');if(o)o.innerHTML=html;else{document.body.insertAdjacentHTML('beforeend',`<div class="d3-dro" id="d3dr">${html}</div>`);document.body.classList.add('d3-lock')}setTimeout(()=>{const t=$('d3rw');if(DR&&DR.mode=='rev'&&t)t.focus();else{const x=document.querySelector('#d3dr .d3-x');if(x&&!document.querySelector('#d3dr :focus'))x.focus()}},20)}

/* ---------------- controls (Owner / Manager) ---------------- */
let CC=null;
function ctlOpen(){if(!isAppr()){toast('Only an Owner or Manager can change cash desk controls.',1);return}const c=CFG();CC={thr:String(thr()||''),acc:JSON.parse(JSON.stringify(c.acc)),cat:JSON.parse(JSON.stringify(c.cat)),q:'',err:''};ctlRender()}
function ctlRender(){const L=liq(),B=BASE(),q=CC.q.toLowerCase();const ro=role()!='Owner';
 const accRows=L.map(a=>{const o=CC.acc[a.id]||{},sys=a.sysOff||!a.typeOk;return`<tr><td><span class="d3-an">${ic(a.kind,15)}<b>${A(a.name)}</b></span><small class="mu">${A(kindL(a.kind))} · GL ${A(a.gl)} · ${A(brL(a))} · ${A(a.ccy=='*'?'Multi-currency':a.ccy)}</small>${sys?`<small class="out">${A(a.why)}</small>`:''}</td><td>${a.ceq?`<label class="d3-tg"><input type="checkbox" data-cc="ceq:${A(a.id)}" ${o.ceq?'checked':''} ${ro?'disabled':''}><span>Approved cash equivalent</span></label>`:`<label class="d3-tg"><input type="checkbox" data-cc="on:${A(a.id)}" ${!o.off&&!sys?'checked':''} ${sys||ro?'disabled':''}><span>Active on cash desk</span></label>`}</td><td>${a.kind=='bank'?`<label class="d3-odl"><span>Overdraft limit</span><input class="d3-in" type="number" min="0" step="0.01" inputmode="decimal" data-cc="odl:${A(a.id)}" value="${A(o.odl||'')}" placeholder="0.00" ${ro?'disabled':''}> <small>${A(a.ccy)}</small></label>`:`<small class="mu">${a.kind=='cash'?'No overdraft. Cash cannot go below zero.':'No overdraft.'}</small>`}</td></tr>`}).join('');
 const cs=Object.keys(CH).filter(c=>['Income','Expenses'].includes(acType(c))&&!SYS_CAT.includes(String(c))).sort().filter(c=>!q||(c+' '+CH[c]).toLowerCase().includes(q));
 const catRows=cs.map(c=>`<label class="d3-tg d3-ctg"><input type="checkbox" data-cc="cat:${A(c)}" ${!(CC.cat[c]||{}).off?'checked':''} ${ro?'disabled':''}><span><b>${A(c)} · ${A(CH[c])}</b><small>${A(acType(c))} · ${A(grpOf(c))}</small></span></label>`).join('');
 const html=`<div class="d3-sh d3-ctl" role="document"><header class="d3-hd"><span class="d3-hi">${ic('gear',20)}</span><div><h2 id="d3cct">Cash desk controls</h2><p>Which accounts the cash desk may use, overdraft rules and the approval threshold.${ro?' Only an Owner can change these.':''}</p></div><button type="button" class="d3-x" data-d3="ccx" aria-label="Close">${ic('x',18)}</button></header><div class="d3-bd">
 <section class="d3-cs"><h3>Approval</h3><div class="d3-f"><label class="d3-lb" for="d3thr">Entries at or above this amount need approval (${A(B)})</label><input class="d3-in" id="d3thr" type="number" min="0" step="0.01" inputmode="decimal" value="${A(CC.thr)}" placeholder="0.00 = no threshold" ${ro?'disabled':''}><p class="d3-hn">Applies to entries made by Managers, Accountants and Cashiers. An Owner or Manager other than the person who entered it approves. Owners’ entries post directly and are logged.</p></div></section>
 <section class="d3-cs"><h3>Cash, bank and cash-equivalent accounts</h3><p class="d3-mu">From your Chart of Accounts (Cash &amp; Bank group) and Banks. Inactive accounts keep their history but cannot be selected.</p><div class="cdk-w"><table class="cdk-t d3-cct"><tbody>${accRows}</tbody></table></div></section>
 <section class="d3-cs"><h3>Income and expense categories</h3><p class="d3-mu">Turn off accounts the cash desk should not post to. System accounts (FX gain/loss, cash over/short, clearing) are never offered.</p><div class="d3-srch">${ic('srch',15)}<input class="d3-in d3-sq" id="d3ccq" type="search" placeholder="Search categories" value="${A(CC.q)}" aria-label="Search categories"></div><div class="d3-ctgs">${catRows||'<p class="d3-mu">No match.</p>'}</div></section>
 ${CC.err?`<p class="d3-er" role="alert">${ic('warn',14)}${A(CC.err)}</p>`:''}</div><footer class="d3-ft"><span class="d3-sp"></span><button type="button" class="d3-b" data-d3="ccx">${ro?'Close':'Cancel'}</button>${ro?'':`<button type="button" class="d3-b dk" data-d3="ccsave">${ic('ok',16)}Save controls</button>`}</footer></div>`;
 let o=$('d3cc');if(o){const sc=o.querySelector('.d3-bd')?o.querySelector('.d3-bd').scrollTop:0;const fid=document.activeElement&&document.activeElement.id;o.innerHTML=html;o.querySelector('.d3-bd').scrollTop=sc;if(fid&&$(fid))$(fid).focus()}else{document.body.insertAdjacentHTML('beforeend',`<div class="d3-ov" id="d3cc" role="dialog" aria-modal="true" aria-labelledby="d3cct">${html}</div>`);document.body.classList.add('d3-lock')}}
function ctlSave(){if(role()!='Owner')return;const t=CC.thr===''?0:+CC.thr;if(!(t>=0)){CC.err='The approval threshold must be zero or more.';ctlRender();return}
 for(const k in CC.acc){const o=CC.acc[k];if(o.odl!=null&&o.odl!==''&&!(+o.odl>=0)){CC.err='Overdraft limits must be zero or more.';ctlRender();return}}
 const c=CFG(),old=JSON.stringify([thr(),c.acc,c.cat]);S.cbk=S.cbk||{};S.cbk.thr=R2(t);c.acc=CC.acc;c.cat=CC.cat;save();if(old!=JSON.stringify([thr(),c.acc,c.cat]))logA('Cash desk controls','Updated: approval threshold '+(t?BASE()+' '+mf(t):'off')+'; '+Object.values(c.acc).filter(o=>o.off).length+' account(s) off; '+Object.values(c.cat).filter(o=>o.off).length+' categor(ies) off');CC=null;const o=$('d3cc');if(o)o.remove();if(!$('d3ov')&&!$('d3dr'))document.body.classList.remove('d3-lock');toast('Cash desk controls saved.');go()}

/* =====================================================================
   Events
   ===================================================================== */
function cbOpen(w,open){const b=w.querySelector('.d3-cbb'),p=w.querySelector('.d3-cbp');document.querySelectorAll('.d3-cb .d3-cbp:not([hidden])').forEach(x=>{if(x!==p){x.hidden=true;x.parentNode.querySelector('.d3-cbb').setAttribute('aria-expanded','false')}});p.hidden=!open;b.setAttribute('aria-expanded',open?'true':'false');if(open){const q=p.querySelector('.d3-cbq');q.value='';cbFilter(w,'');const on=p.querySelector('li[aria-selected="true"]');cbAct(w,on||p.querySelector('li[role=option]:not(.dis)'));setTimeout(()=>q.focus(),10);const r=p.getBoundingClientRect();if(r.bottom>window.innerHeight-8)p.classList.add('up');else p.classList.remove('up')}}
function cbFilter(w,q){q=q.trim().toLowerCase();let n=0,best=null;const words=q.split(/\s+/).filter(Boolean);w.querySelectorAll('li[role=option]').forEach(li=>{const l=li.dataset.cbl,all=l+' '+li.dataset.cbs;const on=!q||words.every(t=>all.includes(t));li.hidden=!on;if(on){n++;if(!best&&!li.classList.contains('dis')&&words.every(t=>l.includes(t)))best=li}});w.querySelectorAll('li.d3-cg').forEach(g=>{let e=g.nextElementSibling,any=false;while(e&&!e.classList.contains('d3-cg')){if(!e.hidden)any=true;e=e.nextElementSibling}g.hidden=!any});w.querySelector('.d3-cbn').hidden=n>0;cbAct(w,best||w.querySelector('li[role=option]:not([hidden]):not(.dis)'))}
function cbAct(w,li){w.querySelectorAll('li.act').forEach(x=>x.classList.remove('act'));const q=w.querySelector('.d3-cbq');if(li){li.classList.add('act');q.setAttribute('aria-activedescendant',li.id);li.scrollIntoView({block:'nearest'})}else q.removeAttribute('aria-activedescendant')}
function cbPick(w,li){if(!li||li.classList.contains('dis'))return;const n=w.dataset.cb,v=li.dataset.cbv;cbOpen(w,false);if(n=='reg'){W.acc=v;if(v!='all')window.__dxa=v;go();setTimeout(()=>{const b=$('d3f_reg');if(b)b.focus()},30);return}setF(n,v,null,1);setTimeout(()=>{const b=$('d3f_'+n);if(b)b.focus()},20)}
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;
 const cb=t.closest('.d3-cb');if(cb){if(t.closest('.d3-cbb')){e.preventDefault();cbOpen(cb,cb.querySelector('.d3-cbp').hidden);return}const li=t.closest('li[role=option]');if(li){cbPick(cb,li);return}if(t.closest('.d3-cbp'))return}
 document.querySelectorAll('.d3-cb .d3-cbp:not([hidden])').forEach(p=>{p.hidden=true;p.parentNode.querySelector('.d3-cbb').setAttribute('aria-expanded','false')});
 const el=t.closest('[data-d3]');if(!el)return;const[a,...rr]=el.dataset.d3.split(':'),v=rr.join(':');
 if(a=='new'){e.preventDefault();open(v);return}
 if(a=='acc'){W.acc=v;window.__dxa=v;go();return}
 if(a=='x'){drawer('x',v);return}if(a=='q'){drawer('q',v);return}
 if(a=='fst'){W.f.st=v;W.f.per='30';go();return}
 if(a=='freset'){W.f={q:'',per:'day',typ:'',st:'',from:'',to:''};go();return}
 if(a=='csv'){csv();return}
 if(a=='ctl'){ctlOpen();return}if(a=='ccx'){CC=null;const o=$('d3cc');if(o)o.remove();if(!$('d3ov')&&!$('d3dr'))document.body.classList.remove('d3-lock');return}if(a=='ccsave'){ctlSave();return}
 if(a=='drx'){drClose();return}
 if(a=='attdl'){if(DR&&DR.att&&window.dlSave){fetch(DR.att.data).then(r=>r.blob()).then(b=>dlSave(DR.att.name,b,DR.att.type))}return}
 if(a=='rev'||a=='revcor'){DR.mode='rev';DR.corr=a=='revcor';DR.err='';drRender();return}if(a=='revcancel'){DR.mode='';DR.err='';drRender();return}
 if(a=='revgo'){const why=($('d3rw')||{}).value||'',rd=($('d3rd')||{}).value||'';const x=S.j.find(z=>String(z.id)==String(DR.id));const m=reverse(x&&x.id,why,rd);if(m){DR.err=m;drRender();return}const cor=DR.corr;toast('Reversal posted for '+(x.vno||'#'+x.id)+'.');go();if(cor){drClose();const lq=x.dxg?S.j.filter(z=>z.dxg==x.dxg&&!z.rev):[x],a0=lq.find(z=>z.leg=='from')||lq[0],t0=lq.find(z=>z.leg=='to');const pre=x.dxk=='xfr'?{acct:a0.acc,to:t0&&t0.acc,amt:String(R2((a0.fa||Math.abs(a0.lines.find(y=>String(y[0])!=CLR&&String(y[0])!=a0.feeAcct)[2]))-(a0.fee||0))),fee:a0.fee?String(a0.fee):'',feeAcct:a0.feeAcct||'',tamt:t0&&t0.fa?String(t0.fa):'',xr:t0&&t0.xr?String(t0.xr):''}:{cls:x.cls||'',acct:x.acc,cat:String((x.lines.find(y=>!LIQSET().has(String(y[0]))&&String(y[0])!=RFX)||[''])[0]),amt:String(x.fa||R2(x.lines.find(y=>LIQSET().has(String(y[0])))[x.dxk=='in'?1:2])),rate:x.spot?String(x.spot):x.rate?String(x.rate):'',cust:x.cust||'',party:x.cust?'':x.party||''};open(x.dxk,{...pre,ref:x.ref&&x.ref!=x.vno?x.ref:'',desc:'',date:rd||bizDate(),corr:x.id,att:x.att||null});if(F&&F.k=='xfr'&&F.to){syncTo();render()}}else drRender();return}
 if(a=='qok'||a=='qrej'||a=='qwd'){const why=($('d3rw')||{}).value||'';const m=a=='qok'?qApprove(DR.id):qReject(DR.id,why,a=='qwd');if(m){DR.err=m;drRender();return}toast(a=='qok'?'Approved and posted.':a=='qwd'?'Withdrawn.':'Rejected.');go();drRender();return}
 if(!F)return;
 if(a=='close'){close(F.step!='form');return}if(a=='review'){review();return}if(a=='back'){F.step='form';render();return}if(a=='commit'){commit();return}
 if(a=='att'){attach();return}if(a=='attx'){F.att=null;F.dirty=true;render();return}
 if(a=='another'){const k=F.k,keep={acct:F.acct,date:F.date,cls:F.cls,cat:F.cat,to:F.to};F=null;open(k,keep);return}
 if(a=='viewres'){const id=F.res.id;close(true);drawer('x',id);return}
},false);
document.addEventListener('input',e=>{const t=e.target;if(t.classList&&t.classList.contains('d3-cbq')){cbFilter(t.closest('.d3-cb'),t.value);return}
 if(t.id=='d3q'){W.f.q=t.value;clearTimeout(window.__d3qt);window.__d3qt=setTimeout(()=>{go();setTimeout(()=>{const q=$('d3q');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}},0)},250);return}
 if(t.id=='d3ccq'&&CC){CC.q=t.value;ctlRender();return}
 if(t.id=='d3thr'&&CC){CC.thr=t.value;return}
 if(t.dataset&&t.dataset.cc&&CC){const[k,id]=t.dataset.cc.split(/:(.*)/s);if(k=='odl'){(CC.acc[id]=CC.acc[id]||{}).odl=t.value}return}
 if(F&&t.dataset&&t.dataset.d3f&&t.type!='radio'&&t.tagName!='SELECT'){setF(t.dataset.d3f,t.value,t)}});
document.addEventListener('change',e=>{const t=e.target;
 if(['d3per','d3typ','d3st','d3from','d3to'].includes(t.id)){const k={d3per:'per',d3typ:'typ',d3st:'st',d3from:'from',d3to:'to'}[t.id];W.f[k]=t.value;go();return}
 if(t.dataset&&t.dataset.cc&&CC){const[k,id]=t.dataset.cc.split(/:(.*)/s);if(k=='on'){(CC.acc[id]=CC.acc[id]||{}).off=!t.checked}else if(k=='ceq'){(CC.acc[id]=CC.acc[id]||{}).ceq=t.checked}else if(k=='cat'){if(t.checked)delete CC.cat[id];else CC.cat[id]={off:true}}return}
 if(F&&t.dataset&&t.dataset.d3f){if(t.type=='radio'||t.tagName=='SELECT')setF(t.dataset.d3f,t.value,t,1);else if(t.type=='date'){F.touched[t.dataset.d3f]=1;render()}}});
document.addEventListener('focusout',e=>{const t=e.target;if(F&&t.dataset&&t.dataset.d3f&&!F.touched[t.dataset.d3f]){F.touched[t.dataset.d3f]=1;soft()}});
document.addEventListener('keydown',e=>{const t=e.target;
 const cb=t.closest&&t.closest('.d3-cb');if(cb){const p=cb.querySelector('.d3-cbp');if(t.classList.contains('d3-cbb')&&['ArrowDown','Enter',' '].includes(e.key)&&p.hidden){e.preventDefault();cbOpen(cb,true);return}
  if(t.classList.contains('d3-cbq')){const vis=[...cb.querySelectorAll('li[role=option]:not([hidden]):not(.dis)')],cur=cb.querySelector('li.act'),i=vis.indexOf(cur);if(e.key=='ArrowDown'){e.preventDefault();cbAct(cb,vis[Math.min(vis.length-1,i+1)]);return}if(e.key=='ArrowUp'){e.preventDefault();cbAct(cb,vis[Math.max(0,i-1)]);return}if(e.key=='Home'){e.preventDefault();cbAct(cb,vis[0]);return}if(e.key=='End'){e.preventDefault();cbAct(cb,vis[vis.length-1]);return}if(e.key=='Enter'){e.preventDefault();cbPick(cb,cur);return}if(e.key=='Escape'){e.preventDefault();e.stopPropagation();cbOpen(cb,false);cb.querySelector('.d3-cbb').focus();return}if(e.key=='Tab'){cbOpen(cb,false)}}}
 if(e.key=='Enter'&&t.dataset&&t.dataset.d3&&t.tagName=='TR'){e.preventDefault();t.click();return}
 if(e.key=='Escape'){if($('d3cc')){e.stopPropagation();CC=null;$('d3cc').remove();if(!$('d3ov')&&!$('d3dr'))document.body.classList.remove('d3-lock');return}if($('d3dr')){e.stopPropagation();drClose();return}if(F){e.stopPropagation();close(F.step!='form');return}}
 if(F&&(e.ctrlKey||e.metaKey)&&e.key=='Enter'){e.preventDefault();if(F.step=='form')review();else if(F.step=='confirm')commit();return}
 if(e.key=='Tab'){const host=$('d3cc')||$('d3dr')||$('d3ov');if(!host)return;const fs=[...host.querySelectorAll('button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(x=>x.offsetParent!==null);if(!fs.length)return;const f0=fs[0],f1=fs[fs.length-1];if(e.shiftKey&&document.activeElement==f0){e.preventDefault();f1.focus()}else if(!e.shiftKey&&document.activeElement==f1){e.preventDefault();f0.focus()}else if(!host.contains(document.activeElement)){e.preventDefault();f0.focus()}}},true);
/* "New entry" / "Add transaction" menu: route money in / out / transfer to the CoA-driven forms */
window.addEventListener('click',e=>{const it=e.target.closest&&e.target.closest('[data-cbxa]');if(!it)return;const k=it.dataset.cbxa,L=()=>elig(),cashOf=()=>{const b=br!='all'?br:(ME().br&&ME().br!='All'?ME().br:S.br[0].id);return'cash|'+b},bankOf=()=>(L().find(a=>a.kind=='bank'&&a.ccy==BASE()&&(!a.br||br=='all'||a.br==br))||{}).id||'';
 const map={inc:['in',{cls:'inc'}],exp:['out',{cls:'exp'}],xfr:['xfr',{}],c2b:['xfr',{acct:cashOf(),to:bankOf()}],b2c:['xfr',{acct:bankOf(),to:cashOf()}]};if(!map[k])return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 document.querySelectorAll('.cbx-menu').forEach(m=>m.hidden=true);document.querySelectorAll('[data-cbxm]').forEach(b=>b.setAttribute('aria-expanded','false'));const[kk,pre]=map[k];open(kk,pre)},true);
window.dx3Open=open;
window.dx3=()=>({liq,elig,cats,calc,postAll,reverse,qApprove,qReject,ledger,balOf,carry,csv,canApprove,revBlock,get F(){return F},set acc(v){W.acc=v}});

/* =====================================================================
   Styles – follows the cash desk (cdk) look: warm neutrals, ink buttons,
   serif headings; restrained blue for focus, selection and information.
   ===================================================================== */
const css=document.createElement('style');css.id='dx3css';css.textContent=`
html body .dxt .d3-reg{font-family:Inter,system-ui,sans-serif}
html body .dxt .d3-reg{min-width:0;max-width:100%;width:100%}html body .dxt .d3-reg>*{min-width:0;max-width:100%}html body .dxt .d3-top>*{min-width:0}html body .d3-cbb{min-width:0;max-width:100%;overflow:hidden}html body .dxt .d3-reg .cdk-w{max-width:100%}
html body .dxt .d3-top{display:flex;gap:12px;align-items:stretch;flex-wrap:wrap;margin:0 0 16px}
html body .dxt .d3-rsel{flex:1 1 360px;min-width:0}
html body .dxt .d3-acts{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
html body .dxt .d3-acts .cdk-b svg{flex:none}html body .dxt .d3-gh{padding:10px 14px}
html body .dxt .d3-ro-n{display:flex;align-items:center;gap:8px;margin:0;color:#667085;font-size:14px;background:#F0EEE9;border-radius:12px;padding:10px 14px}
html body .d3-strip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#FBEFDD;color:#7A4E12;border:1px solid #F1DDBB;border-radius:12px;padding:10px 14px;margin:0 0 16px;font-size:14px}html body .d3-strip span{flex:1;min-width:220px}
html body .dxt .d3-kg{grid-template-columns:repeat(4,minmax(0,1fr))}
html body .dxt .d3-k{padding:16px 18px!important}html body .dxt .d3-k b{font-size:21px!important}html body .dxt .d3-k>span{display:block;margin-top:6px;font-size:12.5px;color:#667085;min-height:1em}
html body .dxt .d3-k b.in{color:#3F7D5C!important}html body .dxt .d3-k b.out{color:#B8372F!important}html body .dxt .d3-k b.wn{color:#B7791F!important}
html body .dxt .d3-card .d3-ch{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px}html body .dxt .d3-card .d3-ch h2{margin:0}
html body .dxt .d3-sm{padding:8px 14px!important;font-size:13px!important}
html body .dxt .d3-cg2+.d3-cg2{margin-top:20px}html body .dxt .d3-cg2 h3{display:flex!important;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 6px!important;font:600 14px Inter,sans-serif!important;color:#1B2233!important;text-transform:none!important;letter-spacing:0!important}html body .dxt .d3-cg2 h3 small{font-weight:400;color:#667085}
html body .d3-cc{display:inline-block;background:#172033;color:#fff;border-radius:8px;padding:3px 9px;font:600 12px Inter,sans-serif;letter-spacing:.04em}
html body .dxt .d3-bt td,html body .dxt .d3-ht td{padding:11px 10px!important;font-size:14px}html body .dxt .d3-bt tbody tr,html body .dxt .d3-ht tbody tr{cursor:pointer}html body .dxt .d3-bt tbody tr:hover td,html body .dxt .d3-ht tbody tr:hover td{background:#F7F6F3}html body .dxt .d3-bt tr.on td{background:#EEF4FF}html body .dxt .d3-bt tr.on td:first-child{box-shadow:inset 3px 0 0 #2563EB}
html body .dxt .d3-bt tbody tr:focus-visible,html body .dxt .d3-ht tbody tr:focus-visible{outline:2px solid #2563EB;outline-offset:-2px}
html body .dxt .d3-bt tfoot td{font-weight:600;border-top:1px solid #E4E2DD;padding:11px 10px;font-variant-numeric:tabular-nums}
html body .d3-an{display:inline-flex;align-items:center;gap:8px}html body .d3-an svg{color:#667085;flex:none}
html body .d3-st{display:inline-block;font:600 12px/1.4 Inter,sans-serif;padding:3px 10px;border-radius:99px;background:#F0EEE9;color:#667085;white-space:nowrap}html body .d3-st.ok{background:#E6F0EA;color:#2F6B4B}html body .d3-st.wn{background:#FBEFDD;color:#8A5A12}html body .d3-st.bad{background:#FBE9E7;color:#A12F28}html body .d3-st.info{background:#EAF1FE;color:#1D4ED8}
html body .dxt .d3-strk td:not(:last-child):not(:nth-last-child(2)){color:#98A2B3!important;text-decoration:line-through;text-decoration-color:#C9CED6}
html body .d3-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
html body .d3-fl{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 14px}html body .d3-fl select,html body .d3-fl input[type=date]{height:40px;border:1px solid #E4E2DD;border-radius:10px;background:#fff;padding:0 10px;font:500 13.5px Inter,sans-serif;color:#1B2233;width:auto;min-height:0}
html body .d3-srch{display:flex!important;flex-direction:row!important;align-items:center;gap:8px;border:1px solid #E4E2DD;border-radius:10px;background:#fff;padding:0 12px;height:40px;flex:1 1 240px;color:#98A2B3;min-width:0}html body .d3-srch:focus-within{border-color:#2563EB;box-shadow:0 0 0 3px #DBEAFE}html body .d3-srch input,html body .d3-ov .d3-srch .d3-in{border:0!important;flex:1;outline:0!important;box-shadow:none!important;background:transparent!important;font:400 14px Inter,sans-serif!important;color:#1B2233!important;width:100%;padding:0!important;margin:0!important;height:auto!important;min-height:0}
html body .d3-lk{background:none!important;border:0!important;color:#1D4ED8!important;font:600 13px Inter,sans-serif!important;cursor:pointer;padding:0!important;box-shadow:none!important;text-decoration:none}html body .d3-lk:hover{text-decoration:underline}
html body .d3-mu,html body .d3-reg .mu{color:#667085}html body .d3-reg .in,html body .d3-sh .in{color:#3F7D5C}html body .d3-reg .out,html body .d3-sh .out,html body .d3-dr .out{color:#B8372F}html body .d3-reg .wn{color:#B7791F}
/* combobox */
html body .d3-cb{position:relative;min-width:0}
html body .d3-cbb{width:100%;display:flex;align-items:center;gap:10px;min-height:46px;border:1px solid #E4E2DD!important;background:#fff!important;border-radius:12px!important;padding:6px 12px!important;cursor:pointer;text-align:left;color:#1B2233!important;font:inherit!important;box-shadow:none!important;margin:0!important}
html body .d3-cbb:hover{border-color:#CFCBC2!important}html body .d3-cbb:focus-visible,html body .d3-cbb[aria-expanded=true]{outline:0;border-color:#2563EB!important;box-shadow:0 0 0 3px #DBEAFE!important}html body .d3-cbb.bad{border-color:#B8372F!important;box-shadow:0 0 0 3px #FBE9E7!important}
html body .d3-cbv{display:flex;flex-direction:column;min-width:0;flex:1}html body .d3-cbv b,html body .d3-ot b{font:500 14.5px Inter,sans-serif;color:#1B2233;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}html body .d3-cbv small,html body .d3-ot small{font:400 12px Inter,sans-serif;color:#667085;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html body .d3-cbph{flex:1;color:#98A2B3;font:400 14.5px Inter,sans-serif}html body .d3-cbc{color:#667085;flex:none;margin-left:auto}
html body .d3-oi{width:28px;height:28px;border-radius:8px;background:#F0EEE9;color:#475467;display:grid;place-items:center;flex:none}html body .d3-oi:empty{display:none}
html body .d3-or{font:500 12.5px Inter,sans-serif;color:#475467;white-space:nowrap;font-variant-numeric:tabular-nums}
html body .d3-cbp{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:60;background:#fff;border:1px solid #D6DEEF;border-radius:12px;box-shadow:0 16px 40px rgba(16,24,40,.16);overflow:hidden;min-width:260px}html body .d3-cbp.up{top:auto;bottom:calc(100% + 6px)}html body .d3-cbp[hidden]{display:none}
html body .d3-cbs{display:flex;align-items:center;gap:8px;margin:8px;border:1px solid #E4E2DD;border-radius:10px;padding:0 10px;color:#98A2B3}html body .d3-cbs:focus-within{border-color:#2563EB}html body .d3-cbq{border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important;padding:9px 0!important;font:400 14px Inter,sans-serif!important;width:100%;color:#1B2233!important;margin:0!important;height:auto!important}
html body .d3-cbp ul{list-style:none;margin:0;padding:0 6px 6px;max-height:300px;overflow:auto}
html body .d3-cbp li[role=option]{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;cursor:pointer;min-width:0}html body .d3-cbp li[role=option][hidden],html body .d3-cbp li.d3-cg[hidden]{display:none}
html body .d3-cbp li.act{background:#EEF4FF}html body .d3-cbp li.on{background:#EAF1FE}html body .d3-cbp li.on b{color:#1D4ED8}html body .d3-cbp li.dis{opacity:.5;cursor:not-allowed}
html body .d3-ot{display:flex;flex-direction:column;min-width:0;flex:1}
html body .d3-cg{font:600 11px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#98A2B3;padding:10px 10px 4px}
html body .d3-cbn{margin:0;padding:12px 16px 14px;color:#667085;font-size:13px}
/* sheets */
html body.d3-lock{overflow:hidden}
html body .d3-ov{position:fixed;inset:0;z-index:300;background:rgba(23,32,51,.42);display:flex;justify-content:flex-end;font-family:Inter,system-ui,sans-serif;color:#1B2233}
html body .d3-ov *,html body .d3-dro *{box-sizing:border-box;text-transform:none;letter-spacing:normal}
html body .d3-sh{width:min(1040px,100%);height:100%;background:#FAF9F7;display:flex;flex-direction:column;box-shadow:-20px 0 50px rgba(16,24,40,.18);animation:d3in .18s ease-out}
html body .d3-ctl{width:min(820px,100%)}
@keyframes d3in{from{transform:translateX(24px);opacity:.6}to{transform:none;opacity:1}}
@media(prefers-reduced-motion:reduce){html body .d3-sh,html body .d3-dr{animation:none}}
html body .d3-hd{display:flex;align-items:center;gap:14px;padding:18px 24px;border-bottom:1px solid #EDEBE6;background:#fff}
html body .d3-hd h2{margin:0!important;font:600 22px/1.2 var(--sf,Georgia,serif)!important;color:#1B2233!important;letter-spacing:-.01em!important;text-transform:none!important}html body .d3-hd p{margin:3px 0 0;font-size:13.5px;color:#667085}html body .d3-hd>div{flex:1;min-width:0}
html body .d3-hi{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#F0EEE9;color:#1B2233;flex:none}html body .d3-hi.in{background:#E6F0EA;color:#2F6B4B}html body .d3-hi.out{background:#FBE9E7;color:#A12F28}html body .d3-hi.xfr{background:#EAF1FE;color:#1D4ED8}
html body .d3-vn{font:600 13px Inter,sans-serif;color:#475467;background:#F0EEE9;border-radius:8px;padding:5px 10px;font-variant-numeric:tabular-nums}html body .d3-vn:empty{display:none}
html body .d3-x{width:38px;height:38px;border-radius:10px;border:1px solid #E4E2DD!important;background:#fff!important;color:#475467!important;display:grid;place-items:center;cursor:pointer;padding:0!important;box-shadow:none!important;flex:none}html body .d3-x:hover{background:#F7F6F3!important}
html body .d3-bd{flex:1;overflow:auto;padding:20px 24px 28px}
html body .d3-ft{display:flex;align-items:center;gap:10px;padding:14px 24px;border-top:1px solid #EDEBE6;background:#fff;flex-wrap:wrap}html body .d3-sp{flex:1}html body .d3-hint{font-size:12.5px;color:#98A2B3}
html body .d3-b{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 18px!important;border-radius:12px!important;border:1px solid #E4E2DD!important;background:#fff!important;color:#1B2233!important;font:600 14px Inter,sans-serif!important;cursor:pointer;box-shadow:0 1px 2px #1b223310!important;margin:0!important;white-space:nowrap}
html body .d3-b:hover{filter:brightness(.97)}html body .d3-b.dk{background:#172033!important;border-color:#172033!important;color:#fff!important}html body .d3-b.dg{color:#A12F28!important;border-color:#F0C9C5!important}
html body .d3-b:focus-visible,html body .d3-x:focus-visible,html body .d3-lk:focus-visible,html body .d3-dz:focus-visible,html body .d3-ct:focus-within{outline:2px solid #2563EB!important;outline-offset:2px}
html body .d3-cols{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,1fr);gap:20px;align-items:start}
html body .d3-main{display:flex;flex-direction:column;gap:16px;min-width:0}
html body .d3-side{position:sticky;top:0;background:#fff;border:1px solid #EDEBE6;border-radius:16px;padding:18px;box-shadow:0 1px 2px #1b223308}
html body .d3-g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}html body .d3-amr{grid-template-columns:1.4fr 1fr}html body .d3-g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
html body .d3-f{display:flex;flex-direction:column;gap:6px;min-width:0}
html body .d3-lb{font:600 13px Inter,sans-serif!important;color:#344054!important;display:block;padding:0}html body .d3-lb em{color:#B8372F;font-style:normal}
html body .d3-ov .d3-in,html body .d3-dro .d3-in{width:100%;min-height:44px;border:1px solid #E4E2DD!important;border-radius:12px!important;background:#fff!important;padding:10px 12px!important;font:400 14.5px Inter,sans-serif!important;color:#1B2233!important;box-shadow:none!important;margin:0!important;outline:0;height:auto!important}
html body .d3-ov textarea.d3-in,html body .d3-dro textarea.d3-in{resize:vertical;min-height:64px}
html body .d3-ov .d3-in:focus,html body .d3-dro .d3-in:focus{border-color:#2563EB!important;box-shadow:0 0 0 3px #DBEAFE!important}
html body .d3-ov .d3-in:disabled{background:#F7F6F3!important;color:#667085!important}
html body .d3-ov .d3-am .d3-in{border:0!important;box-shadow:none!important;font:600 16px Inter,sans-serif!important;border-radius:0!important}
html body .d3-ov .d3-f.bad .d3-in,html body .d3-f.bad .d3-am{border-color:#B8372F!important}html body .d3-ov .d3-f.bad .d3-am .d3-in{border:0!important}
html body .d3-am{display:flex;align-items:center;border:1px solid #E4E2DD;border-radius:12px;background:#fff;overflow:hidden}html body .d3-am:focus-within{border-color:#2563EB;box-shadow:0 0 0 3px #DBEAFE}html body .d3-am span{padding:0 10px 0 12px;font:600 13px Inter,sans-serif;color:#667085;border-right:1px solid #EDEBE6}
html body .d3-ro{min-height:44px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px dashed #E4E2DD;border-radius:12px;padding:8px 12px;background:#F7F6F3;color:#475467;font:600 14px Inter,sans-serif}html body .d3-ro small{font-weight:400;color:#667085;font-size:12px}
html body .d3-er{display:flex;gap:6px;align-items:flex-start;margin:0;color:#A12F28;font:500 12.5px/1.4 Inter,sans-serif}html body .d3-er svg{flex:none;margin-top:1px}
html body .d3-hn{margin:0;color:#667085;font:400 12.5px/1.45 Inter,sans-serif}html body .d3-pl{margin-top:-6px}
html body .d3-fs{border:0;margin:0;padding:0;min-width:0}html body .d3-fs legend{margin:0 0 8px}
html body .d3-cls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
html body .d3-ct{position:relative;display:flex;flex-direction:column;gap:3px;border:1px solid #E4E2DD;border-radius:12px;background:#fff;padding:11px 12px;cursor:pointer;min-width:0}html body .d3-ct input{position:absolute;opacity:0;pointer-events:none}
html body .d3-ct b{font:600 14px Inter,sans-serif;color:#1B2233}html body .d3-ct small{font:400 12px/1.4 Inter,sans-serif;color:#667085}
html body .d3-ct:hover{border-color:#CFCBC2}html body .d3-ct.on{border-color:#2563EB;background:#F5F8FF;box-shadow:0 0 0 1px #2563EB}html body .d3-ct.on b{color:#1D4ED8}
html body .d3-fs.bad .d3-ct{border-color:#E8B4AF}
html body .d3-fxb{background:#F5F8FF;border:1px solid #DCE6FB;border-radius:14px;padding:14px}
html body .d3-dz{display:flex;align-items:center;gap:12px;width:100%;border:1.5px dashed #D0CCC3!important;border-radius:12px!important;background:#fff!important;padding:12px 14px!important;cursor:pointer;color:#475467!important;text-align:left;box-shadow:none!important;margin:0!important}html body .d3-dz span{display:flex;flex-direction:column}html body .d3-dz b{font:600 14px Inter,sans-serif;color:#1B2233}html body .d3-dz small{font:400 12px Inter,sans-serif;color:#667085}
html body .d3-at{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #E4E2DD;border-radius:12px;background:#fff;padding:10px 14px}html body .d3-at span{display:flex;align-items:center;gap:8px;min-width:0}html body .d3-at b{font:500 14px Inter,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}html body .d3-at small{color:#667085}
html body .d3-ph{display:flex;align-items:center;gap:8px;font:600 12px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase!important;color:#667085;margin:0 0 10px}
html body .d3-jt{width:100%;border-collapse:collapse;font-size:13.5px;font-variant-numeric:tabular-nums}html body .d3-jt th{font:500 12.5px Inter,sans-serif;color:#667085;text-align:left;padding:6px 6px;border-bottom:1px solid #EDEBE6;background:transparent!important;text-transform:none!important;letter-spacing:0!important}html body .d3-jt td{padding:8px 6px;border-bottom:1px solid #F1EFEA;vertical-align:top}html body .d3-jt td b{font-weight:500;display:block}html body .d3-jt td small{display:block;color:#667085;font-size:12px}html body .d3-jt .n{text-align:right;white-space:nowrap}html body .d3-jt tfoot td{font-weight:600;border-bottom:0;border-top:1px solid #E4E2DD}
html body .d3-bal{display:flex;align-items:center;gap:6px;margin:8px 0 0;font:600 12.5px Inter,sans-serif}html body .d3-bal.ok{color:#2F6B4B}html body .d3-bal.bad{color:#A12F28}
html body .d3-kv{display:grid;grid-template-columns:1fr;gap:6px;margin:12px 0 0}html body .d3-kv div{display:flex;justify-content:space-between;gap:12px;font-size:13px}html body .d3-kv dt{color:#667085}html body .d3-kv dd{margin:0;text-align:right;font-weight:500;font-variant-numeric:tabular-nums}html body .d3-kv dd small{color:#667085;font-weight:400;margin-left:4px}
html body .d3-kv.d3-kvl{gap:0;border:1px solid #EDEBE6;border-radius:12px;background:#fff;overflow:hidden}html body .d3-kv.d3-kvl div{padding:10px 14px;font-size:14px}html body .d3-kv.d3-kvl div+div{border-top:1px solid #F1EFEA}html body .d3-kv.d3-kvl dd{max-width:62%;overflow-wrap:anywhere}
html body .d3-blc{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0 0;padding:10px 12px;border-radius:12px;background:#F7F6F3;font-size:13px}html body .d3-blc span{flex:1 1 100%;color:#667085}html body .d3-blc b{font-variant-numeric:tabular-nums}
html body .d3-ap{display:flex;gap:10px;align-items:flex-start;margin:12px 0 0;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.45}html body .d3-ap span{display:flex;flex-direction:column}html body .d3-ap.ok{background:#E6F0EA;color:#2F6B4B}html body .d3-ap.wn{background:#FBEFDD;color:#7A4E12}html body .d3-ap svg{flex:none;margin-top:2px}
html body .d3-nt{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}html body .d3-nt li{display:flex;gap:8px;align-items:flex-start;font:500 13px/1.45 Inter,sans-serif;border-radius:10px;padding:8px 10px}html body .d3-nt li svg{flex:none;margin-top:2px}html body .d3-nt.bad li{background:#FBE9E7;color:#A12F28}html body .d3-nt.wn li{background:#FBEFDD;color:#7A4E12}
html body .d3-bn{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-radius:12px;font-size:13.5px;margin:0 0 4px}html body .d3-bn.info{background:#EAF1FE;color:#1E3A8A}html body .d3-bn.wn{background:#FBEFDD;color:#7A4E12;margin-bottom:14px}html body .d3-bn svg{flex:none;margin-top:2px}
html body .d3-cf h3,html body .d3-done h3{margin:0 0 6px;font:600 20px var(--sf,Georgia,serif);color:#1B2233;text-transform:none}html body .d3-cf>p{margin:0 0 14px}
html body .d3-done{max-width:520px;margin:40px auto;text-align:center}html body .d3-done p{color:#475467;margin:0 0 18px}html body .d3-dic{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;margin:0 auto 14px;background:#E6F0EA;color:#2F6B4B}html body .d3-dic.wn{background:#FBEFDD;color:#8A5A12}html body .d3-done .d3-kv{text-align:left;border:1px solid #EDEBE6;border-radius:12px;background:#fff;padding:12px 14px}
/* drawer */
html body .d3-dro{position:fixed;inset:0;z-index:310;background:rgba(23,32,51,.32);display:flex;justify-content:flex-end;font-family:Inter,system-ui,sans-serif;color:#1B2233}
html body .d3-dr{width:min(560px,100%);height:100%;background:#FAF9F7;display:flex;flex-direction:column;box-shadow:-20px 0 50px rgba(16,24,40,.18);animation:d3in .18s ease-out}
html body .d3-dr .d3-hd>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
html body .d3-dr h4{margin:20px 0 8px;font:600 12px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase!important;color:#667085}
html body .d3-dft{flex-direction:column;align-items:stretch}html body .d3-dft>p{margin:0;font-size:13px;display:flex;gap:6px;align-items:flex-start}html body .d3-ra{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}html body .d3-rv{display:flex;flex-direction:column;gap:8px}
html body .d3-tl{list-style:none;margin:0;padding:0 0 0 6px}html body .d3-tl li{position:relative;display:flex;gap:12px;padding:0 0 14px 14px;border-left:2px solid #E4E2DD}html body .d3-tl li:last-child{border-left-color:transparent}html body .d3-tl i{position:absolute;left:-6px;top:2px;width:10px;height:10px;border-radius:50%;background:#2563EB;box-shadow:0 0 0 3px #FAF9F7}html body .d3-tl b{display:block;font:600 13.5px Inter,sans-serif}html body .d3-tl small{display:block;color:#667085;font-size:12px}html body .d3-tl span{display:block;font-size:13px;color:#475467;margin-top:2px}
html body .d3-rcp{border:1px solid #EDEBE6;border-radius:12px;background:#fff;overflow:hidden}html body .d3-rcp img{display:block;max-width:100%;max-height:360px;margin:0 auto;object-fit:contain;background:#F7F6F3}html body .d3-rcp object{display:block;width:100%;height:360px}html body .d3-rcf{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid #F1EFEA;font-size:12.5px;color:#475467}html body .d3-rcf span{display:flex;gap:6px;align-items:center;min-width:0;overflow-wrap:anywhere}
/* controls */
html body .d3-cs{background:#fff;border:1px solid #EDEBE6;border-radius:16px;padding:18px;margin:0 0 16px}html body .d3-cs h3{margin:0 0 6px;font:600 16px Inter,sans-serif;color:#1B2233}html body .d3-cs>p{margin:0 0 12px;font-size:13px}
html body .d3-cct td{vertical-align:middle!important;padding:12px 8px!important}html body .d3-cct td small{display:block;margin-top:2px;font-size:12px}
html body .d3-tg{display:inline-flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:13.5px}html body .d3-tg input{width:18px!important;height:18px!important;min-height:0!important;accent-color:#2563EB;margin:1px 0 0!important;flex:none}html body .d3-tg span{display:flex;flex-direction:column}html body .d3-tg small{color:#667085;font-size:12px}
html body .d3-odl{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#667085;white-space:nowrap}html body .d3-ov .d3-odl .d3-in{width:120px!important;min-height:36px!important;padding:6px 10px!important}
html body .d3-ctgs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px;max-height:360px;overflow:auto;padding:2px}html body .d3-ctg{border:1px solid #EDEBE6;border-radius:10px;padding:9px 11px}
/* responsive */
@media(max-width:1100px){html body .dxt .d3-kg{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){html body .d3-cols{grid-template-columns:1fr}html body .d3-side{position:static}html body .d3-cls{grid-template-columns:1fr 1fr}html body .d3-g3{grid-template-columns:1fr 1fr}}
@media(max-width:640px){html body .dxt .d3-kg{gap:10px}html body .dxt .d3-k{padding:12px 14px!important}html body .dxt .d3-k b{font-size:17px!important}html body .dxt .d3-k small{font-size:10.5px!important;letter-spacing:.06em!important}html body .d3-acts{width:100%}html body .d3-acts .cdk-b{flex:1 1 auto;justify-content:center;padding:10px 12px!important}
 html body .d3-g2,html body .d3-g3,html body .d3-cls,html body .d3-ctgs{grid-template-columns:1fr}html body .d3-hd{padding:14px 16px}html body .d3-bd{padding:16px}html body .d3-ft{padding:12px 16px}html body .d3-ft .d3-b{flex:1 1 auto;justify-content:center}html body .d3-hint{display:none}html body .d3-vn{display:none}
 html body .dxt .d3-ht thead{display:none}html body .dxt .d3-ht,html body .dxt .d3-ht tbody,html body .dxt .d3-ht tr,html body .dxt .d3-ht td{display:block;width:100%}html body .dxt .d3-ht tr{border:1px solid #EDEBE6;border-radius:12px;padding:8px 12px;margin:0 0 10px;display:grid!important;grid-template-columns:1fr auto;gap:2px 10px}html body .dxt .d3-ht td{border:0!important;padding:2px 0!important;text-align:left!important}html body .dxt .d3-ht td.n{text-align:right!important}html body .dxt .d3-ht td:empty{display:none}
 html body .d3-fl select,html body .d3-fl input[type=date]{flex:1 1 140px}html body .d3-cct tr{display:flex;flex-direction:column;gap:8px}html body .d3-cct td{padding:4px 0!important;border:0!important}html body .d3-cct tr{border-bottom:1px solid #EFEDE8;padding:10px 0}}
`;document.head.appendChild(css);
})();
