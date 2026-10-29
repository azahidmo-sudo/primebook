const {chromium}=require('playwright');let f=0;const ok=(m,c,x)=>{console.log((c?'PASS ':'FAIL ')+m+(c?'':' '+JSON.stringify(x)));if(!c)f++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1500,height:1300}});const er=[];p.on('pageerror',e=>er.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(500);
await p.evaluate(()=>{new MutationObserver(()=>document.getElementById('rmd')?.remove()).observe(document.body,{childList:true});document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};
S.users=[{name:'Ann',role:'Owner',br:'All'},{name:'Bob',role:'Manager',br:'All'},{name:'Cy',role:'Cashier',br:'All'}];S.me=0;S.base='CAD';
const B=S.br[0].id;window.__B=B;const y=new Date(Date.now()-864e5).toISOString().slice(0,10);window.__y=y;
post({date:y,br:B,memo:'Opening cash',tt:'Opening',lines:[['1000',1000,0],['3000',0,1000]]});
post({date:today(),br:B,acc:'cash|'+B,memo:'Walk-in service',tt:'Service',lines:[['1000',200,0],['4100',0,200]]});
view='cbd';go()});
await p.waitForTimeout(300);await p.click('[data-cbmt=cl]');await p.waitForTimeout(300);
const Y=await p.evaluate(()=>window.__y);const txt=()=>p.innerText('.cbl');
ok('actions grouped in header',/Close the day/.test(await p.innerText('.cbl-h'))&&/Daily cash report/.test(await p.innerText('.cbl-h'))&&/Closing history/.test(await p.innerText('.cbl-h')));
ok('summary bar',/Status for/.test(await txt())&&/1 Open/.test(await p.innerText('.cbl-sum'))&&/No activity/.test(await p.innerText('.cbl-sum')),await p.innerText('.cbl-sum'));
ok('scope is a dropdown next to search',await p.$('#cbsc')!=null&&await p.$('[data-cbms]')==null);
const card=await p.locator('.cbl-c').first().innerText();
ok('status pill on card',/Open/.test(card));ok('Last 7 days label + 7 bubbles',/Last 7 days/.test(card)&&(await p.$$('.cbl-c:first-child .cbl-d')).length==7);
ok('four-step progress',(await p.$$('.cbl-c:first-child .cbl-sp li')).length==4&&await p.evaluate(()=>document.querySelector('.cbl-sp li').classList.contains('cur')));
ok('expected shown, counted empty state',/101,200\.00/.test(card)&&/Not counted yet/.test(card),card);
ok('empty states are words',/Not closed yet/.test(card)&&/No record/.test(card));
ok('missed day coloured',await p.evaluate(()=>!!document.querySelector('.cbl-c .cbl-d.missed')));
ok('days not closed shows red',await p.evaluate(()=>!!document.querySelector('.cbl-fg dd.bad')));
ok('exceptions panel',/Exceptions:/.test(card));
// ---- close without approval
await p.click('.cbl-c:first-child [data-cbcl]');await p.waitForTimeout(400);
ok('opens count flow for that branch/date',await p.evaluate(()=>view=='dcl'&&dcd==today()));
await p.click('#crc_nx');await p.waitForTimeout(150);await p.fill('input.crc-q[data-k=n][data-d="100"]','1012');await p.evaluate(()=>window.crcConfirmAll&&crcConfirmAll());await p.click('#crc_nx');await p.waitForTimeout(150);await p.click('#crc_nx');await p.waitForTimeout(150);await p.check('.crc-ck input');
await p.click('#crc_cl');await p.waitForTimeout(400);
ok('closed immediately (approval off)',await p.evaluate(()=>S.closings.length==1&&S.closings[0].date==today()));
await p.evaluate(()=>{view='cbd';go()});await p.waitForTimeout(300);await p.click('[data-cbmt=cl]');await p.waitForTimeout(300);
const c2=await p.locator('.cbl-c').first().innerText();ok('card shows Closed + counted + zero difference',/Closed/.test(c2)&&/101,200\.00/.test(c2)&&/0\.00/.test(c2),c2.slice(0,300));
ok('all steps done',await p.evaluate(()=>[...document.querySelectorAll('.cbl-c:first-child .cbl-sp li')].every(l=>l.classList.contains('done'))));
ok('last difference green',await p.evaluate(()=>!!document.querySelector('.cbl-fg dd.ok')));
// ---- approval on, yesterday
await p.click('#cbapr');await p.waitForTimeout(300);ok('approval setting saved',await p.evaluate(()=>S.clcfg.apr===true));
await p.click('.cbl-c:first-child [data-cbld="'+Y+'"]');await p.waitForTimeout(300);
ok('yesterday missed',/Missed/.test(await p.locator('.cbl-c').first().innerText()));
await p.evaluate(()=>{S.me=2;go()});await p.waitForTimeout(300); // cashier
await p.click('.cbl-c:first-child [data-cbcl]');await p.waitForTimeout(400);
await p.click('#crc_nx');await p.waitForTimeout(150);await p.fill('input.crc-q[data-k=n][data-d="100"]','9');await p.evaluate(()=>window.crcConfirmAll&&crcConfirmAll());await p.click('#crc_nx');await p.waitForTimeout(150);
await p.selectOption('#crc_rec select.rs','Counting error');await p.fill('#crc_rec input.rn','Recounted with supervisor');await p.click('#crc_nx');await p.waitForTimeout(150);await p.check('.crc-ck input');
const n0=await p.evaluate(()=>[S.j.length,S.closings.length]);
await p.click('#crc_cl');await p.waitForTimeout(400);
const n1=await p.evaluate(()=>[S.j.length,S.closings.length,(S.clq||[]).length]);
ok('submitted: nothing posted or locked',n1[0]==n0[0]&&n1[1]==n0[1]&&n1[2]==1,[n0,n1]);
await p.evaluate(()=>{view='cbd';go()});await p.waitForTimeout(300);await p.click('[data-cbmt=cl]');await p.waitForTimeout(300);await p.click('.cbl-c:first-child [data-cbld="'+Y+'"]');await p.waitForTimeout(300);
let cd=await p.locator('.cbl-c').first().innerText();
ok('awaiting approval shown, step 3 current',/Awaiting approval/.test(cd)&&await p.evaluate(()=>document.querySelectorAll('.cbl-c:first-child .cbl-sp li')[2].classList.contains('cur')));
ok('cashier cannot approve',await p.$('[data-cbap]')==null&&/Waiting for a manager/.test(cd));
await p.evaluate(()=>{S.me=1;go()});await p.waitForTimeout(300);
ok('submitter-manager rule n/a (Bob did not submit) -> Bob can approve',await p.$('[data-cbap$=":ok"]')!=null);
// return needs comment
await p.click('[data-cbap$=":ret"]');await p.waitForTimeout(300);
ok('return without comment refused',await p.evaluate(()=>S.clq[0].st=='Pending approval'));
await p.fill('[id^=cbcn_]','Recount the coins');await p.click('[data-cbap$=":ret"]');await p.waitForTimeout(300);
cd=await p.locator('.cbl-c').first().innerText();ok('returned with comment shown, day still open',/Returned/.test(cd)&&/Recount the coins/.test(cd)&&await p.evaluate(()=>S.clq[0].st=='Returned'&&!S.closings.some(c=>c.date==window.__y)),cd.slice(0,400));
// resubmit by cashier then approve by owner
await p.evaluate(()=>{S.me=2;go()});await p.waitForTimeout(300);await p.click('.cbl-c:first-child [data-cbcl]');await p.waitForTimeout(400);
await p.click('#crc_nx');await p.waitForTimeout(150);await p.fill('input.crc-q[data-k=n][data-d="100"]','9');await p.evaluate(()=>window.crcConfirmAll&&crcConfirmAll());await p.click('#crc_nx');await p.waitForTimeout(150);await p.selectOption('#crc_rec select.rs','Counting error');await p.fill('#crc_rec input.rn','Recounted with supervisor');await p.click('#crc_nx');await p.waitForTimeout(150);await p.check('.crc-ck input');await p.click('#crc_cl');await p.waitForTimeout(400);
ok('resubmitted replaces the returned one',await p.evaluate(()=>S.clq.length==1&&S.clq[0].st=='Pending approval'));
await p.evaluate(()=>{S.me=0;view='cbd';go()});await p.waitForTimeout(300);await p.click('[data-cbmt=cl]');await p.waitForTimeout(300);await p.click('.cbl-c:first-child [data-cbld="'+Y+'"]');await p.waitForTimeout(300);
const j0=await p.evaluate(()=>S.j.length);await p.click('[data-cbap$=":ok"]');await p.waitForTimeout(300);ok('re-authentication asked before approval',await p.$('#crc_ra_p')!=null);await p.fill('#crc_ra_p','wrong name');await p.click('#crc_ra_o');await p.waitForTimeout(200);ok('wrong identity refused',await p.evaluate(()=>S.clq.length==1));await p.fill('#crc_ra_p','Ann');await p.click('#crc_ra_o');await p.waitForTimeout(400);
const r=await p.evaluate(()=>({n:S.closings.length,j:S.j.length,q:S.clq.length,ap:S.closings.find(c=>c.date==window.__y)&&S.closings.find(c=>c.date==window.__y).apprBy,bal:S.j.every(e=>Math.abs(e.lines.reduce((t,l)=>t+l[1]-l[2],0))<.011)}));
ok('approved: locked, variance posted, approver recorded',r.n==2&&r.j==j0+1&&r.q==0&&r.ap=='Ann'&&r.bal,r);
cd=await p.locator('.cbl-c').first().innerText();ok('shows Closed with a −100.00 difference in red',/Closed/.test(cd)&&/−100\.00/.test(cd)&&await p.evaluate(()=>!!document.querySelector('.cbl-t td.bad')),cd.slice(0,300));
// blocking item disables submit
await p.evaluate(()=>{const B=window.__B;S.j.push({id:9999,date:today(),br:B,acc:'cash|'+B,tt:'Bad',memo:'x',lines:[['1000',5,0],['4100',0,4]]});S.closings=S.closings.filter(c=>c.date!=today());go()});await p.click('.cbl-c:first-child [data-cbld="'+(await p.evaluate(()=>today()))+'"]');await p.waitForTimeout(300);
ok('blocking exception shown',/blocking/.test(await p.locator('.cbl-ex').first().innerText())&&/Unbalanced entry/.test(await p.locator('.cbl-ex').first().innerText()));
ok('close button disabled while blocking',await p.evaluate(()=>document.querySelector('.cbl-c:first-child [data-cbcl]').disabled));
await p.screenshot({path:'/tmp/pt/closing.png',fullPage:true});
console.log('errs',er.join('|'));console.log(f?'FAILED '+f:'ALL PASSED');await b.close()})()
