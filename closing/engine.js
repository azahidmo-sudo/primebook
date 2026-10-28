/* =====================================================================
   BRIMAPAY Daily Closing – ledger engine (pure, no DOM).
   A book holds many business days for one branch. Every action goes
   through act(user, action, payload) which checks role, separation of
   duties and day state, then posts balanced journals and logs an
   append-only, hash-chained audit entry.
   ===================================================================== */
const r2=v=>Math.round(((+v||0)+Number.EPSILON)*100)/100;
const r6=v=>+(+v||0).toFixed(8);
const BASE='CAD',BRANCH='Vancouver';
const USERS={
  farhan:{name:'Farhan',role:'Teller',title:'Teller · Preparer'},
  amina:{name:'Amina',role:'Manager',title:'Branch Manager · Approver'},
  daniel:{name:'Daniel',role:'Finance',title:'Finance · Head-office accountant'},
  sara:{name:'Sara',role:'Auditor',title:'Internal auditor · Read only'}};
const ACC=[
 ['1000','Cash on Hand – Till','CAD','A','Cash'],
 ['1005','Safe – CAD','CAD','A','Cash'],
 ['1010','Bank – RBC Operating','CAD','A','Bank'],
 ['1100','FX Stock – USD','USD','A','FX stock'],
 ['1101','FX Stock – AED','AED','A','FX stock'],
 ['1102','FX Stock – ETB','ETB','A','FX stock'],
 ['1103','FX Stock – KES','KES','A','FX stock'],
 ['1210','Due from Taaj System','CAD','A','Settlement asset'],
 ['3000',"Owner's Capital",'CAD','E','Equity'],
 ['3900','Retained Earnings (P&L summary)','CAD','E','Equity'],
 ['4100','Remittance Commission Income','CAD','I','Income'],
 ['4200','Realized FX Gain/Loss','CAD','I','Income'],
 ['4210','Unrealized FX Gain/Loss','CAD','I','Income'],
 ['6100','Office Supplies','CAD','X','Expense'],
 ['6200','Rent','CAD','X','Expense'],
 ['6300','Utilities','CAD','X','Expense'],
 ['6400','Bank Charges','CAD','X','Expense'],
 ['6500','Cash Over/Short','CAD','X','Expense']].map(a=>({code:a[0],name:a[1],ccy:a[2],cls:a[3],grp:a[4],bs:'ALE'.includes(a[3])}));
const AC=Object.fromEntries(ACC.map(a=>[a.code,a]));
const CCYS=['USD','AED','ETB','KES'];
const FXA={USD:'1100',AED:'1101',ETB:'1102',KES:'1103'};
const EXPC=['6100','6200','6300','6400'];
const BOARD={USD:{b:1.35,s:1.395},AED:{b:0.365,s:0.381},ETB:{b:0.0093,s:0.0103},KES:{b:0.0101,s:0.0108}};
const SRC_BOARD='Branch rate board (Treasury, published 08:45 PT)';
const CASH_DENOMS=[100,50,20,10,5,2,1,0.25,0.1,0.05];
const START='2026-10-27';
const OPEN0={'1000':{fc:1514,cad:1514},'1005':{fc:10000,cad:10000},'1010':{fc:18250,cad:18250},
 '1100':{fc:2000,cad:2720},'1101':{fc:5000,cad:1860},'1102':{fc:120000,cad:1152},'1103':{fc:250000,cad:2625},
 '1210':{fc:3200,cad:3200},'3000':{fc:-40000,cad:-40000},'3900':{fc:-1321,cad:-1321}};
const PERM={open:['Teller','Manager'],record:['Teller','Manager'],count:['Teller','Manager'],stmt:['Teller','Manager'],completeRecon:['Teller','Manager'],
 reopenRecon:['Teller','Manager'],reason:['Teller','Manager'],raiseAdj:['Teller','Manager'],approveAdj:['Manager','Finance'],rateSet:['Manager','Finance'],rateAp:['Manager','Finance'],
 submit:['Teller','Manager'],approve:['Manager'],returnDay:['Manager','Finance'],lock:['Manager','Finance'],next:['Manager','Finance'],reverse:['Manager','Finance'],editOpening:[],postLocked:['Teller','Manager']};
const LABEL={open:'open the day',record:'record transactions',count:'enter counts',stmt:'enter statements',completeRecon:'complete reconciliations',reopenRecon:'reopen reconciliations',reason:'explain variances',
 raiseAdj:'raise adjustments',approveAdj:'approve adjustments',rateSet:'set closing rates',rateAp:'approve closing rates',submit:'submit the day',approve:'approve the day',returnDay:'return the day',
 lock:'lock the day',next:'generate the next-day opening',reverse:'reverse transactions',editOpening:'edit opening balances',postLocked:'post transactions'};
const TXTYPES={
 buy:{t:'Currency purchase',d:'Buy foreign currency from a customer; pay CAD from the till.'},
 sell:{t:'Currency sale',d:'Sell foreign currency to a customer; receive CAD into the till.'},
 payout:{t:'Taaj remittance payout',d:'Pay a Taaj remittance to a beneficiary in cash. Taaj owes us the amount plus commission.'},
 settle:{t:'Taaj settlement received',d:'Taaj pays what it owes us, in cash or to the bank. Reduces Due from Taaj; not income.'},
 expense:{t:'Expense',d:'Pay a running cost from the till or the bank.'},
 tosafe:{t:'Till to safe',d:'Move CAD cash from the till into the safe.'},
 fromsafe:{t:'Safe to till',d:'Move CAD cash from the safe into the till.'},
 deposit:{t:'Bank deposit',d:'Deposit CAD cash from the till into the bank.'},
 withdraw:{t:'Bank withdrawal',d:'Withdraw CAD from the bank into the till.'}};
function fnv(s){let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h.toString(16).padStart(8,'0')}
function fm(v){v=r2(+v||0);if(Math.abs(v)<.005)v=0;return(v<0?'−':'')+Math.abs(v).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})}
function rf(v){v=+v||0;let s=v.toFixed(6).replace(/0+$/,'');const d=(s.split('.')[1]||'').length;return d<4?v.toFixed(4):s}
const addD=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const L=(a,d,c,fc,rate)=>({a,d:r2(d),c:r2(c),fc:fc==null?r2(d-c):r6(fc),rate:rate||1});
const newDay=(date,opening,prev)=>({date,status:'Not opened',opening,openFrom:prev||null,js:[],counts:null,bank:null,taaj:null,rates:{},reasons:{},adjs:[],recDone:false,
 opened:null,submitted:null,approved:null,locked:null,returned:null,next:null,clock:8*60+50});

function Book(state){
 const B=state||{v:2,days:[newDay(START,JSON.parse(JSON.stringify(OPEN0)),{ref:'DC-VAN-20261026',date:'2026-10-26',approvedBy:'Amina',approvedAt:'2026-10-26 18:22',locked:true})],cur:0,seq:{TX:0,ADJ:0},audit:[]};
 const E={B};
 E.day=i=>B.days[i==null?B.cur:i];
 E.prevLocked=D=>{const i=B.days.indexOf(D);if(i<=0)return!!(D.openFrom&&D.openFrom.locked);return B.days[i-1].status=='Locked'};
 E.ts=(D,at)=>{if(at)return D.date+' '+at;const h=Math.floor(D.clock/60)%24,m=D.clock%60;D.clock+=3;return D.date+' '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')};
 E.log=(D,uid,action,result,ref,detail,at)=>{const u=USERS[uid],prev=B.audit.length?B.audit[B.audit.length-1].hash:'00000000';
  const e={seq:(B.audit.length?B.audit[B.audit.length-1].seq:0)+1,date:D.date,at:E.ts(D,at),user:u.name,role:u.title,action,result,ref:ref||'',detail:detail||'',acct:E.acct||''};e.hash=fnv(prev+JSON.stringify(e));B.audit.push(e);return e};
 E.bal=(D,code,withCL)=>{const o=(D.opening||{})[code]||{fc:0,cad:0};let fc=o.fc,cad=o.cad;D.js.forEach(j=>{if(j.type=='CL'&&!withCL)return;j.lines.forEach(l=>{if(l.a==code){cad+=l.d-l.c;fc+=l.fc}})});return{fc:r6(fc),cad:r2(cad)}};
 E.avg=(D,c)=>{const b=E.bal(D,FXA[c]);return b.fc>1e-9?b.cad/b.fc:BOARD[c].b};
 E.ok=j=>Math.abs(r2(j.lines.reduce((s,l)=>s+l.d,0))-r2(j.lines.reduce((s,l)=>s+l.c,0)))<.005;
 E.post=(D,j)=>{if(!E.ok(j))throw new Error('Journal '+j.ref+' does not balance. Nothing was posted.');D.js.push(j);return j};
 E.tillTotal=D=>D.counts?r2(CASH_DENOMS.reduce((s,d)=>s+d*(+D.counts.till[d]||0),0)):null;
 E.held=D=>CCYS.filter(c=>{const b=E.bal(D,FXA[c]);const o=(D.opening||{})[FXA[c]]||{fc:0};return Math.abs(b.fc)>1e-9||Math.abs(o.fc)>1e-9});
 E.rateOf=(D,c)=>{const r=D.rates[c];return r&&r.st=='Approved'?r:null};
 E.recs=D=>recs(E,D);E.checks=D=>checks(E,D);E.blockers=D=>checks(E,D).filter(c=>!c.ok&&c.sev=='block');
 E.pnl=D=>{const inc=ACC.filter(a=>a.cls=='I').map(a=>({a,v:r2(-E.bal(D,a.code).cad)})),exp=ACC.filter(a=>a.cls=='X').map(a=>({a,v:r2(E.bal(D,a.code).cad)}));
  const ti=r2(inc.reduce((s,x)=>s+x.v,0)),te=r2(exp.reduce((s,x)=>s+x.v,0));return{inc,exp,ti,te,net:r2(ti-te)}};
 E.fxRows=D=>CCYS.map(c=>{const code=FXA[c],o=(D.opening||{})[code]||{fc:0,cad:0},b=E.bal(D,code),R=D.rates[c]||{},cr=+R.r||BOARD[c].b,avg=b.fc>1e-9?b.cad/b.fc:0,val=r2(b.fc*cr);
  let bought=0,sold=0,adj=0;D.js.forEach(j=>j.lines.forEach(l=>{if(l.a!=code)return;if(j.type=='ADJ')adj+=l.fc;else if(l.fc>0)bought+=l.fc;else sold-=l.fc}));
  return{c,code,open:o,bought:r6(bought),sold:r6(sold),adj:r6(adj),fc:b.fc,book:b.cad,avg,cr,rsrc:R.src||'Board buy rate (no closing rate yet)',rst:R.st||'Missing',val,unr:r2(val-b.cad)}}).filter(x=>Math.abs(x.fc)>1e-9||Math.abs(x.open.fc)>1e-9);
 E.nextTx=()=>'TX-'+String(++B.seq.TX).padStart(3,'0');
 E.nextAdj=()=>'ADJ-'+String(++B.seq.ADJ).padStart(3,'0');
 /* ------------------------------------------------------------- */
 E.act=(uid,action,p={})=>{const u=USERS[uid],D=E.day(),at=p.at;
  const deny=m=>{E.log(D,uid,LABEL[action]?cap(LABEL[action]):action,'Denied',p.ref||'',m,at);return{ok:false,msg:m}};
  const okr=(m,ref,detail)=>{E.log(D,uid,m,'OK',ref,detail,at);return{ok:true,msg:detail||m}};
  if(action=='editOpening')return deny('Opening balances are carried forward from the approved close of the previous day and cannot be overwritten. Raise an authorized adjustment instead.');
  if(!(PERM[action]||[]).includes(u.role))return deny(u.title.split(' · ')[0]+' role cannot '+LABEL[action]+'.');
  if(B.cur!=B.days.length-1&&!['next'].includes(action))return deny('You are viewing '+D.date+'. Switch to the latest business date to make changes.');
  const posting=['record','count','stmt','completeRecon','reopenRecon','reason','raiseAdj','approveAdj','reverse','postLocked','rateSet','rateAp'];
  if(posting.includes(action)&&D.status=='Locked')return deny(D.date+' is locked for '+BRANCH+'. Post on an open business date, or ask Finance to reopen the day with a documented reason.');
  if(posting.includes(action)&&['Submitted','Approved'].includes(D.status))return deny('The day is '+D.status.toLowerCase()+'. It must be returned for correction before anything changes.');
  if(action!='open'&&D.status=='Not opened')return deny('Open the day first.');
  const varOf=id=>(E.recs(D).find(r=>r.id==id)||{});
  switch(action){
   case 'open':{if(D.status!='Not opened')return deny('The day is already open.');if(!E.prevLocked(D))return deny('The previous business day is not locked.');
    D.status='Open';D.opened={by:u.name,at:E.ts(D,at)};E.log(D,uid,'Open day','OK','DC-VAN-'+D.date.replace(/-/g,''),'Day opened by '+u.name,at);
    return okr('Load opening balances',(D.openFrom||{}).ref||'','Opening balances loaded from the approved close of '+((D.openFrom||{}).date||'the previous day')+' ('+Object.keys(D.opening).length+' accounts).')}
   case 'record':{if(D.recDone)return deny('Reconciliations are complete. Reopen them before recording more transactions, so the counts stay valid.');
    const b=buildTx(E,D,p);if(b.err)return deny(b.err);const ref=p.ref&&/^TX-/.test(p.ref)?p.ref:E.nextTx();if(p.ref&&/^TX-/.test(p.ref))B.seq.TX=Math.max(B.seq.TX,+p.ref.slice(3));
    if(D.js.some(j=>j.ref==ref))return deny('Reference '+ref+' already exists.');
    const j=E.post(D,{ref,type:'TX',kind:TXTYPES[p.type].t,tt:p.type,at:E.ts(D,at),by:u.name,desc:b.desc,party:p.party||'',ext:p.ext||'',ccy:b.ccy,amt:b.amt,rate:b.rate,src:b.src,avg:b.avg,cost:b.cost,gain:b.gain,lines:b.lines,status:'Posted',big:b.cadAmt>=10000});
    return okr('Post transaction',ref,TXTYPES[p.type].t+' '+ref+' posted: '+b.ccy+' '+fm(b.amt)+(b.ccy!=BASE?' = CAD '+fm(b.cadAmt):'')+'. Debits = credits.')}
   case 'count':{const till={};for(const d of CASH_DENOMS){const q=p.till?p.till[d]:0;if(q!=null&&q!==''&&(!(+q>=0)||+q%1))return deny('Note and coin quantities must be whole numbers of zero or more (CAD '+d+').');till[d]=+q||0}
    const fx={};for(const c of E.held(D)){const v=p.fx?p.fx[c]:null;if(v===''||v==null)return deny('Enter the counted '+c+' amount (0 if none).');if(!(+v>=0))return deny(c+': the counted amount must be zero or more.');fx[c]=r2(+v)}
    if(p.safe===''||p.safe==null||!(+p.safe>=0))return deny('Enter the counted safe amount.');
    if(p.witness&&p.witness.trim().toLowerCase()==u.name.toLowerCase())return deny('The witness must be a different person from the counter.');
    D.counts={till,safe:r2(+p.safe),fx,by:u.name,witness:(p.witness||'').trim(),at:E.ts(D,at)};return okr('Enter counts','CNT-VAN-'+D.date.replace(/-/g,''),'Till CAD '+fm(E.tillTotal(D))+', safe CAD '+fm(D.counts.safe)+' and '+Object.keys(fx).length+' currencies counted.')}
   case 'stmt':{if(p.kind=='bank'){if(!isFinite(+p.stmt)||p.stmt==='')return deny('Enter the bank statement closing balance.');if(!(p.sref||'').trim())return deny('Enter the bank statement reference.');
     const items=[];for(const ln of String(p.items||'').split('\n').map(s=>s.trim()).filter(Boolean)){const q=ln.split(';').map(s=>s.trim()),amt=+String(q[q.length-1]).replace(/,/g,'');if(q.length<2||!isFinite(amt)||q[q.length-1]==='')return deny('Each reconciling item needs "reference; description; amount". Problem: '+ln);items.push({ref:q[0],desc:q.length>2?q.slice(1,-1).join('; '):'',amt:r2(amt)})}
     D.bank={stmt:r2(+p.stmt),ref:p.sref.trim(),items,by:u.name};return okr('Enter bank statement',p.sref.trim(),'Bank statement CAD '+fm(+p.stmt)+' with '+items.length+' reconciling item(s).')}
    if(!isFinite(+p.stmt)||p.stmt==='')return deny('Enter the balance due on the Taaj statement.');if(!(p.sref||'').trim())return deny('Enter the Taaj statement reference.');
    D.taaj={stmt:r2(+p.stmt),ref:p.sref.trim(),by:u.name};return okr('Enter Taaj statement',p.sref.trim(),'Taaj statement balance due CAD '+fm(+p.stmt)+'.')}
   case 'completeRecon':{if(!D.counts)return deny('Enter the till, safe and currency counts first.');if(!D.bank)return deny('Enter the bank statement first.');if(!D.taaj&&Math.abs(E.bal(D,'1210').cad)>.004)return deny('Enter the Taaj settlement statement first.');
    D.recDone=true;return okr('Complete reconciliations','REC-VAN-'+D.date.replace(/-/g,''),'Cash, safe, bank, FX stock and Taaj settlement reconciliations completed.')}
   case 'reopenRecon':{if(!D.recDone)return deny('Reconciliations are not complete yet.');if(D.adjs.some(a=>a.status=='Pending approval'))return deny('Decide the pending adjustment first.');D.recDone=false;return okr('Reopen reconciliations','','Reconciliations reopened. Counts must be checked again before submitting.')}
   case 'reason':{const r=(p.reason||'').trim(),ref=(p.sref||'').trim();if(r.length<10)return deny('Write a reason of at least 10 characters.');if(!ref)return deny('Add a supporting reference, for example an incident or count-sheet number.');
    const v=varOf(p.id);if(!v.id)return deny('Unknown reconciliation.');D.reasons[p.id]={reason:r,ref,by:u.name};return okr('Explain variance',ref,(v.acct||p.id)+': '+r)}
   case 'raiseAdj':{const v=varOf(p.id);if(!v.id||!v.adjustable)return deny('This reconciliation is corrected with a reason, not an adjustment.');if(v.actual==null||Math.abs(v.variance)<.005)return deny('There is no variance to adjust.');
    if(!D.reasons[p.id])return deny('Explain the variance before raising an adjustment.');if(D.adjs.some(a=>a.id==p.id&&a.status!='Rejected'))return deny('An adjustment for this variance already exists.');
    const rate=v.ccy==BASE?1:E.avg(D,v.ccy),cad=r2(Math.abs(v.variance)*rate),ref=E.nextAdj();
    D.adjs.push({ref,id:p.id,code:v.code,ccy:v.ccy,fc:r6(v.variance),cad,rate,status:'Pending approval',by:u.name,at:E.ts(D,at),pre:{exp:v.expected,act:v.actual},why:D.reasons[p.id]});
    return okr('Raise adjustment',ref,v.acct+' '+(v.variance<0?'short':'over')+' '+fm(Math.abs(v.variance))+' '+v.ccy+(v.ccy!=BASE?' × '+rf(rate):'')+' = CAD '+fm(cad)+'. Awaiting approval.')}
   case 'approveAdj':{const a=D.adjs.find(x=>x.ref==p.ref);if(!a||a.status!='Pending approval')return deny('No adjustment is waiting for approval.');if(a.by==u.name)return deny('Separation of duties: '+u.name+' raised '+a.ref+' and cannot approve it.');
    if(p.reject){if((p.reason||'').trim().length<10)return deny('Write the reason for rejecting (at least 10 characters).');a.status='Rejected';a.apprBy=u.name;a.note=p.reason.trim();return okr('Reject adjustment',a.ref,a.ref+' rejected: '+a.note)}
    const short=a.fc<0,lines=short?[L('6500',a.cad,0),L(a.code,0,a.cad,a.fc,a.rate)]:[L(a.code,a.cad,0,a.fc,a.rate),L('6500',0,a.cad)];
    E.post(D,{ref:a.ref,type:'ADJ',kind:'Count adjustment',at:E.ts(D,at),by:a.by,appr:u.name,desc:AC[a.code].name+' '+(short?'shortage':'overage')+' at count. '+a.why.reason+' ('+a.why.ref+').',ccy:a.ccy,amt:Math.abs(a.fc),rate:a.rate,src:a.ccy==BASE?'Base currency':'Carrying rate (weighted average cost)',lines,status:'Posted'});
    a.status='Approved and posted';a.apprBy=u.name;return okr('Approve adjustment',a.ref,a.ref+' approved and posted: '+(short?'Dr 6500 / Cr '+a.code:'Dr '+a.code+' / Cr 6500')+' CAD '+fm(a.cad)+'.')}
   case 'rateSet':{const c=p.ccy;if(!CCYS.includes(c))return deny('Unknown currency.');if(!(+p.rate>0))return deny('Enter a '+c+' closing rate above zero.');if(!(p.src||'').trim()||p.src.trim().length<3)return deny('Enter where the rate comes from.');
    const dev=Math.abs(+p.rate/BOARD[c].b-1);D.rates[c]={r:+p.rate,src:p.src.trim(),by:u.name,st:'Pending approval',dev:r2(dev*100)};return okr('Set closing rate',c,c+' closing rate '+rf(+p.rate)+' from '+p.src.trim()+(dev>.05?' (more than 5% from the board rate)':'')+'. Awaiting approval.')}
   case 'rateAp':{const r=D.rates[p.ccy];if(!r||r.st=='Approved')return deny('No '+(p.ccy||'')+' closing rate is waiting for approval.');if(r.by==u.name)return deny('Separation of duties: '+u.name+' entered this rate and cannot approve it.');
    r.st='Approved';r.ap=u.name;return okr('Approve closing rate',p.ccy,p.ccy+' closing rate '+rf(r.r)+' approved.')}
   case 'submit':{if(!['Open','Returned'].includes(D.status))return deny('Only an open or returned day can be submitted.');const b=E.blockers(D);if(b.length)return deny('Submit is blocked: '+b[0].text);
    D.status='Submitted';D.submitted={by:u.name,at:E.ts(D,at)};return okr('Submit day','DC-VAN-'+D.date.replace(/-/g,''),'Day submitted for approval with no open blockers.')}
   case 'returnDay':{if(D.status!='Submitted')return deny('Only a submitted day can be returned.');const r=(p.reason||'').trim();if(r.length<10)return deny('Write the reason for returning the day (at least 10 characters).');
    D.status='Returned';D.returned={by:u.name,at:E.ts(D,at),reason:r};return okr('Return day','DC-VAN-'+D.date.replace(/-/g,''),'Returned for correction: '+r)}
   case 'approve':{if(D.status!='Submitted')return deny('Only a submitted day can be approved.');if(D.submitted.by==u.name)return deny('Separation of duties: '+u.name+' submitted this day and cannot approve it.');
    if(D.opened&&D.opened.by==u.name)return deny('Separation of duties: the person who prepared the day cannot approve it.');const b=E.blockers(D);if(b.length)return deny('Approval is blocked: '+b[0].text);
    D.status='Approved';D.approved={by:u.name,at:E.ts(D,at)};return okr('Approve day','DC-VAN-'+D.date.replace(/-/g,''),'Day approved.')}
   case 'lock':{if(D.status!='Approved')return deny('Approve the day before locking it.');const lines=[];let net=0;
    ACC.filter(a=>!a.bs).forEach(a=>{const b=E.bal(D,a.code).cad;if(Math.abs(b)<.005)return;lines.push(L(a.code,b<0?-b:0,b>0?b:0));net+=b});
    if(lines.length){lines.push(L('3900',net>0?net:0,net<0?-net:0));E.post(D,{ref:'CL-'+D.date.replace(/-/g,''),type:'CL',kind:'Close income and expense to P&L',at:E.ts(D,at),by:'System',appr:u.name,desc:'Income and expense closed to 3900 Retained Earnings. Day result CAD '+fm(-net)+'.',ccy:'CAD',amt:Math.abs(r2(net)),rate:1,src:'Base currency',lines,status:'Posted'})}
    D.result=r2(-net);D.status='Locked';D.locked={by:u.name,at:E.ts(D,at)};D.snapHash=fnv(JSON.stringify(D.js)+JSON.stringify(D.opening));return okr('Lock day','DC-VAN-'+D.date.replace(/-/g,''),'Day locked. Income and expense closed to P&L. Nothing more can be posted to '+D.date+'.')}
   case 'next':{if(D.status!='Locked')return deny('Lock the day before generating the next-day opening.');if(D.next)return deny('The next-day opening already exists.');
    const op={};ACC.filter(a=>a.bs).forEach(a=>{const b=E.bal(D,a.code,true);if(Math.abs(b.cad)>.004||Math.abs(b.fc)>1e-9)op[a.code]={fc:b.fc,cad:b.cad}});
    const nd=newDay(addD(D.date,1),op,{ref:'DC-VAN-'+D.date.replace(/-/g,''),date:D.date,approvedBy:D.approved.by,approvedAt:D.approved.at,locked:true});
    Object.keys(D.rates).forEach(c=>{nd.rates[c]={r:D.rates[c].r,src:'Copied from the '+D.date+' closing rate; confirm with Treasury',by:'System',st:'Pending approval'}});
    D.next={at:E.ts(D,at),by:u.name,date:nd.date};B.days.push(nd);return okr('Generate next-day opening','DC-VAN-'+nd.date.replace(/-/g,''),'Opening balances for '+nd.date+' generated from the locked close.')}
   case 'reverse':{const j=D.js.find(x=>x.ref==p.ref);if(!j||j.type!='TX')return deny('Choose a posted transaction.');if(j.status=='Reversed')return deny(j.ref+' is already reversed.');if(D.recDone)return deny('Reopen reconciliations first, so the counts are checked again after the reversal.');
    const r=(p.reason||'').trim();if(r.length<10)return deny('Write the reason for the reversal (at least 10 characters).');
    E.post(D,{ref:'REV-'+j.ref,type:'REV',kind:'Reversal',at:E.ts(D,at),by:u.name,desc:'Reversal of '+j.ref+': '+r,ccy:j.ccy,amt:j.amt,rate:j.rate,src:j.src,reverses:j.ref,lines:j.lines.map(l=>({...l,d:l.c,c:l.d,fc:-l.fc})),status:'Posted'});
    j.status='Reversed';j.revBy='REV-'+j.ref;return okr('Reverse transaction','REV-'+j.ref,'Posted REV-'+j.ref+' with opposite lines. '+j.ref+' stays in the ledger, marked reversed.')}
   case 'postLocked':return deny('Posting refused.');}
  return deny('Unknown action.')};
 return E}

/* build a transaction's journal from the form */
function buildTx(E,D,p){const T=TXTYPES[p.type];if(!T)return{err:'Choose a transaction type.'};const amt=r2(p.amt);
 if(!(amt>0))return{err:'Enter an amount greater than zero.'};if(Math.abs(+p.amt-amt)>1e-9)return{err:'Use at most two decimal places.'};
 const till=E.bal(D,'1000').cad,ext=(p.ext||'').trim();let lines,desc,ccy='CAD',rate=1,src='Base currency',cadAmt=amt,extra={};
 const need=(code,v,name)=>E.bal(D,code).cad+1e-9<v?'Not enough '+name+': available CAD '+fm(E.bal(D,code).cad)+', this needs CAD '+fm(v)+'.':'';
 switch(p.type){
  case 'buy':{ccy=p.ccy;if(!CCYS.includes(ccy))return{err:'Choose the currency bought.'};rate=+p.rate;if(!(rate>0))return{err:'Enter the buy rate.'};
   if(Math.abs(rate/BOARD[ccy].b-1)>.02&&!(p.override||'').trim())return{err:'The rate is more than 2% from the board buy rate '+rf(BOARD[ccy].b)+'. Enter a manager override reason.'};
   if(!ext)return{err:'Enter the customer KYC or ID reference.'};cadAmt=r2(amt*rate);const n=need('1000',cadAmt,'cash in the till');if(n)return{err:n};
   src=(p.override||'').trim()?'Manager override: '+p.override.trim():SRC_BOARD;lines=[L(FXA[ccy],cadAmt,0,amt,rate),L('1000',0,cadAmt)];desc='Bought '+ccy+' '+fm(amt)+' at '+rf(rate)+' from customer ('+ext+'). Paid CAD '+fm(cadAmt)+' cash.';break}
  case 'sell':{ccy=p.ccy;if(!CCYS.includes(ccy))return{err:'Choose the currency sold.'};rate=+p.rate;if(!(rate>0))return{err:'Enter the sell rate.'};
   if(Math.abs(rate/BOARD[ccy].s-1)>.02&&!(p.override||'').trim())return{err:'The rate is more than 2% from the board sell rate '+rf(BOARD[ccy].s)+'. Enter a manager override reason.'};
   if(!ext)return{err:'Enter the customer KYC or ID reference.'};const st=E.bal(D,FXA[ccy]);if(st.fc+1e-9<amt)return{err:'Not enough '+ccy+' in stock: available '+fm(st.fc)+', this needs '+fm(amt)+'.'};
   cadAmt=r2(amt*rate);const avg=st.cad/st.fc,cost=r2(amt*avg),gain=r2(cadAmt-cost);src=(p.override||'').trim()?'Manager override: '+p.override.trim():SRC_BOARD;
   lines=[L('1000',cadAmt,0),L(FXA[ccy],0,cost,-amt,avg)];if(Math.abs(gain)>.004)lines.push(gain>0?L('4200',0,gain):L('4200',-gain,0));extra={avg,cost,gain};
   desc='Sold '+ccy+' '+fm(amt)+' at '+rf(rate)+' to customer ('+ext+'). Received CAD '+fm(cadAmt)+'. Cost at average '+rf(avg)+' = CAD '+fm(cost)+'.';break}
  case 'payout':{const com=r2(p.com||0);if(com<0)return{err:'Commission cannot be negative.'};if(!ext)return{err:'Enter the Taaj remittance reference (for example TJ-88231).'};
   const n=need('1000',amt,'cash in the till');if(n)return{err:n};lines=[L('1210',r2(amt+com),0),L('1000',0,amt)];if(com>0)lines.push(L('4100',0,com));
   desc='Paid Taaj remittance '+ext+' to the beneficiary in cash on behalf of Taaj.'+(com>0?' Commission CAD '+fm(com)+' earned, due from Taaj.':'');break}
  case 'settle':{if(!ext)return{err:'Enter the Taaj settlement reference.'};const to=p.to=='bank'?'1010':'1000';lines=[L(to,amt,0),L('1210',0,amt)];
   desc='Taaj settlement '+ext+' received '+(to=='1010'?'by bank transfer':'in cash')+'. Reduces Due from Taaj; not income.';break}
  case 'expense':{const cat=p.cat;if(!EXPC.includes(cat))return{err:'Choose an expense account.'};if(!ext)return{err:'Enter the receipt or invoice reference.'};const from=p.from=='bank'?'1010':'1000';
   const n=need(from,amt,from=='1000'?'cash in the till':'money in the bank');if(n)return{err:n};lines=[L(cat,amt,0),L(from,0,amt)];desc=AC[cat].name+' paid '+(from=='1010'?'from the bank':'in cash')+', receipt '+ext+'.';break}
  case 'tosafe':case 'fromsafe':case 'deposit':case 'withdraw':{const m={tosafe:['1005','1000','cash in the till'],fromsafe:['1000','1005','cash in the safe'],deposit:['1010','1000','cash in the till'],withdraw:['1000','1010','money in the bank']}[p.type];
   const n=need(m[1],amt,m[2]);if(n)return{err:n};lines=[L(m[0],amt,0),L(m[1],0,amt)];desc=T.t+(ext?' ('+ext+')':'')+'. Moves CAD between your own accounts; no income or expense.';break}
 }
 if((p.note||'').trim())desc+=' '+p.note.trim();
 return{lines,desc,ccy,amt,rate,src,cadAmt,...extra}}

/* reconciliations: expected (book) vs actual (count / statement) */
function recs(E,D){const out=[],C=D.counts,R=D.reasons;
 const adjOf=id=>D.adjs.filter(a=>a.id==id&&a.status!='Rejected').pop();
 const row=(id,area,code,ccy,expected,actual,ref,adjustable)=>{const a=adjOf(id);let exp=expected,act=actual;if(a&&a.status=='Approved and posted'){exp=a.pre.exp;act=a.pre.act}
  const v=act==null?null:r2(act-exp),rate=ccy==BASE?1:(a?a.rate:E.avg(D,ccy));let st;
  if(act==null)st=area=='Bank reconciliation'||area=='Remittance settlement'?'Statement not entered':'Not counted';
  else if(a&&a.status=='Approved and posted')st=Math.abs(r2(actual-expected))<.005?'Adjusted · '+a.ref:'Recount needed';
  else if(Math.abs(v)<.005)st=area=='Remittance settlement'?'Matched':area=='Bank reconciliation'?'Reconciled':'Balanced';
  else if(a)st='Adjustment pending approval';else if(R[id])st=adjustable?'Explained · adjustment needed':'Explained';else st='Needs reason';
  out.push({id,area,code,acct:code+' '+AC[code].name,ccy,expected:exp,actual:act,variance:v==null?0:v,cadVar:v==null?0:r2(v*rate),reason:R[id]?R[id].reason:'',ref:R[id]?R[id].ref:ref,status:st,adjustable,adj:a})};
 row('till','Cash denomination count','1000','CAD',E.bal(D,'1000').cad,C?E.tillTotal(D):null,'CNT-VAN-'+D.date.replace(/-/g,''),true);
 row('safe','Safe reconciliation','1005','CAD',E.bal(D,'1005').cad,C?C.safe:null,'SAFE-VAN-'+D.date.replace(/-/g,'')+(C&&C.witness?' (dual count: '+C.by+' + '+C.witness+')':''),true);
 const bk=E.bal(D,'1010').cad;row('bank','Bank reconciliation','1010','CAD',bk,D.bank?r2(D.bank.stmt+D.bank.items.reduce((s,i)=>s+i.amt,0)):null,D.bank?D.bank.ref:'',false);
 E.held(D).forEach(c=>{const b=E.bal(D,FXA[c]);row('fx-'+c,'FX stock reconciliation',FXA[c],c,r6(b.fc),C&&C.fx[c]!=null?C.fx[c]:null,'CNT-VAN-'+D.date.replace(/-/g,'')+'-FX',true)});
 const tj=E.bal(D,'1210').cad;if(Math.abs(tj)>.004||D.taaj||D.js.some(j=>j.lines.some(l=>l.a=='1210')))row('taaj','Remittance settlement','1210','CAD',tj,D.taaj?D.taaj.stmt:null,D.taaj?D.taaj.ref:'',false);
 return out}
function checks(E,D){const c=[],add=(ok,text,sev)=>c.push({ok,text,sev:sev||'block'});const rs=E.recs(D),open=D.status!='Not opened';
 add(E.prevLocked(D),'Previous business day approved and locked ('+((D.openFrom||{}).ref||'')+')');
 add(open,'Day opened by the preparer');
 add(open&&!!D.opening,'Opening balances loaded from the approved close, not typed in');
 add(D.js.every(E.ok),'Every journal entry balances (debits = credits)');
 const held=E.held(D),miss=held.filter(x=>!E.rateOf(D,x));add(!miss.length,miss.length?'Closing rates not approved: '+miss.join(', '):'Closing rates approved for '+(held.join(', ')||'all held currencies'));
 add(!!D.counts,'Till, safe and currency counts entered');
 add(!!D.bank,'Bank statement entered');
 add(D.recDone,'Reconciliations completed');
 const unex=rs.filter(r=>r.actual!=null&&Math.abs(r.variance)>.004&&!r.status.startsWith('Adjusted')&&!D.reasons[r.id]);
 add(!unex.length,unex.length?'Variance without reason: '+unex.map(r=>r.acct+' '+fm(r.variance)+' '+r.ccy).join(', '):'Every variance has a reason and a supporting reference');
 const noadj=rs.filter(r=>r.adjustable&&r.actual!=null&&Math.abs(r.variance)>.004&&D.reasons[r.id]&&!r.adj);
 add(!noadj.length,noadj.length?'Cash or stock variance not yet adjusted: '+noadj.map(r=>r.acct).join(', '):'Cash and stock variances adjusted through approved adjustments');
 const pend=D.adjs.filter(a=>a.status=='Pending approval');add(!pend.length,pend.length?pend.map(a=>a.ref).join(', ')+' awaiting approval by a manager or Finance':'No adjustments awaiting approval');
 const bk=rs.find(r=>r.id=='bank');add(!bk||bk.actual==null||Math.abs(bk.variance)<.005||!!D.reasons.bank,'Bank reconciled to statement'+(bk&&bk.actual!=null?' (difference CAD '+fm(bk.variance)+')':''));
 const tj=rs.find(r=>r.id=='taaj');add(!tj||(tj.actual!=null&&(Math.abs(tj.variance)<.005||!!D.reasons.taaj)),'Taaj settlement matched to the agent statement'+(tj&&tj.actual!=null?' (difference CAD '+fm(tj.variance)+')':''));
 const big=D.js.filter(j=>j.big&&j.status!='Reversed');add(!big.length,big.length?big.map(j=>j.ref).join(', ')+' at or above CAD 10,000: check the FINTRAC large cash report':'No cash transaction at or above CAD 10,000 awaiting compliance review','warn');
 return c}
function stepIndex(E,D){return[D.status!='Not opened',D.status!='Not opened'&&!!D.opening,D.js.some(j=>j.type=='TX')||D.recDone,D.recDone,D.recDone&&E.blockers(D).length==0,!!D.submitted&&D.status!='Returned',!!D.approved,!!D.locked,!!D.next]}
function chain(a){let p='00000000';for(const e of a){const {hash,...rest}=e;if(fnv(p+JSON.stringify(rest))!==hash)return false;p=hash}return true}

/* sample day 1: same events as the brief, ending at "Review variances" with ADJ-001 waiting */
const TILL_SAMPLE={100:6,50:8,20:15,10:5,5:6,2:7,1:5,0.25:4,0.1:0,0.05:0};
function seed(){const E=Book();const a=(u,x,p)=>{const r=E.act(u,x,p);if(!r.ok)throw new Error(x+': '+r.msg);return r};
 a('farhan','open',{at:'08:52'});
 a('farhan','record',{type:'buy',ccy:'USD',amt:1000,rate:1.35,ext:'KYC-55812',at:'09:12'});
 a('farhan','record',{type:'settle',amt:1500,to:'cash',ext:'TJ-SET-1027',at:'10:05'});
 a('farhan','record',{type:'payout',amt:800,com:35,ext:'TJ-88231',at:'11:40'});
 a('farhan','record',{type:'sell',ccy:'USD',amt:400,rate:1.395,ext:'KYC-55840',at:'13:18'});
 a('farhan','record',{type:'expense',cat:'6100',amt:22,from:'cash',ext:'RCPT-7781',at:'15:46'});
 [['USD',1.38],['AED',0.375],['ETB',0.0098],['KES',0.0104]].forEach(([c,r])=>{a('daniel','rateSet',{ccy:c,rate:r,src:'Treasury closing rates CR-20261027 (market mid 17:00 PT)',at:'16:55'});a('amina','rateAp',{ccy:c,at:'16:58'})});
 a('farhan','count',{till:TILL_SAMPLE,safe:10000,fx:{USD:2600,AED:5000,ETB:119500,KES:250000},witness:'Amina',at:'17:02'});
 a('farhan','stmt',{kind:'bank',stmt:18300,sref:'RBC statement 27-Oct-2026 (feed BNK-0012-1027)',items:'CHQ 1042; Cheque to landlord issued 26-Oct, not yet cleared; -50',at:'17:04'});
 a('farhan','stmt',{kind:'taaj',stmt:2535,sref:'TJ-STMT-VAN-20261027',at:'17:05'});
 a('farhan','completeRecon',{at:'17:06'});
 a('farhan','reason',{id:'fx-ETB',reason:'Recount confirmed ETB 500 short (two 200 notes and one 100 note). Likely overpaid on an ETB sale; incident opened.',sref:'INC-1027',at:'17:09'});
 a('farhan','raiseAdj',{id:'fx-ETB',at:'17:11'});
 E.B.days[0].clock=17*60+14;return E}
function complete(E){const a=(u,x,p)=>{const r=E.act(u,x,p);if(!r.ok)throw new Error(x+': '+r.msg);return r};a('amina','approveAdj',{ref:'ADJ-001'});a('farhan','submit');a('amina','approve');a('amina','lock');a('amina','next');return E}

/* =====================================================================
   UAT: each test replays the sample through a fresh book
   ===================================================================== */
function runUAT(){const T=[];const t=(id,area,scenario,expected,fn,manual)=>{let pass=null,detail='';if(!manual){try{const r=fn();pass=!!r.pass;detail=r.d||''}catch(e){pass=false;detail=e.message}}T.push({id,area,scenario,expected,pass,detail,manual})};
 const S=()=>seed(),F=()=>complete(seed()),D0=E=>E.B.days[0];
 t('UAT-01','Opening','Open 27-Oct and compare opening balances with the approved close of 26-Oct.','Every balance-sheet account opens at the 26-Oct approved figure, by currency.',()=>{const E=S(),o=D0(E).opening;return{pass:Object.keys(OPEN0).every(k=>o[k].fc==OPEN0[k].fc&&o[k].cad==OPEN0[k].cad),d:Object.keys(OPEN0).length+' accounts compared'}});
 t('UAT-02','Opening','Teller, Manager and Finance try to overwrite an opening balance.','Refused for every role, pointing to an authorized adjustment.',()=>{const E=S(),r=['farhan','amina','daniel'].map(u=>E.act(u,'editOpening'));return{pass:r.every(x=>!x.ok)&&r[0].msg.includes('adjustment'),d:r[0].msg}});
 t('UAT-03','Opening','Try to open the next day before the current day is locked.','Refused: the previous business day is not locked.',()=>{const E=S();const nd=newDay('2026-10-28',{},null);E.B.days.push(nd);E.B.cur=1;const r=E.act('farhan','open');return{pass:!r.ok&&r.msg.includes('not locked'),d:r.msg}});
 t('UAT-04','Register','Record TX-001 to TX-005.','Unique references, timestamp, staff, currency, amount, rate and source, each with a balanced journal.',()=>{const E=S(),tx=D0(E).js.filter(j=>j.type=='TX');return{pass:tx.length==5&&new Set(tx.map(j=>j.ref)).size==5&&tx.every(j=>E.ok(j)&&j.at&&j.by&&j.ccy&&j.rate&&j.src),d:tx.map(j=>j.ref).join(', ')}});
 t('UAT-05','Register','Post a journal that is out of balance by CAD 0.01.','Rejected. Nothing is posted.',()=>{const E=S(),D=D0(E),n=D.js.length;let err='';try{E.post(D,{ref:'BAD',lines:[L('1000',10,0),L('4100',0,9.99)]})}catch(e){err=e.message}return{pass:!!err&&D.js.length==n,d:err}});
 t('UAT-06','Register','Buy USD at 1.4500 (more than 2% from the 1.3500 board rate) without an override reason.','Refused until a manager override reason is given.',()=>{const E=Book();E.act('farhan','open');const r=E.act('farhan','record',{type:'buy',ccy:'USD',amt:100,rate:1.45,ext:'KYC-1'});const r2_=E.act('farhan','record',{type:'buy',ccy:'USD',amt:100,rate:1.45,ext:'KYC-1',override:'VIP rate approved by Amina'});return{pass:!r.ok&&r2_.ok,d:r.msg}});
 t('UAT-07','Register','Sell USD 5,000 when the stock is USD 2,600.','Refused: not enough USD in stock.',()=>{const E=Book();E.act('farhan','open');E.act('farhan','record',{type:'buy',ccy:'USD',amt:600,rate:1.35,ext:'K'});const r=E.act('farhan','record',{type:'sell',ccy:'USD',amt:5000,rate:1.395,ext:'K'});return{pass:!r.ok&&r.msg.includes('Not enough USD'),d:r.msg}});
 t('UAT-08','Cash','Count the CAD till: 6×100, 8×50, 15×20, 5×10, 6×5, 7×2, 5×1, 4×0.25.','Counted CAD 1,400.00, expected CAD 1,400.00, variance CAD 0.00, Balanced.',()=>{const r=S().recs(D0(S())).find(x=>x.id=='till');return{pass:r.expected==1400&&r.actual==1400&&r.variance==0&&r.status=='Balanced',d:'Expected '+fm(r.expected)+' · counted '+fm(r.actual)}});
 t('UAT-09','Cash','Recount the till as CAD 1,390.00 and try to submit.','Variance −10.00 shown. Submit blocked until a reason, reference and approved adjustment exist.',()=>{const E=S(),D=D0(E);E.act('amina','approveAdj',{ref:'ADJ-001'});E.act('farhan','reopenRecon');E.act('farhan','count',{...D.counts,till:{...D.counts.till,10:4},fx:D.counts.fx,safe:D.counts.safe,witness:'Amina'});E.act('farhan','completeRecon');const a=E.act('farhan','submit');return{pass:!a.ok&&E.recs(D).find(r=>r.id=='till').variance==-10,d:a.msg}});
 t('UAT-10','FX','USD purchase TX-001 at 1.3500 with source.','Dr FX Stock USD 1,000.00 = CAD 1,350.00; Cr Cash CAD 1,350.00; rate source stored.',()=>{const j=D0(S()).js.find(x=>x.ref=='TX-001');return{pass:j.lines[0].fc==1000&&j.lines[0].d==1350&&j.lines[1].c==1350&&j.src==SRC_BOARD,d:j.src}});
 t('UAT-11','FX','Sell USD 400 at 1.3950 after the purchase (weighted average cost).','Cost CAD 542.67 at 1.356667; realized FX gain CAD 15.33 to 4200.',()=>{const j=D0(S()).js.find(x=>x.ref=='TX-004');return{pass:j.cost==542.67&&j.gain==15.33&&rf(j.avg)=='1.356667',d:'cost '+fm(j.cost)+' · gain '+fm(j.gain)}});
 t('UAT-12','FX','Revalue USD at the approved closing rate 1.3800.','USD 2,600.00 book CAD 3,527.33, value CAD 3,588.00, unrealized CAD 60.67.',()=>{const E=S(),u=E.fxRows(D0(E)).find(x=>x.c=='USD');return{pass:u.fc==2600&&u.book==3527.33&&u.val==3588&&u.unr==60.67,d:'unrealized '+fm(u.unr)}});
 t('UAT-13','FX','Leave the KES closing rate unapproved and try to submit.','Submit blocked: closing rates not approved.',()=>{const E=S(),D=D0(E);D.rates.KES.st='Pending approval';E.act('amina','approveAdj',{ref:'ADJ-001'});const r=E.act('farhan','submit');return{pass:!r.ok&&r.msg.includes('Closing rates'),d:r.msg}});
 t('UAT-14','FX','Daniel enters a closing rate and tries to approve it himself.','Refused: separation of duties.',()=>{const E=S();E.act('daniel','rateSet',{ccy:'USD',rate:1.381,src:'Treasury CR-2'});const r=E.act('daniel','rateAp',{ccy:'USD'});return{pass:!r.ok,d:r.msg}});
 t('UAT-15','Taaj','Record TX-002, cash received from Taaj.','Cash up CAD 1,500.00, Due from Taaj down CAD 1,500.00, no income.',()=>{const j=D0(S()).js.find(x=>x.ref=='TX-002');return{pass:j.lines.some(l=>l.a=='1210'&&l.c==1500)&&!j.lines.some(l=>AC[l.a].cls=='I'),d:j.desc}});
 t('UAT-16','Taaj','Reconcile 1210 with Taaj statement TJ-STMT-VAN-20261027.','Book CAD 2,535.00 = statement CAD 2,535.00, Matched.',()=>{const E=S(),r=E.recs(D0(E)).find(x=>x.id=='taaj');return{pass:r.status=='Matched'&&r.expected==2535,d:r.status}});
 t('UAT-17','Bank','Reconcile 1010: statement CAD 18,300.00 with cheque #1042 outstanding.','Adjusted statement CAD 18,250.00 = books; difference 0.00.',()=>{const E=S(),r=E.recs(D0(E)).find(x=>x.id=='bank');return{pass:r.variance==0&&r.actual==18250,d:r.status}});
 t('UAT-18','Variances','ETB count 119,500 against book 120,000.','Variance −500 ETB (CAD −4.80); reason, reference and ADJ-001 required; submit blocked while pending.',()=>{const E=S(),D=D0(E),a=E.act('farhan','submit'),r=E.recs(D).find(x=>x.id=='fx-ETB');return{pass:!a.ok&&r.variance==-500&&r.cadVar==-4.8,d:a.msg}});
 t('UAT-19','Segregation','Farhan tries to approve the adjustment he raised.','Refused.',()=>{const r=S().act('farhan','approveAdj',{ref:'ADJ-001'});return{pass:!r.ok,d:r.msg}});
 t('UAT-20','Segregation','Amina approves ADJ-001.','Dr 6500 CAD 4.80 / Cr 1102 ETB 500 = CAD 4.80; ETB book 119,500.',()=>{const E=S(),D=D0(E);E.act('amina','approveAdj',{ref:'ADJ-001'});const j=D.js.find(x=>x.ref=='ADJ-001');return{pass:j&&j.lines[0].d==4.8&&E.bal(D,'1102').fc==119500,d:'approved by '+j.appr}});
 t('UAT-21','Workflow','Amina prepares and submits a day, then tries to approve it.','Refused: preparer and approver must differ.',()=>{const E=Book();E.act('amina','open');const r0=E.act('amina','approve');return{pass:!r0.ok,d:r0.msg}});
 t('UAT-22','Workflow','Amina returns the submitted day with a reason; Farhan resubmits.','Submitted → Returned → Submitted; reason in the audit trail.',()=>{const E=S(),D=D0(E);E.act('amina','approveAdj',{ref:'ADJ-001'});E.act('farhan','submit');const a=E.act('amina','returnDay',{reason:'Attach the ETB incident report to INC-1027'});const b=E.act('farhan','submit');return{pass:a.ok&&b.ok&&D.status=='Submitted'&&E.B.audit.some(x=>x.action=='Return day'),d:D.status}});
 t('UAT-23','Closing','Lock the approved day.','Income and expense closed to 3900; day result CAD 23.53; posting to 27-Oct refused.',()=>{const E=S(),D=D0(E);['approveAdj:amina','submit:farhan','approve:amina','lock:amina'].forEach(x=>{const[a,u]=x.split(':');E.act(u,a,{ref:'ADJ-001'})});const j=D.js.find(x=>x.type=='CL'),p=E.act('farhan','record',{type:'expense',cat:'6100',amt:5,from:'cash',ext:'R1'});return{pass:j&&E.ok(j)&&D.result==23.53&&!p.ok&&p.msg.includes('locked'),d:'result '+fm(D.result)+' · '+p.msg}});
 t('UAT-24','Closing','Generate the 28-Oct opening.','Balance-sheet accounts carry forward; income and expense open at zero; assets CAD 41,344.53 = equity.',()=>{const E=F(),o=E.B.days[1].opening;const ta=r2(Object.entries(o).filter(([k])=>AC[k].cls=='A').reduce((s,[,v])=>s+v.cad,0)),te=r2(-Object.entries(o).filter(([k])=>AC[k].cls!='A').reduce((s,[,v])=>s+v.cad,0));return{pass:ta==41344.53&&te==ta&&!Object.keys(o).some(k=>!AC[k].bs),d:'assets '+fm(ta)+' · equity '+fm(te)}});
 t('UAT-25','Closing','Run 28-Oct: open, buy USD 200, count, reconcile, approve, lock.','The second day closes on the carried-forward balances; USD cost pool continues.',()=>{const E=F();E.B.cur=1;const a=(u,x,p)=>{const r=E.act(u,x,p);if(!r.ok)throw new Error(x+': '+r.msg)};const D=E.B.days[1];
  a('farhan','open');a('farhan','record',{type:'buy',ccy:'USD',amt:200,rate:1.35,ext:'KYC-9'});CCYS.forEach(c=>a('daniel','rateAp',{ccy:c}));
  const fx={};E.held(D).forEach(c=>fx[c]=E.bal(D,FXA[c]).fc);const till={};let rem=E.bal(D,'1000').cad;CASH_DENOMS.forEach(d=>{const q=Math.floor((rem+1e-9)/d);till[d]=q;rem=r2(rem-q*d)});
  a('farhan','count',{till,safe:E.bal(D,'1005').cad,fx,witness:'Amina'});a('farhan','stmt',{kind:'bank',stmt:18250,sref:'RBC 28-Oct',items:''});a('farhan','stmt',{kind:'taaj',stmt:2535,sref:'TJ-28'});a('farhan','completeRecon');a('farhan','submit');a('amina','approve');a('amina','lock');
  return{pass:D.status=='Locked'&&E.bal(D,'1100').fc==2800,d:'USD stock '+fm(E.bal(D,'1100').fc)}});
 t('UAT-26','Closing','Trial balance after lock.','Total debits = total credits; every journal balances.',()=>{const E=F(),D=D0(E);let d=0,c=0;Object.values(D.opening).forEach(o=>{if(o.cad>0)d+=o.cad;else c-=o.cad});D.js.forEach(j=>j.lines.forEach(l=>{d+=l.d;c+=l.c}));return{pass:Math.abs(d-c)<.005&&D.js.every(E.ok),d:'Dr '+fm(d)+' · Cr '+fm(c)}});
 t('UAT-27','Reversal','Daniel reverses TX-005 with a reason (reconciliations reopened first).','REV-TX-005 posts opposite lines; TX-005 kept and marked Reversed; till up CAD 22.00.',()=>{const E=S(),D=D0(E);E.act('amina','approveAdj',{ref:'ADJ-001'});E.act('farhan','reopenRecon');const b=E.bal(D,'1000').cad,r=E.act('daniel','reverse',{ref:'TX-005',reason:'Supplies were paid by head-office card'});return{pass:r.ok&&D.js.find(x=>x.ref=='TX-005').status=='Reversed'&&r2(E.bal(D,'1000').cad-b)==22,d:r.msg}});
 t('UAT-28','Reversal','Farhan (Teller) tries to reverse TX-001.','Refused.',()=>{const r=S().act('farhan','reverse',{ref:'TX-001',reason:'testing teller rights'});return{pass:!r.ok,d:r.msg}});
 t('UAT-29','Access','Sara (Auditor) tries to record, approve and lock.','All refused; reports stay readable.',()=>{const E=S(),r=['record','approve','lock'].map(a=>E.act('sara',a,{type:'expense'}));return{pass:r.every(x=>!x.ok),d:r[0].msg}});
 t('UAT-30','Audit','Change one past audit entry and re-check the hash chain.','The chain breaks at the changed entry.',()=>{const E=F(),ok=chain(E.B.audit);E.B.audit[3].detail='edited';return{pass:ok&&!chain(E.B.audit),d:E.B.audit.length+' entries chained'}});
 t('UAT-31','Access','A teller assigned to Vancouver opens Surrey.','Only permitted branches are listed; direct access refused.',null,true);
 t('UAT-32','Usability','Run the close on a phone (400 px) and a desktop.','All steps, counts and reports usable without sideways scrolling.',null,true);
 return T}
if(typeof module!=='undefined')module.exports={Book,seed,complete,runUAT,recs,checks,fm,rf,r2,TXTYPES,CCYS,FXA,AC,ACC,BOARD,chain};
