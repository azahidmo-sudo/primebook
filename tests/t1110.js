const {chromium}=require('playwright');let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1100}});const errs=[];p.on('pageerror',e=>errs.push(e.message));let dl=[];p.on('dialog',d=>{dl.push(d.message());d.accept(new Date(Date.now()+5*864e5).toISOString().slice(0,10))});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(700);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};
S.pos['b1|EUR']={q:1000,c:1.1};S.cust.push({id:'cT',name:'Test Customer',type:'Customer',status:'Active'});S.cust.push({id:'cU',name:'Other Customer',type:'Customer',status:'Active'});
view='std';go()});await p.waitForTimeout(400);
const tab=async k=>{await p.click('[data-csx=tab][data-csk='+k+']');await p.waitForTimeout(300)};
await tab('rs');
await p.selectOption('#rs_br','b1');await p.selectOption('#rs_cur','EUR');await p.fill('#rs_amt','600');await p.selectOption('#rs_type','customer');await p.selectOption('#rs_cust','cT');
await p.click('[data-csx=rssub]');await p.waitForTimeout(400);
ok(await p.evaluate(()=>S.cs.res.length)==1,'reservation created');
await tab('rs');
// over-reserve blocked
await p.fill('#rs_amt','500');await p.selectOption('#rs_cust','cU');await p.click('[data-csx=rssub]');await p.waitForTimeout(300);
ok(await p.evaluate(()=>S.cs.res.length)==1,'over-reserve blocked');
// oversell by other customer blocked, with message
const r1=await p.evaluate(()=>{const k='b1|EUR';window.__rsvC='cU';const x=mv(S.pos,k,500,0,0);const m=stkMsg(k,500);window.__rsvC=null;return{x,m,q:S.pos[k].q}});
ok(r1.x==null&&r1.q==1000,'other customer cannot take reserved stock');console.log(r1.m);
ok(/Available 400\.00 EUR/.test(r1.m)&&/Required 500\.00/.test(r1.m)&&/Shortage 100\.00/.test(r1.m),'message has available/required/shortage');
// reserved customer can sell 600 and consumes
const r2=await p.evaluate(()=>{const k='b1|EUR';window.__rsvC='cT';const x=mv(S.pos,k,600,0,0);window.__rsvC=null;if(x!=null)rsvTake(k,'cT',600);return{x,q:S.pos[k].q,st:S.cs.res[0].status,u:S.cs.res[0].used}});
ok(r2.x!=null&&r2.q==400&&r2.st=='consumed'&&r2.u==600,'reserved customer sale consumes hold');
// expiry
const r3=await p.evaluate(()=>{S.cs.res.push({id:'RSV-9',cur:'EUR',br:'b1',key:'b1|EUR',amt:100,used:0,type:'other',exp:'2020-01-01',status:'active',by:'x',at:'2020-01-01',hist:[]});const a=resv('b1|EUR');return{a}});
ok(r3.a==0,'expired reservation does not hold stock');
await p.evaluate(()=>go());await p.waitForTimeout(300);
ok(await p.evaluate(()=>S.cs.res.find(r=>r.id=='RSV-9').status)=='expired','auto-expired in model');
// release
await p.evaluate(()=>{const cs=S.cs;cs.res.push({id:'RSV-8',cur:'EUR',br:'b1',key:'b1|EUR',amt:100,used:0,type:'other',exp:'2999-01-01',status:'active',by:me().name,at:'2026-01-01',hist:[]});go()});await p.waitForTimeout(300);
await tab('rs');await p.click('[data-csx=rsrel][data-csid=RSV-8]');await p.waitForTimeout(300);
ok(await p.evaluate(()=>S.cs.res.find(r=>r.id=='RSV-8').status)=='released','release works');
// ask
await tab('ov');ok(!(await p.$('#cs-ask')),'ask panel removed from Currency Stock');


// reports
const rp=await p.evaluate(()=>{const o={};['Available and Reserved Stock','Currency Stock by Branch','Currency Reservations','Daily Currency Movement'].forEach(n=>{o[n]=REP.some(r=>r[0]==n)});return o});
ok(Object.values(rp).every(Boolean),'4 reports registered');
ok(errs.length==0,'no errors '+errs.join('|'));console.log(f?'FAILED '+f:'ALL PASS');await b.close()})();
