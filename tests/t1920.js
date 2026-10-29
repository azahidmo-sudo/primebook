const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));let f=0;const ck=(n,c)=>{if(!c){f++;console.log('FAIL',n)}};
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
// start from an old layout that had them swapped
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';window.B=S.br[0].id;S.users=[{name:'Z',role:'Owner',br:'All'}];S.me=0;S.j=[];
post({date:today(),br:B,acc:'cash|'+B,tt:'Receipt',memo:'Client A',vno:'RV-1',by:'Z',lines:[['1000',500,0],['3000',0,500]]});
S.dwl={Z:{ord:[],hid:[],sp:{},sec:{dbxfo:'tx',rec:'ov'},mig6:1,mig3:1,mig7:1}};view='dash';go()});await p.waitForTimeout(500);
const inTab=async t=>{await p.click('.dsv-i[data-dws='+t+']');await p.waitForTimeout(300);return p.evaluate(()=>[...document.querySelectorAll('.dws.act .dw')].map(d=>d.dataset.dwid))};
const ov=await inTab('ov'),tx=await inTab('tx');
ck('Financial overview under Financial overview',ov.includes('dbxfo')&&!tx.includes('dbxfo'));
ck('Recent transactions under Transactions',tx.includes('rec')&&!ov.includes('rec'));
const all=await p.evaluate(()=>[...document.querySelectorAll('.dw')].map(d=>d.dataset.dwid));ck('no duplicates',new Set(all).size==all.length);
ck('Recent transactions shows data',/Client A/.test(await p.innerText('.dw[data-dwid=rec]')));
await p.click('.dsv-i[data-dws=ov]');await p.waitForTimeout(300);
ck('Financial overview works',/Total Cash Balance/.test(await p.innerText('.dw[data-dwid=dbxfo]')));
await p.selectOption('.dw[data-dwid=dbxfo] select','all').catch(()=>{});
ck('currency filter control present',(await p.$$('.dw[data-dwid=dbxfo] select')).length>0);
console.log(f?'FAILED '+f:'ALL PASS',errs);await b.close()})();
