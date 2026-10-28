/* =====================================================================
   UI – all navigation is in-page state (buttons), no link navigation.
   ===================================================================== */
if(typeof document!=='undefined'){
const $=s=>document.querySelector(s);
const A=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const KEY='brimapay-daily-closing-v2';
function load(){try{const t=localStorage.getItem(KEY);if(t){const st=JSON.parse(t);if(st&&st.v==2&&Array.isArray(st.days))return Book(st)}}catch(e){}return seed()}
/* ---------- online sync: shared books in the artifact database ----------
   books/vancouver               summary: rev, ID counters, list of business dates
   books/vancouver/days/<date>   one document per day: the day and its audit entries
   Every change is written under a short lease with a revision check, so two people
   can never silently overwrite each other; other viewers receive changes live. */
const SYNC={mode:'connecting',db:null,user:null,acct:'',canWrite:null,canEdit:false,baseRev:0,busy:false,queue:Promise.resolve(),last:{},names:{},tab:'t'+Math.random().toString(36).slice(2,10),resetArm:false};
const META='books/vancouver',DAYS='books/vancouver/days';
function persist(){if(SYNC.mode=='local'){try{localStorage.setItem(KEY,JSON.stringify(E.B))}catch(e){}}}
function syncLabel(){const m={connecting:['Connecting…','p-mute'],online:['Online · saved','p-ok'],saving:['Saving…','p-warn'],empty:['Online · no shared books yet','p-warn'],readonly:['Online · view only','p-info'],local:['Offline · this browser only','p-mute'],error:['Not saved · retrying','p-bad']}[SYNC.mode]||['','p-mute'];return`<span class="pill ${m[1]}">${m[0]}</span>`}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function dayJson(d){return JSON.stringify({day:d,audit:E.B.audit.filter(a=>a.date==d.date)})}
async function pull(m){const q=await SYNC.db.collection(DAYS).get(),by={};q.docs.forEach(x=>by[x.id]=x.data());
 const days=[],audit=[],last={};for(const dt of m.dates){const x=by[dt];if(!x||typeof x.json!='string')return false;const o=JSON.parse(x.json);days.push(o.day);audit.push(...o.audit);last[dt]=x.json}
 audit.sort((a,b)=>a.seq-b.seq);const wasLatest=!E||isLatest(),cur=wasLatest?days.length-1:Math.min(E.B.cur,days.length-1);
 E=Book({v:2,days,cur,seq:m.seq||{TX:0,ADJ:0},audit});E.acct=SYNC.acct;SYNC.last=last;SYNC.baseRev=m.rev||0;return true}
async function writeAll(note){const db=SYNC.db,meta=db.doc(META);
 for(let i=0;i<4;i++){let l;try{l=await meta.acquire({holder:SYNC.tab,ttlMs:8000})}catch(e){l={acquired:false}}if(l.acquired)break;if(i==3)throw{code:'busy'};await sleep(350+Math.random()*400)}
 const cur=await meta.get(),srv=cur.exists?(cur.data().rev||0):0;if(srv!==SYNC.baseRev)throw{code:'conflict'};
 for(const d of E.B.days){const j=dayJson(d);if(SYNC.last[d.date]!==j){await db.doc(DAYS+'/'+d.date).set({date:d.date,json:j,status:d.status,rev:srv+1,acct:SYNC.acct});SYNC.last[d.date]=j}}
 await meta.set({rev:srv+1,seq:{...E.B.seq},dates:E.B.days.map(d=>d.date),updatedAt:new Date().toISOString(),acct:SYNC.acct,note:note||''});SYNC.baseRev=srv+1}
function save(note){if(!['online','saving','error','empty'].includes(SYNC.mode)||!SYNC.db){persist();return}
 SYNC.queue=SYNC.queue.then(async()=>{SYNC.busy=true;SYNC.mode='saving';header();
  try{await writeAll(note);SYNC.mode='online';names()}
  catch(e){const c=e&&e.code;
   if(c=='conflict'){const m=(await SYNC.db.doc(META).get()).data();await pull(m);SYNC.mode='online';toast({ok:false,msg:'Someone else changed the books at the same moment. Your screen now shows the latest version; please repeat your last step if it is missing.'})}
   else if(c=='busy'){SYNC.mode='error';toast({ok:false,msg:'Another person was saving at the same moment, so your last step was not saved. Your screen now shows the latest shared books; repeat the step if it is still needed.'});try{const m=(await SYNC.db.doc(META).get()).data();if(m)await pull(m)}catch(_){}SYNC.mode='online'}
   else if(c=='invalid_argument'){SYNC.mode='readonly';SYNC.canWrite=false;toast({ok:false,msg:'You have view-only access to these shared books. Ask the owner for Contributor access to make changes.'});try{const m=(await SYNC.db.doc(META).get()).data();if(m)await pull(m)}catch(_){}}
   else if(c=='quota_exceeded'){SYNC.mode='error';toast({ok:false,msg:'The shared database is full. Export the reports you need and ask the owner to clear old days.'})}
   else{SYNC.mode='error';toast({ok:false,msg:'Could not save to the shared books ('+(c||'network')+'). Check your connection; the next action will try again.'})}}
  finally{SYNC.busy=false;render()}})}
async function names(){if(!SYNC.user||!SYNC.user.profiles)return;const ids=[...new Set(E.B.audit.map(a=>a.acct).filter(x=>x&&!SYNC.names[x]))];if(!ids.length)return;
 try{const ps=await SYNC.user.profiles(ids);let ch=false;ids.forEach(i=>{const n=ps&&ps[i]&&ps[i].name;if(n){SYNC.names[i]=n;ch=true}});if(ch)render()}catch(e){}}
const acctName=id=>id?(SYNC.names[id]||'a signed-in account'):'';
async function initOnline(){let db=null;try{db=window.claude&&claude.use?await claude.use('db'):null}catch(e){db=null}
 if(!db){SYNC.mode='local';E=load();render();return}
 SYNC.db=db;try{SYNC.user=await claude.use('user')}catch(e){}
 if(SYNC.user){try{SYNC.acct=(await SYNC.user.id())||''}catch(e){}try{SYNC.canWrite=await SYNC.user.can('data.write')}catch(e){}try{SYNC.canEdit=!!(await SYNC.user.canEdit())}catch(e){}}
 const meta=db.doc(META);let first=null;try{first=await meta.get()}catch(e){}
 if(first&&first.exists&&await pull(first.data()))SYNC.mode=SYNC.canWrite===false?'readonly':'online';else{SYNC.mode='empty';E=seed();E.acct=SYNC.acct}
 meta.onSnapshot(sn=>{if(!sn.exists||SYNC.busy)return;const m=sn.data();if((m.rev||0)!==SYNC.baseRev)pull(m).then(ok=>{if(ok){if(SYNC.mode=='empty')SYNC.mode=SYNC.canWrite===false?'readonly':'online';render();names()}})},()=>{});
 render();names()}
async function startShared(){if(SYNC.canWrite===false)return toast({ok:false,msg:'You have view-only access to these shared books.'});E=seed();E.acct=SYNC.acct;SYNC.last={};SYNC.baseRev=((await SYNC.db.doc(META).get().catch(()=>null))||{}).exists?((await SYNC.db.doc(META).get()).data().rev||0):0;SYNC.mode='online';VIEW='dashboard';render();save('Started from the sample day')}
let E=seed(),UID='farhan',VIEW='dashboard',UAT=runUAT();
let FORM={type:'buy',ccy:'USD',amt:'',rate:String(BOARD.USD.b),ext:'',override:'',com:'',to:'cash',cat:'6100',from:'cash',note:''};
const D_=()=>E.day();
const isLatest=()=>E.B.cur==E.B.days.length-1;
const VIEWS=[['dashboard','Dashboard'],['transactions','Transactions'],['reconcile','Reconcile'],['reports','Reports'],['design','System design'],['controls','Controls'],['uat','UAT tests']];
const STEPS=['Open day','Load opening balances','Record transactions','Reconcile accounts','Review variances','Submit','Approve','Lock day','Next-day opening'];
const sp=s=>{const m={'Not opened':'p-mute','Open':'p-info','Returned':'p-warn','Submitted':'p-warn','Approved':'p-ok','Locked':'p-ok'};return`<span class="pill ${m[s]||'p-mute'}">${A(s)}</span>`};
const chip=s=>{const c=/^(Balanced|Reconciled|Matched|Posted|Approved|Adjusted|Locked|Pass|OK)/.test(s)?'p-ok':/(Needs|Unmatched|Fail|Denied|Not counted|not entered|Recount|Rejected|Missing)/.test(s)?'p-bad':/(pending|Pending|Explained|Submitted|Returned|Monitoring|Reversed)/.test(s)?'p-warn':'p-mute';return`<span class="pill ${c}">${A(s)}</span>`};
function toast(r){const t=$('#toast');t.textContent=r.msg;t.className='toast '+(r.ok?'ok':'bad');t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,4800)}
const DRAFT={};const DRX=/^(q-|c-safe|c-fx-|c-wit|b-|t-|rs-|rf-|rt-|rv-|ret-)/;
const CLEAR={count:['q-','c-'],'stmt-bank':['b-'],'stmt-taaj':['t-'],reverse:['rv-'],returnDay:['ret-']};
function clearDraft(pre){Object.keys(DRAFT).forEach(k=>{if(pre.some(x=>k.startsWith(x)))delete DRAFT[k]})}
function act(a,p,key){if(SYNC.mode=='readonly'||SYNC.canWrite===false&&SYNC.mode!='local'){toast({ok:false,msg:'You have view-only access to these shared books. Ask the owner for Contributor access to make changes.'});return{ok:false}}
 if(SYNC.mode=='empty'){toast({ok:false,msg:'Start the shared books first (button on the Dashboard).'});return{ok:false}}
 if(SYNC.mode=='connecting'){toast({ok:false,msg:'Still connecting to the shared books. Try again in a moment.'});return{ok:false}}
 E.acct=SYNC.acct;const r=E.act(UID,a,p||{});save(USERS[UID].name+': '+a);if(r.ok&&key)clearDraft(key);toast(r);render();return r}
const val=id=>{const e=document.getElementById(id);return e?e.value:''};

/* ---------- header ---------- */
$('#c-user').innerHTML=Object.entries(USERS).map(([k,u])=>`<option value="${k}">${A(u.name)} — ${A(u.title)}</option>`).join('');
$('#c-user').addEventListener('change',e=>{UID=e.target.value;render()});
$('#c-date').addEventListener('change',e=>{E.B.cur=+e.target.value;if(SYNC.mode=='local')persist();render()});
function header(){const D=D_();$('#c-date').innerHTML=E.B.days.map((d,i)=>`<option value="${i}" ${i==E.B.cur?'selected':''}>${new Date(d.date+'T12:00:00Z').toLocaleDateString('en-CA',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})} · ${d.status}</option>`).join('');
 $('#c-status').innerHTML=sp(D.status);const sy=$('#c-sync');if(sy)sy.innerHTML=syncLabel();const st=stepIndex(E,D),cur=st.findIndex(x=>!x);
 $('#rail').innerHTML=STEPS.map((s,i)=>`<li class="${st[i]?'done':i==cur?'cur':''}" ${i==cur?'aria-current="step"':''}><div class="bar"></div><span>${s}</span></li>`).join('');
 $('#nav').innerHTML=VIEWS.map(([k,t])=>`<button type="button" data-view="${k}" ${VIEW==k?'aria-current="page"':''}>${t}</button>`).join('')}
function render(){header();const D=D_();
 const past=!isLatest()?`<div class="note warn"><span class="ic warn">!</span><span><b>You are viewing ${A(D.date)} (${A(D.status)}).</b> It is read-only. <button type="button" data-go-latest>Go to ${A(E.B.days[E.B.days.length-1].date)}</button></span></div>`:'';
 $('#app').innerHTML=`<div class="view">${past}${({dashboard:vDash,transactions:vTx,reconcile:vRec,reports:vRep,design:vDesign,controls:vCtl,uat:vUat})[VIEW]()}</div>`;
 Object.keys(DRAFT).forEach(k=>{const el=document.getElementById(k);if(el&&!el.disabled)el.value=DRAFT[k]});
 try{if(location.hash!=='#'+VIEW)history.replaceState(null,'','#'+VIEW)}catch(e){}}

/* ---------- dashboard ---------- */
function nextActions(D){const s=D.status,b=[],B=(a,l,pri,x)=>b.push(`<button type="button" class="${pri?'pri':''}" ${a.startsWith('view:')?`data-view="${a.slice(5)}"`:`data-act="${a}"`} ${x||''}>${l}</button>`);
 if(!isLatest()){B('view:reports','Open the reports for this day',1);return b.join('')}
 if(s=='Not opened')B('open','Open day and load opening balances',1);
 else if(['Open','Returned'].includes(s)){const pr=Object.entries(D.rates).filter(([c,r])=>r.st!='Approved'),pa=D.adjs.filter(a=>a.status=='Pending approval');
  B('view:transactions','Record a transaction',!D.counts);
  if(!D.counts||!D.bank)B('view:reconcile','Enter counts and statements',!!D.js.length&&!D.counts);
  else if(!D.recDone)B('completeRecon','Complete reconciliations',1);
  if(pr.length)B('view:reconcile','Approve '+pr.length+' closing rate'+(pr.length==1?'':'s'));
  pa.forEach(a=>B('approveAdj','Approve '+a.ref,1,`data-ref="${a.ref}"`));
  if(D.recDone&&E.recs(D).some(r=>r.actual!=null&&Math.abs(r.variance)>.004&&!D.reasons[r.id]))B('view:reconcile','Explain variances',1);
  B('submit','Submit day for approval',D.recDone&&!E.blockers(D).length)}
 else if(s=='Submitted'){B('approve','Approve day',1);b.push('<button type="button" data-ret>Return for correction…</button>')}
 else if(s=='Approved')B('lock','Lock day and close P&L',1);
 else if(s=='Locked'&&!D.next)B('next','Generate next-day opening',1);
 else if(s=='Locked'&&D.next)b.push(`<button type="button" class="pri" data-go-latest>Go to ${A(D.next.date)}</button>`);
 return b.join('')}
function onlineBanner(){if(SYNC.mode=='empty')return`<div class="note warn"><span class="ic warn">!</span><span><b>The shared books are empty.</b> You are looking at the sample day. ${SYNC.canWrite===false?'Ask the owner to start them.':'<button type="button" class="pri" data-start>Start the shared books with the sample day</button>'}</span></div>`;
 if(SYNC.mode=='readonly')return`<div class="note info"><span class="ic info">i</span><span><b>View only.</b> You can read the shared books and every report. Ask the owner for Contributor access to record or approve.</span></div>`;
 if(SYNC.mode=='local')return`<div class="note info"><span class="ic info">i</span><span><b>Offline copy.</b> The shared database is not available here, so changes are saved in this browser only.</span></div>`;return''}
const FEATURES=[
 ['Record transactions','Currency buy and sell, Taaj payout and settlement, expenses, till ↔ safe ↔ bank transfers, each with a live journal preview.','transactions','tx-form'],
 ['Transaction register','Reference, time, staff, accounts, currency, amount, rate and rate source for every entry.','transactions','tx-register'],
 ['Authorized reversal','Cancel a posted entry with an opposite journal and a reason. Posted entries are never edited.','transactions','tx-reversal'],
 ['Cash, safe and FX counts','Till by denomination, the safe and every foreign currency, with a second counter as witness.','reconcile','rc-counts'],
 ['Bank reconciliation','Statement balance and uncleared items against the books.','reconcile','rc-counts'],
 ['Taaj settlement','Due from Taaj matched to the agent statement. Taaj receipts are never income.','reconcile','rc-taaj'],
 ['Closing rates','Enter each currency rate with its source; a second person approves it.','reconcile','rc-rates'],
 ['Variances and adjustments','Reason and reference for every difference; adjustments approved by someone else.','reconcile','rc-variances'],
 ['Submit, approve, lock','Separation of duties enforced at every step. Locking closes income and expense to P&L.','dashboard','dash-next'],
 ['Next-day opening','Carry balances forward and run the next business day.','reports','r-next'],
 ['14 closing reports','Opening, register, trial balance, cash, bank, safe, FX stock, I&E, exceptions, branch summary and more.','reports','r-open'],
 ['Realized and unrealized FX','Weighted-average cost, gains on sales and revaluation at closing rates.','reports','r-fxgl'],
 ['Audit trail','Every action and refusal, with the signed-in account and a tamper-evident hash chain.','reports','r-staff'],
 ['Exceptions','Variances, outstanding items, compliance flags and refused actions.','reports','r-exc'],
 ['System design','Architecture, workflow states, data model, accounts and role permissions.','design',''],
 ['Controls','Validation rules, blockers, exception handling and integrations.','controls',''],
 ['UAT tests','30 automated acceptance tests that run on this page.','uat','']];
function featureMap(){return`<section class="sec" id="dash-features"><div class="sec-h"><div><span class="eyebrow">Everything in this app</span><h2>Features</h2></div><p>Switch staff at the top to see each role's rights</p></div>
 <div class="feat">${FEATURES.map(([t,d,v,id])=>`<button type="button" class="ft" data-view="${v}" data-target="${id}"><b>${t}</b><span>${d}</span><em>Open →</em></button>`).join('')}</div></section>`}
function vDash(){const D=D_(),ck=E.checks(D),bl=ck.filter(c=>!c.ok&&c.sev=='block'),p=E.pnl(D),fx=E.fxRows(D),unr=r2(fx.reduce((s,x)=>s+x.unr,0));
 const ta=r2(ACC.filter(a=>a.cls=='A').reduce((s,a)=>s+E.bal(D,a.code).cad,0)),till=E.recs(D).find(r=>r.id=='till'),u=USERS[UID];
 const who={Teller:'You prepare the day: record transactions, count, enter statements, explain variances and submit.',Manager:'You approve adjustments, closing rates and the day, then lock it. You cannot approve what you prepared or submitted.',Finance:'You set and approve closing rates, approve adjustments, reverse entries and can lock.',Auditor:'You can read everything. Every action you try is refused and logged.'}[u.role];
 return`${onlineBanner()}<section class="sec"><div class="sec-h"><div><span class="eyebrow">${BRANCH} · ${A(D.date)}${D.opened?' · opened by '+A(D.opened.by):''}</span><h2>Daily closing</h2></div><p>Signed in as <b>${A(u.name)}</b>, ${A(u.title)}</p></div>
 <p class="lede">${who}</p>
 <div class="grid2"><div class="stack" id="dash-next"><h3>Next step</h3><div class="btns">${nextActions(D)}</div>
  <div id="retbox" hidden class="field"><label for="ret-reason">Reason for returning the day</label><textarea id="ret-reason">Attach the incident report to the variance before approval.</textarea><div class="btns"><button type="button" class="dg" data-act="returnDay">Return to preparer</button></div></div>
  ${D.status=='Locked'?`<div class="note ok"><span class="ic ok">✓</span><span><b>Day locked</b> by ${A(D.locked.by)} at ${A(D.locked.at.slice(11))}. Day result CAD ${fm(D.result)}. Posting to ${A(D.date)} is refused.</span></div>`:bl.length?`<div class="note bad"><span class="ic bad">!</span><span><b>${bl.length} blocker${bl.length==1?'':'s'}.</b> Submit and approval stay blocked until each is cleared.</span></div>`:D.status=='Not opened'?'':`<div class="note ok"><span class="ic ok">✓</span><span><b>No blockers.</b> The day can move to the next step.</span></div>`}
  <div class="btns">${SYNC.mode=='local'||SYNC.canEdit?`<button type="button" class="ghost" data-reset>${SYNC.mode=='local'?'Reset to the sample day':'Reset shared books to the sample day'}</button>`:''}</div></div>
 <div class="stack"><h3>Closing checks</h3><ul class="checks">${ck.map(c=>`<li><span class="ic ${c.ok?'ok':c.sev=='block'?'bad':'warn'}">${c.ok?'✓':'!'}</span><span>${A(c.text)}</span><span class="mu" style="font-size:12px">${c.ok?'':c.sev=='block'?'Blocks submit':'Warning'}</span></li>`).join('')}</ul></div></div></section>
 <div class="kpis">
  <div class="kpi"><small>Total assets (book)</small><b>CAD ${fm(ta)}</b><span>All currencies at carrying value</span></div>
  <div class="kpi"><small>CAD till</small><b>CAD ${fm(till.expected)}</b><span>${till.actual==null?'Not counted yet':'Counted '+fm(till.actual)+' · variance '+fm(till.variance)}</span></div>
  <div class="kpi"><small>Day result</small><b class="${p.net<0?'neg':'pos'}">CAD ${fm(D.status=='Locked'?D.result:p.net)}</b><span>Income ${fm(p.ti)} − expenses ${fm(p.te)}</span></div>
  <div class="kpi"><small>Unrealized FX (memo)</small><b class="${unr<0?'neg':'pos'}">CAD ${fm(unr)}</b><span>At the day's closing rates</span></div></div>
 ${featureMap()}
 <div class="grid2"><section class="sec"><div class="sec-h"><h3>Balances by account and currency</h3><p>Foreign amounts are never added together</p></div>${balTable(D)}</section>
 <section class="sec"><div class="sec-h"><h3>Recent activity</h3><p>Append-only audit trail</p></div><ul class="log">${E.B.audit.filter(a=>a.date==D.date).slice(-9).reverse().map(a=>`<li><time>${A(a.at.slice(11))}</time><span><b>${A(a.user)}</b> · ${A(a.action)} ${a.result=='Denied'?chip('Denied'):''}<br><span class="mu">${A(a.detail)}${a.acct?' · by '+A(acctName(a.acct)):''}</span></span></li>`).join('')||'<li><span></span><span class="mu">No activity yet.</span></li>'}</ul></section></div>`}
function balTable(D){const rows=ACC.filter(a=>a.cls=='A').map(a=>{const b=E.bal(D,a.code);return`<tr><td><span class="tag">${a.code}</span> ${A(a.name)}</td><td>${a.ccy}</td><td class="n">${a.ccy=='CAD'?'—':fm(b.fc)}</td><td class="n">${fm(b.cad)}</td></tr>`}).join('');
 const t=r2(ACC.filter(a=>a.cls=='A').reduce((s,a)=>s+E.bal(D,a.code).cad,0));return`<div class="tw"><table><thead><tr><th>Account</th><th>Ccy</th><th class="n">Foreign amount</th><th class="n">CAD (book)</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">Total assets in CAD</td><td class="n">${fm(t)}</td></tr></tfoot></table></div>`}

/* ---------- transactions ---------- */
function txFields(){const f=FORM,ccyOpt=`<select id="f-ccy" data-f="ccy">${CCYS.map(c=>`<option ${f.ccy==c?'selected':''}>${c}</option>`).join('')}</select>`,inp=(k,lab,ph,im)=>`<div class="field"><label for="f-${k}">${lab}</label><input id="f-${k}" data-f="${k}" value="${A(f[k])}" ${ph?`placeholder="${A(ph)}"`:''} ${im?'inputmode="decimal"':''}></div>`;
 const t=f.type;let h='';
 if(t=='buy'||t=='sell')h=`<div class="field"><label for="f-ccy">Currency</label>${ccyOpt}</div>${inp('amt','Amount ('+f.ccy+')','0.00',1)}${inp('rate',(t=='buy'?'Buy':'Sell')+' rate (CAD per '+f.ccy+')','',1)}${inp('ext','Customer KYC / ID reference','KYC-…')}${inp('override','Rate override reason (only if more than 2% from the board)','')}`;
 else if(t=='payout')h=`${inp('amt','Amount paid to beneficiary (CAD)','0.00',1)}${inp('com','Commission earned (CAD)','0.00',1)}${inp('ext','Taaj remittance reference','TJ-…')}`;
 else if(t=='settle')h=`${inp('amt','Amount received (CAD)','0.00',1)}<div class="field"><label for="f-to">Received into</label><select id="f-to" data-f="to"><option value="cash" ${f.to=='cash'?'selected':''}>Cash – till</option><option value="bank" ${f.to=='bank'?'selected':''}>Bank – RBC Operating</option></select></div>${inp('ext','Taaj settlement reference','TJ-SET-…')}`;
 else if(t=='expense')h=`<div class="field"><label for="f-cat">Expense account</label><select id="f-cat" data-f="cat">${['6100','6200','6300','6400'].map(c=>`<option value="${c}" ${f.cat==c?'selected':''}>${c} ${A(AC[c].name)}</option>`).join('')}</select></div>${inp('amt','Amount (CAD)','0.00',1)}<div class="field"><label for="f-from">Paid from</label><select id="f-from" data-f="from"><option value="cash" ${f.from=='cash'?'selected':''}>Cash – till</option><option value="bank" ${f.from=='bank'?'selected':''}>Bank – RBC Operating</option></select></div>${inp('ext','Receipt / invoice reference','RCPT-…')}`;
 else h=`${inp('amt','Amount (CAD)','0.00',1)}${inp('ext','Reference (optional)','')}`;
 return h+inp('note','Note (optional)','')}
function txPreview(){const D=D_(),b=buildTx(E,D,{...FORM,amt:+FORM.amt,rate:+FORM.rate,com:+FORM.com||0});
 if(b.err)return`<div class="note warn"><span class="ic warn">!</span><span>${A(b.err)}</span></div>`;
 const td=r2(b.lines.reduce((s,l)=>s+l.d,0)),tc=r2(b.lines.reduce((s,l)=>s+l.c,0));
 return`<div class="tw"><table><thead><tr><th>Account</th><th class="n">Foreign</th><th class="n">Debit CAD</th><th class="n">Credit CAD</th></tr></thead><tbody>${b.lines.map(l=>`<tr><td><span class="tag">${l.a}</span> ${A(AC[l.a].name)}</td><td class="n">${AC[l.a].ccy=='CAD'?'—':fm(l.fc)+' @ '+rf(l.rate)}</td><td class="n">${l.d?fm(l.d):''}</td><td class="n">${l.c?fm(l.c):''}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">Total</td><td class="n">${fm(td)}</td><td class="n">${fm(tc)}</td></tr></tfoot></table></div><p class="mu" style="font-size:12.5px">${A(b.desc)}${b.gain!=null?' Realized FX '+(b.gain>=0?'gain':'loss')+' CAD '+fm(Math.abs(b.gain))+'.':''}</p>`}
function regTable(D){return D.js.length?`<div class="tw"><table><thead><tr><th>Ref</th><th>Timestamp (PT)</th><th>Business date</th><th>Branch</th><th>Staff</th><th>Description</th><th>Debit account</th><th>Credit account</th><th>Ccy</th><th class="n">Amount</th><th class="n">Rate</th><th>Rate source</th><th class="n">CAD</th><th>Status</th></tr></thead><tbody>${D.js.map(j=>{const d=j.lines.filter(l=>l.d>0),c=j.lines.filter(l=>l.c>0),cad=r2(j.lines.reduce((s,l)=>s+l.d,0));
  return`<tr><td class="ref">${j.ref}</td><td class="mono">${A(j.at)}</td><td class="mono">${A(D.date)}</td><td>VAN</td><td>${A(j.by)}${j.appr?'<br><span class="mu">appr. '+A(j.appr)+'</span>':''}</td><td style="min-width:240px">${A(j.desc)}</td><td>${d.map(l=>l.a+' '+A(AC[l.a].name)).join('<br>')}</td><td>${c.map(l=>l.a+' '+A(AC[l.a].name)).join('<br>')}</td><td>${j.ccy}</td><td class="n">${fm(j.amt)}</td><td class="n">${rf(j.rate)}</td><td class="mu" style="min-width:180px">${A(j.src)}</td><td class="n">${fm(cad)}</td><td>${chip(j.status)}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="mu">No transactions recorded yet.</p>'}
function trace(D){return D.js.length?D.js.map(j=>{const td=r2(j.lines.reduce((s,l)=>s+l.d,0)),tc=r2(j.lines.reduce((s,l)=>s+l.c,0));
 return`<div class="je"><div class="je-h"><span class="ref">${j.ref}</span><span class="tag">${j.type}</span><span class="d">${A(j.kind)} · ${A(j.at.slice(11))} · ${A(j.by)}${j.appr?' · approved by '+A(j.appr):''}${j.reverses?' · reverses '+j.reverses:''}${j.revBy?' · reversed by '+j.revBy:''}</span></div>
 <div class="tw" style="border:0;border-radius:0"><table><thead><tr><th>Account</th><th>Ccy</th><th class="n">Foreign amount</th><th class="n">Rate</th><th class="n">Debit CAD</th><th class="n">Credit CAD</th></tr></thead><tbody>${j.lines.map(l=>`<tr><td><span class="tag">${l.a}</span> ${A(AC[l.a].name)}</td><td>${AC[l.a].ccy}</td><td class="n">${AC[l.a].ccy=='CAD'?'—':fm(l.fc)}</td><td class="n">${AC[l.a].ccy=='CAD'?'1.0000':rf(l.rate)}</td><td class="n">${l.d?fm(l.d):''}</td><td class="n">${l.c?fm(l.c):''}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="4">Total</td><td class="n">${fm(td)}</td><td class="n">${fm(tc)}</td></tr></tfoot></table></div>
 <div class="bal ${Math.abs(td-tc)<.005?'pos':'neg'}">${Math.abs(td-tc)<.005?'✓ Balanced':'✗ Out of balance'}</div></div>`}).join(''):'<p class="mu">No journal entries yet.</p>'}
function vTx(){const D=D_(),can=['Teller','Manager'].includes(USERS[UID].role),editable=isLatest()&&['Open','Returned'].includes(D.status)&&!D.recDone,posted=D.js.filter(j=>j.type=='TX'&&j.status=='Posted');
 const T=TXTYPES[FORM.type];
 return`<section class="sec" id="tx-form"><div class="sec-h"><div><span class="eyebrow">Step 3</span><h2>Record a transaction</h2></div><p>Every transaction posts a balanced journal in CAD and keeps the original currency, amount and rate</p></div>
 ${!editable?`<div class="note info"><span class="ic info">i</span><span>${D.status=='Not opened'?'Open the day first.':D.recDone&&['Open','Returned'].includes(D.status)?'Reconciliations are complete. Reopen them on the Reconcile tab to record more transactions.':'This day is '+A(D.status.toLowerCase())+'; recording is closed.'}</span></div>`:''}
 ${editable&&!can?`<div class="note warn"><span class="ic warn">!</span><span>${A(USERS[UID].title.split(' · ')[0])} cannot record transactions. Switch to Farhan or Amina.</span></div>`:''}
 <div class="grid2"><div class="stack"><div class="field"><label for="f-type">Transaction type</label><select id="f-type" data-f="type">${Object.entries(TXTYPES).map(([k,v])=>`<option value="${k}" ${FORM.type==k?'selected':''}>${A(v.t)}</option>`).join('')}</select><span class="mu" style="font-size:12.5px">${A(T.d)}</span></div>
  <div class="fgrid">${txFields()}</div><div class="btns"><button type="button" class="pri" data-act="record" ${editable?'':'disabled'}>Post transaction</button><button type="button" class="ghost" data-clear>Clear</button></div></div>
  <div class="stack"><h3>Journal preview</h3><div id="txpv">${txPreview()}</div>
  <p class="mu" style="font-size:12.5px">Board rates today: ${CCYS.map(c=>c+' buy '+rf(BOARD[c].b)+' / sell '+rf(BOARD[c].s)).join(' · ')}.</p></div></div></section>
 <section class="sec" id="tx-register"><div class="sec-h"><div><span class="eyebrow">Report 2</span><h2>Daily transaction register</h2></div><p>${D.js.filter(j=>j.type=='TX').length} transactions · ${D.js.length} journals</p></div>${regTable(D)}</section>
 <section class="sec" id="tx-reversal"><div class="sec-h"><div><span class="eyebrow">Controlled change</span><h3>Authorized reversal</h3></div><p>Posted entries are never edited</p></div>
  <p class="lede">A reversal posts the same lines on opposite sides and links both entries. Only a Manager or Finance can reverse, a reason is required, and reconciliations must be reopened first so the counts are checked again.</p>
  <div class="grid3"><div class="field"><label for="rv-ref">Transaction</label><select id="rv-ref">${posted.map(j=>`<option value="${j.ref}">${j.ref} · ${A(j.kind)} · ${j.ccy} ${fm(j.amt)}</option>`).join('')||'<option value="">Nothing to reverse</option>'}</select></div>
  <div class="field" style="grid-column:span 2"><label for="rv-reason">Reason (required)</label><input id="rv-reason" placeholder="Why this entry is being reversed"></div></div>
  <div class="btns"><button type="button" class="dg" data-act="reverse">Post reversal</button></div></section>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Report 13</span><h2>Journal-entry trace</h2></div><p>Every journal and its balanced lines</p></div><div class="stack">${trace(D)}</div></section>`}

/* ---------- reconcile ---------- */
function recTable(D,edit){const rs=E.recs(D);return`<div class="tw"><table><thead><tr><th>Reconciliation</th><th>Account</th><th>Ccy</th><th class="n">Expected</th><th class="n">Actual</th><th class="n">Variance</th><th class="n">Variance CAD</th><th>Reason</th><th>Supporting ref</th><th>Status</th>${edit?'<th>Action</th>':''}</tr></thead><tbody>${rs.map(r=>{const needs=r.actual!=null&&Math.abs(r.variance)>.004;
 let ac='';if(edit&&needs){if(!D.reasons[r.id]&&!r.adj)ac=`<div class="mini"><input id="rs-${r.id}" placeholder="Reason (10+ characters)" aria-label="Reason for ${A(r.acct)}"><input id="rf-${r.id}" placeholder="Reference" aria-label="Reference for ${A(r.acct)}"><button type="button" data-act="reason" data-id="${r.id}">Save reason</button></div>`;
  else if(r.adjustable&&!r.adj)ac=`<button type="button" class="pri" data-act="raiseAdj" data-id="${r.id}">Raise adjustment</button>`;
  else if(r.adj&&r.adj.status=='Pending approval')ac=`<button type="button" class="pri" data-act="approveAdj" data-ref="${r.adj.ref}">Approve ${r.adj.ref}</button>`}
 return`<tr><td>${A(r.area)}</td><td>${A(r.acct)}</td><td>${r.ccy}</td><td class="n">${fm(r.expected)}</td><td class="n">${r.actual==null?'—':fm(r.actual)}</td><td class="n ${r.variance<-.004?'neg':r.variance>.004?'wn':''}">${r.actual==null?'—':fm(r.variance)}</td><td class="n">${r.actual==null?'—':fm(r.cadVar)}</td><td style="min-width:200px">${A(r.reason)||'<span class="mu">—</span>'}</td><td class="mono" style="font-size:12px">${A(r.ref)}</td><td>${chip(r.status)}</td>${edit?`<td style="min-width:220px">${ac}</td>`:''}</tr>`}).join('')}</tbody></table></div>`}
function vRec(){const D=D_(),open=isLatest()&&['Open','Returned'].includes(D.status),editC=open&&!D.recDone,C=D.counts||{till:{},fx:{},safe:'',witness:''},held=E.held(D);
 const tillRows=CASH_DENOMS.map(d=>`<tr><td class="n">${d>=1?d.toFixed(0):d.toFixed(2)}</td><td class="n"><input class="qty" type="number" min="0" step="1" id="q-${String(d).replace('.','_')}" data-den="${d}" value="${C.till[d]==null?'':C.till[d]}" ${editC?'':'disabled'} aria-label="Quantity of CAD ${d}"></td></tr>`).join('');
 const R=E.recs(D),pend=D.adjs;
 return`<section class="sec" id="rc-counts"><div class="sec-h"><div><span class="eyebrow">Step 4</span><h2>Counts and statements</h2></div><p>Expected comes from the ledger; actual comes from a count or a statement</p></div>
 ${D.status=='Not opened'?'<div class="note info"><span class="ic info">i</span><span>Open the day first.</span></div>':''}
 <div class="grid3"><div class="stack"><h3>Till · CAD denominations</h3><div class="tw"><table><thead><tr><th class="n">Denomination</th><th class="n">Quantity</th></tr></thead><tbody>${tillRows}</tbody><tfoot><tr><td>Expected</td><td class="n">${fm(E.bal(D,'1000').cad)}</td></tr></tfoot></table></div></div>
 <div class="stack"><h3>Safe and foreign currency</h3><div class="field"><label for="c-safe">Safe · CAD counted</label><input id="c-safe" inputmode="decimal" value="${A(C.safe)}" ${editC?'':'disabled'}><span class="mu" style="font-size:12px">Expected ${fm(E.bal(D,'1005').cad)}</span></div>
  ${held.map(c=>`<div class="field"><label for="c-fx-${c}">${c} counted</label><input id="c-fx-${c}" inputmode="decimal" value="${A(C.fx[c]==null?'':C.fx[c])}" ${editC?'':'disabled'}><span class="mu" style="font-size:12px">Expected ${fm(E.bal(D,FXA[c]).fc)} ${c}</span></div>`).join('')}
  <div class="field"><label for="c-wit">Second counter (witness)</label><input id="c-wit" value="${A(C.witness||'')}" placeholder="Name of a second person" ${editC?'':'disabled'}></div>
  <div class="btns"><button type="button" class="pri" data-act="count" ${editC?'':'disabled'}>Save counts</button><button type="button" class="ghost" data-fill ${editC?'':'disabled'} title="Demo convenience: copies the expected figures into the count">Fill with expected (demo)</button></div></div>
 <div class="stack"><h3>Bank statement · RBC Operating</h3><div class="field"><label for="b-stmt">Statement closing balance (CAD)</label><input id="b-stmt" inputmode="decimal" value="${A(D.bank?D.bank.stmt:'')}" ${editC?'':'disabled'}><span class="mu" style="font-size:12px">Books ${fm(E.bal(D,'1010').cad)}</span></div>
  <div class="field"><label for="b-ref">Statement reference</label><input id="b-ref" value="${A(D.bank?D.bank.ref:'')}" placeholder="e.g. RBC statement ${A(D.date)}" ${editC?'':'disabled'}></div>
  <div class="field"><label for="b-items">Reconciling items: one per line, "reference; description; amount" (minus for uncleared payments)</label><textarea id="b-items" ${editC?'':'disabled'} placeholder="CHQ 1042; Cheque to landlord; -50">${A(D.bank?D.bank.items.map(i=>i.ref+'; '+i.desc+'; '+i.amt).join('\n'):'')}</textarea></div>
  <div class="btns"><button type="button" class="pri" data-act="stmt-bank" ${editC?'':'disabled'}>Save bank statement</button></div>
  <h3>Taaj settlement statement</h3><div class="field"><label for="t-stmt">Balance due per Taaj (CAD)</label><input id="t-stmt" inputmode="decimal" value="${A(D.taaj?D.taaj.stmt:'')}" ${editC?'':'disabled'}><span class="mu" style="font-size:12px">Books ${fm(E.bal(D,'1210').cad)}</span></div>
  <div class="field"><label for="t-ref">Statement reference</label><input id="t-ref" value="${A(D.taaj?D.taaj.ref:'')}" placeholder="TJ-STMT-…" ${editC?'':'disabled'}></div>
  <div class="btns"><button type="button" class="pri" data-act="stmt-taaj" ${editC?'':'disabled'}>Save Taaj statement</button></div></div></div>
 <div class="btns">${open&&!D.recDone?'<button type="button" class="pri" data-act="completeRecon">Complete reconciliations</button>':''}${open&&D.recDone?'<button type="button" data-act="reopenRecon">Reopen reconciliations</button>':''}</div></section>
 <section class="sec" id="rc-variances"><div class="sec-h"><div><span class="eyebrow">Step 5</span><h2>Variance review</h2></div><p>Every variance needs a reason and a reference; cash and stock variances also need an adjustment approved by someone else</p></div>${recTable(D,open)}
  ${pend.length?`<div class="tw"><table><thead><tr><th>Adjustment</th><th>Account</th><th class="n">Amount</th><th class="n">CAD</th><th>Raised by</th><th>Decision</th><th>Status</th></tr></thead><tbody>${pend.map(a=>`<tr><td class="ref">${a.ref}</td><td>${A(a.code+' '+AC[a.code].name)}</td><td class="n">${fm(a.fc)} ${a.ccy}</td><td class="n">${fm(a.cad)}</td><td>${A(a.by)}</td><td>${A(a.apprBy||'—')}${a.note?'<br><span class="mu">'+A(a.note)+'</span>':''}</td><td>${chip(a.status)}${a.status=='Pending approval'&&open?` <button type="button" data-act="rejectAdj" data-ref="${a.ref}">Reject…</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:''}</section>
 <section class="sec" id="rc-rates"><div class="sec-h"><div><span class="eyebrow">FX handling</span><h2>Closing rates</h2></div><p>Each rate keeps its value, source, who entered it and who approved it</p></div>
  <div class="tw"><table><thead><tr><th>Ccy</th><th class="n">Closing rate</th><th>Source</th><th>Entered by</th><th>Status</th><th>Set a new rate</th><th></th></tr></thead><tbody>${held.map(c=>{const r=D.rates[c]||{};return`<tr><td><b>${c}</b></td><td class="n">${r.r?rf(r.r):'—'}</td><td style="min-width:200px">${A(r.src||'')}</td><td>${A(r.by||'')}${r.ap?'<br><span class="mu">approved by '+A(r.ap)+'</span>':''}</td><td>${chip(r.st||'Missing')}</td>
   <td><div class="mini"><input id="rt-${c}" inputmode="decimal" placeholder="Rate" aria-label="${c} rate" ${open?'':'disabled'}><input id="rs-src-${c}" placeholder="Source" aria-label="${c} source" ${open?'':'disabled'}><button type="button" data-act="rateSet" data-ccy="${c}" ${open?'':'disabled'}>Set</button></div></td>
   <td>${r.st&&r.st!='Approved'&&open?`<button type="button" class="pri" data-act="rateAp" data-ccy="${c}">Approve</button>`:''}</td></tr>`}).join('')}</tbody></table></div></section>
 ${R.some(r=>r.id=='taaj')?secTaaj(D).replace('<section class="sec">','<section class="sec" id="rc-taaj">'):''}`}
function secTaaj(D){const b=E.bal(D,'1210').cad,mv=D.js.filter(j=>j.lines.some(l=>l.a=='1210'));
 return`<section class="sec"><div class="sec-h"><div><span class="eyebrow">Remittance settlement</span><h3>1210 Due from Taaj System</h3></div>${chip(D.taaj?(Math.abs(D.taaj.stmt-b)<.005?'Matched':'Unmatched'):'Statement not entered')}</div>
 <div class="callout"><h3>Taaj System is a settlement asset, not income</h3><p>When we pay a Taaj remittance out of our cash, Taaj owes us that money, so it sits in <b>1210 Due from Taaj System</b>, an asset. When Taaj pays us, in cash or by bank, the receivable goes down: <span class="mono">Dr Cash / Cr 1210</span>. Only the commission Taaj pays us is income (4100).</p></div>
 <div class="tw"><table><thead><tr><th>Movement</th><th>Ref</th><th class="n">CAD</th></tr></thead><tbody><tr><td>Opening balance due</td><td class="ref">${A((D.openFrom||{}).ref||'')}</td><td class="n">${fm(((D.opening||{})['1210']||{cad:0}).cad)}</td></tr>${mv.map(j=>{const v=j.lines.filter(l=>l.a=='1210').reduce((s,l)=>s+l.d-l.c,0);return`<tr><td>${A(j.kind)}${j.status=='Reversed'?' (reversed)':''}</td><td class="ref">${j.ref}</td><td class="n">${fm(v)}</td></tr>`}).join('')}</tbody>
 <tfoot><tr><td colspan="2">Ledger balance 1210</td><td class="n">${fm(b)}</td></tr><tr><td colspan="2">Taaj statement ${A(D.taaj?D.taaj.ref:'')}</td><td class="n">${D.taaj?fm(D.taaj.stmt):'—'}</td></tr><tr><td colspan="2">Difference</td><td class="n">${D.taaj?fm(D.taaj.stmt-b):'—'}</td></tr></tfoot></table></div></section>`}

/* ---------- reports ---------- */
const REPORTS=[['r-open','1. Opening balances'],['r-reg','2. Transaction register'],['r-close','3. Account closing & trial balance'],['r-cash','4. Cash variance'],['r-bank','5. Bank reconciliation'],['r-safe','6. Safe reconciliation'],['r-fx','7. Multi-currency stock & closing'],['r-fxgl','7a. Realized & unrealized FX'],['r-taaj','7b. Remittance settlement'],['r-ie','8. Income & expense'],['r-exc','9. Exceptions'],['r-branch','10. Branch summary'],['r-staff','11. Staff activity & approvals'],['r-next','12. Next-day opening'],['r-trace','13. Journal-entry trace']];
const repHead=(D,id,title,sub)=>`<div class="sec-h" id="${id}"><div><span class="eyebrow">BRIMAPAY · ${BRANCH} · ${A(D.date)}</span><h2>${title}</h2></div><p>${sub||''}</p></div>`;
function vRep(){const D=D_(),p=E.pnl(D),fx=E.fxRows(D),op=D.opening||{};
 const openRows=ACC.filter(a=>a.bs).map(a=>{const o=op[a.code]||{fc:0,cad:0};return`<tr><td><span class="tag">${a.code}</span> ${A(a.name)}</td><td>${A(a.grp)}</td><td>${a.ccy}</td><td class="n">${a.ccy=='CAD'?'—':fm(o.fc)}</td><td class="n">${o.cad>0?fm(o.cad):''}</td><td class="n">${o.cad<0?fm(-o.cad):''}</td></tr>`}).join('');
 let td=0,tc=0;Object.values(op).forEach(o=>{if(o.cad>0)td+=o.cad;else tc-=o.cad});
 const clos=ACC.map(a=>{const o=op[a.code]||{fc:0,cad:0};let d=0,c=0;D.js.filter(j=>j.type!='CL').forEach(j=>j.lines.forEach(l=>{if(l.a==a.code){d+=l.d;c+=l.c}}));return{a,o,d:r2(d),c:r2(c),b:E.bal(D,a.code)}}).filter(x=>Math.abs(x.o.cad)>.004||x.d||x.c);
 const tot=k=>r2(clos.reduce((s,x)=>s+k(x),0));
 const sales=D.js.filter(j=>j.tt=='sell'&&j.status!='Reversed');
 const unrTot=r2(fx.reduce((s,x)=>s+x.unr,0));
 const nextRows=ACC.map(a=>{const b=a.bs?E.bal(D,a.code,true):{fc:0,cad:0};let cad=b.cad;if(a.code=='3900'&&D.status!='Locked')cad=r2(E.bal(D,'3900').cad-p.net);return{a,fc:a.bs?b.fc:0,cad:a.bs?cad:0}}).filter(x=>Math.abs(x.cad)>.004||!x.a.bs);
 const exc=[];E.recs(D).filter(r=>r.actual!=null&&Math.abs(r.variance)>.004).forEach(r=>exc.push([r.acct+' variance '+fm(r.variance)+' '+r.ccy+' (CAD '+fm(r.cadVar)+')',r.adjustable?'Medium':'High','Branch Manager',r.reason?'Reason: '+r.reason:'Needs reason and reference',r.status]));
 if(D.bank)D.bank.items.forEach(i=>exc.push(['Outstanding bank item '+i.ref+' CAD '+fm(i.amt),'Low','Finance','Clears automatically; escalates after 7 days','Monitoring']));
 fx.filter(x=>x.unr<-.004).forEach(x=>exc.push([x.c+' unrealized loss CAD '+fm(x.unr),'Info','Treasury','Review exposure limit','Noted']));
 D.js.filter(j=>j.big).forEach(j=>exc.push([j.ref+' is CAD 10,000 or more','Medium','Compliance','FINTRAC large cash transaction report',j.status=='Reversed'?'Reversed':'Review']));
 const den=E.B.audit.filter(a=>a.date==D.date&&a.result=='Denied').length;exc.push(['Refused actions in the audit trail: '+den,den?'Low':'Info','Internal audit','Review for training or misuse','Noted']);
 const by={};E.B.audit.filter(a=>a.date==D.date).forEach(a=>{const g=by[a.user]||(by[a.user]={role:a.role,n:0,tx:0,ap:0,den:0});g.n++;if(a.action=='Post transaction'&&a.result=='OK')g.tx++;if(/Approve|Lock|Return/.test(a.action)&&a.result=='OK')g.ap++;if(a.result=='Denied')g.den++});
 const sod=[['Preparer ≠ day approver',!D.approved||(D.approved.by!=(D.submitted||{}).by&&D.approved.by!=(D.opened||{}).by)],['Adjustment raiser ≠ adjustment approver',D.adjs.every(a=>!a.apprBy||a.apprBy!=a.by)],['Closing-rate enterer ≠ approver',Object.values(D.rates).every(r=>!r.ap||r.ap!=r.by)]];
 return`<section class="sec"><div class="sec-h"><div><span class="eyebrow">Report pack · ${A(D.date)}</span><h2>Closing reports</h2></div><p>${D.status=='Locked'?'Final: the day is locked':'Live view of the day in progress'}</p></div><div class="rep-nav">${REPORTS.map(([id,t])=>`<button type="button" data-jump="${id}">${t}</button>`).join('')}</div></section>
 <section class="sec">${repHead(D,'r-open','1. Opening balances','Carried forward from '+A((D.openFrom||{}).ref||'')+', approved by '+A((D.openFrom||{}).approvedBy||'')+(D.status=='Not opened'?' · loads when the day is opened':''))}
 <div class="tw"><table><thead><tr><th>Account</th><th>Type</th><th>Ccy</th><th class="n">Foreign amount</th><th class="n">Debit CAD</th><th class="n">Credit CAD</th></tr></thead><tbody>${openRows}</tbody><tfoot><tr><td colspan="4">Total</td><td class="n">${fm(td)}</td><td class="n">${fm(tc)}</td></tr></tfoot></table></div>
 <p class="mu" style="font-size:12.5px">Income and expense accounts open at zero. No field can change these figures; a correction needs an authorized adjustment.</p></section>
 <section class="sec">${repHead(D,'r-reg','2. Transaction register',D.js.length+' journals')}${regTable(D)}</section>
 <section class="sec">${repHead(D,'r-close','3. Account closing and trial balance','Before the P&L closing entry')}
 <div class="tw"><table><thead><tr><th>Account</th><th>Ccy</th><th class="n">Opening CAD</th><th class="n">Debits CAD</th><th class="n">Credits CAD</th><th class="n">Closing foreign</th><th class="n">Closing Dr CAD</th><th class="n">Closing Cr CAD</th><th>Next day</th></tr></thead><tbody>${clos.map(x=>`<tr><td><span class="tag">${x.a.code}</span> ${A(x.a.name)}</td><td>${x.a.ccy}</td><td class="n">${fm(x.o.cad)}</td><td class="n">${x.d?fm(x.d):''}</td><td class="n">${x.c?fm(x.c):''}</td><td class="n">${x.a.ccy=='CAD'?'—':fm(x.b.fc)}</td><td class="n">${x.b.cad>0?fm(x.b.cad):''}</td><td class="n">${x.b.cad<0?fm(-x.b.cad):''}</td><td>${x.a.bs?'<span class="mu">Carry forward</span>':'<b>Close to 3900 P&amp;L</b>'}</td></tr>`).join('')}</tbody>
 <tfoot><tr><td colspan="3">Trial balance</td><td class="n">${fm(tot(x=>x.d))}</td><td class="n">${fm(tot(x=>x.c))}</td><td></td><td class="n">${fm(tot(x=>x.b.cad>0?x.b.cad:0))}</td><td class="n">${fm(tot(x=>x.b.cad<0?-x.b.cad:0))}</td><td>${Math.abs(tot(x=>x.b.cad))<.005?'<span class="pos">Balanced</span>':'<span class="neg">Out of balance</span>'}</td></tr></tfoot></table></div></section>
 <section class="sec">${repHead(D,'r-cash','4. Cash variance','Till, safe, bank, foreign notes and Taaj')}${recTable(D,false)}${D.counts?`<p class="mu" style="font-size:12.5px">Till counted by ${A(D.counts.by)}${D.counts.witness?', witnessed by '+A(D.counts.witness):''}: ${CASH_DENOMS.filter(d=>D.counts.till[d]).map(d=>D.counts.till[d]+' × '+(d>=1?d:d.toFixed(2))).join(', ')} = CAD ${fm(E.tillTotal(D))}.</p>`:''}</section>
 <div class="grid2"><section class="sec">${repHead(D,'r-bank','5. Bank reconciliation','RBC Operating')}${bankRec(D)}</section><section class="sec">${repHead(D,'r-safe','6. Safe reconciliation','Dual control')}${safeRec(D)}</section></div>
 <section class="sec">${repHead(D,'r-fx','7. Multi-currency stock and closing','Each currency on its own; CAD totals only')}
 <div class="tw"><table><thead><tr><th>Ccy</th><th class="n">Opening</th><th class="n">Bought</th><th class="n">Sold</th><th class="n">Adjusted</th><th class="n">Closing amount</th><th class="n">Book rate (avg cost)</th><th class="n">Book CAD</th><th class="n">Closing rate</th><th>Rate source</th><th class="n">CAD at closing rate</th><th class="n">Unrealized CAD</th></tr></thead><tbody>${fx.map(x=>`<tr><td><b>${x.c}</b></td><td class="n">${fm(x.open.fc)}</td><td class="n">${x.bought?fm(x.bought):'—'}</td><td class="n">${x.sold?fm(x.sold):'—'}</td><td class="n">${x.adj?fm(x.adj):'—'}</td><td class="n"><b>${fm(x.fc)}</b></td><td class="n">${rf(x.avg)}</td><td class="n">${fm(x.book)}</td><td class="n">${rf(x.cr)}</td><td class="mu" style="min-width:180px">${A(x.rsrc)} ${x.rst!='Approved'?chip(x.rst):''}</td><td class="n">${fm(x.val)}</td><td class="n ${x.unr<0?'neg':'pos'}">${fm(x.unr)}</td></tr>`).join('')}</tbody>
 <tfoot><tr><td colspan="7">Total in CAD (foreign columns are not added)</td><td class="n">${fm(fx.reduce((s,x)=>s+x.book,0))}</td><td colspan="2"></td><td class="n">${fm(fx.reduce((s,x)=>s+x.val,0))}</td><td class="n">${fm(unrTot)}</td></tr></tfoot></table></div></section>
 <section class="sec">${repHead(D,'r-fxgl','7a. Realized and unrealized FX','Weighted average cost method')}
 ${sales.length?`<div class="tw"><table><thead><tr><th>Sale</th><th class="n">Amount</th><th class="n">Sell rate</th><th class="n">CAD received</th><th class="n">Average cost</th><th class="n">Cost CAD</th><th class="n">Realized CAD</th></tr></thead><tbody>${sales.map(j=>`<tr><td class="ref">${j.ref}</td><td class="n">${j.ccy} ${fm(j.amt)}</td><td class="n">${rf(j.rate)}</td><td class="n">${fm(r2(j.amt*j.rate))}</td><td class="n">${rf(j.avg)}</td><td class="n">${fm(j.cost)}</td><td class="n ${j.gain<0?'neg':'pos'}">${fm(j.gain)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="mu">No currency sold today, so no realized FX.</p>'}
 ${(()=>{const u=fx.find(x=>x.c=='USD'),buy=D.js.find(j=>j.tt=='buy'&&j.ccy=='USD'&&j.status!='Reversed');if(!u)return'';const o=u.open;return`<div class="formula">USD opening stock   ${fm(o.fc)}   book CAD ${fm(o.cad)}${o.fc?'   (avg '+rf(o.cad/o.fc)+')':''}
${buy?`${buy.ref} purchase    USD ${fm(buy.amt)} × ${rf(buy.rate)} = CAD ${fm(r2(buy.amt*buy.rate))}   (${A(buy.src)})
`:''}${sales.filter(j=>j.ccy=='USD').map(j=>`${j.ref} sale        USD ${fm(j.amt)} × ${rf(j.rate)} = CAD ${fm(r2(j.amt*j.rate))};  cost USD ${fm(j.amt)} × ${rf(j.avg)} = CAD ${fm(j.cost)}
  REALIZED FX       ${fm(r2(j.amt*j.rate))} − ${fm(j.cost)} = CAD ${fm(j.gain)}   → 4200`).join('\n')}
USD closing stock   ${fm(u.fc)}   book CAD ${fm(u.book)}
  at closing rate   USD ${fm(u.fc)} × ${rf(u.cr)} = CAD ${fm(u.val)}   (${A(u.rsrc)})
  UNREALIZED FX     ${fm(u.val)} − ${fm(u.book)} = CAD ${fm(u.unr)}   (memo; posted by month-end revaluation)${buy?`
  of which ${buy.ref} lot (memo): USD ${fm(buy.amt)} × (${rf(u.cr)} − ${rf(buy.rate)}) = CAD ${fm(r2(buy.amt*(u.cr-buy.rate)))}`:''}</div>`})()}
 <p class="mu" style="font-size:12.5px">Realized gain or loss arises only when foreign currency is sold. Unrealized gain or loss on stock held: CAD ${fm(unrTot)} across all currencies at the day's closing rates.</p></section>
 ${secTaaj(D).replace('<section class="sec">','<section class="sec" id="r-taaj">')}
 <section class="sec">${repHead(D,'r-ie','8. Income and expense','Closed to 3900 at lock')}
 <div class="tw"><table><thead><tr><th>Account</th><th class="n">CAD</th></tr></thead><tbody><tr class="sub"><td colspan="2">Income</td></tr>${p.inc.filter(x=>Math.abs(x.v)>.004).map(x=>`<tr><td><span class="tag">${x.a.code}</span> ${A(x.a.name)}</td><td class="n">${fm(x.v)}</td></tr>`).join('')||'<tr><td class="mu">None</td><td></td></tr>'}<tr class="sub"><td>Total income</td><td class="n">${fm(p.ti)}</td></tr><tr class="sub"><td colspan="2">Expenses</td></tr>${p.exp.filter(x=>Math.abs(x.v)>.004).map(x=>`<tr><td><span class="tag">${x.a.code}</span> ${A(x.a.name)}</td><td class="n">${fm(x.v)}</td></tr>`).join('')||'<tr><td class="mu">None</td><td></td></tr>'}<tr class="sub"><td>Total expenses</td><td class="n">${fm(p.te)}</td></tr></tbody><tfoot><tr><td>Day result</td><td class="n ${p.net<0?'neg':'pos'}">${fm(p.net)}</td></tr></tfoot></table></div>
 <p class="mu" style="font-size:12.5px">Not income: Taaj settlements (a receivable collected), currency purchases (an asset swap) and transfers between your own accounts. Unrealized FX of CAD ${fm(unrTot)} is a memo in report 7.</p></section>
 <section class="sec">${repHead(D,'r-exc','9. Exceptions','Raised automatically, each with an owner')}
 <div class="tw"><table><thead><tr><th>Exception</th><th>Severity</th><th>Owner</th><th>Action</th><th>Status</th></tr></thead><tbody>${exc.map(e=>`<tr><td>${A(e[0])}</td><td>${chip(e[1])}</td><td>${A(e[2])}</td><td class="mu">${A(e[3])}</td><td>${chip(e[4])}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="sec">${repHead(D,'r-branch','10. Branch summary','All branches for '+A(D.date))}
 <div class="tw"><table><thead><tr><th>Branch</th><th>Status</th><th>Prepared by</th><th>Approved by</th><th class="n">Cash variance CAD</th><th class="n">Open blockers</th><th class="n">Day result CAD</th></tr></thead><tbody>
 <tr><td><b>Vancouver</b> <span class="mu">(live)</span></td><td>${sp(D.status)}</td><td>${A((D.opened||{}).by||'—')}</td><td>${A((D.approved||{}).by||'—')}</td><td class="n">${fm(E.recs(D).filter(r=>r.ccy=='CAD'&&r.adjustable).reduce((s,r)=>s+r.cadVar,0))}</td><td class="n">${E.blockers(D).length}</td><td class="n">${fm(D.status=='Locked'?D.result:p.net)}</td></tr>
 <tr><td>Surrey <span class="sample">illustrative</span></td><td>${sp('Locked')}</td><td>Hodan</td><td>Yusuf</td><td class="n">0.00</td><td class="n">0</td><td class="n">418.20</td></tr>
 <tr><td>Calgary <span class="sample">illustrative</span></td><td>${sp('Submitted')}</td><td>Musa</td><td>—</td><td class="n">−10.00</td><td class="n">0</td><td class="n">96.75</td></tr></tbody></table></div></section>
 <section class="sec">${repHead(D,'r-staff','11. Staff activity and approvals','From the audit trail')}
 <div class="tw"><table><thead><tr><th>Staff</th><th>Role</th><th class="n">Actions</th><th class="n">Transactions posted</th><th class="n">Approvals / locks</th><th class="n">Refused</th></tr></thead><tbody>${Object.entries(by).map(([u,g])=>`<tr><td><b>${A(u)}</b></td><td>${A(g.role)}</td><td class="n">${g.n}</td><td class="n">${g.tx}</td><td class="n">${g.ap}</td><td class="n">${g.den}</td></tr>`).join('')}</tbody></table></div>
 <ul class="checks">${sod.map(([t,ok])=>`<li><span class="ic ${ok?'ok':'bad'}">${ok?'✓':'!'}</span><span>${t}</span><span></span></li>`).join('')}</ul>
 <div class="tw"><table><thead><tr><th>#</th><th>Time</th><th>Staff</th><th>Action</th><th>Result</th><th>Ref</th><th>Detail</th><th>Hash</th></tr></thead><tbody>${E.B.audit.filter(a=>a.date==D.date).map(a=>`<tr><td class="n">${a.seq}</td><td class="mono">${A(a.at.slice(11))}</td><td>${A(a.user)}${a.acct?'<br><span class="mu">'+A(acctName(a.acct))+'</span>':''}</td><td>${A(a.action)}</td><td>${chip(a.result)}</td><td class="ref">${A(a.ref)}</td><td style="min-width:220px">${A(a.detail)}</td><td class="mono mu">${a.hash}</td></tr>`).join('')}</tbody></table></div>
 <p class="mu" style="font-size:12.5px">Hash chain ${chain(E.B.audit)?'<span class="pos">intact</span>':'<span class="neg">broken</span>'}: each entry's hash includes the previous one, so editing or deleting history is detectable.</p></section>
 <section class="sec">${repHead(D,'r-next','12. Next-day opening · '+addD(D.date,1),D.next?'Generated by '+A(D.next.by)+' from the locked close':'Preview. Final once the day is locked.')}
 <div class="tw"><table><thead><tr><th>Account</th><th>Ccy</th><th class="n">Opening foreign</th><th class="n">Opening Dr CAD</th><th class="n">Opening Cr CAD</th><th>Source</th></tr></thead><tbody>${nextRows.map(x=>`<tr><td><span class="tag">${x.a.code}</span> ${A(x.a.name)}</td><td>${x.a.ccy}</td><td class="n">${x.a.ccy=='CAD'?'—':fm(x.fc)}</td><td class="n">${x.cad>0?fm(x.cad):''}</td><td class="n">${x.cad<0?fm(-x.cad):''}</td><td class="mu">${x.a.bs?'Closing of '+A(D.date):'Closed to P&amp;L · opens at zero'}</td></tr>`).join('')}</tbody>
 <tfoot><tr><td colspan="3">Total</td><td class="n">${fm(nextRows.reduce((s,x)=>s+(x.cad>0?x.cad:0),0))}</td><td class="n">${fm(nextRows.reduce((s,x)=>s+(x.cad<0?-x.cad:0),0))}</td><td></td></tr></tfoot></table></div></section>
 <section class="sec">${repHead(D,'r-trace','13. Journal-entry trace','Every entry balanced in CAD')}<div class="stack">${trace(D)}</div></section>`}
function bankRec(D){const bk=E.bal(D,'1010').cad;if(!D.bank)return`<p class="mu">Statement not entered yet. Books show CAD ${fm(bk)}.</p>`;const adj=r2(D.bank.stmt+D.bank.items.reduce((s,i)=>s+i.amt,0));
 return`<div class="tw"><table><tbody><tr><td>Balance per bank statement</td><td class="mu">${A(D.bank.ref)}</td><td class="n">${fm(D.bank.stmt)}</td></tr>${D.bank.items.map(o=>`<tr><td>${o.amt<0?'Less outstanding':'Add in transit'} ${A(o.ref)}</td><td class="mu">${A(o.desc)}</td><td class="n">${fm(o.amt)}</td></tr>`).join('')}<tr class="sub"><td>Adjusted statement balance</td><td></td><td class="n">${fm(adj)}</td></tr><tr><td>Balance per ledger (1010)</td><td></td><td class="n">${fm(bk)}</td></tr><tr class="sub"><td>Difference</td><td>${D.reasons.bank?A(D.reasons.bank.reason):''}</td><td class="n">${fm(adj-bk)}</td></tr></tbody></table></div>`}
function safeRec(D){const exp=E.bal(D,'1005').cad,act=D.counts?D.counts.safe:null;
 return`<div class="tw"><table><tbody><tr><td>Expected (1005)</td><td class="n">${fm(exp)}</td></tr><tr><td>Counted${D.counts&&D.counts.witness?' (dual control: '+A(D.counts.by)+' + '+A(D.counts.witness)+')':''}</td><td class="n">${act==null?'—':fm(act)}</td></tr><tr class="sub"><td>Variance</td><td class="n">${act==null?'—':fm(act-exp)}</td></tr></tbody></table></div><p class="mu" style="font-size:12.5px">Moving cash between the till and the safe is a transfer entry, never a silent balance change.</p>`}

/* ---------- design / controls (static content) ---------- */
/*@@STATIC@@*/

/* ---------- UAT ---------- */
function vUat(){const p=UAT.filter(t=>t.pass===true).length,f=UAT.filter(t=>t.pass===false).length,m=UAT.filter(t=>t.manual).length;
 return`<section class="sec"><div class="sec-h"><div><span class="eyebrow">User acceptance</span><h2>UAT acceptance tests</h2></div><div class="btns"><button type="button" data-uat>Run again</button></div></div>
 <p class="lede">Automated tests replay the sample through a fresh copy of the engine on this page, including a full second business day. Manual tests are for the UAT team on the real environment.</p>
 <div class="kpis"><div class="kpi"><small>Passed</small><b class="pos">${p}</b><span>automated</span></div><div class="kpi"><small>Failed</small><b class="${f?'neg':''}">${f}</b><span>automated</span></div><div class="kpi"><small>Manual</small><b>${m}</b><span>to sign off</span></div><div class="kpi"><small>Total</small><b>${UAT.length}</b><span>test cases</span></div></div>
 <div class="tw"><table><thead><tr><th>ID</th><th>Area</th><th>Scenario</th><th>Expected result</th><th>Result</th><th>Evidence</th></tr></thead><tbody>${UAT.map(t=>`<tr><td class="ref">${t.id}</td><td>${t.area}</td><td style="min-width:240px">${A(t.scenario)}</td><td style="min-width:260px">${A(t.expected)}</td><td>${t.manual?chip('Manual'):chip(t.pass?'Pass':'Fail')}</td><td class="mu" style="min-width:200px;font-size:12px">${A(t.detail)}</td></tr>`).join('')}</tbody></table></div></section>`}

/* ---------- events ---------- */
function readCounts(){const till={};CASH_DENOMS.forEach(d=>{const v=val('q-'+String(d).replace('.','_'));till[d]=v===''?0:v});const fx={};E.held(D_()).forEach(c=>fx[c]=val('c-fx-'+c));return{till,safe:val('c-safe'),fx,witness:val('c-wit')}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.view){VIEW=b.dataset.view;render();const tg=b.dataset.target&&document.getElementById(b.dataset.target);if(tg)tg.scrollIntoView({block:'start'});else window.scrollTo(0,0);return}
 if(b.dataset.goLatest!=null){E.B.cur=E.B.days.length-1;if(SYNC.mode=='local')persist();VIEW='dashboard';render();return}
 if(b.dataset.reset!=null){if(SYNC.mode=='local'){clearDraft(['']);try{localStorage.removeItem(KEY)}catch(x){}E=seed();persist();VIEW='dashboard';toast({ok:true,msg:'Reset to the 27-Oct sample day at the Review variances step.'});render();return}
  if(!SYNC.canEdit){toast({ok:false,msg:'Only the owner or an Editor can reset the shared books.'});return}
  if(!SYNC.resetArm){SYNC.resetArm=true;b.textContent='Click again to erase the shared books for everyone';setTimeout(()=>{SYNC.resetArm=false;render()},6000);return}
  SYNC.resetArm=false;clearDraft(['']);E=seed();E.acct=SYNC.acct;SYNC.last={};VIEW='dashboard';render();save('Reset to the sample day');toast({ok:true,msg:'Shared books reset to the 27-Oct sample day for everyone.'});return}
 if(b.dataset.start!=null){startShared();return}
 if(b.dataset.uat!=null){UAT=runUAT();render();toast({ok:true,msg:'UAT re-run: '+UAT.filter(t=>t.pass).length+' passed.'});return}
 if(b.dataset.ret!=null){const x=$('#retbox');x.hidden=!x.hidden;return}
 if(b.dataset.jump){const el=document.getElementById(b.dataset.jump);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});return}
 if(b.dataset.clear!=null){FORM={...FORM,amt:'',ext:'',override:'',com:'',note:''};render();return}
 if(b.dataset.fill!=null){const D=D_();let rem=E.bal(D,'1000').cad;CASH_DENOMS.forEach(d=>{const q=Math.floor((rem+1e-9)/d);const el=document.getElementById('q-'+String(d).replace('.','_'));if(el)el.value=q;rem=r2(rem-q*d)});
  const s=$('#c-safe');if(s)s.value=E.bal(D,'1005').cad;E.held(D).forEach(c=>{const el=document.getElementById('c-fx-'+c);if(el)el.value=E.bal(D,FXA[c]).fc});const w=$('#c-wit');if(w&&!w.value)w.value=UID=='amina'?'Farhan':'Amina';
  const bs=$('#b-stmt');if(bs&&!bs.value)bs.value=E.bal(D,'1010').cad;const br=$('#b-ref');if(br&&!br.value)br.value='RBC statement '+D.date;const ts=$('#t-stmt');if(ts&&!ts.value)ts.value=E.bal(D,'1210').cad;const tr=$('#t-ref');if(tr&&!tr.value)tr.value='TJ-STMT-VAN-'+D.date.replace(/-/g,'');
  document.querySelectorAll('#app input,#app textarea').forEach(el=>{if(el.id&&DRX.test(el.id)&&!el.disabled&&el.value!=='')DRAFT[el.id]=el.value});
  toast({ok:true,msg:'Expected figures copied into the count and statement fields. Change any figure that differs, then save.'});return}
 const a=b.dataset.act;if(!a)return;
 if(a=='record'){const r=act('record',{...FORM,amt:+FORM.amt,rate:+FORM.rate,com:+FORM.com||0});if(r.ok){FORM={...FORM,amt:'',ext:'',override:'',com:'',note:''};render()}return}
 if(a=='count')return act('count',readCounts(),CLEAR.count);
 if(a=='stmt-bank')return act('stmt',{kind:'bank',stmt:val('b-stmt'),sref:val('b-ref'),items:val('b-items')},CLEAR['stmt-bank']);
 if(a=='stmt-taaj')return act('stmt',{kind:'taaj',stmt:val('t-stmt'),sref:val('t-ref')},CLEAR['stmt-taaj']);
 if(a=='reason')return act('reason',{id:b.dataset.id,reason:val('rs-'+b.dataset.id),sref:val('rf-'+b.dataset.id)},['rs-'+b.dataset.id,'rf-'+b.dataset.id]);
 if(a=='raiseAdj')return act('raiseAdj',{id:b.dataset.id});
 if(a=='approveAdj')return act('approveAdj',{ref:b.dataset.ref});
 if(a=='rejectAdj'){const tr=b.closest('td');if(!tr.querySelector('input')){tr.insertAdjacentHTML('beforeend',`<div class="mini"><input id="rj-${b.dataset.ref}" placeholder="Reason for rejecting"><button type="button" class="dg" data-act="rejectAdjGo" data-ref="${b.dataset.ref}">Reject</button></div>`)}return}
 if(a=='rejectAdjGo')return act('approveAdj',{ref:b.dataset.ref,reject:true,reason:val('rj-'+b.dataset.ref)});
 if(a=='rateSet')return act('rateSet',{ccy:b.dataset.ccy,rate:val('rt-'+b.dataset.ccy),src:val('rs-src-'+b.dataset.ccy)},['rt-'+b.dataset.ccy,'rs-src-'+b.dataset.ccy]);
 if(a=='rateAp')return act('rateAp',{ccy:b.dataset.ccy});
 if(a=='returnDay')return act('returnDay',{reason:val('ret-reason')},CLEAR.returnDay);
 if(a=='reverse')return act('reverse',{ref:val('rv-ref'),reason:val('rv-reason')},CLEAR.reverse);
 if(a=='next'){const r=act('next');return r}
 act(a)});
document.addEventListener('input',e=>{const t=e.target;if(t.id&&DRX.test(t.id))DRAFT[t.id]=t.value;if(t.dataset&&t.dataset.f){FORM[t.dataset.f]=t.value;const pv=$('#txpv');if(pv)pv.innerHTML=txPreview()}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset&&t.dataset.f&&t.tagName=='SELECT'){FORM[t.dataset.f]=t.value;if(t.dataset.f=='type'||t.dataset.f=='ccy'){if(FORM.type=='buy'||FORM.type=='sell')FORM.rate=String(BOARD[FORM.ccy][FORM.type=='buy'?'b':'s'])}render()}});
window.addEventListener('hashchange',()=>{const h=(location.hash||'').slice(1);if(VIEWS.some(v=>v[0]==h)&&h!=VIEW){VIEW=h;render()}});
{const h=(location.hash||'').slice(1);if(VIEWS.some(v=>v[0]==h))VIEW=h}
E=seed();render();initOnline();
}
