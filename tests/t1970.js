const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{errs.push('DIALOG '+d.message().slice(0,80));d.accept()});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';S.co={name:'X'};window.B=S.br[0].id;S.users=[{name:'Z',role:'Owner',br:'All'}];S.me=0;S.dwl={};
post({date:today(),br:B,acc:'cash|'+B,tt:'Receipt',memo:'x',vno:'RV-1',by:'Z',lines:[['1000',5000,0],['3000',0,5000]]});view='dash';go()});await p.waitForTimeout(400);
const names=['New Sales Deal','New Forex Purchase','New Forex Sale','Deposit','Withdrawal','Pay Bill','New Entry','Transfer','Daily Closing','Reconcile','Reports','Exchange Rates','Currency Stock','Cashbook & Banks'];
for(const n of names){
 await p.evaluate(()=>{MD=null;view='dash';go()});await p.waitForTimeout(250);await p.click('.dsv-i[data-dws=ac]');await p.waitForTimeout(250);
 const before=errs.length;
 await p.evaluate(()=>{window.__v0=view});
 await p.click('.qa3-c:has(b:text-is("'+n+'"))');await p.waitForTimeout(500);
 const r=await p.evaluate(()=>({view,md:typeof MD!='undefined'&&!!MD,modal:[...document.querySelectorAll('.ov,.mo,.modal,[role=dialog],.mfw')].some(e=>e.getBoundingClientRect().width>200&&e.getBoundingClientRect().height>200)}));
 await p.screenshot({path:'qa_'+n.replace(/[^A-Za-z]/g,'')+'.png'});console.log(n.padEnd(20),JSON.stringify(r),(r.view!='dash'||r.modal)?'OK':'NOT ACTIVE',errs.slice(before).join(' || '));
}
await b.close()})();
