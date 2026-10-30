const {chromium}=require('playwright');let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1500,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(500);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.users=[{name:'Ann',role:'Owner',br:'All'}];S.me=0;S.dwl={};view='dash';go()});await p.waitForTimeout(600);
ok(!(await p.$('[data-dwx=undo]'))&&!(await p.$('[data-dwx=redo]'))&&!(await p.$('[data-dwx=edit]')),'Undo, Redo and Customize are not on the dashboard');
ok(!(await p.$('.dwb')),'no layout toolbar');
ok((await p.$$('.dsv-i')).length==5,'five section tabs remain');
const all=await p.evaluate(()=>[...document.querySelectorAll('.dw')].map(d=>d.dataset.dwid));
ok(all.includes('hero')&&all.includes('kpi')&&all.includes('dbxfo'),'health, key figures and overview cards present');
ok(new Set(all).size==all.length&&!all.includes('acc')&&!all.includes('ins'),'no duplicate cards');
ok(await p.evaluate(()=>!document.querySelector('.dw-t')),'no customize handles');
const wd=await p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.dwg>.dw')].map(d=>[d.dataset.dwid,Math.round(d.getBoundingClientRect().width)])));
ok(wd.kpi>1000,'key figures full width');
await p.selectOption('#dbx-acc select[aria-label=Currency]',{index:1});await p.waitForTimeout(300);ok(await p.evaluate(()=>S.dbx.Ann.cur)!='all','currency filter dropdown filters');
for(const w of [820,420]){await p.setViewportSize({width:w,height:900});await p.waitForTimeout(300);const o=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);ok(o<=2,'no horizontal overflow at '+w+' ('+o+')')}
console.log('errs',errs.join('|'));console.log(f?'FAILED '+f:'ALL PASSED');await b.close()})()
