const {chromium}=require('playwright');let f=0;const ok=(n,c)=>{console.log(c?'ok':'FAIL',n);if(!c)f++};(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
// stale business day with a frozen opening, ledger then wiped (what the user's reset left behind)
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.users=[{name:'Zahid',role:'Owner',br:'All'}];S.me=0;S.base='CAD';S.j=[];S.bdays=[];S.apr=[];const B=S.br[0].id;
const a=accts().find(x=>x.br==B&&x.kind=='Cash');S.bdays.push({id:'x',br:B,date:today(),status:'In Progress',openedBy:'Z',openedAt:'2026-10-30T08:00:00',opening:{[a.id+'#CAD']:{amt:64729.25,base:64729.25,src:'Ledger'}},recon:{},vapp:{},audit:[]});view='dcw';ST_dcw();go()});await p.waitForTimeout(500);
ok('stale opening gone after empty ledger',!/64,729\.25/.test(await p.textContent('#m'))&&await p.evaluate(()=>S.bdays.length==1&&!Object.keys(S.bdays[0].opening).length));
ok('no errors',errs.length==0);if(errs.length)console.log(errs);await b.close();process.exit(f?1:0)})();
