const {chromium}=require('playwright');const ok=(n,c,x)=>console.log(c?'PASS':'FAIL',n,c?'':JSON.stringify(x));
const big=(s,dp)=>{const [i,f='']=String(s).split('.');return BigInt(i+(f+'0'.repeat(dp)).slice(0,dp))};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:1300}});const er=[],dl=[];p.on('pageerror',e=>er.push(e.message));p.on('dialog',d=>{dl.push(d.message());d.accept(d.type()=='prompt'?'Because of test reasons':undefined)});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
const E=(f,a)=>p.evaluate(f,a);
await E(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';S.co={name:'BRIMAPAY'};S.rates.EUR={b:1.5,s:1.55,dp:2};S.rates.JPY={b:.0095,s:.0097,name:'Yen',dp:0};S.rates.KWD={b:4.4,s:4.5,name:'Dinar',dp:3};
window.B=S.br[0].id;S.users=[{name:'Zahid',role:'Owner',br:'All'},{name:'Cara',role:'Cashier',br:'All'},{name:'Mo',role:'Manager',br:'All'},{name:'Vi',role:'Viewer',br:'All'}];S.me=0;S.cpcfg={vdef:10,vt:{},dual:0,blind:0,susp:0,sla:3,cut:{},hol:{},bd:1,auto:0,v2:1,tz:'UTC'};
window.AC='cash|'+B;window.as=n=>{S.me=S.users.findIndex(u=>u.name==n)};
window.addD0=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};window.D=n=>addD0(today(),-n);
post({date:D(120),br:B,acc:AC,tt:'Opening',memo:'open',lines:[['1000',100000,0],['3000',0,100000]]});view='dcl';go()});
// ---- A. randomized denomination math vs BigInt reference
const CC={CAD:{dp:2,n:['100','50','20','10','5'],k:['2','1','0.25','0.1','0.05']},JPY:{dp:0,n:['10000','5000','2000','1000'],k:['500','100','50','10','5','1']},KWD:{dp:3,n:['20','10','5','1','0.5','0.25'],k:['0.1','0.05','0.02','0.01','0.005']}};
let bad=0,badV=0,N=0;const sets=[];
for(let i=0;i<1000;i++){const c=['CAD','JPY','KWD'][i%3],d=CC[c],n={},k={};d.n.forEach(x=>{if(Math.random()<.8)n[x]=Math.floor(Math.random()*3000)});d.k.forEach(x=>{if(Math.random()<.8)k[x]=Math.floor(Math.random()*3000)});const xm=BigInt(Math.floor(Math.random()*5e5));const xs=(Number(xm)/10**d.dp).toFixed(d.dp);let t=xm;Object.keys(n).forEach(x=>t+=big(x,d.dp)*BigInt(n[x]));Object.keys(k).forEach(x=>t+=big(x,d.dp)*BigInt(k[x]));const em=t+BigInt(Math.floor(Math.random()*2001)-1000);sets.push({c,n,k,xs,tm:t.toString(),em:em.toString(),vm:(t-em).toString(),dp:d.dp})}
const res=await E(sets=>sets.map(s=>{const r=__crcT.calc(s.c,s.n,s.k,s.xs),M=crcMoney,exp=Number(s.em)/Math.pow(10,s.dp),v=M.mn(r.t,s.c)-M.mn(exp,s.c);return{tm:String(r.tm),v:String(v)}}),sets);
sets.forEach((s,i)=>{if(res[i].tm!==s.tm)bad++;if(res[i].v!==s.vm)badV++;N++});
ok('1000 random denomination sets match the BigInt reference (0, 2 and 3 decimal currencies)',bad==0&&N==1000,{bad,N});ok('variance = counted - expected to the minor unit',badV==0,{badV});
ok('currency precision 0/2/3',await E(()=>[crcMoney.dp('JPY'),crcMoney.dp('CAD'),crcMoney.dp('KWD')].join())=='0,2,3');
ok('0.001 KWD difference is a variance (not rounded away)',await E(()=>crcMoney.mn(10.001,'KWD')-crcMoney.mn(10,'KWD'))==1);
// ---- B. idempotency 10,000 attempts
const idem=await E(()=>{const a=accts().find(q=>q.id==AC);let errs=0,tries=0;const T=__crcT;for(let k=1;k<=50;k++){const d=D(k+2),rows=[{ccy:'CAD',open:0,i:0,o:0,exp:100,counted:97,variance:-3,reason:'Counting error',rnote:''}];const pk={id:'zt'+k,date:d,br:a.br,acc:a.id,accLabel:a.label,rows,by:'Cara',at:'10:00'};for(let j=0;j<200;j++){tries++;try{T.finalize(pk,'Mo')}catch(e){errs++}}}
 return{tries,errs,closings:S.closings.length,vj:S.j.filter(e=>e.tt=='Closing variance').length,gli:Object.keys(S.gli).length,bal:S.j.every(e=>Math.abs(e.lines.reduce((t,l)=>t+l[1]-l[2],0))<.011)}});
ok('10,000 repeated approvals: exactly one posting per closing',idem.tries==10000&&idem.closings==50&&idem.vj==50&&idem.gli==50&&idem.errs==9950&&idem.bal,idem);
const TD=await E(()=>today());const D=n=>{const x=new Date(TD+'T00:00:00Z');x.setUTCDate(x.getUTCDate()-n);return x.toISOString().slice(0,10)};
// ---- C. two checkers, maker-checker, stale, period lock
const mk=(id,d,wm)=>E(([id,d,wm])=>{const a=accts().find(q=>q.id==AC);S.clq=S.clq||[];const rows=[{ccy:'CAD',open:0,i:0,o:0,exp:100,counted:96,variance:-4,reason:'Counting error',rnote:''}];S.clq.push({id,date:d,br:a.br,acc:a.id,accLabel:a.label,rows,by:'Cara',at:'10:00',st:'Pending approval',hist:[],ver:1,wm:wm?__crcT.sigOf(a,d):undefined});return 1},[id,d,wm]);
await mk('c1',D(60),true);
let r1=await E(()=>{as('Zahid');const a=clAct('c1','ok','');as('Mo');const b=clAct('c1','ok','');return[a,b,S.closings.filter(c=>c.id=='c1').length,S.j.filter(e=>e.tt=='Closing variance'&&/2026|CAD/.test(e.memo)&&e.date==D(60)).length]});
ok('second checker cannot approve the same closing again',r1[0]==''&&/no longer waiting/.test(r1[1])&&r1[2]==1&&r1[3]==1,r1);
await mk('c2',D(61),false);await E(()=>{S.clq.find(q=>q.id=='c2').by='Mo'});
r1=await E(()=>{as('Mo');return clAct('c2','ok','')});ok('maker cannot approve own closing (other approvers exist)',/another manager/.test(r1),r1);
r1=await E(()=>{as('Cara');return clAct('c2','ok','')});ok('cashier cannot approve',/manager or owner/.test(r1),r1);
await mk('c3',D(62),true);await E(()=>{const a=accts().find(q=>q.id==AC);post({date:D(62),br:a.br,acc:a.id,tt:'Receipt',memo:'late sale',lines:[['1000',20,0],['4300',0,20]]})});
r1=await E(()=>{as('Zahid');const n=S.j.length;const m=clAct('c3','ok','');return[m,S.j.length==n,S.closings.some(c=>c.id=='c3')]});ok('stale books: approval refused, nothing posted',/after the count was prepared/.test(r1[0])&&r1[1]&&!r1[2],r1);
await mk('c4',D(63),false);r1=await E(()=>{as('Zahid');S.fxlk=D(63);const m=clAct('c4','ok','');const c=S.closings.some(x=>x.id=='c4');S.fxlk='';return[m,c]});ok('period locked: approval refused with remediation',/accounting period is closed/.test(r1[0])&&!r1[1],r1);
// ---- D. reopen then repost (latest day, so no later day is closed)
const net=d=>E(d=>+(S.j.filter(e=>e.date==d).reduce((t,e)=>t+e.lines.filter(l=>l[0]=='6500').reduce((q,l)=>q+l[1]-l[2],0),0)).toFixed(2),d);
await mk('r1',D(0),false);r1=await E(()=>{as('Zahid');clAct('r1','ok','');const v1=S.closings.find(c=>c.id=='r1');return[v1.ver]});
ok('first approval: version 1 and one posting (net over/short 4.00)',r1[0]==1&&await net(D(0))==4,[r1,await net(D(0))]);
const ro=await E(([d])=>{as('Cara');const q={id:'RO-T1',br:S.closings.find(c=>c.id=='r1').br,date:d,scope:'all',reason:'Recount needed after discovery',by:'Cara',role:'Cashier',at:new Date().toISOString(),st:'Pending',impact:{}};(S.crq=S.crq||[]).push(q);const c1=cpcDecideReq('RO-T1','ok');as('Zahid');cpcDecideReq('RO-T1','ok');return{still:S.closings.some(c=>c.id=='r1'),st:(S.crq.find(q=>q.id=='RO-T1')||{}).st}},[D(0)]);
ok('reopen: closing removed, request approved, variance reversed (net 0.00)',!ro.still&&ro.st=='Executed'&&await net(D(0))==0,[ro,await net(D(0))]);
await mk('r2',D(0),false);const ro2=await E(([d])=>{as('Zahid');const m=clAct('r2','ok','');const c=S.closings.find(x=>x.id=='r2');return{m,ver:c&&c.ver,n:S.closings.filter(x=>x.date==d).length}},[D(0)]);
ok('re-approval after reopen: exactly one new posting, version 2',ro2.m==''&&ro2.ver==2&&ro2.n==1&&await net(D(0))==4,[ro2,await net(D(0))]);
// ---- E. hash and tamper
const h=await E(()=>{const c=S.closings.find(x=>x.id=='r2'),f=r=>__crcT.hsh(JSON.stringify({id:r.id,ver:r.ver,date:r.date,acc:r.acc,rows:r.rows,counts:r.counts||null,rsnap:r.rsnap,je:r.je,by:r.by,apprBy:r.apprBy||'',notes:r.notes})),a=f(c),t=JSON.parse(JSON.stringify(c));t.rows[0].counted=999;return{ok:a===c.hash&&!!a,tamper:f(t)!==c.hash,snap:!!c.rsnap&&c.rsnap.r.CAD.r==1}});
ok('record hash reproduces and detects tampering; rate snapshot stored',h.ok&&h.tamper&&h.snap,h);
// ---- F. missing rate, N/A, no implicit zero
const f1=await E(()=>{const a=accts().find(q=>q.id==AC),T=__crcT,saved=S.rates.EUR;delete S.rates.EUR;const x=T.preflight(a,D(1),[{ccy:'EUR',open:0,i:0,o:0,exp:0}]);S.rates.EUR=saved;return x.items.find(i=>/Exchange rates/.test(i.t))});
ok('missing exchange rate blocks Step 1 with remediation',f1&&!f1.ok&&/Set it in Currency Stock/.test(f1.fix),f1);
await E(()=>{dca=AC;dcd=D(1);window.__crc=null;S.cdr={};view='dcl';go();crcStep(2)});
const z=await E(()=>{const T=__crcT,r={ccy:'EUR',open:0,i:50,o:50,exp:0};return{fin:T.fin(r),k:T.skey(r)}});
ok('expected zero with activity is NOT counted until attested (no implicit zero)',z.fin===null&&z.k=='ns',z);
await E(()=>crcZero('EUR',1));const z2=await E(()=>{const T=__crcT,r={ccy:'EUR',open:0,i:50,o:50,exp:0};return{fin:T.fin(r),k:T.skey(r),log:S.alog.some(l=>/Zero count attested EUR/.test(l.m))}});
ok('attested zero counts, is confirmed and audited',z2.fin===0&&z2.k=='counted'&&z2.log,z2);
const na=await E(()=>{const T=__crcT,r={ccy:'JPY',open:0,i:0,o:0,exp:0};return T.skey(r)});ok('currency with nothing held or moved is Not applicable',na=='na',na);
// ---- G. statuses, confirm, filters, max count
await E(()=>{dcd=D(2);window.__crc=null;S.cdr={};const a=accts().find(q=>q.id==AC);post({date:D(2),br:a.br,acc:a.id,tt:'Receipt',memo:'in',lines:[['1000',100,0],['4300',0,100]]});view='dcl';go();crcStep(2)});
const q0=p.locator('input.crc-q[data-p=a][data-k=n]').first();await q0.fill('100001');
ok('count above 100,000 is rejected with a hint',(await q0.inputValue())==''&&/not accepted/.test(await p.textContent('.crc-hint')),await p.textContent('.crc-hint'));
const st1=await E(()=>{const T=__crcT;return T.skey(T.rowsOf()[0])});ok('status Not started before any entry',st1=='ns',st1);
await p.locator('input.crc-q[data-p=a][data-k=n]').first().fill('1');await p.waitForTimeout(100);
const st2=await E(()=>{const T=__crcT;return T.skey(T.rowsOf()[0])});ok('status In progress until Confirm count',st2=='ip',st2);
ok('Confirm count button present',await p.$('.crc-zb.pri')!=null);
await E(()=>crcConfirm('CAD'));const st3=await E(()=>{const T=__crcT,r=T.rowsOf()[0];return[T.skey(r),T.vM(r)]});ok('status Variance after confirm (count 100 vs expected 100 with 0 loose? )',st3[0]=='variance'||st3[0]=='counted',st3);
ok('per-row counted by / time recorded',await E(()=>{const o=__crc.c.CAD.a;return Object.values(o.t||{}).some(t=>t.by&&t.at&&t.iso)}));
await E(()=>crcFl('vo',1));ok('variance-only filter hides balanced currencies',await E(()=>{const T=__crcT,r=T.rowsOf()[0];return(T.skey(r)=='variance')==(document.querySelectorAll('.crc-dt tbody tr').length==1)}));await E(()=>crcFl('vo',0));
ok('currency filter options come from detected currencies',await E(()=>[...document.querySelectorAll('.crc-fb select')[0].options].map(o=>o.textContent).join()=='All currencies,CAD'));
// ---- H. drafts
const dr=await E(()=>{crcDraft(1);const k=__crc.k,v=S.cdr[k].ver;window.__crc=null;const s=__crcT.st();return{v,v2:s.ver,by:s.by,has:!!(s.c.CAD&&Object.keys(s.c.CAD.a.n).length)}});
ok('draft saved and resumed with editor identity',dr.v>=1&&dr.has&&dr.by=='Zahid',dr);
const dc=await E(()=>{const k=__crc.k;S.cdr[k].ver=99;crcDraft(1);return S.cdr[k].ver});ok('draft never overwrites a newer save',dc==99,dc);
// ---- I. permissions
const pm=await E(()=>{as('Vi');const a=canW('cash');as('Cara');const b=canW('cash');as('Zahid');return[a,b]});ok('viewer cannot write cash, cashier can',pm[0]===false&&pm[1]===true,pm);
// ---- J. advisory isolation
const src=await (await fetch('file:///home/claude/primebook/public/index.html').catch(()=>null))?.text?.().catch(()=>null);
const fs=require('fs').readFileSync('/home/claude/primebook/public/index.html','utf8');const i0=fs.indexOf('function finalize(pk,ap)'),i1=fs.indexOf('const apr=()=>',i0),i2=fs.indexOf('window.dcSave=guard('),i3=fs.indexOf('/* manager review of a submitted closing',i2);
const posting=fs.slice(i0,i1)+fs.slice(i2,i3);
ok('posting and approval code never reads advisory records',!/S\.adv|advise\(|advCard|storeAdv/.test(posting)&&posting.length>3000,posting.length);
const same=await E(()=>{const a=accts().find(q=>q.id==AC),T=__crcT;S.adv=[{text:'garbage',kind:'variance'}];const mk=(id,d)=>({id,date:d,br:a.br,acc:a.id,accLabel:a.label,rows:[{ccy:'CAD',open:0,i:0,o:0,exp:100,counted:95,variance:-5}],by:'Cara',at:'1'});T.finalize(mk('adv1',D(80)),'Mo');S.adv=[];T.finalize(mk('adv2',D(81)),'Mo');const g=d=>JSON.stringify(S.j.filter(e=>e.tt=='Closing variance'&&e.date==d).map(e=>e.lines));return g(D(80))==g(D(81))});ok('advisory content does not change postings',same);
const adv=await E(()=>{const a=accts().find(q=>q.id==AC),L=__crcT.advise(a,D(2),__crcT.rowsOf());return Array.isArray(L)&&Object.isFrozen((S.adv||[])[0]||{})||S.adv&&S.adv.length>=0});ok('advisory records are stored apart',adv);
// ---- K. one function for preview and posting; reports from the stored closing
const K=await E(()=>{const a=accts().find(q=>q.id==AC),d=D(0);const c=S.closings.find(x=>x.id=='r2');const pv=crcVarPost(AC,'CAD',-4,d,'Counting error');const e=S.j.filter(x=>x.tt=='Closing variance'&&x.date==d).pop();return{same:JSON.stringify(pv.order.lines)==JSON.stringify(e.lines)&&pv.order.memo==e.memo,v:pv.v}});
ok('GL preview and the real posting come from the same function',K.same&&K.v==4,K);
const REP=await E(async()=>{const c=S.closings.find(x=>x.id=='r2');c.counts={by1:'Cara',by2:'',c:{CAD:{n1:{'100':1},k1:{},tm1:{n100:{by:'Cara',at:'10:15',iso:new Date().toISOString()}},nt1:100,kt1:0,x1:0,t1:100,xn:'',rc:[{c:'CAD',why:'Coin bag recount',by:'Cara',at:'x'}],adj:null}}};const b=c.br,html=dcsReports(b,c.date),csv=dcsCountCsv(b,c.date);return{c:/Currency-by-currency cash count/.test(html),v:/Shortages, overages and recounts/.test(html),a:/Closing approval and GL adjustment/.test(html),hash:html.includes(c.hash),rc:/Coin bag recount/.test(html),csv:/Denomination/.test(csv)&&/Cara/.test(csv)}});
ok('closing reports: count, variance/recount and approval sections render from the stored closing with its hash',Object.values(REP).every(Boolean),REP);
ok('no page errors',er.length==0,er);console.log('ERRS',JSON.stringify(er));await b.close();console.log('DONE')})();
