const {chromium}=require('playwright');const ok=(n,c,x)=>console.log(c?'PASS':'FAIL',n,c?'':JSON.stringify(x));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:1300}});const er=[],dl=[];p.on('pageerror',e=>er.push(e.message));p.on('dialog',d=>{dl.push(d.message());d.accept()});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
const E=(f,a)=>p.evaluate(f,a);
await E(()=>{new MutationObserver(()=>document.getElementById('rmd')?.remove()).observe(document.body,{childList:true});document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';S.co={name:'BRIMAPAY'};S.rates.EUR={b:1.5,s:1.55};
window.B=S.br[0].id;S.users=[{name:'Zahid',role:'Owner',br:'All'},{name:'Cara',role:'Cashier',br:'All'},{name:'Mo',role:'Manager',br:'All'}];S.me=0;
window.AC='cash|'+B;window.as=n=>{S.me=S.users.findIndex(u=>u.name==n)};window.ad=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
window.D=n=>ad(today(),-n);window.rec=(d,amt,by)=>{const w=S.me;if(by)as(by);post({date:d,br:B,acc:AC,tt:'Receipt',memo:'sale '+d,at:d+'T12:00:00.000Z',lines:[['1000',amt,0],['4300',0,amt]]});S.me=w};
window.exp=d=>dayRows(AC,d)[0].exp;
window.openC=d=>{dca=AC;dcd=d;window.__dcn=null;window.__crc=null;S.cdr={};view='dcl';go();crcStep(2)};
window.setC=(amt,rs,nt)=>{const e=document.querySelector('input.crc-q[data-k=x][data-p=a]');e.value=String(amt);crcQ(e);try{__crc.c[e.dataset.c].a.xn='loose cash'}catch(_){};window.crcConfirmAll&&crcConfirmAll();if(rs!=null)crcRs('CAD','r',rs);if(nt!=null)crcRs('CAD','n',nt)};
window.close_=(d,delta,rs,nt)=>{openC(d);setC(exp(d)+delta,rs,nt);const n0=S.closings.length;dcSave();return n0};
window.lastQ=()=>S.clq[S.clq.length-1];
S.cpcfg={vdef:1};
rec(D(3),500);rec(D(2),300);rec(D(1),100)});
// 1 material variance needs evidence + forces approval
await E(()=>{close_(D(3),-30,'Counting error',null)});
ok('material variance blocked without evidence',dl.some(m=>/above the threshold/.test(m)),dl);
await E(()=>{window.__crc=null;S.cdr={};openC(D(3));setC(exp(D(3))-30,'Counting error','Till 2 recount, customer short-changed');window.J0=S.j.length;dcSave()});
ok('forced to approval even with approval switch off',await E(()=>!S.clcfg||!S.clcfg.apr)&&await E(()=>S.closings.length==0&&S.clq.length==1&&S.clq[0].st=='Pending approval'),await E(()=>JSON.stringify([S.closings.length,S.clq.map(q=>q.st)])));
ok('nothing posted while pending',await E(()=>S.j.length==J0));
ok('variance pending checker',await E(()=>S.cvr.length==1&&S.cvr[0].st=='Pending checker'&&S.cvr[0].material&&S.cvr[0].maker=='Zahid'),await E(()=>JSON.stringify(S.cvr)));
ok('state PENDING_APPROVAL',await E(()=>cpcState(B,D(3)))=='PENDING_APPROVAL',await E(()=>cpcState(B,D(3))));
ok('cannot close while pending (blocker lists approvals)',await E(()=>cpcReady(B,D(3)).blockers.some(x=>x.id=='var')));
let m1=await E(()=>{as('Cara');return clAct(S.clq[0].id,'ok','')});ok('cashier cannot approve',/manager or owner/.test(m1),m1);
m1=await E(()=>{as('Zahid');return clAct(S.clq[0].id,'ok','')});ok('maker cannot approve own close',/another manager/.test(m1),m1);
m1=await E(()=>{as('Mo');return clAct(S.clq[0].id,'ok','')});ok('manager approves and posts','' ===m1&&await E(()=>S.closings.length==1&&S.j.length==J0+1),m1);
ok('variance posted with checker',await E(()=>S.cvr[0].st=='Posted'&&S.cvr[0].checker=='Mo'&&!S.cvr[0].self&&S.cvr[0].je.length==1));
ok('variance journal balanced',await E(()=>{const x=S.j[S.j.length-1];return x.lines.reduce((s,y)=>s+y[1]-y[2],0)==0&&x.tt=='Closing variance'}));
ok('second approval attempt rejected (idempotent)',await E(()=>clAct(S.clq.length?S.clq[0].id:'zz','ok',''))!=='' );
ok('duplicate submission → no second closing',await E(()=>{as('Zahid');openC(D(3));dcSave();return S.closings.filter(c=>c.date==D(3)).length==1}));
// 2 return flow as cashier
await E(()=>{as('Cara');window.__crc=null;S.cdr={};openC(D(2));setC(exp(D(2))-25,'Counting error','ok');dcSave()});
ok('cashier submission pending (material, evidence note too short)',dl.filter(m=>/above the threshold/.test(m)).length>=2);
await E(()=>{window.__crc=null;S.cdr={};openC(D(2));setC(exp(D(2))-25,'Counting error','Counted twice with supervisor');dcSave()});
ok('cashier submitted',await E(()=>S.clq.some(q=>q.date==D(2)&&q.st=='Pending approval')));
m1=await E(()=>{as('Mo');const q=S.clq.find(q=>q.date==D(2));return clAct(q.id,'ret','')});ok('return needs comment',/comment/.test(m1),m1);
m1=await E(()=>{const q=S.clq.find(q=>q.date==D(2));return clAct(q.id,'ret','Attach the till slip')});ok('returned',m1==''&&await E(()=>S.cvr.find(v=>v.date==D(2)).st=='Returned'),m1);
ok('returned keeps history',await E(()=>{const q=S.clq.find(q=>q.date==D(2));return q.hist.length>=2&&q.hist[q.hist.length-1].note=='Attach the till slip'}));
await E(()=>{as('Cara');window.__crc=null;S.cdr={};openC(D(2));setC(exp(D(2))-25,'Counting error','Till slip attached, counted twice');dcSave()});
ok('resubmit reuses the same variance record',await E(()=>S.cvr.filter(v=>v.date==D(2)).length==1&&S.cvr.find(v=>v.date==D(2)).st=='Pending checker'),await E(()=>JSON.stringify(S.cvr)));
m1=await E(()=>{as('Mo');const q=S.clq.find(q=>q.date==D(2)&&q.st=='Pending approval');return clAct(q.id,'rej','Not credible')});
ok('reject keeps record, posts nothing',m1==''&&await E(()=>S.cvr.find(v=>v.date==D(2)).st=='Rejected'&&!S.closings.some(c=>c.date==D(2))),m1);
await E(()=>{as('Cara');window.__crc=null;S.cdr={};openC(D(2));setC(exp(D(2))-25,'Counting error','Recount confirmed with manager');dcSave()});
m1=await E(()=>{as('Mo');const q=S.clq.find(q=>q.date==D(2)&&q.st=='Pending approval');return clAct(q.id,'ok','')});ok('approved after rework',m1==''&&await E(()=>S.closings.some(c=>c.date==D(2))),m1);
ok('audit shows full history',await E(()=>{const a=S.cvr.filter(v=>v.date==D(2));return a.length==2&&a.some(v=>v.st=='Rejected')&&a.some(v=>v.st=='Posted')}),await E(()=>JSON.stringify(S.cvr.map(v=>[v.id,v.date,v.st]))));
// 3 close D1 clean then reopen rules
await E(()=>{as('Zahid');close_(D(1),0,null,null)});
ok('D1 closed',await E(()=>S.closings.some(c=>c.date==D(1))));
ok('bridge zero across closed days',await E(()=>cpcBridge(B,D(1)).every(x=>Math.abs(x.diff)<.005)&&cpcBridge(B,D(2)).every(x=>Math.abs(x.diff)<.005)));
// reopen oldest while later closed → blocked
await E(()=>{as('Cara');document.body.insertAdjacentHTML('beforeend','<div id=tmpq><select id=cpq_b><option value="'+B+'" selected></option></select><input id=cpq_d value="'+D(3)+'"><textarea id=cpq_r>Wrong till assigned, need recount</textarea></div>');cpcReq();document.getElementById('tmpq').remove()});
ok('reopen request created with impact',await E(()=>S.crq.length==1&&S.crq[0].st=='Pending'&&S.crq[0].impact.laterClosed.length>=1&&S.crq[0].reason.length>8),await E(()=>JSON.stringify(S.crq)));
await E(()=>{as('Cara');document.body.insertAdjacentHTML('beforeend','<input id=cprn_RO-0001 value="">');cpcDecideReq('RO-0001','ok')});
ok('cashier cannot approve reopen',await E(()=>S.crq[0].st=='Pending'&&S.closings.some(c=>c.date==D(3))));
await E(()=>{as('Mo');cpcDecideReq('RO-0001','ok')});
ok('reopen blocked while later days closed; nothing changed',await E(()=>S.crq[0].st=='Pending'&&S.closings.some(c=>c.date==D(3))&&!S.j.some(x=>x.tt=='Closing reversal')));
// reopen newest (D1) as request by Cara, approved by Mo
await E(()=>{as('Zahid');cpcFix&&0;S.crq=[];const mk=(d)=>{document.body.insertAdjacentHTML('beforeend','<div id=tmpq><select id=cpq_b><option value="'+B+'" selected></option></select><input id=cpq_d value="'+d+'"><textarea id=cpq_r>Recount requested by branch manager</textarea></div>');cpcReq();document.getElementById('tmpq').remove()};as('Cara');mk(D(2));window.__m=mk});
await E(()=>{as('Mo');cpcDecideReq('RO-0001','ok')});
ok('later day D1 closed, so D2 reopen refused',await E(()=>S.closings.some(c=>c.date==D(2))&&S.crq[0].st=='Pending'));
await E(()=>{S.crq=[];as('Cara');__m(D(1))});await E(()=>{as('Mo');cpcDecideReq('RO-0001','ok')});
ok('D1 reopened by different approver',await E(()=>S.crq[0].st=='Executed'&&S.crq[0].decBy=='Mo'&&!S.closings.some(c=>c.date==D(1))));
ok('state REOPENED',await E(()=>cpcState(B,D(1)))=='REOPENED',await E(()=>cpcState(B,D(1))));
ok('closing archived not lost',await E(()=>S.cpd[B+'|'+D(1)].arch.length==1&&S.cpd[B+'|'+D(1)].arch[0].closings.length==1));
ok('day accepts entries again',await E(()=>!closedDay(B,D(1))));
await E(()=>{as('Zahid');close_(D(1),0,null,null)});
ok('re-closed → CLOSED and reopen done',await E(()=>cpcState(B,D(1))=='CLOSED'&&S.cpd[B+'|'+D(1)].reopen.done));
// reopen of a locked day + variance reversal
await E(()=>{as('Mo');cpcLockNow(B,D(1),null)});
ok('D1 locked',await E(()=>cpcState(B,D(1)))=='LOCKED');
await E(()=>{S.crq=[];as('Cara');__m(D(1))});await E(()=>{as('Zahid');cpcDecideReq('RO-0001','ok')});
ok('locked day reopened, lock cleared, archived',await E(()=>!S.cpd[B+'|'+D(1)].lock&&S.cpd[B+'|'+D(1)].arch.length==2&&S.cpd[B+'|'+D(1)].arch[1].lock&&S.crq[0].locked));
await E(()=>{as('Zahid');close_(D(1),0,null,null)});
// 4 failed posting during reopen rolls back
await E(()=>{as('Mo');cpcLockNow(B,D(1),null)});
// make D2 closing variance entry corrupt then reopen D2 requires D1 not closed: reopen D1 first
await E(()=>{S.crq=[];as('Cara');__m(D(1))});await E(()=>{as('Mo');cpcDecideReq('RO-0001','ok')});
await E(()=>{S.crq=[];as('Cara');__m(D(2))});
await E(()=>{const c=S.closings.find(c=>c.date==D(2));const j=S.j.find(x=>x.id==c.je[0]);j.lines[0][0]='9999';window.SN=JSON.stringify({c:S.closings.length,j:S.j.length})});
await E(()=>{as('Mo');cpcDecideReq('RO-0001','ok')});
ok('failed posting: atomic rollback, request stays pending',await E(()=>S.crq[0].st=='Pending'&&JSON.stringify({c:S.closings.length,j:S.j.length})==SN&&S.closings.some(c=>c.date==D(2))),await E(()=>JSON.stringify([S.crq[0].st,S.closings.length,S.j.length,SN])));
ok('no page errors',er.length==0,er.slice(0,3));console.log('ERR',er.slice(0,3));await b.close()})();
