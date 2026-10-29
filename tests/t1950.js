const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));let f=0;const ck=(n,c)=>{if(!c){f++;console.log('FAIL',n)}};
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.base='CAD';window.B=S.br[0].id;S.users=[{name:'Z',role:'Owner',br:'All'}];S.me=0;S.dwl={Z:{ord:[],hid:[],sp:{},sec:{},mig6:1,mig3:1,mig7:1,mig8:1}};view='dash';go()});await p.waitForTimeout(500);
ck('not under Financial Overview',!(await p.evaluate(()=>!!document.querySelector('.dws.act .dtp-ha'))));
await p.click('.dsv-i[data-dws=rp]');await p.waitForTimeout(300);
ck('actions under Reports (health score shows with ledger data)',await p.evaluate(()=>!!document.querySelector('.dws.act[data-dws=rp] .dtp-ha .dtp-b.pri')));
const all=await p.evaluate(()=>[...document.querySelectorAll('.dw')].map(d=>d.dataset.dwid));ck('no duplicate',new Set(all).size==all.length);
await p.click('.dtp-ha .dtp-b[data-go=rpt]');await p.waitForTimeout(300);ck('View Reports works',await p.evaluate(()=>view)=='rpt');
console.log(f?'FAILED '+f:'ALL PASS',errs);await b.close()})();
