const {chromium}=require('playwright');let f=0;const ok=(n,c)=>{console.log(c?'ok':'FAIL',n);if(!c)f++};(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1500,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{d.accept()});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.users=[{name:'Zahid',role:'Owner',br:'All'}];S.me=0;S.base='CAD';S.j=[];S.closings=[];
post({date:today(),br:S.br[0].id,acc:'cash|'+S.br[0].id,tt:'Receipt',memo:'dep',vno:'RV-1',by:'Z',lines:[['1000',5000,0],['3000',0,5000]]});
post({date:today(),br:S.br[0].id,acc:'cash|'+S.br[0].id,tt:'Receipt',memo:'fx',vno:'RV-2',by:'Z',ccy:'USD',rate:1.35,lines:[['1000',1350,0],['3000',0,1350]]});view='dcl';go();crcStep(2)});await p.waitForTimeout(500);
ok('currency cards',(await p.$$('.cs2-cc')).length==2);
ok('recent transactions',/RV-2/.test(await p.textContent('.cs2-l')));
ok('summary + checklist + quick actions + treasury',/Closing Summary/.test(await p.textContent('#cs2_sum'))&&/Daily Closing Checklist/.test(await p.textContent('#cs2_ck'))&&(await p.$$('.cs2-qa button')).length==4&&/Total Branch Cash/.test(await p.textContent('#cs2_tr')));
// count 100*50 = 5000 for CAD -> balanced
const q=await p.$$('.crc-bl input.crc-q, .crc-ut input');ok('denomination inputs present',q.length>5);
await p.evaluate(()=>{const i=document.querySelector('.crc-ut tbody tr input');i.value='50';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))});await p.waitForTimeout(400);
ok('live summary shows counted CAD',/5,000\.00/.test(await p.textContent('#cs2_sum')));
ok('card shows counted',/Counted 5,000\.00/.test(await p.textContent('#cs2_cg')));
await p.click('.cs2-cc[data-cc=USD]');await p.waitForTimeout(500);
ok('card selects USD block',/USD/.test(await p.textContent('.crc-bl')));
ok('hidden status table still present',await p.evaluate(()=>!!document.querySelector('#crc_ch')));
ok('no errors',errs.length==0);if(errs.length)console.log(errs);await b.close();process.exit(f?1:0)})();
