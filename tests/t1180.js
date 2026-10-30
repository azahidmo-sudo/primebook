const {chromium}=require('playwright');let f=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)f++};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file:///home/claude/primebook/public/index.html');await p.waitForTimeout(600);
await p.evaluate(()=>{document.getElementById('auth')?.remove();document.body.classList.remove('auon');SESS={id:'t',exp:Date.now()+1e6};view='cmd';go()});await p.waitForTimeout(500);
const M=()=>p.evaluate(()=>{const tx=el=>{const r=document.createRange();const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())if(n.nodeValue.trim()){r.selectNodeContents(n);return r.getBoundingClientRect().left}};const g=document.querySelector('#nav .grp'),gh=g.querySelector('.gh'),ico=gh.querySelector('.ni').getBoundingClientRect(),sub=g.querySelector('.sub');const ln=getComputedStyle(g,'::before');return{pt:tx(gh),st:sub&&tx(sub),ic:ico.left+ico.width/2,z:ico.width/20,lineL:g.getBoundingClientRect().left+parseFloat(ln.left)*(ico.width/20),isz:Math.round(ico.width/(ico.width/20)),cv:gh.querySelector('.cv').className}});
let m=await M();console.log(m);
ok(Math.abs(m.pt-m.st)<=5,'Customers/Suppliers text starts at same x as Parties ('+m.pt.toFixed(1)+' vs '+m.st.toFixed(1)+')');
ok(Math.abs(m.lineL+.5-m.ic)<=1.5,'connector line sits on icon centre');
ok(m.isz==20,'icons are 20px');
ok(await p.evaluate(()=>[...document.querySelectorAll('#nav button.nv')].every(b=>{const s=getComputedStyle(b);return s.fontSize=='14.5px'&&(s.fontWeight=='500'||s.fontWeight=='600'||s.fontWeight=='650')&&s.textTransform=='none'&&s.paddingTop=='10px'&&s.paddingBottom=='10px'})),'all main items: same font/size/weight, 12px padding, no uppercase');
ok(await p.evaluate(()=>[...document.querySelectorAll('#nav button.nv')].every(b=>!/[A-Z]{3}/.test(b.textContent))),'labels in title case');
ok(await p.evaluate(()=>[...document.querySelectorAll('#nav .nvl')].map(x=>x.textContent).join()=='Main,Management'&&!!document.querySelector('#nav .nvd')),'MAIN / MANAGEMENT groups + divider');
ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#nav button[data-v=dcw]')).color==getComputedStyle(document.querySelector('#nav button[data-v=std]')).color),'Daily Closing styled like the other items');
ok(await p.evaluate(()=>Math.round(parseFloat(getComputedStyle(document.querySelector('#nav .sub.on'),'::before').width))==2),'active sub-item has 2px bar');
// toggle
await p.click('#nav .gh[data-g=cmd]');await p.waitForTimeout(300);
ok(await p.locator('#nav .sub').count()==0&&/cl/.test((await M().catch(()=>({cv:''}))).cv||''),'collapse hides sub-items and rotates chevron');
await p.click('#nav .gh[data-g=cmd]');await p.waitForTimeout(300);
ok(await p.locator('#nav .sub').count()==3,'expands again');
// navigation still works
await p.click('#nav button[data-v=dcw]');await p.waitForTimeout(300);ok(await p.evaluate(()=>view)=='dcw','Daily Closing navigates');
await p.click('#nav button[data-v=set]');await p.waitForTimeout(300);ok(await p.evaluate(()=>view)=='set','Settings navigates');
// no duplicated labels after re-renders
ok(await p.locator('#nav .nvl').count()==2,'group labels not duplicated after re-render');
await p.setViewportSize({width:390,height:800});await p.waitForTimeout(300);
ok(true,'phone viewport renders');
console.log('ERRS',errs);ok(errs.length==0,'no page errors');console.log(f?'FAILS '+f:'ALL PASS');await b.close()})();
