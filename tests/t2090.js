const {chromium}=require('playwright');let f=0;const ok=(n,c)=>{console.log(c?'ok':'FAIL',n);if(!c)f++};(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1400,height:1000}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.addInitScript(()=>{window.secIpFetch=async()=>window.__ip||'203.0.113.9'});
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
const t=await p.evaluate(()=>{const s=__sec;return{a:s.okEntry('203.0.113.0/24'),b:s.okEntry('999.1.1.1'),c:s.inList('203.0.113.9',[{v:'203.0.113.0/24'}]),d:s.inList('203.0.114.9',[{v:'203.0.113.0/24'}]),e:s.inList('10.0.0.1',[{v:'10.0.0.1'}])}});
ok('cidr validation',t.a&&!t.b);ok('cidr matching',t.c&&!t.d&&t.e);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};S.users=[{name:'Zahid',role:'Owner',br:'All'},{name:'Cash',role:'Cashier',br:'All'}];S.me=0;view='set';go()});await p.waitForTimeout(400);
await p.evaluate(()=>{window.__stg=1;try{stgTab('ac')}catch(e){}});
// open Access & security tab through the app's own tab handler
const hasPanel=async()=>await p.locator('#secpn').count();
if(!await hasPanel()){const tabs=p.locator('button,a').filter({hasText:/^Access & security$/});if(await tabs.count())await tabs.first().click();await p.waitForTimeout(400)}
ok('panels shown in Access & security',await hasPanel()==1&&/IP restrictions/.test(await p.textContent('#m'))&&/Trusted browsers/.test(await p.textContent('#m')));
// cannot enforce before own address listed
await p.selectOption('#secmode','enforce');await p.waitForTimeout(200);
ok('enforce refused until own IP listed',await p.evaluate(()=>S.sec.ip.mode)!='enforce'&&/lock/i.test(await p.textContent('#secmsg')));
await p.click('[data-sec=ipme]');await p.waitForTimeout(200);
ok('own IP added',await p.evaluate(()=>S.sec.ip.list.map(x=>x.v).join())=='203.0.113.9');
await p.selectOption('#secmode','enforce');await p.waitForTimeout(200);
ok('enforce on',await p.evaluate(()=>S.sec.ip.mode)=='enforce');
await p.fill('#secip','bad');await p.click('[data-sec=ipadd]');ok('invalid entry rejected',/valid/i.test(await p.textContent('#secmsg')));
// trusted browser flow
await p.check('#sectb');await p.waitForTimeout(200);
ok('requiring trust auto-trusts this browser',await p.evaluate(()=>S.sec.tb.required&&S.sec.tb.list.length==1&&__sec.trusted(localStorage.getItem('fd_dev'))));
await p.click('[data-sec=tbrev]');await p.waitForTimeout(200);
ok('revoke',await p.evaluate(()=>!__sec.trusted(localStorage.getItem('fd_dev'))));
// guard: blocked from other address (non-owner)
const r=await p.evaluate(async()=>{S.me=1;window.__ip='198.51.100.7';window.secIp=null;window.secIpFetch=async()=>'198.51.100.7';const ok=await __sec.guard();const t=document.getElementById('secblk')?.textContent||'';document.getElementById('secblk')?.remove();return{ok,t}});
ok('cashier blocked on unlisted IP',r.ok===false&&/not allowed/.test(r.t));
const r2=await p.evaluate(async()=>{S.me=0;const ok=await __sec.guard();const t=document.getElementById('secblk')?.textContent||'';document.getElementById('secblk')?.remove();return{ok,t}});
ok('owner on unlisted IP not blocked by IP but untrusted browser blocked',r2.ok===false&&/not trusted/.test(r2.t)&&!/not allowed/.test(r2.t));
ok('no errors',errs.length==0);if(errs.length)console.log(errs);await b.close();process.exit(f?1:0)})();
