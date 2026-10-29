const {chromium}=require('playwright');const ok=(n,c,x)=>console.log(c?'PASS':'FAIL',n,c?'':JSON.stringify(x));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:1300}});const er=[],dl=[];p.on('pageerror',e=>er.push(e.message));p.on('dialog',d=>{dl.push(d.message());d.accept()});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
const E=(f,a)=>p.evaluate(f,a);
await E(()=>{new MutationObserver(()=>document.getElementById('rmd')?.remove()).observe(document.body,{childList:true});document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';S.co={name:'BRIMAPAY'};S.rates.EUR={b:1.5,s:1.55};
window.B=S.br[0].id;S.users=[{name:'Zahid',role:'Owner',br:'All'},{name:'Cara',role:'Cashier',br:'All'},{name:'Mo',role:'Manager',br:'All'}];S.me=0;
window.AC='cash|'+B;window.as=n=>{S.me=S.users.findIndex(u=>u.name==n)};
window.yest=()=>addD0(today(),-1);window.addD0=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
post({date:addD0(today(),-3),br:B,acc:AC,tt:'Opening',memo:'open',lines:[['1000',1000,0],['3000',0,1000]]});
window.cnt=(date,amt,note,who2)=>{dca=AC;dcd=date;window.__crc=null;S.cdr={};window.__dcn=null;view='dcl';go();const s=window.__crc||st&&0;return 1};
window.setCount=(amt,reason,note)=>{window.__crc=null;S.cdr={};go();const e=document.querySelector('input.crc-q[data-k=x]');e.value=String(amt);crcQ(e);try{__crc.c[e.dataset.c].a.xn='loose cash'}catch(_){};window.crcConfirmAll&&crcConfirmAll();if(reason!=null){crcRs('CAD','r',reason);}if(note!=null){crcRs('CAD','n',note)}};
view='dtx';window.__dxt='clo';go()});
await p.waitForTimeout(400);
ok('cockpit renders',(await p.textContent('.cpc')).includes('Branch day closing'));
ok('state OPEN at start',await E(()=>cpcState(B,today())=='OPEN'||cpcState(B,today())=='NONE'),await E(()=>cpcState(B,today())));
// activity today
await E(()=>{post({date:today(),br:B,acc:AC,tt:'Receipt',memo:'sale',lines:[['1000',200,0],['4300',0,200]]})});
ok('OPEN with activity',await E(()=>cpcState(B,today()))=='OPEN');
// A. small variance direct close
await E(()=>{dca=AC;dcd=today();window.__dcn=null;window.__crc=null;S.cdr={};view='dcl';go()});await p.waitForTimeout(200);
await E(()=>{crcStep(2)});
ok('COUNTING after count step opened',await E(()=>cpcState(B,today()))=='COUNTING');
// exp = 1200
await E(()=>{const e=document.querySelector('input.crc-q[data-k=x]');e.value=String(dayRows(AC,today())[0].exp-4);crcQ(e);try{__crc.c[e.dataset.c].a.xn='loose cash'}catch(_){};window.crcConfirmAll&&crcConfirmAll();crcRs('CAD','r','Counting error')});
await E(()=>dcSave());await p.waitForTimeout(200);
console.log('DLG',JSON.stringify(dl));ok('small variance closes directly',await E(()=>S.closings.length==1&&S.closings[0].rows[0].variance==-4),await E(()=>JSON.stringify(S.closings.map(c=>c.rows))));
ok('variance object created+posted',await E(()=>S.cvr.length==1&&S.cvr[0].st=='Posted'&&!S.cvr[0].material&&S.cvr[0].amt==-4),await E(()=>JSON.stringify(S.cvr)));
ok('state CLOSED',await E(()=>cpcState(B,today()))=='CLOSED');
ok('closedDay true',await E(()=>closedDay(B,today())));
// lock: cashier cannot
await E(()=>as('Cara'));
let r1=await E(()=>{try{cpcLockNow(B,today(),null);return 'locked'}catch(e){return e.message}});ok('cashier cannot lock',/manager or owner/.test(r1),r1);
await E(()=>as('Mo'));
r1=await E(()=>{try{cpcLockNow(B,today(),999);return 'locked'}catch(e){return e.message}});ok('stale version rejected',/changed since/.test(r1),r1);
r1=await E(()=>{try{cpcLockNow(B,today(),S.cpd[B+'|'+today()].ver);return 'locked'}catch(e){return e.message}});ok('manager locks',r1=='locked',r1);
ok('state LOCKED',await E(()=>cpcState(B,today()))=='LOCKED');
ok('snapshot hash ok',await E(()=>{const l=S.cpd[B+'|'+today()].lock;return apw.h53(JSON.stringify(l.snap))==l.hash}));
// pack immutable (posting on a locked day is now rejected outright)
let h1=await E(()=>{let blocked=false;try{post({date:today(),br:B,acc:AC,tt:'Receipt',memo:'late',lines:[['1000',50,0],['4300',0,50]]})}catch(e){blocked=/locked/.test(e.message)}window.__blk=blocked;go();return cpcPack(B,today()).accounts[0].rows[0].exp});
await E(()=>{view='dtx';window.__dxt='clo';window.__cpv='pack';window.__cpb=B;window.__cpd=today();go()});await p.waitForTimeout(200);
const pk=await p.textContent('.cpc-pk');ok('pack from snapshot, intact; late post to locked day rejected',pk.includes('Snapshot intact')&&await E(()=>window.__blk===true));
await E(()=>{S.cpd[B+'|'+today()].lock.snap.accounts[0].rows[0].counted=9999;go()});await p.waitForTimeout(150);
ok('tamper detected',(await p.textContent('.cpc-pk')).includes('DOES NOT MATCH'));
await E(()=>{S.cpd[B+'|'+today()].lock.snap.accounts[0].rows[0].counted=S.closings[0].rows[0].counted});
ok('audit chain verifies',await E(()=>apw.ver().ok),await E(()=>apw.ver()));
ok('audit has lock event',await E(()=>S.apl.some(e=>e.act=='Day locked'&&e.rid=='CLOSE '+B+' '+today())));
ok('no page errors so far',er.length==0,er);
console.log('ERRS',er.slice(0,3));await b.close()})();
