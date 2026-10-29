const {chromium}=require('playwright');let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1500,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(500);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.users=[{name:'Ann',role:'Owner',br:'All'}];S.me=0;
const b=S.br[0].id,d=today();S.banks=[{id:'k1',name:'TD Bank',no:'123',ccy:S.base,br:b}];post({date:d,br:b,acc:'bank|k1',bank:'k1',tt:'Deposit',memo:'Bank dep',lines:[['1010',5000,0],['4300',0,5000]]});view='dash';go()});
await p.waitForTimeout(700);
const secs=()=>p.evaluate(()=>[...document.querySelectorAll('.dws')].map(s=>s.dataset.dws+':'+[...s.querySelectorAll('.dwg>.dw')].map(d=>d.dataset.dwid).join(',')));
console.log(JSON.stringify(await secs()));
ok((await p.$$('.dws')).length==5,'5 sections');ok((await secs())[0].startsWith('ov:hero,kpi,dbxcb,rec'),'greeting + key figures first in overview');
const all=await p.evaluate(()=>[...document.querySelectorAll('.dw')].map(d=>d.dataset.dwid));
ok(!all.includes('acc')&&!all.includes('ins'),'duplicate cards (acc, ins) not shown by default');
ok(new Set(all).size==all.length,'no card appears twice');
ok(!/Your company\s*·/.test(await p.innerText('.dw[data-dwid=dbxfo]')),'Financial overview description line removed');
ok(/Currency/.test(await p.innerText('.dw[data-dwid=dbxfo]'))&&/Total Cash Balance/.test(await p.innerText('.dw[data-dwid=dbxfo]')),'overview KPIs intact');
ok(await p.evaluate(()=>document.querySelector('.dws[data-dws=mr]').classList.contains('col')),'settings & more collapsed');
// hold-drag Quick reports onto Recent transactions (right half)
const box=async s=>await (await p.$(s)).boundingBox();
const src=await box('.dw[data-dwid=dbxqr] .dbx-ph h3');await p.locator('.dw[data-dwid=dbxqr]').scrollIntoViewIfNeeded();
const s2=await box('.dw[data-dwid=dbxqr] .dbx-ph h3');
await p.mouse.move(s2.x+5,s2.y+5);await p.mouse.down();
await p.mouse.move(s2.x+8,s2.y+8);await p.waitForTimeout(100);
ok(!(await p.$('.dw.drag')),'quick move before hold does not drag');
await p.mouse.up();
await p.mouse.move(s2.x+5,s2.y+5);await p.mouse.down();await p.waitForTimeout(500);
ok(await p.evaluate(()=>document.querySelector('.dw[data-dwid=dbxqr]').classList.contains('arm')),'armed after hold');
await p.locator('.dw[data-dwid=act]').evaluate(e=>e.scrollIntoView({block:'center'}));const t=await box('.dw[data-dwid=act]');await p.mouse.move(t.x+t.width*.8,t.y+40,{steps:10});await p.waitForTimeout(150);
ok(await p.$('.dw.drag')!=null&&await p.$('.dw-ghost')!=null&&await p.$('.dw-ind')!=null,'dragging shows ghost + indicator');
await p.mouse.up();await p.waitForTimeout(400);
const a1=await secs();console.log(JSON.stringify(a1));
ok(a1.find(x=>x.startsWith('tx:')).split(':')[1].split(',').indexOf('dbxqr')>=0,'card moved into Transactions');
ok((await p.$$('.dw-ghost')).length==0,'ghost cleaned up');
// undo / redo
ok(await p.isEnabled('[data-dwx=undo]'),'undo enabled');
await p.click('[data-dwx=undo]');await p.waitForTimeout(300);
ok(JSON.stringify(await secs())!=JSON.stringify(a1)&&(await secs()).find(x=>x.startsWith('rp:')).includes('dbxqr'),'undo restores');
await p.click('[data-dwx=redo]');await p.waitForTimeout(300);ok(JSON.stringify(await secs())==JSON.stringify(a1),'redo reapplies');
await p.keyboard.press('Control+z');await p.waitForTimeout(300);ok((await secs()).find(x=>x.startsWith('rp:')).includes('dbxqr'),'Ctrl+Z works');
await p.keyboard.press('Control+Shift+z');await p.waitForTimeout(300);
// persists
ok((await p.evaluate(()=>JSON.stringify(S.dwl.Ann.sec))).includes('dbxqr'),'saved in S.dwl');
// existing functions still work: click currency row filters, no drag on quick click
await p.evaluate(()=>window.scrollTo(0,0));
await p.click('.dw[data-dwid=dbxcb] tbody tr:nth-child(2)');await p.waitForTimeout(300);
ok(await p.evaluate(()=>S.dbx.Ann.cur)!='all','row click still works');
await p.evaluate(()=>{S.dbx.Ann.cur='all';go()});await p.waitForTimeout(300);
// customize mode: section select + collapse + reset
await p.click('[data-dwx=edit]');await p.waitForTimeout(200);
ok((await p.$$('.dw-t')).length>5,'customize handles');
await p.selectOption('[data-dwsel=kpt]','ov');await p.waitForTimeout(300);ok((await secs())[0].includes('kpt'),'move to section via select');
await p.click('[data-dwx=reset]');await p.waitForTimeout(300);ok(!(await secs())[0].includes('kpt'),'reset');
await p.click('[data-dwx=done]');await p.waitForTimeout(200);
await p.click('[data-dwx=col][data-dws=mr]');await p.waitForTimeout(300);ok(await p.$('.dws[data-dws=mr] .dw')!=null,'expand settings & more');
// persistence across reload
await p.evaluate(()=>save());await p.reload();await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.me=0;view='dash';go()});await p.waitForTimeout(600);
ok(await p.evaluate(()=>!!(S.dwl&&S.dwl.Ann)),'layout still stored after reload');
// bad legacy sizes are corrected
await p.evaluate(()=>{S.dwl.Ann={ord:['dbxcb','kpi'],hid:['hero'],sp:{hero:4,kpi:4},mig2:1,mig4:1,mig5:1};go()});await p.waitForTimeout(600);
const wd=await p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.dwg>.dw')].map(d=>[d.dataset.dwid,Math.round(d.getBoundingClientRect().width)])));
ok(wd.hero>1000&&wd.kpi>1000,'hero and key figures full width even with bad saved sizes '+JSON.stringify([wd.hero,wd.kpi]));
// responsive
for(const w of [820,420]){await p.setViewportSize({width:w,height:900});await p.waitForTimeout(300);const o=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);ok(o<=2,'no horizontal overflow at '+w+' ('+o+')')}
console.log('errs',errs.join('|'));console.log(f?'FAILED '+f:'ALL PASSED');await b.close()})()
