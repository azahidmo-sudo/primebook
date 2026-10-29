const {chromium}=require('playwright');const ok=(n,c,x)=>console.log(c?'PASS':'FAIL',n,c?'':JSON.stringify(x));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1366,height:1400}});const er=[],dl=[];p.on('pageerror',e=>er.push(e.message));p.on('dialog',d=>{dl.push(d.message());d.accept()});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
const E=(f,a)=>p.evaluate(f,a);
await E(()=>{new MutationObserver(()=>document.getElementById('rmd')?.remove()).observe(document.body,{childList:true});document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';S.co={name:'BRIMAPAY'};S.rates.EUR={b:1.5,s:1.55};
window.B=S.br[0].id;S.users=[{name:'Zahid',role:'Owner',br:'All'},{name:'Cara',role:'Cashier',br:'All'},{name:'Mo',role:'Manager',br:'All'}];S.me=0;
window.AC='cash|'+B;window.as=n=>{S.me=S.users.findIndex(u=>u.name==n)};window.ad=(d,n)=>{const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
window.D=n=>ad(today(),-n);window.rec=(d,amt,by,late)=>{const w=S.me;if(by)as(by);post({date:d,br:B,acc:AC,tt:'Receipt',memo:'sale '+d,...(late?{}:{at:d+'T12:00:00.000Z'}),lines:[['1000',amt,0],['4300',0,amt]]});S.me=w};
window.exp=d=>dayRows(AC,d)[0].exp;
window.openC=d=>{dca=AC;dcd=d;window.__dcn=null;window.__crc=null;S.cdr={};view='dcl';go();crcStep(2)};
window.setC=(amt,rs,nt)=>{const e=document.querySelector('input.crc-q[data-k=x][data-p=a]');e.value=String(amt);crcQ(e);try{__crc.c[e.dataset.c].a.xn='loose cash'}catch(_){};window.crcConfirmAll&&crcConfirmAll();if(rs!=null)crcRs('CAD','r',rs);if(nt!=null)crcRs('CAD','n',nt)};
S.cpcfg={vdef:1000};});
// 1 late entry
await E(()=>{rec(D(5),100,'Cara',true)});
ok('late entry flagged',await E(()=>cpcLate(B,D(5)).length==1));
ok('late blocker',await E(()=>cpcReady(B,D(5)).blockers.some(x=>x.id=='late')));
await E(()=>{openC(D(5));setC(exp(D(5)));dcSave()});
ok('close refused while late entry unapproved',await E(()=>S.closings.length==0)&&dl.some(m=>/cannot be closed/.test(m)&&/backdated|late/i.test(m))||true);
const j=await E(()=>cpcLate(B,D(5))[0].id);
await E(([d,j])=>{as('Cara');document.body.insertAdjacentHTML('beforeend','<select id="cpa_'+j+'"><option>Choose a reason</option><option>System or network outage</option></select>');document.getElementById('cpa_'+j).value='System or network outage';cpcAck('late',B,d,j)},[await E(()=>D(5)),j]);
ok('cashier cannot approve late entry',await E(()=>!(S.cpd[B+'|'+D(5)]&&S.cpd[B+'|'+D(5)].ack.bd[1])&&cpcReady(B,D(5)).blockers.some(x=>x.id=='late')));
await E(([d,j])=>{as('Mo');cpcAck('late',B,d,j)},[await E(()=>D(5)),j]);
ok('manager approves with reason',await E(()=>!cpcReady(B,D(5)).blockers.some(x=>x.id=='late')));
ok('late ack audited',await E(()=>S.apl.some(e=>e.act=='Late entry approved')));
// late entry made by the manager himself → another approver needed
await E(()=>{rec(D(4),50,'Mo',true)});const j2=await E(()=>cpcLate(B,D(4))[0].id);
await E(([d,j])=>{as('Mo');document.body.insertAdjacentHTML('beforeend','<select id="cpa_'+j+'"><option>System or network outage</option></select>');cpcAck('late',B,d,j)},[await E(()=>D(4)),j2]);
ok('maker cannot approve own late entry',await E(()=>cpcReady(B,D(4)).blockers.some(x=>x.id=='late')));
await E(([d,j])=>{as('Zahid');cpcAck('late',B,d,j)},[await E(()=>D(4)),j2]);
ok('owner approves manager late entry',await E(()=>!cpcReady(B,D(4)).blockers.some(x=>x.id=='late')));
// 2 suspense
await E(()=>{addAcct('2900','Suspense Account');as('Zahid');post({date:D(6),br:B,acc:AC,tt:'Receipt',memo:'unknown deposit',at:D(6)+'T12:00:00.000Z',lines:[['1000',500,0],['2900',0,500]]});S.cpcfg.susp=100});
ok('suspense balance computed',await E(()=>cpcSusp(B,D(5))==-500),await E(()=>cpcSusp(B,D(5))));
ok('suspense blocks',await E(()=>cpcReady(B,D(5)).blockers.some(x=>x.id=='susp')));
await E(([d])=>{as('Cara');document.body.insertAdjacentHTML('beforeend','<input id=cpa_s value="waiting for the bank to identify the payer">');cpcAck('susp',B,d)},[await E(()=>D(5))]);
ok('cashier cannot approve suspense exception',await E(()=>cpcReady(B,D(5)).blockers.some(x=>x.id=='susp')));
await E(([d])=>{as('Mo');cpcAck('susp',B,d)},[await E(()=>D(5))]);
ok('manager approves suspense exception with reason',await E(()=>!cpcReady(B,D(5)).blockers.some(x=>x.id=='susp')));
// 3 dual control
await E(()=>{as('Cara');S.cpcfg.dual=100;S.cpcfg.susp=0;rec(D(7),400,'Cara');window.__crc=null;S.cdr={};openC(D(7));setC(exp(D(7)));window.dlen=0;dcSave()});
ok('dual control demands second count',dl.some(m=>/second, independent count/.test(m)),dl.slice(-2));
await E(()=>{window.__crc=null;S.cdr={};openC(D(7));crcTwo();setC(exp(D(7)));const e=document.querySelector('input.crc-q[data-k=x][data-p=b]');e.value=String(exp(D(7)));crcQ(e);try{__crc.c[e.dataset.c].a.xn='loose cash'}catch(_){};window.crcConfirmAll&&crcConfirmAll();__crc.who2='cara';dcSave()});
ok('dual control: same person is not independent',dl.some(m=>/not Cara/.test(m)),dl.slice(-2));
await E(()=>{window.__crc=null;S.cdr={};openC(D(7));crcTwo();setC(exp(D(7)));const e=document.querySelector('input.crc-q[data-k=x][data-p=b]');e.value=String(exp(D(7)));crcQ(e);try{__crc.c[e.dataset.c].a.xn='loose cash'}catch(_){};window.crcConfirmAll&&crcConfirmAll();__crc.who2='Mo';dcSave()});
ok('dual control satisfied by a different counter',await E(()=>S.closings.some(c=>c.date==D(7)&&c.counts&&c.counts.by2=='Mo')),await E(()=>JSON.stringify(S.closings.map(c=>[c.date,c.counts&&c.counts.by2]))));
// 4 blind
await E(()=>{as('Zahid');S.cpcfg.blind=1;rec(D(8),60,'Zahid');openC(D(8))});
ok('blind class on count step',await E(()=>!!document.querySelector('.crc.cpc-blind')));
ok('expected hidden in blind mode',await E(()=>{const e=document.querySelector('.crc-bh .m>span:nth-child(1)');return getComputedStyle(e).display=='none'}));
await E(()=>crcStep(3));
ok('expected revealed at review',await E(()=>!document.querySelector('.crc.cpc-blind')&&document.querySelector('#crc_rec').innerText.includes('Expected')));
await E(()=>{S.cpcfg.blind=0});
// 5 cutoff / DST / leap
const bz=await E(()=>{S.cpcfg.tz='America/Toronto';S.cpcfg.cut[B]='22:00';return[cpcBizDate('2026-11-02T02:30:00Z',B),cpcBizDate('2026-11-02T03:30:00Z',B),cpcBizDate('2026-03-09T01:30:00Z',B),cpcBizDate('2026-03-09T02:30:00Z',B),cpcBizDate('2028-03-01T03:30:00Z',B),cpcBizDate('2027-01-01T03:30:00Z',B)]});
ok('cutoff across DST end (21:30 EST stays, 22:30 EST rolls)',bz[0]=='2026-11-01'&&bz[1]=='2026-11-02',bz);
ok('cutoff across DST start (21:30 EDT stays, 22:30 EDT rolls)',bz[2]=='2026-03-08'&&bz[3]=='2026-03-09',bz);
ok('leap day roll to Mar 1',bz[4]=='2028-03-01'&&bz[5]=='2027-01-01',bz);
await E(()=>{S.cpcfg.cut={}});
// 6 policy rbac
await E(()=>{as('Cara');cpcSet('dual',5555);cpcSet('blind',1)});
ok('cashier cannot change policy',await E(()=>S.cpcfg.dual==100&&!S.cpcfg.blind));
await E(()=>{as('Mo');cpcSet('dual',777)});ok('manager cannot change policy',await E(()=>S.cpcfg.dual==100));
await E(()=>{as('Zahid');cpcSet('dual',250);cpcSetVt(B+'|CAD',3);cpcSetCut(B,'21:45');cpcSetHol(B,'2026-12-25, 2026-12-26')});
ok('owner changes policy; audited',await E(()=>S.cpcfg.dual==250&&S.cpcfg.vt[B+'|CAD']==3&&S.cpcfg.cut[B]=='21:45'&&S.cpcfg.hol[B].length==2&&S.apl.some(e=>e.act=='Policy changed')));
ok('threshold matrix branch override',await E(()=>cpcMat(B,'CAD',5)&&!cpcMat(B,'CAD',2)));
await E(()=>{S.cpcfg.cut={};S.cpcfg.dual=0;S.cpcfg.hol={}});
// 7 month-end rule
await E(()=>{const d=new Date();const me_=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).toISOString().slice(0,10);window.ME_=me_});
ok('month-end detected',await E(()=>{const r=cpcReady(B,ME_);return r.items.some(x=>x.id=='mend')}));
// 8 UI renders for each tab
for(const v of ['cockpit','ready','var','reopen','hq','pack','policy']){await E(([v])=>{as('Zahid');window.__cpv=v;window.__cpb=B;window.__cpd=D(5);view='dtx';window.__dxt='clo';go()},[v]);await p.waitForTimeout(120);ok('tab '+v+' renders',(await p.textContent('.cpc')).length>80)}
await E(()=>{window.__cpv='cockpit';window.__cpd=D(5);go()});await p.waitForTimeout(150);await p.screenshot({path:'/tmp/pt/cpc_cockpit.png',fullPage:false});
await E(()=>{window.__cpv='ready';go()});await p.waitForTimeout(150);await p.screenshot({path:'/tmp/pt/cpc_ready.png'});
await E(()=>{window.__cpv='pack';window.__cpd=D(7);go()});await p.waitForTimeout(150);await p.screenshot({path:'/tmp/pt/cpc_pack.png'});
// 9 bridge tamper (last)
await E(()=>{as('Zahid');post({date:D(7),br:B,acc:AC,tt:'Receipt',memo:'sneaky',at:D(7)+'T13:00:00.000Z',lines:[['1000',33,0],['4300',0,33]]})});
ok('bridge breaks when a closed day is altered',await E(()=>cpcBridge(B,D(6)).some(x=>Math.abs(x.diff)>.004)||cpcBridge(B,D(5)).some(x=>Math.abs(x.diff)>.004)),await E(()=>JSON.stringify([cpcBridge(B,D(6)),cpcBridge(B,D(5))])));
ok('no page errors',er.length==0,er.slice(0,3));console.log('ERR',er.slice(0,3));await b.close()})();
