/*DCS*/(function(){'use strict';
/* =====================================================================
   Daily Closing System extension for the branch-day closing control.
   Adds: bank statement, safe, FX stock and settlement-agent (Taaj)
   reconciliations, daily closing rates with source, maker/checker stock
   adjustments, closing reports, a next-day opening and a locked-day
   posting guard. Plugs into closing control through window hooks:
   dcsReady (readiness), dcsSnap (lock snapshot), dcsRecon / dcsReports (tabs).
   Income and expense are closed to P&L in the snapshot and the next-day
   opening (presentation). No daily closing journal is posted, so monthly
   and yearly income statements keep working.
   ===================================================================== */
const A=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r2=v=>Math.round(((+v||0)+Number.EPSILON)*100)/100;
const F=v=>{v=r2(v);if(Math.abs(v)<.005)v=0;return(v<0?'−':'')+Math.abs(v).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})};
const SG=v=>Math.abs(v)<.005?'0.00':(v>0?'+':'−')+F(Math.abs(v));
const RF=v=>{v=+v||0;const s=v.toFixed(6).replace(/0+$/,'');return((s.split('.')[1]||'').length<4)?v.toFixed(4):s};
const nowI=()=>new Date().toISOString();
const ME=()=>(typeof me=='function'?me():null)||{};
const role=()=>ME().role||'';
const toast=(m,bad)=>{try{window.rpToast?rpToast(m,bad):alert(m)}catch(e){}};
const BASE=()=>S.base||'CAD';
const tm=t=>{if(!t)return'';const x=new Date(t);if(isNaN(x))return String(t).slice(11,16);return String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0')};
const stamp=t=>t?String(t).slice(0,16).replace('T',' '):'';
const addD=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const DCS=()=>{const s=S.dcs=S.dcs||{};s.cfg=s.cfg||{};['reqBank','reqFx','reqAgents'].forEach(k=>{if(s.cfg[k]==null)s.cfg[k]=1});if(s.cfg.reqRates==null)s.cfg.reqRates=0;
 s.agents=s.agents||[];s.bstm=s.bstm||{};s.fxc=s.fxc||{};s.adj=s.adj||[];s.agst=s.agst||{};s.rates=s.rates||{};return s};
const canEd=()=>{try{return canW('cash')&&role()!='Viewer'}catch(e){return false}};
const isAp=()=>['Owner','Manager'].includes(role());
const isFin=()=>['Owner','Manager','Accountant'].includes(role());
const isOwn=()=>role()=='Owner';
const otherAp=n=>(S.users||[]).filter(u=>['Owner','Manager'].includes(u.role)&&u.name!=n&&(u.status||'Active')!='Inactive').length;
const REC=(b,d)=>(S.cpd||{})[b+'|'+d];
const locked=(b,d)=>{const r=REC(b,d);return!!(r&&r.lock)};
const stOf=(b,d)=>{try{return window.cpcState?cpcState(b,d):'NONE'}catch(e){return'NONE'}};
const cacc=b=>{try{return window.__cl&&__cl.cacc?__cl.cacc(b):[]}catch(e){return[]}};
const guard=(b,d)=>locked(b,d)?'The '+d+' day is locked for '+bn(b)+'. Request a reopen to change it.':!canEd()?'Your role ('+role()+') cannot change closing records.':'';
function au(b,d,act,note){S.cpd=S.cpd||{};const k=b+'|'+d,r=S.cpd[k]=S.cpd[k]||{br:b,date:d,ver:1,hist:[],reopens:[],arch:[],ack:{susp:null,bd:{}}};
 r.ver=(r.ver||1)+1;r.hist.push({t:nowI(),by:ME().name||'',role:role(),act,note:note||''});
 try{if(window.apw&&apw.ev)apw.ev({id:'CLOSE '+b+' '+d,ver:r.ver},act,note||'',{br:b,date:d})}catch(e){}
 try{if(window.alog)alog('Daily closing',act+' · '+bn(b)+' '+d+(note?': '+note:''))}catch(e){}}

/* ---------------- ledger views (per branch) ---------------- */
const CASHGL=c=>{c=String(c);if(c=='1000'||c=='1010')return true;let p=par(c),g=0;while(p&&g++<20){if(String(p)=='1000'||String(p)=='1010')return true;p=par(p)}return false};
const TY=c=>{try{return acType(c)}catch(e){return'Assets'}};
const BS=c=>['Assets','Liabilities','Equity'].includes(TY(c));
function bals(b,upto,from){const m={},B=BASE();S.j.forEach(x=>{if(x.br!=b||x.date>upto||(from&&x.date<from))return;const fx=x.ccy&&x.ccy!=B,rt=+x.rate||1;
 x.lines.forEach(y=>{const c=String(y[0]),v=(+y[1]||0)-(+y[2]||0),o=m[c]||(m[c]={code:c,cad:0,dr:0,cr:0,nat:{},cadBy:{}});o.cad+=v;o.dr+=+y[1]||0;o.cr+=+y[2]||0;
  const k=fx&&CASHGL(c)?x.ccy:B;o.nat[k]=(o.nat[k]||0)+(k==B?v:v/rt);o.cadBy[k]=(o.cadBy[k]||0)+v})});
 Object.values(m).forEach(o=>{['cad','dr','cr'].forEach(k=>o[k]=r2(o[k]));Object.keys(o.nat).forEach(k=>{o.nat[k]=r2(o.nat[k]);o.cadBy[k]=r2(o.cadBy[k])})});return m}
const posOf=b=>Object.keys(S.pos||{}).filter(k=>k.split('|')[0]==b).map(k=>({ccy:k.split('|')[1],q:+(S.pos[k].q||0),c:+(S.pos[k].c||0)})).filter(p=>Math.abs(p.q)>1e-9).sort((x,y)=>x.ccy.localeCompare(y.ccy));
/* balance-sheet rows by account and currency; income and expense folded into current earnings */
function closeRows(b,upto){const B=BASE(),m=bals(b,upto),rows=[];let earn=0;
 Object.values(m).sort((x,y)=>x.code.localeCompare(y.code)).forEach(o=>{if(!BS(o.code)){earn-=o.cad;return}
  if(o.code=='1100'){/* the stock record holds only the current position: split by currency only when nothing moved stock after this date, else use the locked snapshot */
   const later=S.j.some(x=>x.br==b&&x.date>upto&&x.lines.some(y=>String(y[0])=='1100')),lk=REC(b,upto),sr=lk&&lk.lock&&lk.lock.snap&&lk.lock.snap.dcs&&lk.lock.snap.dcs.close?lk.lock.snap.dcs.close.rows.filter(r=>r.code=='1100'):null;
   if(!later){const P=posOf(b);let t=0;P.forEach(p=>{const cad=r2(p.q*p.c);t+=cad;rows.push({code:o.code,ccy:p.ccy,fc:r2(p.q),cad})});const u=r2(o.cad-t);if(Math.abs(u)>.004||!P.length)rows.push({code:o.code,ccy:B,fc:u,cad:u,note:P.length?'Ledger differs from the currency stock record':''});return}
   if(sr&&Math.abs(r2(sr.reduce((t,r)=>t+r.cad,0))-o.cad)<.005){sr.forEach(r=>rows.push({...r,note:'From the locked close of '+upto}));return}
   rows.push({code:o.code,ccy:B,fc:o.cad,cad:o.cad,note:'All currencies at cost. The split by currency is kept from the first locked day onward.'});return}
  Object.keys(o.nat).forEach(k=>{if(Math.abs(o.cadBy[k])<.005&&Math.abs(o.nat[k])<.005)return;rows.push({code:o.code,ccy:k,fc:o.nat[k],cad:o.cadBy[k]})})});
 return{rows,earn:r2(earn)}}
function dayIE(b,d){const m=bals(b,d,d),inc=[],exp=[];Object.values(m).forEach(o=>{const t=TY(o.code);if(t=='Income')inc.push({code:o.code,v:r2(-o.cad)});else if(t=='Expenses')exp.push({code:o.code,v:r2(o.cad)})});
 const ti=r2(inc.reduce((s,x)=>s+x.v,0)),te=r2(exp.reduce((s,x)=>s+x.v,0));return{inc,exp,ti,te,net:r2(ti-te)}}
/* closing rate: approved daily rate, else approved monthly rate, else board mid */
function rateOf(ccy,d){const dr=((DCS().rates[d]||{})[ccy]);if(dr&&dr.st=='Approved')return{r:+dr.r,src:dr.src,by:dr.by,ap:dr.ap,kind:'Daily closing rate',ok:true};
 const mr=((S.fxcl||{})[d.slice(0,7)]||{})[ccy];if(mr&&mr.status=='Approved')return{r:+mr.rate,src:'Monthly closing rate '+d.slice(0,7)+' (FX management)',by:mr.by,ap:mr.apBy||mr.apprBy||'',kind:'Monthly closing rate',ok:true};
 return{r:(typeof mid=='function'?+mid(ccy):0)||0,src:'Board mid rate (not an approved closing rate)',kind:'Board mid',ok:false,pend:!!(dr&&dr.st!='Approved')}}
function fxRows(b,d){return posOf(b).map(p=>{const R=rateOf(p.ccy,d),book=r2(p.q*p.c),val=r2(p.q*R.r);return{...p,book,rate:R,val,unr:r2(val-book)}})}

/* ---------------- reconciliations ---------------- */
const isSafe=a=>/safe|vault/i.test(a.label||'');
function cashRecs(b,d){const out=[];cacc(b).filter(a=>a.kind=='Cash').forEach(a=>{const c=(S.closings||[]).find(x=>x.acc==a.id&&x.date==d&&!x.reopened),q=(S.clq||[]).find(x=>x.acc==a.id&&x.date==d&&x.st=='Pending approval');
 let rows=[];try{rows=typeof dayRows=='function'?dayRows(a.id,d):[]}catch(e){}const active=rows.some(r=>Math.abs(r.open)>.004||Math.abs(r.i)>.004||Math.abs(r.o)>.004);
 if(!active&&!c&&!q)return;(c||q?(c||q).rows:rows).forEach(r=>{const counted=c||q?r2(r.counted):null,exp=r2(r.exp),v=counted==null?null:r2(counted-exp);
  out.push({kind:isSafe(a)?'safe':'cash',id:a.id,label:a.label,ccy:r.ccy,exp,act:counted,var:v,varCad:v==null?null:r2(v*((typeof mid=='function'?mid(r.ccy):1)||1)),reason:(r.reason||'')+(r.rnote?' · '+r.rnote:''),ref:c?'Closing '+(c.by||''):q?'Submitted by '+(q.by||''):'',
   st:c?(Math.abs(v)<.005?'Balanced':'Variance recorded'):q?'Awaiting approval':'Not counted',by:(c||q||{}).by||'',ap:c?c.apprBy||'':''})})});return out}
function bankRecs(b,d){const out=[],B=BASE();cacc(b).filter(a=>a.kind=='Bank').forEach(a=>{let rows=[];try{rows=dayRows(a.id,d)}catch(e){}const ccy=a.ccy||B,row=rows.find(r=>r.ccy==ccy)||{exp:0,i:0,o:0,open:0};
 const active=Math.abs(row.exp)>.004||Math.abs(row.i)>.004||Math.abs(row.o)>.004;const s=DCS().bstm[a.id+'|'+d];if(!active&&!s)return;
 const items=(s&&s.items)||[],adj=s?r2(+s.bal+items.reduce((t,i)=>t+(+i.amt||0),0)):null,v=s?r2(adj-row.exp):null;
 const un=(S.bst||[]).filter(r=>r.bank==a.bank&&!r.j&&(r.date||d)<=d).length;
 out.push({kind:'bank',id:a.id,label:a.label,ccy,exp:r2(row.exp),stmt:s?+s.bal:null,items,act:adj,var:v,varCad:v==null?null:r2(v*((ccy==B?1:mid(ccy))||1)),reason:s&&s.reason||'',ref:s?s.ref:'',unmatched:un,
  st:!s?'Statement not entered':Math.abs(v)<.005?(items.length?'Reconciled · '+items.length+' item'+(items.length==1?'':'s'):'Reconciled'):s.reason?'Explained':'Difference',by:s?s.by:'',at:s?s.at:''})});return out}
function fxRecs(b,d){const C=DCS().fxc[b+'|'+d],P=posOf(b),ccys=[...new Set([...P.map(p=>p.ccy),...Object.keys((C&&C.rows)||{})])].sort();
 return ccys.map(c=>{const p=P.find(x=>x.ccy==c)||{q:0,c:0},row=C&&C.rows[c],adj=DCS().adj.filter(x=>x.br==b&&x.date==d&&x.ccy==c&&x.st!='Rejected').pop();
  const exp=row?r2(row.exp):r2(p.q),act=row?r2(row.q):null,v=act==null?null:r2(act-exp),wac=row&&row.c?row.c:p.c;let s;
  if(act==null)s='Not counted';else if(adj&&adj.st=='Posted')s=Math.abs(p.q-act)<1e-6?'Adjusted · '+adj.id:'Recount needed';else if(Math.abs(p.q-exp)>1e-6)s='Recount needed';
  else if(Math.abs(v)<.005)s='Balanced';else if(adj)s='Adjustment pending approval';else if(row.reason&&row.ref)s='Explained · adjustment needed';else s='Needs reason';
  return{kind:'fx',id:c,label:'1100 Currency stock – '+c,ccy:c,exp,act,var:v,varCad:v==null?null:r2(v*wac),wac,reason:row&&row.reason||'',ref:row&&row.ref||'',st:s,adj,by:C?C.by:'',wit:C?C.wit:'',liveQ:r2(p.q)}})}
const agentsFor=b=>DCS().agents.filter(g=>g.on!==false&&(!g.br||g.br=='all'||g.br==b));
function agRecs(b,d){return agentsFor(b).map(g=>{const m=bals(b,d)[String(g.code)],book=m?m.cad:0,mv=bals(b,d,d)[String(g.code)],s=DCS().agst[g.id+'|'+b+'|'+d];
 if(Math.abs(book)<.005&&!mv&&!s)return null;const v=s?r2(+s.bal-book):null;
 return{kind:'agent',id:g.id,label:g.code+' '+(CH[g.code]||'Due from '+g.name),agent:g.name,ccy:BASE(),exp:r2(book),act:s?+s.bal:null,var:v,varCad:v,reason:s&&s.reason||'',ref:s?s.ref:'',st:!s?'Statement not entered':Math.abs(v)<.005?'Matched':s.reason?'Explained':'Unmatched',by:s?s.by:'',moves:mv?{dr:mv.dr,cr:mv.cr}:null}}).filter(Boolean)}
/* receipts from a settlement agent must reduce the due-from account, never income */
function misuse(b,d){const ag=agentsFor(b);if(!ag.length)return[];return S.j.filter(x=>x.br==b&&x.date==d&&!x.rev&&!x.revBy).filter(x=>{const t=((x.party||'')+' '+(x.memo||'')).toLowerCase();
 const g=ag.find(g=>t.includes(String(g.name).toLowerCase()));if(!g)return false;if(x.lines.some(y=>String(y[0])==String(g.code)))return false;
 return x.lines.some(y=>TY(y[0])=='Income'&&(+y[2]||0)>0)&&x.lines.some(y=>CASHGL(y[0])&&(+y[1]||0)>0)})}
function openCheck(b,d){const prev=Object.values(S.cpd||{}).filter(r=>r.br==b&&r.lock&&r.date<d).sort((x,y)=>y.date.localeCompare(x.date))[0];
 if(!prev)return{ok:true,none:true};const sn=prev.lock.snap&&prev.lock.snap.dcs;if(!sn||!sn.close)return{ok:true,legacy:true,from:prev.date};
 const live=bals(b,prev.date),diffs=[];const by={};sn.close.rows.forEach(r=>{by[r.code]=r2((by[r.code]||0)+r.cad)});
 Object.keys({...by,...Object.fromEntries(Object.keys(live).filter(c=>BS(c)).map(c=>[c,1]))}).forEach(c=>{if(!BS(c))return;const v=r2(((live[c]||{}).cad||0)-(by[c]||0));if(Math.abs(v)>.004)diffs.push({code:c,v})});
 return{ok:!diffs.length,from:prev.date,by:prev.lock.by,diffs}}

/* ---------------- readiness hook ---------------- */
window.dcsReady=(b,d,add)=>{const c=DCS().cfg,go={t:'rcn'};
 const oc=openCheck(b,d);add('dcsopn','Opening balances equal the last approved close',oc.ok,oc.ok?'':'Changed after the '+oc.from+' close was locked: '+oc.diffs.map(x=>x.code+' '+(CH[x.code]||'')+' '+SG(x.v)).join('; ')+'. Post a dated correction in an open day instead.','block',go);
 const bk=bankRecs(b,d);if(c.reqBank&&bk.length){const bad=bk.filter(r=>!['Reconciled','Explained'].some(k=>r.st.startsWith(k)));add('dcsbnk','Bank statements reconciled',!bad.length,bad.map(r=>r.label+': '+r.st.toLowerCase()).join('; ')+'.','block',go)}
 const fx=fxRecs(b,d);if(c.reqFx&&fx.length){const bad=fx.filter(r=>!(r.st=='Balanced'||r.st.startsWith('Adjusted')));add('dcsfx','Currency stock counted and agreed',!bad.length,bad.map(r=>r.ccy+': '+r.st.toLowerCase()).join('; ')+'.','block',go)}
 const pa=DCS().adj.filter(x=>x.br==b&&x.date==d&&x.st=='Pending approval');add('dcsadj','No stock adjustments waiting for approval',!pa.length,pa.map(x=>x.id).join(', ')+' waiting for a manager or owner.','block',go);
 const ag=agRecs(b,d);if(c.reqAgents&&ag.length){const bad=ag.filter(r=>!['Matched','Explained'].includes(r.st));add('dcsag','Settlement agents matched to statements',!bad.length,bad.map(r=>r.agent+': '+r.st.toLowerCase()).join('; ')+'.','block',go)}
 const mu=misuse(b,d);if(agentsFor(b).length)add('dcsinc','Agent receipts reduce the due-from account, not income',!mu.length,mu.map(x=>(x.vno||'#'+x.id)).join(', ')+' credit income for money received from a settlement agent. Reverse and repost against the agent account.','block',go);
 const held=posOf(b).map(p=>p.ccy),miss=held.filter(cc=>!rateOf(cc,d).ok);if(held.length)add('dcsrt','Closing rates approved for held currencies',!miss.length,'Using board mid for '+miss.join(', ')+'. Enter and approve closing rates with their source.',c.reqRates?'block':'warn',go)};

/* ---------------- snapshot (stored in the lock) ---------------- */
window.dcsSnap=(b,d)=>{try{const cr=closeRows(b,d),op=closeRows(b,addD(d,-1));return{v:1,close:cr,open:op,ie:dayIE(b,d),
 recon:{cash:cashRecs(b,d),bank:bankRecs(b,d),fx:fxRecs(b,d).map(({adj,...r})=>({...r,adj:adj?adj.id:''})),agent:agRecs(b,d)},fx:fxRows(b,d),
 adj:DCS().adj.filter(x=>x.br==b&&x.date==d).map(x=>({...x})),jids:S.j.filter(x=>x.br==b&&x.date==d).map(x=>x.id),openCheck:openCheck(b,d)}}catch(e){console.error(e);return{v:1,err:e.message}}};

/* ---------------- locked-day posting guard ---------------- */
{const g0=window.apwGate;window.apwGate=function(o){if(o&&o.br&&o.date&&locked(o.br,o.date)){const m='The '+o.date+' day is locked for '+bn(o.br)+'. Post on an open business date, or ask for a reopen with a reason.';throw(typeof PE=='function'?PE(m):new Error(m))}if(g0)return g0.apply(this,arguments)}}

/* ---------------- actions ---------------- */
const DR=window.__dcsDraft=window.__dcsDraft||{};
const dv=(id,v)=>Object.prototype.hasOwnProperty.call(DR,id)?DR[id]:(v==null?'':v);
document.addEventListener('input',e=>{const t=e.target;if(t&&t.id&&/^dcs/.test(t.id))DR[t.id]=t.value},true);
const clr=pre=>Object.keys(DR).forEach(k=>{if(k.startsWith(pre))delete DR[k]});
const val=id=>{const e=document.getElementById(id);return e?e.value:dv(id,'')};
const done=(m,b,d,act,pre)=>{if(pre)clr(pre);save();if(act)au(b,d,act,m);toast(m);go()};
window.dcsBankSave=(b,d,id,n)=>{const g=guard(b,d);if(g)return toast(g,1);const bal=val('dcsbk'+n+'b').trim(),ref=val('dcsbk'+n+'r').trim(),its=val('dcsbk'+n+'i'),why=val('dcsbk'+n+'w').trim();
 if(bal===''||!isFinite(+bal))return toast('Enter the closing balance shown on the bank statement.',1);if(!ref)return toast('Enter the statement reference (for example the statement date or file name).',1);
 const items=[];for(const ln of its.split('\n').map(s=>s.trim()).filter(Boolean)){const p=ln.split(';').map(s=>s.trim());const amt=+String(p[p.length-1]).replace(/,/g,'');if(p.length<2||!isFinite(amt)||!p[p.length-1])return toast('Each reconciling item needs "reference; description; amount". Problem line: '+ln,1);items.push({ref:p[0],desc:p.length>2?p.slice(1,-1).join('; '):'',amt:r2(amt)})}
 const book=(bankRecs(b,d).find(r=>r.id==id)||{}).exp||0,v=r2(+bal+items.reduce((t,i)=>t+i.amt,0)-book);if(Math.abs(v)>.004&&why.length<10)return toast('The statement differs from the books by '+SG(v)+'. Write a reason of at least 10 characters, or add the missing reconciling item.',1);
 DCS().bstm[id+'|'+d]={bal:r2(+bal),ref,items,reason:Math.abs(v)>.004?why:'',by:ME().name||'',at:nowI()};done('Bank statement saved for '+(cacc(b).find(a=>a.id==id)||{}).label+': difference '+SG(v)+'.',b,d,'Bank reconciliation','dcsbk'+n)};
window.dcsFxSave=(b,d)=>{const g=guard(b,d);if(g)return toast(g,1);const P=posOf(b),prev=DCS().fxc[b+'|'+d],ccys=[...new Set([...P.map(p=>p.ccy),...Object.keys((prev&&prev.rows)||{})])],rows={};
 const wit=val('dcsfxw').trim();for(const c of ccys){const q=val('dcsfx_'+c+'_q').trim();if(q==='')return toast('Enter the counted quantity of '+c+' (0 if none).',1);if(!isFinite(+q)||+q<0)return toast(c+': the counted quantity must be zero or more.',1);
  const p=P.find(x=>x.ccy==c)||{q:0,c:0},v=r2(+q-p.q),reason=val('dcsfx_'+c+'_r').trim(),ref=val('dcsfx_'+c+'_f').trim();
  if(Math.abs(v)>.004&&(reason.length<10||!ref))return toast(c+' differs by '+SG(v)+'. Give a reason (10+ characters) and a supporting reference such as an incident number.',1);
  rows[c]={exp:r2(p.q),q:r2(+q),c:p.c,reason:Math.abs(v)>.004?reason:'',ref:Math.abs(v)>.004?ref:''}}
 if(wit&&wit.toLowerCase()==String(ME().name||'').toLowerCase())return toast('The witness must be a different person from the counter.',1);
 DCS().fxc[b+'|'+d]={by:ME().name||'',wit,at:nowI(),rows};done('Currency stock count saved ('+ccys.length+' currencies).',b,d,'Currency stock counted','dcsfx')};
window.dcsAdjReq=(b,d,c)=>{const g=guard(b,d);if(g)return toast(g,1);const r=fxRecs(b,d).find(x=>x.ccy==c);if(!r||r.act==null||Math.abs(r.var)<.005)return toast('There is no '+c+' variance to adjust.',1);
 if(!(r.reason&&r.ref))return toast('Save a reason and reference for the '+c+' variance first.',1);if(r.adj&&r.adj.st!='Rejected')return toast(r.adj.id+' already exists.',1);
 const n=DCS().adj.filter(x=>x.date==d).length+1,id='ADJ-'+d.replace(/-/g,'')+'-'+String(n).padStart(2,'0');const cad=r2(Math.abs(r.var)*r.wac);
 DCS().adj.push({id,br:b,date:d,ccy:c,qty:r.var,c:r.wac,cad,reason:r.reason,ref:r.ref,by:ME().name||'',at:nowI(),st:'Pending approval'});done(id+' raised: '+c+' '+SG(r.var)+' at average cost '+RF(r.wac)+' = '+BASE()+' '+F(cad)+'. Another manager or owner must approve it.',b,d,'Stock adjustment requested')};
window.dcsAdjDo=(id,ok)=>{const x=DCS().adj.find(a=>a.id==id);if(!x||x.st!='Pending approval')return toast('This adjustment is no longer waiting for approval.',1);const b=x.br,d=x.date;if(locked(b,d))return toast(guard(b,d),1);
 if(!isAp())return toast('Only a manager or owner can decide stock adjustments.',1);if(x.by==ME().name&&otherAp(x.by)>0)return toast('You raised '+id+'. Another manager or owner must approve or reject it.',1);
 if(!ok){const why=val('dcsadjw_'+id).trim();if(why.length<10)return toast('Write the reason for rejecting (at least 10 characters).',1);x.st='Rejected';x.apBy=ME().name;x.apAt=nowI();x.note=why;return done(id+' rejected.',b,d,'Stock adjustment rejected','dcsadjw_'+id)}
 const k=b+'|'+x.ccy,p=S.pos[k];if(!p)return toast('There is no '+x.ccy+' stock record for '+bn(b)+'.',1);if(p.q+x.qty<-1e-9)return toast('The adjustment would make '+x.ccy+' stock negative.',1);
 const L=x.qty<0?[['6500',x.cad,0],['1100',0,x.cad]]:[['1100',x.cad,0],['6500',0,x.cad]];if(!CH['6500']&&typeof addAcct=='function')addAcct('6500','Cash Over/Short');
 const n0=S.j.length;try{post({date:d,br:b,tt:'Stock count adjustment',vno:id,ref:x.ref,memo:id+' '+x.ccy+' stock '+(x.qty<0?'shortage':'overage')+' '+F(Math.abs(x.qty))+' at average cost '+RF(x.c)+': '+x.reason,lines:L,appr:{by:ME().name,at:nowI()},mk:x.by})}
 catch(e){S.j.length=n0;return toast((e&&e.message)||'The adjustment could not be posted.',1)}
 p.q=+(p.q+x.qty).toFixed(8);x.st='Posted';x.apBy=ME().name;x.apAt=nowI();x.je=S.j[S.j.length-1].id;done(id+' approved and posted: '+(x.qty<0?'Dr 6500 / Cr 1100':'Dr 1100 / Cr 6500')+' '+BASE()+' '+F(x.cad)+'.',b,d,'Stock adjustment posted')};
window.dcsAgSave=(b,d,gid)=>{const g=guard(b,d);if(g)return toast(g,1);const bal=val('dcsag_'+gid+'_b').trim(),ref=val('dcsag_'+gid+'_r').trim(),why=val('dcsag_'+gid+'_w').trim();
 if(bal===''||!isFinite(+bal))return toast('Enter the balance due shown on the agent statement.',1);if(!ref)return toast('Enter the agent statement reference.',1);
 const r=agRecs(b,d).find(x=>x.id==gid)||{exp:(bals(b,d)[String((DCS().agents.find(a=>a.id==gid)||{}).code)]||{}).cad||0},v=r2(+bal-r.exp);if(Math.abs(v)>.004&&why.length<10)return toast('The statement differs from the books by '+SG(v)+'. Write a reason of at least 10 characters.',1);
 DCS().agst[gid+'|'+b+'|'+d]={bal:r2(+bal),ref,reason:Math.abs(v)>.004?why:'',by:ME().name||'',at:nowI()};done('Settlement statement saved: difference '+SG(v)+'.',b,d,'Settlement reconciliation','dcsag_'+gid)};
window.dcsAgAdd=()=>{if(!isOwn())return toast('Only an owner can add settlement agents.',1);const name=val('dcsagn').trim(),code=val('dcsagc').trim();if(name.length<2)return toast('Enter the agent name.',1);
 if(!/^1\d{3}$/.test(code))return toast('The account code must be a 4-digit asset code starting with 1 (for example 1250).',1);if(['1000','1010','1100'].includes(code)||CASHGL(code))return toast('Use a separate receivable account, not a cash, bank or currency stock account.',1);
 if(CH[code]&&!/due from|receivable|settlement/i.test(CH[code]))return toast(code+' is already used by "'+CH[code]+'". Choose a free code.',1);if(DCS().agents.some(a=>a.code==code))return toast('Another agent already uses '+code+'.',1);
 if(!CH[code]){if(typeof addAcct=='function')addAcct(code,'Due from '+name);S.acx=S.acx||{};S.acx[code]={grp:'Receivables',cur:'base'}}
 DCS().agents.push({id:'ag'+Date.now().toString(36),name,code,br:'all',on:true,by:ME().name,at:nowI()});save();try{alog('Settlement agents','Added '+name+' with account '+code)}catch(e){}clr('dcsag');toast(name+' added. Its balance is reconciled under account '+code+'.');go()};
window.dcsAgOff=id=>{if(!isOwn())return toast('Only an owner can change settlement agents.',1);const g=DCS().agents.find(a=>a.id==id);if(!g)return;g.on=g.on===false;save();try{alog('Settlement agents',(g.on?'Activated ':'Deactivated ')+g.name)}catch(e){}go()};
window.dcsRateSave=(d,c,b)=>{if(!isFin())return toast('Only an owner, manager or accountant can enter closing rates.',1);if(b&&locked(b,d))return toast(guard(b,d),1);const r=+val('dcsrt_'+c+'_r'),src=val('dcsrt_'+c+'_s').trim();
 if(!(r>0))return toast('Enter a '+c+' closing rate above zero.',1);if(src.length<3)return toast('Enter where the rate comes from (for example "Bank of Canada 16:30" or "Treasury sheet CR-1027").',1);
 const m=(typeof mid=='function'?mid(c):0)||0;const R=DCS().rates[d]=DCS().rates[d]||{};const old=R[c];if(old&&old.st=='Approved'&&!isOwn())return toast('An approved closing rate can only be replaced by an owner.',1);
 R[c]={r,src,by:ME().name||'',at:nowI(),st:'Pending approval',dev:m?r2((r/m-1)*100):null};save();try{alog('Closing rate',d+' '+c+' '+r+' from '+src+' entered')}catch(e){}clr('dcsrt_'+c);toast(c+' closing rate saved. Another manager or owner approves it.');go()};
window.dcsRateAp=(d,c)=>{const x=(DCS().rates[d]||{})[c];if(!x||x.st=='Approved')return;if(!isAp())return toast('Only a manager or owner can approve closing rates.',1);if(x.by==ME().name&&otherAp(x.by)>0)return toast('You entered this rate. Another manager or owner must approve it.',1);
 x.st='Approved';x.ap=ME().name;x.apAt=nowI();save();try{alog('Closing rate',d+' '+c+' '+x.r+' approved')}catch(e){}toast(c+' closing rate approved.');go()};
window.dcsCfg=(k,v)=>{if(!isOwn())return toast('Only an owner can change closing requirements.',1);DCS().cfg[k]=v?1:0;save();try{alog('Closing policy',k+' '+(v?'on':'off'))}catch(e){}go()};
window.dcsJump=id=>{const e=document.getElementById(id);if(e)e.scrollIntoView({behavior:'smooth',block:'start'})};

/* ---------------- shared UI bits ---------------- */
const tag=(t,c)=>`<span class="cpc-tg ${c||''}">${A(t)}</span>`;
const stTag=s=>tag(s,/^(Balanced|Reconciled|Matched|Adjusted|Posted|Approved|Explained|Locked|Closed)/.test(s)?'ok':/(Needs|Difference|Unmatched|Not |Recount|Rejected)/.test(s)?'bad':'wn');
const tbl=(head,rows,foot)=>`<div class="cpc-w"><table class="cpc-t dcs-t"><thead><tr>${head.map(h=>`<th${/^(n:)/.test(h)?' class="n"':''}>${A(h.replace(/^n:/,''))}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${head.length}" class="dcs-mu">Nothing to show.</td></tr>`}</tbody>${foot?`<tfoot>${foot}</tfoot>`:''}</table></div>`;
const td=(v,n,c)=>`<td${n?' class="n'+(c?' '+c:'')+'"':c?' class="'+c+'"':''}>${v}</td>`;
const STEPS=['Open day','Load opening balances','Record transactions','Reconcile accounts','Review variances','Submit','Approve','Lock day','Next-day opening'];
function steps(b,d){const s=stOf(b,d),rd=window.cpcReady?cpcReady(b,d):{items:[]},ok=id=>{const i=rd.items.find(x=>x.id==id);return!i||i.ok};
 const act=s!='NONE',sub=['PENDING_APPROVAL','CLOSED','LOCKED'].includes(s);
 return[act,act&&ok('dcsopn')&&ok('brg'),act&&ok('apw')&&ok('txn'),act&&ok('cnt')&&ok('dcsbnk')&&ok('dcsfx')&&ok('dcsag')&&ok('rec'),act&&ok('var')&&ok('dcsadj')&&ok('dcsinc'),sub,['CLOSED','LOCKED'].includes(s),s=='LOCKED',s=='LOCKED']}
function rail(b,d){const st=steps(b,d),cur=st.findIndex(x=>!x);return`<ol class="dcs-rail" aria-label="Closing workflow">${STEPS.map((t,i)=>`<li class="${st[i]?'done':i==cur?'cur':''}" ${i==cur?'aria-current="step"':''}><i></i><span>${i+1}. ${t}</span></li>`).join('')}</ol>`}
const head=(b,d,title,sub)=>{const s=stOf(b,d),L=locked(b,d);return`<div class="cpc-card dcs-hd"><div class="dcs-hr"><div><span class="dcs-ey">${A(bn(b))} · ${A(d)}</span><h4>${title}</h4>${sub?`<p class="dcs-mu">${sub}</p>`:''}</div>${tag(L?'Locked':({NONE:'No activity',OPEN:'Open',COUNTING:'Counting',RECONCILING:'Reconciling',PENDING_APPROVAL:'Pending approval',CLOSED:'Closed',REOPENED:'Reopened'})[s]||s,L||s=='CLOSED'?'ok':s=='NONE'?'':'wn')}</div>${rail(b,d)}${L?`<p class="dcs-note ok">Locked by ${A(REC(b,d).lock.by)} at ${A(stamp(REC(b,d).lock.at))} UTC. Everything below is read-only and nothing can be posted to ${A(d)} for this branch.</p>`:''}</div>`};

/* ---------------- Reconciliations tab ---------------- */
window.dcsRecon=(b,d)=>{if(!b)return'<p class="cpc-em">Choose a branch.</p>';try{const ro=!!guard(b,d),c=DCS().cfg,B=BASE();
 const cash=cashRecs(b,d),hasSafe=cacc(b).some(a=>a.kind=='Cash'&&isSafe(a));
 const cashT=tbl(['Account','Type','Currency','n:Expected','n:Counted','n:Variance','Reason','Status',''],cash.map(r=>`<tr>${td('<b>'+A(r.label)+'</b>')}${td(r.kind=='safe'?'Safe':'Till')}${td(A(r.ccy))}${td(F(r.exp),1)}${td(r.act==null?'—':F(r.act),1)}${td(r.var==null?'—':SG(r.var),1,r.var&&Math.abs(r.var)>.004?'bad':'')}${td(A(r.reason)||'<span class="dcs-mu">—</span>')}${td(stTag(r.st))}${td(r.st=='Not counted'&&!ro?`<button type="button" class="cpc-b" onclick="dxCl('${A(r.id)}')">Count</button>`:'')}</tr>`));
 const banks=bankRecs(b,d),bankH=banks.length?banks.map((r,n)=>{const s=DCS().bstm[r.id+'|'+d]||{};return`<div class="dcs-box"><div class="dcs-hr"><h5>${A(r.label)} · ${A(r.ccy)}</h5>${stTag(r.st)}</div>
  ${tbl(['Line','','n:'+r.ccy],[`<tr>${td('Balance per bank statement')}${td(A(r.ref||''),0,'dcs-mu')}${td(r.stmt==null?'—':F(r.stmt),1)}</tr>`,...r.items.map(i=>`<tr>${td(A(i.amt<0?'Less outstanding':'Add in transit')+' '+A(i.ref))}${td(A(i.desc),0,'dcs-mu')}${td(F(i.amt),1)}</tr>`),`<tr class="dcs-sub">${td('Adjusted statement balance')}${td('')}${td(r.act==null?'—':F(r.act),1)}</tr>`,`<tr>${td('Balance per books')}${td('')}${td(F(r.exp),1)}</tr>`,`<tr class="dcs-sub">${td('Difference')}${td(A(r.reason))}${td(r.var==null?'—':SG(r.var),1,r.var&&Math.abs(r.var)>.004?'bad':'')}</tr>`])}
  ${r.unmatched?`<p class="dcs-note wn">${r.unmatched} imported bank line${r.unmatched==1?' is':'s are'} not matched to an entry yet. <button type="button" class="cpc-b" onclick="view='brc';go()">Match bank lines</button></p>`:''}
  ${ro?'':`<div class="dcs-fg"><label>Statement closing balance<input id="dcsbk${n}b" inputmode="decimal" value="${A(dv('dcsbk'+n+'b',s.bal))}" placeholder="0.00"></label><label>Statement reference<input id="dcsbk${n}r" value="${A(dv('dcsbk'+n+'r',s.ref))}" placeholder="e.g. RBC statement ${A(d)}"></label>
  <label class="dcs-s2">Reconciling items, one per line: reference; description; amount (minus for payments not yet cleared)<textarea id="dcsbk${n}i" rows="2" placeholder="CHQ 1042; Cheque to landlord; -50.00">${A(dv('dcsbk'+n+'i',(s.items||[]).map(i=>i.ref+'; '+i.desc+'; '+i.amt).join('\n')))}</textarea></label>
  <label class="dcs-s2">Reason if a difference remains<input id="dcsbk${n}w" value="${A(dv('dcsbk'+n+'w',s.reason))}"></label></div><div class="dcs-ac"><button type="button" class="cpc-b pri" onclick="dcsBankSave('${A(b)}','${A(d)}','${A(r.id)}',${n})">Save bank reconciliation</button></div>`}</div>`}).join(''):'<p class="cpc-em">No bank account with a balance or movement at this branch.</p>';
 const fx=fxRecs(b,d),C=DCS().fxc[b+'|'+d]||{},fxH=fx.length?`${tbl(['Currency','n:Expected (stock)','n:Counted','n:Variance','n:Variance '+B,'n:Average cost','Reason','Reference','Status'],fx.map(r=>`<tr>${td('<b>'+A(r.ccy)+'</b>')}${td(F(r.exp),1)}${td(ro?(r.act==null?'—':F(r.act)):`<input class="dcs-q" id="dcsfx_${A(r.ccy)}_q" inputmode="decimal" value="${A(dv('dcsfx_'+r.ccy+'_q',r.act))}" aria-label="Counted ${A(r.ccy)}">`,1)}${td(r.var==null?'—':SG(r.var),1,r.var&&Math.abs(r.var)>.004?'bad':'')}${td(r.varCad==null?'—':SG(r.varCad),1)}${td(RF(r.wac),1)}${td(ro?A(r.reason):`<input id="dcsfx_${A(r.ccy)}_r" value="${A(dv('dcsfx_'+r.ccy+'_r',r.reason))}" placeholder="Needed if counted differs">`)}${td(ro?A(r.ref):`<input id="dcsfx_${A(r.ccy)}_f" value="${A(dv('dcsfx_'+r.ccy+'_f',r.ref))}" placeholder="Incident / count sheet">`)}${td(stTag(r.st)+(r.st.startsWith('Explained')&&!ro?` <button type="button" class="cpc-b" onclick="dcsAdjReq('${A(b)}','${A(d)}','${A(r.ccy)}')">Request adjustment</button>`:''))}</tr>`))}
  ${C.by?`<p class="dcs-mu">Counted by ${A(C.by)}${C.wit?' · witnessed by '+A(C.wit):''} at ${A(stamp(C.at))} UTC.</p>`:''}${ro?'':`<div class="dcs-fg"><label>Second counter (witness)<input id="dcsfxw" value="${A(dv('dcsfxw',C.wit))}" placeholder="Name of a second person"></label></div><div class="dcs-ac"><button type="button" class="cpc-b pri" onclick="dcsFxSave('${A(b)}','${A(d)}')">Save currency count</button></div>`}`:'<p class="cpc-em">No foreign currency stock held at this branch.</p>';
 const adj=DCS().adj.filter(x=>x.br==b&&x.date==d),adjH=adj.length?tbl(['Adjustment','Currency','n:Quantity','n:Average cost','n:'+B,'Reason','Maker','Checker','Status',''],adj.map(x=>`<tr>${td('<b>'+A(x.id)+'</b>')}${td(A(x.ccy))}${td(SG(x.qty),1)}${td(RF(x.c),1)}${td(F(x.cad),1)}${td(A(x.reason)+'<br><span class="dcs-mu">'+A(x.ref)+'</span>')}${td(A(x.by))}${td(A(x.apBy||'—'))}${td(stTag(x.st))}${td(x.st=='Pending approval'&&isAp()&&!locked(b,d)?`<div class="dcs-ac"><button type="button" class="cpc-b pri" onclick="dcsAdjDo('${A(x.id)}',1)">Approve and post</button><input id="dcsadjw_${A(x.id)}" value="${A(dv('dcsadjw_'+x.id))}" placeholder="Reason to reject"><button type="button" class="cpc-b" onclick="dcsAdjDo('${A(x.id)}',0)">Reject</button></div>`:'')}</tr>`)):'';
 const ag=agRecs(b,d),agents=agentsFor(b),agH=`<div class="dcs-call"><b>Settlement agents such as Taaj System are receivables, not income.</b> When the branch pays out a Taaj remittance, Taaj owes us that money: <span class="dcs-m">Dr Due from Taaj / Cr Cash</span>. When Taaj pays us, in cash or by bank, the receivable goes down: <span class="dcs-m">Dr Cash or Bank / Cr Due from Taaj</span>. Only the commission Taaj pays us is income. A receipt from an agent that credits income blocks the close.</div>
  ${ag.length?ag.map(r=>{const s=DCS().agst[r.id+'|'+b+'|'+d]||{};return`<div class="dcs-box"><div class="dcs-hr"><h5>${A(r.agent)} · ${A(r.label)}</h5>${stTag(r.st)}</div>${tbl(['Line','n:'+B],[r.moves?`<tr>${td('Movements today: paid out / commission (debits)')}${td(F(r.moves.dr),1)}</tr><tr>${td('Movements today: settlements received (credits)')}${td(F(-r.moves.cr),1)}</tr>`:'',`<tr class="dcs-sub">${td('Balance due per books')}${td(F(r.exp),1)}</tr>`,`<tr>${td('Balance due per agent statement '+A(r.ref?'('+r.ref+')':''))}${td(r.act==null?'—':F(r.act),1)}</tr>`,`<tr class="dcs-sub">${td('Difference '+A(r.reason?'· '+r.reason:''))}${td(r.var==null?'—':SG(r.var),1,r.var&&Math.abs(r.var)>.004?'bad':'')}</tr>`])}
  ${ro?'':`<div class="dcs-fg"><label>Statement balance due<input id="dcsag_${A(r.id)}_b" inputmode="decimal" value="${A(dv('dcsag_'+r.id+'_b',s.bal))}"></label><label>Statement reference<input id="dcsag_${A(r.id)}_r" value="${A(dv('dcsag_'+r.id+'_r',s.ref))}" placeholder="e.g. TJ-STMT-${A(d.replace(/-/g,''))}"></label><label class="dcs-s2">Reason if a difference remains<input id="dcsag_${A(r.id)}_w" value="${A(dv('dcsag_'+r.id+'_w',s.reason))}"></label></div><div class="dcs-ac"><button type="button" class="cpc-b pri" onclick="dcsAgSave('${A(b)}','${A(d)}','${A(r.id)}')">Save settlement reconciliation</button></div>`}</div>`}).join(''):agents.length?'<p class="cpc-em">No agent balance or movement at this branch.</p>':'<p class="cpc-em">No settlement agents set up yet.</p>'}
  <details class="dcs-det"${agents.length?'':' open'}><summary>Settlement agents (${agents.length})</summary>${DCS().agents.length?tbl(['Agent','Account','Status',''],DCS().agents.map(g=>`<tr>${td(A(g.name))}${td(A(g.code+' '+(CH[g.code]||'')))}${td(stTag(g.on===false?'Inactive':'Active'))}${td(isOwn()?`<button type="button" class="cpc-b" onclick="dcsAgOff('${A(g.id)}')">${g.on===false?'Activate':'Deactivate'}</button>`:'')}</tr>`)):''}
  ${isOwn()?`<div class="dcs-fg"><label>Agent name<input id="dcsagn" value="${A(dv('dcsagn'))}" placeholder="Taaj System"></label><label>Receivable account code<input id="dcsagc" value="${A(dv('dcsagc'))}" inputmode="numeric" placeholder="1250"></label></div><div class="dcs-ac"><button type="button" class="cpc-b" onclick="dcsAgAdd()">Add settlement agent</button></div><p class="dcs-mu">A new code creates an asset account "Due from …" in the Receivables group.</p>`:'<p class="dcs-mu">An owner adds settlement agents.</p>'}</details>`;
 const held=[...new Set(posOf(b).map(p=>p.ccy))],R=DCS().rates[d]||{},rtH=held.length?tbl(['Currency','n:Rate in use','Source','Entered','Status',''],held.map(cc=>{const e=rateOf(cc,d),x=R[cc];return`<tr>${td('<b>'+A(cc)+'</b>')}${td(RF(e.r),1)}${td(A(e.src)+(x&&x.st!='Approved'?'<br><span class="dcs-mu">Pending: '+RF(x.r)+' · '+A(x.src)+(x.dev!=null?' · '+SG(x.dev)+'% vs board':'')+'</span>':''))}${td(x?A(x.by)+'<br><span class="dcs-mu">'+A(stamp(x.at))+'</span>':'—')}${td(stTag(x&&x.st=='Approved'?'Approved by '+x.ap:x?'Pending approval':e.ok?'Approved':'Board mid only'))}
  ${td(`${isFin()&&!locked(b,d)?`<div class="dcs-ac"><input class="dcs-q" id="dcsrt_${A(cc)}_r" inputmode="decimal" value="${A(dv('dcsrt_'+cc+'_r'))}" placeholder="Rate" aria-label="${A(cc)} closing rate"><input id="dcsrt_${A(cc)}_s" value="${A(dv('dcsrt_'+cc+'_s'))}" placeholder="Source" aria-label="${A(cc)} rate source"><button type="button" class="cpc-b" onclick="dcsRateSave('${A(d)}','${A(cc)}','${A(b)}')">Save</button>`:''}${x&&x.st!='Approved'&&isAp()?`<button type="button" class="cpc-b pri" onclick="dcsRateAp('${A(d)}','${A(cc)}')">Approve</button>`:''}${isFin()&&!locked(b,d)?'</div>':''}`)}</tr>`})):'<p class="cpc-em">No foreign currency held, so no closing rates are needed.</p>';
 const pol=`<div class="dcs-pol">${[['reqBank','Bank statements must be reconciled'],['reqFx','Currency stock must be counted'],['reqAgents','Settlement agents must be matched'],['reqRates','Approved closing rates are required (otherwise a warning)']].map(([k,t])=>`<label><input type="checkbox" ${c[k]?'checked':''} ${isOwn()?'':'disabled'} onchange="dcsCfg('${k}',this.checked)"> ${t}</label>`).join('')}${isOwn()?'':'<p class="dcs-mu">Only an owner changes these requirements.</p>'}</div>`;
 return head(b,d,'Reconciliations','Expected comes from the ledger; actual comes from a count or a statement. Every variance needs a reason and a reference, and stock differences need an approved adjustment.')+
  `<div class="cpc-card"><h4>Cash and safe counts <small>from the closing count</small></h4>${cashT}${hasSafe?'':'<p class="dcs-note">No safe account at this branch. Add a cash sub-account under 1000 named, for example, "Safe – CAD" in the Chart of Accounts. It is then counted and reconciled here like the till.</p>'}</div>
  <div class="cpc-card"><h4>Bank reconciliation</h4>${bankH}</div>
  <div class="cpc-card"><h4>Currency stock count <small>each currency counted and reconciled on its own</small></h4>${fxH}${adjH?'<h5>Stock adjustments</h5>'+adjH:''}</div>
  <div class="cpc-card"><h4>Remittance settlement</h4>${agH}</div>
  <div class="cpc-card"><h4>Closing rates <small>${A(d)}</small></h4>${rtH}<p class="dcs-mu">Order of use: approved daily rate, then the approved monthly rate from FX management, then the board mid rate.</p></div>
  <div class="cpc-card"><h4>Closing requirements</h4>${pol}</div>`}catch(e){console.error(e);return`<p class="cpc-em">Reconciliations could not be shown: ${A(e.message)}</p>`}};

/* ---------------- Closing reports tab ---------------- */
const REPS=[['dr1','Opening balances'],['dr2','Transaction register'],['dr3','Account closing and trial balance'],['dr4','Cash variance'],['dr5','Bank reconciliation'],['dr6','Safe reconciliation'],['dr7','Multi-currency stock'],['dr8','Remittance settlement'],['dr9','Income and expense'],['dr10','Exceptions'],['dr11','Branch summary'],['dr12','Staff activity and approvals'],['dr13','Next-day opening'],['dr14','Journal-entry trace']];
const nmC=c=>(CH[c]||'Account '+c);
function balTable(rows,earn,showE){const B=BASE();let td_=0,tc=0;const out=rows.map(r=>{if(r.cad>0)td_+=r.cad;else tc-=r.cad;return`<tr>${td('<span class="dcs-m">'+A(r.code)+'</span> '+A(nmC(r.code))+(r.note?'<br><span class="dcs-mu">'+A(r.note)+'</span>':''))}${td(A(TY(r.code)))}${td(A(r.ccy))}${td(r.ccy==B?'—':F(r.fc),1)}${td(r.cad>0?F(r.cad):'',1)}${td(r.cad<0?F(-r.cad):'',1)}</tr>`});
 if(showE&&Math.abs(earn)>.004){if(earn<0)td_+=-earn;else tc+=earn;out.push(`<tr class="dcs-sub">${td('Current earnings (income and expense closed to P&amp;L)')}${td('Equity')}${td(A(B))}${td('—',1)}${td(earn<0?F(-earn):'',1)}${td(earn>0?F(earn):'',1)}</tr>`)}
 return tbl(['Account','Type','Currency','n:Foreign amount','n:Debit '+B,'n:Credit '+B],out,`<tr>${td('Total')}${td('')}${td('')}${td('')}${td(F(td_),1)}${td(F(tc),1)}</tr><tr>${td(Math.abs(td_-tc)<.005?'<span class="ok">Balanced</span>':'<span class="bad">Out of balance by '+F(td_-tc)+'</span>')}${td('')}${td('')}${td('')}${td('')}${td('')}</tr>`)}
function regRows(js){const B=BASE();return js.map(x=>{const dr=x.lines.filter(y=>+y[1]>0),cr=x.lines.filter(y=>+y[2]>0),cad=r2(x.lines.reduce((s,y)=>s+(+y[1]||0),0)),fx=x.ccy&&x.ccy!=B;
 const src=x.rsrc||(x.fxid?'FX deal '+x.fxid:fx?'Rate board':'Base currency'),amt=x.fa!=null?+x.fa:fx?r2(cad/(+x.rate||1)):cad;
 const s=x.revBy?'Reversed':x.rev?'Reversal':x.appr?'Approved':'Posted';
 return`<tr>${td('<b class="dcs-m">'+A(x.vno||'#'+x.id)+'</b>')}${td(A(tm(x.at)),0,'dcs-m')}${td(A(x.by||''))}${td(A(x.tt||''))}${td(A(x.memo||''),0,'dcs-wide')}${td(dr.map(y=>A(y[0]+' '+nmC(y[0]))).join('<br>'))}${td(cr.map(y=>A(y[0]+' '+nmC(y[0]))).join('<br>'))}${td(A(x.ccy||B))}${td(F(amt),1)}${td(fx?RF(x.rate):'1.0000',1)}${td(A(src),0,'dcs-mu')}${td(F(cad),1)}${td(stTag(s))}</tr>`})}
function traceHtml(js){return js.length?js.map(x=>{const d_=r2(x.lines.reduce((s,y)=>s+(+y[1]||0),0)),c_=r2(x.lines.reduce((s,y)=>s+(+y[2]||0),0)),ok=Math.abs(d_-c_)<.005;
 return`<div class="dcs-je"><div class="dcs-jh"><b class="dcs-m">${A(x.vno||'#'+x.id)}</b><span>${A(x.tt||'')} · ${A(tm(x.at))} · ${A(x.by||'')}${x.appr&&x.appr.by?' · approved by '+A(x.appr.by):''}${x.rev?' · reverses #'+A(x.rev):''}${x.revBy?' · reversed by #'+A(x.revBy):''}</span><span class="dcs-mu">${A(x.memo||'')}</span></div>${tbl(['Account','n:Debit '+BASE(),'n:Credit '+BASE()],x.lines.map(y=>`<tr>${td('<span class="dcs-m">'+A(y[0])+'</span> '+A(nmC(y[0])))}${td(+y[1]?F(+y[1]):'',1)}${td(+y[2]?F(+y[2]):'',1)}</tr>`),`<tr>${td(ok?'<span class="ok">Balanced</span>':'<span class="bad">Out of balance</span>')}${td(F(d_),1)}${td(F(c_),1)}</tr>`)}</div>`}).join(''):'<p class="cpc-em">No journal entries on this date.</p>'}
function recTable(list){const B=BASE();return tbl(['Reconciliation','Account','Currency','n:Expected','n:Actual','n:Variance','n:Variance '+B,'Reason','Reference','Status'],list.map(r=>`<tr>${td(A({cash:'Cash count',safe:'Safe count',bank:'Bank',fx:'Currency stock',agent:'Settlement'}[r.kind]))}${td(A(r.label))}${td(A(r.ccy))}${td(F(r.exp),1)}${td(r.act==null?'—':F(r.act),1)}${td(r.var==null?'—':SG(r.var),1,r.var&&Math.abs(r.var)>.004?'bad':'')}${td(r.varCad==null?'—':SG(r.varCad),1)}${td(A(r.reason)||'<span class="dcs-mu">—</span>')}${td(A(r.ref||''),0,'dcs-mu')}${td(stTag(r.st))}</tr>`))}
window.dcsReports=(b,d)=>{if(!b)return'<p class="cpc-em">Choose a branch.</p>';try{const B=BASE(),rec=REC(b,d),L=!!(rec&&rec.lock),sn=L&&rec.lock.snap&&rec.lock.snap.dcs&&!rec.lock.snap.dcs.err?rec.lock.snap.dcs:window.dcsSnap(b,d);
 const js=S.j.filter(x=>(sn.jids||[]).includes(x.id)).sort((x,y)=>String(x.at||'').localeCompare(String(y.at||''))||x.id-y.id);
 const oc=sn.openCheck||{ok:true},R=sn.recon,ie=sn.ie,pos=sn.fx||[];
 const sec=(id,n,t,sub,body)=>`<div class="cpc-card dcs-rep" id="${id}"><div class="dcs-hr"><div><span class="dcs-ey">Report ${n}</span><h4>${t}</h4>${sub?`<p class="dcs-mu">${sub}</p>`:''}</div></div>${body}</div>`;
 const rd=window.cpcReady?cpcReady(b,d):{items:[],warn:[]};
 const exc=[...rd.items.filter(i=>!i.ok).map(i=>[i.label,i.sev=='block'?'Blocking':'Warning',i.detail]),...(rd.warn||[]).map(w=>['Warning','Warning',w]),...(R.fx||[]).filter(r=>r.var&&Math.abs(r.var)>.004).map(r=>['Currency stock '+r.ccy+' '+SG(r.var),'Medium',r.reason+' · '+(r.adj||'no adjustment yet')]),
  ...(R.cash||[]).filter(r=>r.var&&Math.abs(r.var)>.004).map(r=>[r.label+' '+r.ccy+' '+SG(r.var),'High',r.reason]),...(R.bank||[]).filter(r=>r.items&&r.items.length).flatMap(r=>r.items.map(i=>['Outstanding bank item '+i.ref+' '+F(i.amt),'Low',r.label+' · '+i.desc])),
  ...pos.filter(p=>p.unr<-.004).map(p=>['Unrealized loss on '+p.ccy+' '+F(p.unr),'Info','At '+p.rate.src]),...pos.filter(p=>!p.rate.ok).map(p=>[p.ccy+' valued at board mid','Info','No approved closing rate for '+d])];
 const brs=S.br.filter(x=>br=='all'||x.id==br).map(x=>{const s=stOf(x.id,d),r=window.cpcReady?cpcReady(x.id,d):{blockers:[]},cv=r2((S.closings||[]).filter(c=>c.br==x.id&&c.date==d).reduce((t,c)=>t+(+c.base||0),0)),ie2=dayIE(x.id,d),lk=REC(x.id,d)&&REC(x.id,d).lock;
  return`<tr>${td('<b>'+A(x.name)+'</b>')}${td(stTag(lk?'Locked':({NONE:'No activity',OPEN:'Open',COUNTING:'Counting',RECONCILING:'Reconciling',PENDING_APPROVAL:'Pending approval',CLOSED:'Closed',REOPENED:'Reopened'})[s]||s))}${td(String(r.blockers.length),1)}${td(SG(cv),1)}${td(SG(ie2.net),1)}${td(A(lk?lk.by:'—'))}</tr>`});
 /* staff activity */
 const sa={},bump=(n,k)=>{if(!n)return;const o=sa[n]=sa[n]||{tx:0,ap:0,cl:0,adj:0,other:0};o[k]++};js.forEach(x=>{bump(x.mk||x.by,'tx');if(x.appr&&x.appr.by)bump(x.appr.by,'ap')});
 (S.closings||[]).filter(c=>c.br==b&&c.date==d).forEach(c=>{bump(c.by,'cl');if(c.apprBy)bump(c.apprBy,'ap')});(sn.adj||[]).forEach(x=>{bump(x.by,'adj');if(x.apBy)bump(x.apBy,'ap')});((rec&&rec.hist)||[]).forEach(h=>bump(h.by,'other'));
 const sod=[['Every account closing approved by someone other than the counter',(S.closings||[]).filter(c=>c.br==b&&c.date==d&&c.apprBy).every(c=>c.apprBy!=c.by)],['Every stock adjustment approved by someone other than the maker',(sn.adj||[]).filter(x=>x.apBy&&x.st=='Posted').every(x=>x.apBy!=x.by||otherAp(x.by)==0)],['Variance checker differs from the maker',(S.cvr||[]).filter(v=>v.br==b&&v.date==d&&v.checker).every(v=>v.checker!=v.maker)],['Closing rates approved by someone other than the enterer',Object.values(DCS().rates[d]||{}).filter(x=>x.ap).every(x=>x.ap!=x.by||otherAp(x.by)==0)]];
 /* next-day opening */
 const nx=sn.close;
 const usdLike=pos.map(p=>`<tr>${td('<b>'+A(p.ccy)+'</b>')}${td(F(p.q),1)}${td(RF(p.c),1)}${td(F(p.book),1)}${td(RF(p.rate.r),1)}${td(A(p.rate.src),0,'dcs-mu')}${td(F(p.val),1)}${td(SG(p.unr),1,p.unr<0?'bad':'ok')}</tr>`);
 const fxReal=js.reduce((t,x)=>t+x.lines.filter(y=>/realized fx|fx trading|exchange gain|forex gain/i.test(nmC(y[0]))&&!/unrealized/i.test(nmC(y[0]))).reduce((s,y)=>s+(+y[2]||0)-(+y[1]||0),0),0);
 const body=[
  sec('dr1',1,'Opening balances',oc.none?'No earlier locked day: opening is the ledger balance at the end of '+addD(d,-1)+'.':oc.legacy?'Carried forward from the ledger. The '+oc.from+' lock predates closing reports, so it cannot be compared line by line.':oc.ok?'Carried forward from the approved close of '+oc.from+' (locked by '+A(oc.by)+'). Ledger and locked close agree.':'Differs from the approved close of '+oc.from+'.',balTable(sn.open.rows,sn.open.earn,true)+(oc.ok?'':`<p class="dcs-note bad">${A(oc.diffs.map(x=>x.code+' '+nmC(x.code)+' '+SG(x.v)).join('; '))}</p>`)),
  sec('dr2',2,'Transaction register',js.length+' entries · times are local',tbl(['Reference','Time','Staff','Type','Description','Debit account','Credit account','Currency','n:Amount','n:Rate','Rate source','n:'+B,'Status'],regRows(js))+`<div class="dcs-ac noprint"><button type="button" class="cpc-b" onclick="dcsRegCsv('${A(b)}','${A(d)}')">Export register CSV</button></div>`),
  sec('dr3',3,'Account closing and trial balance','Closing = opening + debits − credits. Balance-sheet accounts carry forward; income and expense close to P&L.',(()=>{const m=bals(b,d),dm=bals(b,d,d),codes=Object.keys(m).sort();let a=0,c=0,e=0,f=0;
   const rows=codes.map(k=>{const o=m[k],dd=dm[k]||{dr:0,cr:0},op=r2(o.cad-((dd.dr||0)-(dd.cr||0)));a+=dd.dr||0;c+=dd.cr||0;if(o.cad>0)e+=o.cad;else f-=o.cad;return`<tr>${td('<span class="dcs-m">'+A(k)+'</span> '+A(nmC(k)))}${td(A(TY(k)))}${td(F(op),1)}${td(dd.dr?F(dd.dr):'',1)}${td(dd.cr?F(dd.cr):'',1)}${td(o.cad>0?F(o.cad):'',1)}${td(o.cad<0?F(-o.cad):'',1)}${td(BS(k)?'Carry forward':'<b>Close to P&amp;L</b>')}</tr>`});
   return tbl(['Account','Type','n:Opening','n:Debits','n:Credits','n:Closing Dr','n:Closing Cr','Next day'],rows,`<tr>${td('Trial balance')}${td('')}${td('')}${td(F(a),1)}${td(F(c),1)}${td(F(e),1)}${td(F(f),1)}${td(Math.abs(e-f)<.005&&Math.abs(a-c)<.005?'<span class="ok">Balanced</span>':'<span class="bad">Out of balance</span>')}</tr>`)})()),
  sec('dr4',4,'Cash variance','Till counts by account and currency',recTable(R.cash.filter(r=>r.kind=='cash'))),
  sec('dr5',5,'Bank reconciliation','Statement, reconciling items and books',recTable(R.bank)+R.bank.filter(r=>r.items.length).map(r=>tbl(['Reconciling item · '+r.label,'Description','n:'+r.ccy],r.items.map(i=>`<tr>${td(A(i.ref))}${td(A(i.desc))}${td(F(i.amt),1)}</tr>`))).join('')),
  sec('dr6',6,'Safe reconciliation','Safe and vault accounts',R.cash.some(r=>r.kind=='safe')?recTable(R.cash.filter(r=>r.kind=='safe')):'<p class="cpc-em">No safe account with activity. Add a cash sub-account named "Safe" to count and reconcile it.</p>'),
  sec('dr7',7,'Multi-currency stock and closing','Foreign amounts are never added together. Totals are in '+B+' only.',recTable(R.fx)+tbl(['Currency','n:Quantity','n:Average cost','n:Book '+B,'n:Closing rate','Rate source','n:'+B+' at closing rate','n:Unrealized '+B],usdLike,`<tr>${td('Total in '+B)}${td('')}${td('')}${td(F(pos.reduce((t,p)=>t+p.book,0)),1)}${td('')}${td('')}${td(F(pos.reduce((t,p)=>t+p.val,0)),1)}${td(SG(pos.reduce((t,p)=>t+p.unr,0)),1)}</tr>`)+`<p class="dcs-mu">Realized FX posted today: ${A(B)} ${SG(fxReal)} (sales against weighted average cost). Unrealized = quantity × (closing rate − average cost); reported daily, posted by the monthly revaluation in FX management.</p>`),
  sec('dr8',8,'Remittance settlement','Due-from-agent balances against agent statements',R.agent.length?recTable(R.agent):'<p class="cpc-em">No settlement agent balance at this branch.</p>'),
  sec('dr9',9,'Income and expense',B+' for '+d,tbl(['Account','n:'+B],[`<tr class="dcs-sub">${td('Income')}${td('',1)}</tr>`,...ie.inc.map(x=>`<tr>${td('<span class="dcs-m">'+A(x.code)+'</span> '+A(nmC(x.code)))}${td(F(x.v),1)}</tr>`),`<tr class="dcs-sub">${td('Total income')}${td(F(ie.ti),1)}</tr>`,`<tr class="dcs-sub">${td('Expenses')}${td('',1)}</tr>`,...ie.exp.map(x=>`<tr>${td('<span class="dcs-m">'+A(x.code)+'</span> '+A(nmC(x.code)))}${td(F(x.v),1)}</tr>`),`<tr class="dcs-sub">${td('Total expenses')}${td(F(ie.te),1)}</tr>`],`<tr>${td('Day result')}${td(SG(ie.net),1)}</tr>`)+`<p class="dcs-mu">Settlement receipts, currency purchases and customer deposits are balance-sheet movements and never appear here. Unrealized FX of ${A(B)} ${SG(pos.reduce((t,p)=>t+p.unr,0))} is a memo in report 7.</p>`),
  sec('dr10',10,'Exceptions','From readiness, reconciliations and rates',tbl(['Exception','Severity','Detail'],exc.map(e=>`<tr>${td(A(e[0]))}${td(stTag(e[1]=='Blocking'||e[1]=='High'?'Needs action · '+e[1]:e[1]))}${td(A(e[2]||''))}</tr>`))),
  sec('dr11',11,'Branch summary','All branches you can see, '+d,tbl(['Branch','Status','n:Blockers','n:Cash variance '+B,'n:Day result '+B,'Locked by'],brs)),
  sec('dr12',12,'Staff activity and approvals','Who did what on '+d,tbl(['Staff','n:Entries made','n:Approvals','n:Accounts closed','n:Adjustments raised','n:Other closing actions'],Object.entries(sa).map(([n,o])=>`<tr>${td('<b>'+A(n)+'</b>')}${td(String(o.tx),1)}${td(String(o.ap),1)}${td(String(o.cl),1)}${td(String(o.adj),1)}${td(String(o.other),1)}</tr>`))+`<ul class="dcs-ck">${sod.map(([t,ok])=>`<li class="${ok?'ok':'bad'}">${ok?'✓':'✗'} ${A(t)}</li>`).join('')}</ul>`),
  sec('dr13',13,'Next-day opening · '+addD(d,1),L?'Generated from the snapshot locked by '+A(rec.lock.by)+'. Income and expense open at zero; the day result is in current earnings.':'Preview. Final when the day is locked.',balTable(nx.rows,nx.earn,true)),
  sec('dr14',14,'Journal-entry trace','Every entry with its balanced lines in '+B,traceHtml(js))].join('');
 return head(b,d,'Closing reports',L?'Rendered from the locked snapshot. Later changes to the books cannot alter them.':'Live view. The figures are frozen into the snapshot when the day is locked.')+`<div class="cpc-card noprint"><div class="dcs-nav">${REPS.map(([id,t],i)=>`<button type="button" class="cpc-b" onclick="dcsJump('${id}')">${i+1}. ${t}</button>`).join('')}</div></div>`+body}catch(e){console.error(e);return`<p class="cpc-em">Closing reports could not be shown: ${A(e.message)}</p>`}};
window.dcsRegCsv=(b,d)=>{const B=BASE(),js=S.j.filter(x=>x.br==b&&x.date==d);const rows=[['Reference','Timestamp','Business date','Branch','Staff','Type','Description','Debit accounts','Credit accounts','Currency','Amount','Rate','CAD','Status']];
 js.forEach(x=>{const cad=r2(x.lines.reduce((s,y)=>s+(+y[1]||0),0)),fx=x.ccy&&x.ccy!=B;rows.push([x.vno||'#'+x.id,x.at||'',x.date,bn(x.br),x.by||'',x.tt||'',x.memo||'',x.lines.filter(y=>+y[1]>0).map(y=>y[0]).join(' '),x.lines.filter(y=>+y[2]>0).map(y=>y[0]).join(' '),x.ccy||B,x.fa!=null?x.fa:fx?r2(cad/(+x.rate||1)):cad,fx?x.rate:1,cad,x.revBy?'Reversed':x.rev?'Reversal':'Posted'])});
 const t='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\r\n');if(window.dlSave)dlSave('register-'+bn(b).replace(/\W+/g,'-')+'-'+d+'.csv',t,'text/csv');return t};

/* ---------------- styles (reuse closing-control look) ---------------- */
const css=document.createElement('style');css.textContent=`
html body .dcs-hd{gap:12px}html body .dcs-hr{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}
html body .dcs-ey{font:700 11px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#64748b}
html body .dcs-mu{color:#64748b;font-size:12.5px;margin:0}html body .dcs-m{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
html body .dcs-rail{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:6px}
html body .dcs-rail li{display:flex;flex-direction:column;gap:5px;min-width:0}html body .dcs-rail i{height:4px;border-radius:2px;background:#e2e8f0}html body .dcs-rail span{font:500 11.5px/1.3 Inter,sans-serif;color:#94a3b8}
html body .dcs-rail li.done i{background:#15803d}html body .dcs-rail li.done span{color:#334155}html body .dcs-rail li.cur i{background:#1d4ed8}html body .dcs-rail li.cur span{color:#1d4ed8;font-weight:700}
html body .dcs-box{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:grid;gap:10px}html body .dcs-box h5{margin:0;font:700 14px Inter,sans-serif;color:#14284a}
html body .dcs-fg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}html body .dcs-fg label{display:flex;flex-direction:column;gap:4px;font:600 12px Inter,sans-serif;color:#475569;min-width:0}html body .dcs-s2{grid-column:span 2}
html body .dcs-fg input,html body .dcs-fg textarea,html body .dcs-t input,html body .dcs-ac input{font:400 13.5px Inter,sans-serif;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;background:#fff;color:#0f172a;min-height:34px;width:100%;box-sizing:border-box}
html body .dcs-t input.dcs-q,html body .dcs-ac input.dcs-q{width:110px;text-align:right;font-family:ui-monospace,Menlo,monospace}
html body .dcs-ac{display:flex;gap:6px;flex-wrap:wrap;align-items:center}html body .dcs-ac input{width:auto;min-width:110px;flex:1}
html body .dcs-t td.dcs-wide{min-width:220px}html body .dcs-t tr.dcs-sub td{background:#f8fafc;font-weight:600}html body .dcs-t tfoot td{font-weight:700;background:#f1f5f9}
html body .dcs-t .ok,html body .dcs-ck .ok{color:#15803d}html body .dcs-t .bad,html body .dcs-ck .bad{color:#b91c1c}
html body .dcs-note{margin:0;padding:9px 12px;border-radius:10px;background:#eff6ff;color:#1e3a8a;font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}html body .dcs-note.ok{background:#ecfdf3;color:#166534}html body .dcs-note.wn{background:#fffbeb;color:#92400e}html body .dcs-note.bad{background:#fef2f2;color:#991b1b}
html body .dcs-call{border-left:3px solid #1d4ed8;background:#eff6ff;border-radius:0 10px 10px 0;padding:10px 14px;font-size:13px;color:#1e293b;line-height:1.55}
html body .dcs-det summary{cursor:pointer;font:600 13px Inter,sans-serif;color:#1d4ed8;margin:4px 0 10px}html body .dcs-det{display:grid;gap:10px}
html body .dcs-pol{display:grid;gap:8px}html body .dcs-pol label{display:flex;gap:8px;align-items:center;font-size:13.5px}
html body .dcs-nav{display:flex;gap:6px;flex-wrap:wrap}html body .dcs-nav .cpc-b{font-size:12.5px}
html body .dcs-rep{scroll-margin-top:90px}html body .dcs-je{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 10px}html body .dcs-jh{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px}
html body .dcs-je .cpc-w{border:0;border-radius:0}
html body .dcs-ck{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px;font-size:13px}
@media(max-width:900px){html body .dcs-rail{grid-template-columns:repeat(3,minmax(0,1fr))}html body .dcs-fg{grid-template-columns:1fr}html body .dcs-s2{grid-column:auto}}

html body .cpc .cpc-card h4,html body .cpc .dcs-hd h4{font:700 16px Inter,sans-serif!important;text-transform:none!important;letter-spacing:0!important;color:#14284a!important;margin:0}
html body .cpc .cpc-card h4 small{font:500 12px Inter,sans-serif!important;color:#64748b!important;margin-left:6px;text-transform:none!important;letter-spacing:0!important}
html body .cpc .dcs-fg label,html body .cpc .dcs-pol label{text-transform:none!important;letter-spacing:0!important;text-align:left!important}
html body .cpc .dcs-pol label{display:flex!important;flex-direction:row!important;justify-content:flex-start}html body .cpc .dcs-pol input{width:18px!important;height:18px!important;min-height:0!important;margin:0!important;flex:none}
html body .cpc .dcs-ac .cpc-b{width:auto}

/* phone width: closing control grids had a 420px minimum column, which pushed the page sideways */
html body .cbm.dxt{grid-template-columns:minmax(0,1fr)}html body .cbm.dxt>*{min-width:0;max-width:100%}html body .cpc{min-width:0;max-width:100%}html body .cpc>*{min-width:0;max-width:100%}
html body .cpc .cpc-g{grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr))}
html body .cpc .cpc-tabs{overflow-x:auto;flex-wrap:nowrap}html body .cpc .cpc-tabs button{white-space:nowrap;flex:none}
html body .cpc .cpc-card,html body .cpc .dcs-box{min-width:0;max-width:100%}html body .cpc .cpc-w{max-width:100%;overflow-x:auto}
`;document.head.appendChild(css);
})();
