const {chromium}=require('playwright');let f=0;const ok=(n,c)=>{console.log(c?'ok':'FAIL',n);if(!c)f++};(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1500,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{d.accept()});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.users=[{name:'Zahid',role:'Owner',br:'All'}];S.me=0;S.base='CAD';S.j=[];S.closings=[];S.docs=S.docs||[];
S.tax=[{id:'g5',n:'GST',r:5}];S.cust.push({id:'sp1',type:'Supplier',name:'Acme Supply',status:'Active'},{id:'cu1',type:'Customer',name:'Bob Client',status:'Active'});
post({date:today(),br:S.br[0].id,acc:'cash|'+S.br[0].id,tt:'Receipt',memo:'dep',vno:'RV-1',by:'Z',lines:[['1000',5000,0],['3000',0,5000]]});view='pcd';go()});await p.waitForTimeout(400);
ok('page renders',/Purchases & Customer Deposits/.test(await p.textContent('.pcd')));
ok('summary card',/Accounts payable/.test(await p.textContent('.pcd-sum')));
ok('menu entry',await p.evaluate(()=>MENU.some(m=>m[0]=='pcd')));
// invoice
await p.evaluate(()=>{pcd.set('inv','sup','sp1',1);pcd.set('inv','ref','INV-1');ST=window.__pcd;});
await p.evaluate(()=>{const s=window.__pcd.inv;s.lines[0]={a:'6000',d:'Paper',q:'2',p:'50',t:'g5'};s.lines.push({a:'5000',d:'Stuff',q:'1',p:'100',t:''});go()});await p.waitForTimeout(300);
ok('total recalculated 205',/205\.00/.test(await p.textContent('#pcd_tot')));
const n0=await p.evaluate(()=>S.j.length);
await p.evaluate(()=>pcd.saveInv());await p.waitForTimeout(300);
const r=await p.evaluate(()=>{const e=S.j[S.j.length-1];return{tt:e.tt,dr:e.lines.reduce((a,l)=>a+l[1],0),cr:e.lines.reduce((a,l)=>a+l[2],0),n:S.j.length,ap:e.lines.some(l=>l[0]=='2000'&&l[2]==205),tax:e.lines.some(l=>l[0]=='1400'&&l[1]==5),doc:S.docs.length}});
ok('bill posted balanced',r.n==n0+1&&r.tt=='Bill'&&Math.abs(r.dr-r.cr)<.005&&r.ap&&r.tax&&r.doc==1);console.log(r);
ok('success message',/saved/.test(await p.textContent('.pcd-al')));
// duplicate
await p.evaluate(()=>{pcd.set('inv','sup','sp1',1);pcd.set('inv','ref','INV-1');window.__pcd.inv.lines[0]={a:'6000',d:'x',q:'1',p:'10',t:''};pcd.saveInv()});await p.waitForTimeout(200);
ok('duplicate blocked',/already recorded/.test(await p.textContent('.pcd-al'))&&await p.evaluate(()=>S.docs.length)==1);
// paid from
await p.evaluate(()=>{const a=accts().find(x=>x.kind=='Cash');const o=window.__pcd.inv;o.sup='sp1';o.ref='INV-2';o.pay=a.id;o.lines=[{a:'6000',d:'y',q:'1',p:'40',t:''}];pcd.saveInv()});await p.waitForTimeout(200);
ok('paid invoice credits cash',await p.evaluate(()=>{const e=S.j[S.j.length-1];return e.tt=='Bill'&&e.lines.some(l=>l[0]=='1000'&&l[2]==40)}));
// deposit
await p.evaluate(()=>{pcd.tab('dep')});await p.waitForTimeout(200);
await p.evaluate(()=>{const a=accts().find(x=>x.kind=='Cash');const d=window.__pcd.dep;d.cust='cu1';d.acct=a.id;d.amt='250';pcd.saveDep()});await p.waitForTimeout(300);
ok('deposit posted',await p.evaluate(()=>{const e=S.j[S.j.length-1];return e.tt=='Deposit'&&e.cust=='cu1'&&e.lines.some(l=>l[0]=='1200'&&l[2]==250)}));
ok('customer holds credit',await p.evaluate(()=>cbalance('cu1',S.j)<-249));
ok('summary shows deposit',/250\.00/.test(await p.textContent('.pcd-sum')));
await p.setViewportSize({width:390,height:800});await p.evaluate(()=>{pcd.tab('inv')});await p.waitForTimeout(300);
ok('mobile no horizontal scroll',await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
ok('no errors',errs.length==0);if(errs.length)console.log(errs);await b.close();process.exit(f?1:0)})();
