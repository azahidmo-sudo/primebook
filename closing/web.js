/* =====================================================================
   Web platform layer for /closing
   Sign-in (Supabase email + password), books and team, server sync.
   Replaces the artifact-only sync block of ui.js at build time.
   ===================================================================== */
const URL_=window.__DC_API||'https://htrlqotaetdwccervhmd.supabase.co',AKEY='sb_publishable_GjGlB8yDm7Rdg7WjB5uPAQ_Y1KwrDWB';
const SKEY='pb_closing_sb',BKEY='pb_closing_book',IDLE=15*60*1000,POLL=5000;
const ls={g:k=>{try{return localStorage.getItem(k)}catch(e){return null}},s:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},d:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const enc=encodeURIComponent;
let SB=null;try{SB=JSON.parse(ls.g(SKEY))}catch(e){}
let idleT=Date.now(),lastTouch=0,hb=null,pollT=null;
const G={screen:'loading',err:'',ok:'',email:'',busy:false,books:[]};

/* ---------- API ---------- */
async function api(path,o){o=o||{};const h={apikey:AKEY,'Content-Type':'application/json'};if(SB&&SB.access_token&&!o.anon)h.Authorization='Bearer '+SB.access_token;if(o.prefer)h.Prefer=o.prefer;
 const r=await fetch(URL_+path,{method:o.method||'GET',headers:h,body:o.body?JSON.stringify(o.body):undefined,cache:'no-store'});let j=null;try{j=await r.json()}catch(e){}
 if(!r.ok){const er=new Error((j&&(j.msg||j.message||j.error_description||j.error))||('Request failed ('+r.status+')'));er.status=r.status;er.code=j&&(j.error_code||j.code);throw er}return j}
const fixS=j=>({access_token:j.access_token,refresh_token:j.refresh_token,expires_at:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600),user:j.user||(SB&&SB.user)});
const keep=s=>{SB=s;s?ls.s(SKEY,JSON.stringify(s)):ls.d(SKEY)};
async function refresh(){if(!SB||!SB.refresh_token)throw Object.assign(new Error('Signed out'),{status:401});
 try{keep(fixS(await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:SB.refresh_token},anon:1})))}catch(e){if(e.status>=400&&e.status<500)keep(null);throw e}}
async function rest(p,o){if(!SB)throw Object.assign(new Error('Signed out'),{status:401});if(SB.expires_at-60<Date.now()/1000)await refresh();
 try{return await api('/rest/v1/'+p,o)}catch(e){if(e.status==401&&/PB_SESSION/.test(e.message||'')){expired();throw e}if(e.status==401){await refresh();return await api('/rest/v1/'+p,o)}throw e}}
const rpc=(fn,body)=>rest('rpc/'+fn,{method:'POST',body:body||{}});
function friendly(e){const m=String(e&&e.message||'');
 if(e instanceof TypeError)return'Cannot reach the server. Check your internet connection and try again.';
 if(/invalid login/i.test(m))return'Email or password is incorrect.';
 if(/not confirmed/i.test(m))return'Confirm your email first: open the message we sent you and tap the link.';
 if(e&&e.status==429||/rate limit|too many/i.test(m))return'Too many attempts. Wait a few minutes and try again.';
 if(/already registered|already been registered/i.test(m))return'That email already has an account. Sign in instead.';
 if(/password/i.test(m)&&/(short|least|weak|characters)/i.test(m))return'Choose a stronger password of at least 10 characters.';
 if(/PB_SESSION/.test(m))return'Your session ended. Please sign in again.';
 if(/dc_members_name_uq|duplicate key/i.test(m))return'Someone in this book already uses that name. Use a different display name.';
 if(/DC_CONFLICT/.test(m))return'Someone else saved first. Your screen now shows the latest books; repeat your last step if it is missing.';
 if(/Could not find the function|does not exist|PGRST202|404/i.test(m)||e&&e.status==404)return'The Daily Closing tables are not installed yet. Run supabase/daily-closing.sql once in the Supabase SQL Editor.';
 const d=m.match(/^DC_[A-Z_]+:?\s*(.*)$/);if(d)return d[1]?d[1].charAt(0).toUpperCase()+d[1].slice(1)+(/[.!?]$/.test(d[1])?'':'.'):'The server refused this change.';
 return m||'Something went wrong. Please try again.'}

/* ---------- session: 15-minute idle sign-out + PrimeBook session guard heartbeat ---------- */
function expired(msg){stopBook();keep(null);clearInterval(hb);gate('login',{err:msg||'Your session ended for security. Please sign in again.'})}
function startSession(){idleT=Date.now();clearInterval(hb);hb=setInterval(async()=>{if(!SB)return;if(Date.now()-idleT>IDLE){signOut('You were signed out after 15 minutes without activity.');return}
 if(Date.now()-lastTouch>60000){lastTouch=Date.now();try{await rest('rpc/pb_session_touch',{method:'POST',body:{p_idle_min:15,p_idle_s:Math.min(900,Math.round((Date.now()-idleT)/1000))}})}catch(e){if(e.status==404)lastTouch=Date.now()+3600e3}}},15000)}
['click','keydown','touchstart','scroll'].forEach(ev=>document.addEventListener(ev,()=>{idleT=Date.now()},{passive:true}));
async function signOut(msg){stopBook();try{if(SB)await api('/auth/v1/logout',{method:'POST'})}catch(e){}keep(null);clearInterval(hb);gate('login',{ok:msg||'You have been signed out.'})}
const myId=()=>SB&&SB.user&&SB.user.id||'';
const myEmail=()=>(SB&&SB.user&&SB.user.email||'').toLowerCase();

/* ---------- book state ---------- */
const SYNC={gen:0,mode:'loading',book:null,role:'',me:null,members:[],saves:null,baseRev:0,busy:false,queue:Promise.resolve(),last:{},meta:{},resetArm:false,canEdit:false,updatedName:'',updatedAt:''};
const ROLE_TITLE={Owner:'Owner · Manager rights',Manager:'Branch Manager · Approver',Teller:'Teller · Preparer',Finance:'Finance · Head-office accountant',Auditor:'Internal auditor · Read only'};
const WRITERS=['Owner','Manager','Teller','Finance'],RATE_EDIT=['Owner','Manager','Finance'];
function persist(){}
function names(){}
const acctName=id=>{if(!id)return'';const m=SYNC.members.find(x=>x.user_id==id);return m?m.display_name+' ('+m.email+')':'a former member'};
function syncLabel(){const m={loading:['Loading…','p-mute'],online:['Saved · live','p-ok'],saving:['Saving…','p-warn'],readonly:['Read only · live','p-info'],local:['This browser only','p-warn'],error:['Not saved · retrying','p-bad']}[SYNC.mode]||['','p-mute'];return`<span class="pill ${m[1]}">${m[0]}</span>`}
function bcode(b){return(b.book_id||b.id||'').replace(/[^a-z0-9]/gi,'').slice(0,3).toUpperCase()||'BR'}
function applyMembers(mem){SYNC.members=mem||[];Object.keys(USERS).filter(k=>k.startsWith('m:')).forEach(k=>delete USERS[k]);
 SYNC.members.forEach(m=>{USERS['m:'+m.email]={name:m.display_name,role:m.role=='Owner'?'Manager':m.role,title:ROLE_TITLE[m.role]||m.role}});
 SYNC.me=SYNC.members.find(m=>m.email==myEmail()&&m.active)||null;SYNC.role=SYNC.me?SYNC.me.role:'';UID=SYNC.me?'m:'+SYNC.me.email:UID;SYNC.canEdit=SYNC.role=='Owner'}
function applyBoard(b){if(!b)return;Object.keys(b).forEach(c=>{if(BOARD[c]&&+b[c].b>0&&+b[c].s>0){BOARD[c].b=+b[c].b;BOARD[c].s=+b[c].s}})}
function dayJson(d){return JSON.stringify({day:d,audit:E.B.audit.filter(a=>a.date==d.date)})}
async function fetchBook(id){const st=await rest('dc_state?book_id=eq.'+enc(id)+'&select=rev,meta,updated_name,updated_at');
 if(!st||!st.length)return null;
 const [days,mem]=await Promise.all([rest('dc_days?book_id=eq.'+enc(id)+'&select=date,day,audit&order=date.asc'),rest('dc_members?book_id=eq.'+enc(id)+'&select=email,user_id,display_name,role,active&order=display_name.asc')]);
 return{st:st[0],days:days||[],mem:mem||[]}}
function applyBook(x){const m=x.st.meta||{};SYNC.meta=m;SYNC.baseRev=x.st.rev||0;SYNC.updatedName=x.st.updated_name||'';SYNC.updatedAt=x.st.updated_at||'';applyMembers(x.mem);applyBoard(m.board);
 const by={};x.days.forEach(r=>by[r.date]=r);const dates=(m.dates||[]).filter(d=>by[d]);
 if(!dates.length){E=null;SYNC.last={};return false}
 const days=[],audit=[],last={};dates.forEach(dt=>{const r=by[dt];days.push(r.day);audit.push(...(r.audit||[]));last[dt]=JSON.stringify({day:r.day,audit:r.audit||[]})});
 audit.sort((a,b)=>a.seq-b.seq);const wasLatest=!E||isLatest(),cur=wasLatest?days.length-1:Math.min(E.B.cur,days.length-1);
 E=Book({v:2,days,cur,seq:m.seq||{TX:0,ADJ:0},audit});E.real=true;E.acct=myId();SYNC.last=last;
 SYNC.mode=WRITERS.includes(SYNC.role)?'online':'readonly';return true}
async function reload(quiet){const b=SYNC.book;if(!b||SYNC.local)return;let x;const g=SYNC.gen;
 try{x=await fetchBook(b.book_id)}catch(e){if(!quiet)toast({ok:false,msg:friendly(e)});return}
 if(g!==SYNC.gen||SYNC.busy||SYNC.book!==b)return; // a local change happened meanwhile: its save decides
 if(!x||!x.mem.some(m=>m.email==myEmail()&&m.active)){stopBook();ls.d(BKEY);await showBooks({err:'You no longer have access to '+b.name+'. Ask the book owner if this is unexpected.'});return}
 const had=!!E;if(applyBook(x)){showApp();render()}else{if(had||G.screen!='setup')gate('setup')}}
function stopBook(){clearInterval(pollT);pollT=null;SYNC.book=null;E=null}
function startPoll(){clearInterval(pollT);pollT=setInterval(async()=>{if(!SYNC.book||SYNC.busy||document.hidden)return;
 try{const r=await rest('dc_state?book_id=eq.'+enc(SYNC.book.book_id)+'&select=rev');if(!r||!r.length){reload(true);return}if(r[0].rev!==SYNC.baseRev&&!SYNC.busy)reload(true)}catch(e){}},POLL)}
function metaOut(extra){return Object.assign({},SYNC.meta,{v:2,dates:E?E.B.days.map(d=>d.date):[],seq:E?{...E.B.seq}:{TX:0,ADJ:0},board:Object.fromEntries(CCYS.map(c=>[c,{b:BOARD[c].b,s:BOARD[c].s}]))},extra||{})}
async function writeAll(note,extra){const days=[];if(E)for(const d of E.B.days){const j=dayJson(d);if(SYNC.last[d.date]!==j)days.push({date:d.date,day:d,audit:E.B.audit.filter(a=>a.date==d.date),j})}
 const meta=metaOut(extra);const rev=await rpc('dc_save',{p_book:SYNC.book.book_id,p_base_rev:SYNC.baseRev,p_meta:meta,p_days:days.map(({j,...r})=>r),p_note:(note||'').slice(0,200)});
 days.forEach(d=>SYNC.last[d.date]=d.j);SYNC.meta=meta;SYNC.baseRev=+rev;SYNC.updatedName=SYNC.me?SYNC.me.display_name:'';SYNC.updatedAt=new Date().toISOString()}
function save(note,extra){if(!SYNC.book)return Promise.resolve(false);SYNC.gen++;
 if(SYNC.local){const ok=localSave();if(ok){SYNC.updatedAt=new Date().toISOString();SYNC.updatedName=SYNC.me?SYNC.me.display_name:''}else toast({ok:false,msg:'This browser refused to save (storage full or private window). Export the reports you need.'});if(E)render();return Promise.resolve(ok)}
 return SYNC.queue=SYNC.queue.then(async()=>{SYNC.busy=true;SYNC.mode='saving';if(E)header();let ok=true;
  try{await writeAll(note,extra);SYNC.mode='online'}
  catch(e){ok=false;const m=String(e&&e.message||'');
   if(e instanceof TypeError||e.status>=500){SYNC.mode='error';toast({ok:false,msg:'Could not reach the server, so your last step is not saved yet. It will be sent with your next action, or press Save now on the Dashboard.'})}
   else{toast({ok:false,msg:friendly(e)});SYNC.busy=false;SYNC.gen++;await reload(true)}}
  finally{SYNC.busy=false;if(E&&SYNC.book)render()}return ok})}

/* ---------- UI: gate screens (sign-in, books, setup) ---------- */
const H=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function showApp(){$('#gate').hidden=true;$('#shell').hidden=false}
function gate(screen,o){G.screen=screen;G.err=(o&&o.err)||'';G.ok=(o&&o.ok)||'';G.busy=false;$('#shell').hidden=true;$('#gate').hidden=false;drawGate();window.scrollTo(0,0)}
const msgs=()=>`${G.err?`<div class="note bad" role="alert"><span class="ic bad">!</span><span>${H(G.err)}</span></div>`:''}${G.ok?`<div class="note ok" role="status"><span class="ic ok">✓</span><span>${H(G.ok)}</span></div>`:''}`;
const todayPT=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Vancouver'});
function drawGate(){const g=$('#gate'),s=G.screen,em=H(G.email||myEmail());let body='';
 const top=`<div class="g-brand"><b>BRIMAPAY · Daily Closing</b><small>PrimeBook · cash, FX and Taaj closing for each branch</small></div>`;
 if(s=='loading')body=`<div class="g-card"><p class="mu">Loading…</p></div>`;
 else if(s=='login')body=`<form class="g-card" data-g="login" novalidate><h1>Sign in</h1><p class="mu">Use the email your manager added to the branch book.</p>${msgs()}
  <div class="field"><label for="g-em">Email</label><input id="g-em" name="em" type="email" autocomplete="username" value="${em}" required></div>
  <div class="field"><label for="g-pw">Password</label><input id="g-pw" name="p" type="password" autocomplete="current-password" required></div>
  <div class="btns"><button class="pri" type="submit">Sign in</button></div>
  <p class="g-links"><button type="button" class="lnk" data-gs="signup">Create an account</button> · <button type="button" class="lnk" data-gs="forgot">Forgot password?</button></p>
  <div class="g-alt"><button type="button" data-gs="local">Use it now in this browser — no account needed</button><span class="mu">Every feature works. Saved on this device only, with a staff switch to act as each role.</span></div></form>`;
 else if(s=='signup')body=`<form class="g-card" data-g="signup" novalidate><h1>Create your account</h1><p class="mu">Use the same email your manager added to the book. We will send you a link to confirm it.</p>${msgs()}
  <div class="field"><label for="g-em">Email</label><input id="g-em" name="em" type="email" autocomplete="username" value="${em}" required></div>
  <div class="field"><label for="g-pw">Password (at least 10 characters)</label><input id="g-pw" name="p" type="password" autocomplete="new-password" minlength="10" required></div>
  <div class="field"><label for="g-pw2">Repeat password</label><input id="g-pw2" name="p2" type="password" autocomplete="new-password" required></div>
  <div class="btns"><button class="pri" type="submit">Create account</button></div><p class="g-links"><button type="button" class="lnk" data-gs="login">I already have an account</button></p></form>`;
 else if(s=='check')body=`<div class="g-card"><h1>Check your email</h1><p>We sent a confirmation link to <b>${em}</b>. Open it on this device, then sign in.</p><div class="btns"><button type="button" class="pri" data-gs="login">Go to sign in</button></div></div>`;
 else if(s=='forgot')body=`<form class="g-card" data-g="forgot" novalidate><h1>Reset your password</h1>${msgs()}<div class="field"><label for="g-em">Email</label><input id="g-em" name="em" type="email" autocomplete="username" value="${em}" required></div>
  <div class="btns"><button class="pri" type="submit">Send reset link</button></div><p class="g-links"><button type="button" class="lnk" data-gs="login">Back to sign in</button></p></form>`;
 else if(s=='reset')body=`<form class="g-card" data-g="reset" novalidate><h1>Choose a new password</h1>${msgs()}<div class="field"><label for="g-pw">New password (at least 10 characters)</label><input id="g-pw" name="p" type="password" autocomplete="new-password" required></div>
  <div class="field"><label for="g-pw2">Repeat password</label><input id="g-pw2" name="p2" type="password" autocomplete="new-password" required></div><div class="btns"><button class="pri" type="submit">Save password</button></div></form>`;
 else if(s=='books'&&G.missing)body=`<div class="g-card g-wide"><div class="g-head"><div><h1>Shared books are not switched on yet</h1><p class="mu">Signed in as <b>${H(myEmail())}</b></p></div><button type="button" class="ghost" data-gs="signout">Sign out</button></div>
  <div class="note info"><span class="ic info">i</span><span>You can start working right now in this browser with every feature. Sharing the books with your staff online needs one step by the person who manages your Supabase account.</span></div>
  <div class="btns"><button type="button" class="pri" data-gs="local">Start working now (this browser)</button><button type="button" data-gs="refresh">Check again</button></div>
  ${howOnline()}</div>`;
 else if(s=='books'){const bs=G.books;body=`<div class="g-card g-wide"><div class="g-head"><div><h1>Your branch books</h1><p class="mu">Signed in as <b>${H(myEmail())}</b></p></div><button type="button" class="ghost" data-gs="signout">Sign out</button></div>${msgs()}
  ${bs.length?`<div class="g-books">${bs.map(b=>`<button type="button" class="g-book" data-open="${H(b.book_id)}"><b>${H(b.name)}</b><span>${H(b.display_name)} · ${H(ROLE_TITLE[b.role]||b.role)}</span><em>Open →</em></button>`).join('')}</div>`
   :`<div class="note info"><span class="ic info">i</span><span><b>No books yet for ${H(myEmail())}.</b> If you work at a branch, ask your manager to add this exact email on their Team page, then press Refresh. If you are setting up a branch, create its book below.</span></div><div class="btns"><button type="button" data-gs="refresh">Refresh</button></div>`}
  <details class="g-new" ${bs.length?'':'open'}><summary>Create a new branch book</summary>
  <form data-g="create" novalidate class="fgrid"><div class="field"><label for="g-bn">Branch name</label><input id="g-bn" name="bn" placeholder="Vancouver" maxlength="80" required></div>
   <div class="field"><label for="g-bc">Book code (letters, digits, dashes)</label><input id="g-bc" name="bc" placeholder="vancouver" maxlength="40" required pattern="[a-z0-9][a-z0-9-]{1,39}"></div>
   <div class="field"><label for="g-dn">Your name as it appears in the ledger</label><input id="g-dn" name="dn" maxlength="60" required></div>
   <div class="field"><label>&nbsp;</label><button class="pri" type="submit">Create book</button></div></form>
   <p class="mu" style="font-size:12.5px">You become the book's Owner. You then add your staff by email and give each a role: Teller, Manager, Finance or Auditor.</p></details></div>`}
 else if(s=='setup'){const b=SYNC.book||{},own=SYNC.local||['Owner','Manager'].includes(SYNC.role);
  body=`<div class="g-card g-wide"><div class="g-head"><div><span class="eyebrow">${H(b.name)} · first business day</span><h1>Set up the book</h1></div><div class="btns">${SYNC.local?'<button type="button" class="ghost" data-gs="leave">Back</button>':'<button type="button" class="ghost" data-gs="books">All books</button><button type="button" class="ghost" data-gs="signout">Sign out</button>'}</div></div>${msgs()}
  ${SYNC.local?localNote():''}${own?`<p>Enter what the branch holds at the start of its first business day on this system. Everything after that is carried forward automatically from each locked close.</p>
  <form data-g="setup" novalidate><div class="fgrid">
   <div class="field"><label for="s-date">First business date</label><input id="s-date" name="date" type="date" value="${todayPT()}" required></div><div></div>
   ${[['1000','Cash on hand – till (CAD)'],['1005','Safe – CAD'],['1010','Bank – RBC operating (CAD)'],['1210','Due from Taaj (CAD)']].map(([c,l])=>`<div class="field"><label for="s-${c}">${l}</label><input id="s-${c}" name="a${c}" inputmode="decimal" placeholder="0.00"></div>`).join('')}</div>
   <h3 style="margin:14px 0 6px">Foreign currency on hand</h3><p class="mu" style="margin:0 0 8px">Amount in the currency, and what it cost in CAD (its book value).</p>
   <div class="fgrid">${CCYS.map(c=>`<div class="field"><label for="s-fc-${c}">${c} amount</label><input id="s-fc-${c}" name="fc${c}" inputmode="decimal" placeholder="0"></div><div class="field"><label for="s-cad-${c}">${c} cost in CAD</label><input id="s-cad-${c}" name="cad${c}" inputmode="decimal" placeholder="0.00"></div>`).join('')}</div>
   <p class="mu" id="s-tot" style="margin-top:10px"></p>
   <div class="btns"><button class="pri" type="submit">Create the first business day</button></div></form>
   <details class="g-new"><summary>Or practise first with the training sample</summary><p>Loads a worked example day (27 Oct 2026, staff Farhan and Amina) with transactions, counts and a variance. Use a separate training book for this, not your live branch book: an owner can erase a book only while no day in it is locked.</p><div class="btns"><button type="button" data-gs="sample">Load the training sample</button></div></details>`
  :`<div class="note info"><span class="ic info">i</span><span>This book has no business days yet. Its owner or a manager sets it up with the opening balances. This page updates by itself when they do.</span></div>`}</div>`}
 g.innerHTML=`<div class="g-wrap">${top}${body}<p class="g-foot">PrimeBook · BRIMAPAY Financial Services Inc. · <a href="/">Back to PrimeBook</a></p></div>`;
 if(s=='setup')setupTotal();const f=g.querySelector('input:not([type=hidden])');if(f&&['login','signup','forgot','reset'].includes(s)&&!f.value)f.focus()}
const num=v=>{const x=String(v==null?'':v).replace(/[, ]/g,'');return x===''?0:+x};
function setupTotal(){const f=document.querySelector('form[data-g=setup]');if(!f)return;let t=0,bad=false;
 ['1000','1005','1010','1210'].forEach(c=>{const v=num(f['a'+c].value);if(!isFinite(v)||v<0)bad=true;else t+=v});
 CCYS.forEach(c=>{const a=num(f['fc'+c].value),k=num(f['cad'+c].value);if(!isFinite(a)||!isFinite(k)||a<0||k<0||(a>0)!=(k>0))bad=true;else t+=k});
 const el=$('#s-tot');if(el)el.innerHTML=bad?'<span style="color:var(--bad)">Check the figures: amounts cannot be negative, and each currency needs both its amount and its CAD cost.</span>':`Total assets CAD <b>${fm(t)}</b>, balanced by Owner's capital (3000) CAD ${fm(t)}.`;return bad?null:r2(t)}

async function doLogin(f){const em=f.em.value.trim().toLowerCase(),p=f.p.value;G.email=em;if(!em||!p)return gate('login',{err:'Enter your email and password.'});
 busy(1);try{const j=await api('/auth/v1/token?grant_type=password',{method:'POST',body:{email:em,password:p},anon:1});keep(fixS(j));await afterSignIn()}catch(e){gate('login',{err:friendly(e)})}}
async function doSignup(f){const em=f.em.value.trim().toLowerCase(),p=f.p.value,p2=f.p2.value;G.email=em;
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return gate('signup',{err:'Enter a valid email address.'});if(p.length<10)return gate('signup',{err:'Use at least 10 characters for the password.'});if(p!==p2)return gate('signup',{err:'The two passwords do not match.'});
 busy(1);try{const j=await api('/auth/v1/signup?redirect_to='+enc(location.origin+'/closing'),{method:'POST',body:{email:em,password:p},anon:1});
  if(j&&j.access_token){keep(fixS(j));await afterSignIn()}else gate('check')}
 catch(e){if(/already/i.test(e.message||''))gate('login',{err:'That email already has an account. Sign in instead.'});else gate('signup',{err:friendly(e)})}}
async function doForgot(f){const em=f.em.value.trim().toLowerCase();G.email=em;if(!em)return gate('forgot',{err:'Enter your email.'});busy(1);
 try{await api('/auth/v1/recover?redirect_to='+enc(location.origin+'/closing'),{method:'POST',body:{email:em},anon:1})}catch(e){}
 gate('login',{ok:'If that email has an account, a reset link is on its way.'})}
async function doReset(f){const p=f.p.value,p2=f.p2.value;if(p.length<10)return gate('reset',{err:'Use at least 10 characters.'});if(p!==p2)return gate('reset',{err:'The two passwords do not match.'});busy(1);
 try{await api('/auth/v1/user',{method:'PUT',body:{password:p}});await afterSignIn('Password saved.')}catch(e){gate('reset',{err:friendly(e)})}}
async function doCreate(f){const bn=f.bn.value.trim(),bc=f.bc.value.trim().toLowerCase(),dn=f.dn.value.trim();
 if(!bn||!dn)return showBooks({err:'Enter the branch name and your name.'});if(!/^[a-z0-9][a-z0-9-]{1,39}$/.test(bc))return showBooks({err:'The book code needs 2 to 40 lowercase letters, digits or dashes, for example vancouver.'});
 busy(1);try{await rpc('dc_create_book',{p_id:bc,p_name:bn,p_display:dn});await openBook(bc)}catch(e){showBooks({err:friendly(e)})}}
async function doSetup(f){const tot=setupTotal();if(tot==null)return toastG('Check the opening figures first.');if(!(tot>0))return toastG('Enter at least one opening balance.');
 const date=f.date.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return toastG('Choose the first business date.');
 const op={};['1000','1005','1010','1210'].forEach(c=>{const v=r2(num(f['a'+c].value));if(v)op[c]={fc:v,cad:v}});
 CCYS.forEach(c=>{const a=num(f['fc'+c].value),k=r2(num(f['cad'+c].value));if(a)op[FXA[c]]={fc:a,cad:k}});op['3000']={fc:-tot,cad:-tot};
 const me=SYNC.me.display_name,now=new Date().toLocaleString('en-CA',{timeZone:'America/Vancouver',hour12:false}).replace(',','').slice(0,16);
 E=blankBook(date,op,{ref:'SETUP-'+bcode(SYNC.book),date:'set-up',approvedBy:me,approvedAt:now,locked:true});E.real=true;E.acct=myId();
 busy(1);const ok=await save('Book set up: first business day '+date+', total assets CAD '+fm(tot),{setup:{by:me,at:new Date().toISOString(),kind:'opening'}});
 if(ok){VIEW='dashboard';showApp();render();toast({ok:true,msg:'Book set up. Open the day to start.'})}else{E=null;gate('setup',{err:'The book was not set up. Try again.'})}}
async function doSample(){E=seed(myId());E.real=true;busy(1);const ok=await save('Book set up with the training sample',{setup:{by:SYNC.me.display_name,at:new Date().toISOString(),kind:'sample'}});
 if(ok){VIEW='dashboard';showApp();render();toast({ok:true,msg:'Training sample loaded: 27 Oct 2026 at the Review variances step.'})}else{E=null;gate('setup',{err:'The sample was not loaded. Try again.'})}}
function toastG(m){G.err=m;drawGate()}
const busy=b=>{G.busy=!!b;document.querySelectorAll('#gate button,#gate input').forEach(x=>x.disabled=!!b)};

async function afterSignIn(okMsg){startSession();try{const u=await api('/auth/v1/user');if(u&&u.id){SB.user=u;keep(SB)}}catch(e){}
 await showBooks({ok:okMsg||''},true)}
async function showBooks(o,auto){gate('loading');G.missing=false;try{await rpc('dc_claim');G.books=await rpc('dc_my_books')||[]}catch(e){G.books=[];if(e.status==401&&!SB)return;G.missing=e.status==404||/PGRST202|Could not find|does not exist/i.test(e.message||'');return gate('books',G.missing?{}:{err:friendly(e)})}
 const want=ls.g(BKEY);if(auto&&G.books.length){const b=G.books.find(x=>x.book_id==want)||(G.books.length==1?G.books[0]:null);if(b)return openBook(b.book_id)}
 gate('books',o)}
async function openBook(id){gate('loading');let b;try{G.books=await rpc('dc_my_books')||[]}catch(e){}b=G.books.find(x=>x.book_id==id);if(!b)return gate('books',{err:'That book is not available to you.'});
 SYNC.book=b;ls.s(BKEY,id);configure({branch:b.name,code:bcode(b)});E=null;SYNC.saves=null;let x;
 try{x=await fetchBook(id)}catch(e){return gate('books',{err:friendly(e)})}if(!x)return gate('books',{err:'That book is not available to you.'});
 startPoll();if(applyBook(x)){VIEW=VIEWS.some(v=>v[0]==(location.hash||'').slice(1))?location.hash.slice(1):'dashboard';showApp();render()}else gate('setup')}

document.addEventListener('submit',e=>{const f=e.target.closest('form[data-g]');if(!f)return;e.preventDefault();if(G.busy)return;
 ({login:doLogin,signup:doSignup,forgot:doForgot,reset:doReset,create:doCreate,setup:doSetup})[f.dataset.g](f)});
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('form[data-g=setup]'))setupTotal();
 if(e.target.id=='g-bn'){const c=$('#g-bc');if(c&&!c.dataset.touched)c.value=e.target.value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)}
 if(e.target.id=='g-bc')e.target.dataset.touched='1'});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.gs){const s=b.dataset.gs;if(G.busy)return;
  if(SYNC.local&&(s=='signout'||s=='books'))return leaveLocal();if(s=='signout')return signOut();if(s=='books'){stopBook();ls.d(BKEY);return showBooks({})}if(s=='refresh')return showBooks({},true);if(s=='sample')return doSample();
  if(s=='savenow')return save('Retry save');if(s=='local')return startLocal();if(s=='leave')return leaveLocal();return gate(s)}
 if(b.dataset.open)return openBook(b.dataset.open)});

/* ---------- in-book pages: Team and Settings ---------- */
async function loadSaves(){try{SYNC.saves=await rest('dc_saves?book_id=eq.'+enc(SYNC.book.book_id)+'&select=rev,name,email,role,note,at&order=id.desc&limit=60')}catch(e){SYNC.saves=[]}if(VIEW=='team')render()}
function vTeam(){if(SYNC.local)return vTeamLocal();if(SYNC.saves==null){SYNC.saves=[];loadSaves()}const own=SYNC.role=='Owner',link=location.origin+'/closing';
 return`<section class="sec"><div class="sec-h"><div><span class="eyebrow">${H(SYNC.book.name)} · who can use this book</span><h2>Team</h2></div><p>${SYNC.members.filter(m=>m.active).length} active</p></div>
 <p class="lede">Each person signs in with their own email and password. Their role decides what they can do; the server checks every save.</p>
 <div class="tw"><table><thead><tr><th>Name in the ledger</th><th>Email</th><th>Role</th><th>Status</th>${own?'<th></th>':''}</tr></thead><tbody>${SYNC.members.map(m=>`<tr><td><b>${H(m.display_name)}</b>${m.email==myEmail()?' <span class="mu">(you)</span>':''}</td><td>${H(m.email)}</td><td>${H(ROLE_TITLE[m.role]||m.role)}</td>
  <td>${!m.active?chip('Inactive'):m.user_id?chip('Active'):'<span class="pill p-warn">Invited · not signed in yet</span>'}</td>${own?`<td><div class="mini"><button type="button" data-tm-edit="${H(m.email)}">Edit</button>${m.email!=myEmail()?`<button type="button" class="${m.active?'dg':''}" data-tm-toggle="${H(m.email)}">${m.active?'Deactivate':'Reactivate'}</button>`:''}</div></td>`:''}</tr>`).join('')}</tbody></table></div>
 ${own?`<h3 style="margin:16px 0 6px" id="tm-form-h">Add or change a person</h3><form id="tm-form" class="fgrid" novalidate onsubmit="return false">
  <div class="field"><label for="tm-email">Email</label><input id="tm-email" type="email" autocomplete="off"></div>
  <div class="field"><label for="tm-name">Name in the ledger</label><input id="tm-name" maxlength="60"></div>
  <div class="field"><label for="tm-role">Role</label><select id="tm-role">${['Teller','Manager','Finance','Auditor','Owner'].map(r=>`<option value="${r}">${H(ROLE_TITLE[r])}</option>`).join('')}</select></div>
  <div class="field"><label>&nbsp;</label><button type="button" class="pri" data-tm-save>Save person</button></div></form>
  <div class="note info"><span class="ic info">i</span><span>After you add someone, send them this link: <b class="mono">${H(link)}</b>. They choose <b>Create an account</b> with the same email, confirm it from their inbox, and sign in. Deactivating someone removes their access at once; their past entries stay in the ledger.</span></div>`
 :`<div class="note info"><span class="ic info">i</span><span>Only the book owner can add people or change roles.</span></div>`}
 <table class="mu" style="margin-top:14px;font-size:12.5px"><tbody>${Object.entries({Teller:'Opens the day, records transactions, counts, enters statements, explains variances, submits.',Manager:'Everything a Teller does, plus approves rates, adjustments and the day (not one they prepared or submitted), locks, reverses.',Finance:'Sets and approves closing rates, approves adjustments, returns, reverses, locks.',Auditor:'Reads everything. Cannot change anything.',Owner:'Manager rights, plus manages the team and the rate board.'}).map(([r,t])=>`<tr><td style="padding:3px 10px 3px 0"><b>${r}</b></td><td>${t}</td></tr>`).join('')}</tbody></table></section>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Recorded by the server</span><h3>Save history</h3></div><p>Last 60 saves</p></div>
 <div class="tw"><table><thead><tr><th>When (PT)</th><th>Revision</th><th>Who</th><th>What</th></tr></thead><tbody>${(SYNC.saves||[]).map(s=>`<tr><td class="mono">${H(new Date(s.at).toLocaleString('en-CA',{timeZone:'America/Vancouver',hour12:false}).slice(0,17))}</td><td class="mono">${s.rev}</td><td>${H(s.name||'')}<br><span class="mu">${H(s.email||'')} · ${H(s.role||'')}</span></td><td>${H(s.note||'')}</td></tr>`).join('')||'<tr><td colspan="4" class="mu">Loading…</td></tr>'}</tbody></table></div></section>`}
function vSet(){const can=RATE_EDIT.includes(SYNC.role)&&SYNC.mode!='readonly';
 return`<section class="sec"><div class="sec-h"><div><span class="eyebrow">${H(SYNC.book.name)}</span><h2>Rate board</h2></div><p>Used to pre-fill buy and sell rates</p></div>
 <p class="lede">Staff can still enter the actual rate on each deal; a rate far from the board is flagged. Changes apply to everyone at once and are recorded in the save history.</p>
 <div class="tw"><table><thead><tr><th>Currency</th><th class="n">We buy at (CAD per unit)</th><th class="n">We sell at (CAD per unit)</th></tr></thead><tbody>${CCYS.map(c=>`<tr><td><b>${c}</b></td><td class="n"><input id="rb-b-${c}" inputmode="decimal" value="${rf(BOARD[c].b)}" ${can?'':'disabled'} style="max-width:140px;text-align:right"></td><td class="n"><input id="rb-s-${c}" inputmode="decimal" value="${rf(BOARD[c].s)}" ${can?'':'disabled'} style="max-width:140px;text-align:right"></td></tr>`).join('')}</tbody></table></div>
 ${can?'<div class="btns"><button type="button" class="pri" data-rb-save>Save rate board</button></div>':'<p class="mu">Only an Owner, Manager or Finance can change the rate board.</p>'}</section>
 <section class="sec"><div class="sec-h"><h3>This book</h3></div><table><tbody>
  <tr><td class="mu" style="padding:4px 14px 4px 0">Branch</td><td><b>${H(SYNC.book.name)}</b> · code ${H(bcode(SYNC.book))}</td></tr>
  <tr><td class="mu" style="padding:4px 14px 4px 0">Base currency</td><td>CAD</td></tr>
  <tr><td class="mu" style="padding:4px 14px 4px 0">You</td><td>${H(SYNC.me.display_name)} · ${H(myEmail())} · ${H(ROLE_TITLE[SYNC.role])}</td></tr>
  <tr><td class="mu" style="padding:4px 14px 4px 0">Last saved</td><td>${SYNC.updatedAt?H(new Date(SYNC.updatedAt).toLocaleString('en-CA',{timeZone:'America/Vancouver',hour12:false}).slice(0,17))+' PT by '+H(SYNC.updatedName):'—'} · revision ${SYNC.baseRev}</td></tr>
  <tr><td class="mu" style="padding:4px 14px 4px 0">Security</td><td>Signed out after 15 minutes without activity. Every save is checked by the server for your role, the revision, locked days and the append-only audit trail.</td></tr></tbody></table>
  <div class="btns" style="margin-top:10px"><button type="button" class="ghost" data-gs="books">Switch book</button><button type="button" class="ghost" data-gs="signout">Sign out</button></div></section>`}
async function teamSave(email,name,role,active){try{await rpc('dc_member_set',{p_book:SYNC.book.book_id,p_email:email,p_name:name,p_role:role,p_active:active});clearDraft(['tm-']);toast({ok:true,msg:(active?'Saved ':'Deactivated ')+name+' ('+email+').'});SYNC.saves=null;await reload(true);return true}
 catch(e){toast({ok:false,msg:friendly(e)});return false}}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||!SYNC.book)return;
 if(b.dataset.tmEdit){const m=SYNC.members.find(x=>x.email==b.dataset.tmEdit);if(!m)return;$('#tm-email').value=m.email;$('#tm-name').value=m.display_name;$('#tm-role').value=m.role;$('#tm-form-h').scrollIntoView({block:'start'});$('#tm-name').focus();return}
 if(b.dataset.tmToggle){const m=SYNC.members.find(x=>x.email==b.dataset.tmToggle);if(m)teamSave(m.email,m.display_name,m.role,!m.active);return}
 if(b.dataset.tmSave!=null){const em=$('#tm-email').value.trim().toLowerCase(),nm=$('#tm-name').value.trim(),rl=$('#tm-role').value;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em))return toast({ok:false,msg:'Enter a valid email address.'});if(!nm)return toast({ok:false,msg:'Enter the name to show in the ledger.'});
  b.disabled=true;await teamSave(em,nm,rl,true);return}
 if(b.dataset.rbSave!=null){const nb={};for(const c of CCYS){const x=num(val('rb-b-'+c)),y=num(val('rb-s-'+c));if(!(x>0)||!(y>0))return toast({ok:false,msg:'Enter rates above zero for '+c+'.'});if(y<x)return toast({ok:false,msg:c+': the sell rate should not be below the buy rate.'});nb[c]={b:x,s:y}}
  const old=Object.fromEntries(CCYS.map(c=>[c,{...BOARD[c]}]));applyBoard(nb);const ok=await save('Rate board: '+CCYS.map(c=>c+' '+rf(nb[c].b)+'/'+rf(nb[c].s)).join(', '));
  if(ok){clearDraft(['rb-']);FORM.rate=String(BOARD[FORM.ccy][FORM.type=='sell'?'s':'b']);SYNC.saves=null;toast({ok:true,msg:'Rate board saved for everyone.'})}else applyBoard(old);return}});
async function resetBook(b){if(!SYNC.canEdit){toast({ok:false,msg:'Only the book owner can erase the book.'});return}
 if(SYNC.local){if(!SYNC.resetArm){SYNC.resetArm=true;b.textContent='Click again to erase this browser\'s book';setTimeout(()=>{SYNC.resetArm=false;if(E)render()},6000);return}
  SYNC.resetArm=false;ls.d(LKEY);clearDraft(['']);E=null;return gate('setup',{ok:'Erased. Set the book up again.'})}
 if(E&&E.B.days.some(d=>d.status=='Locked')){toast({ok:false,msg:'This book has locked days, so it cannot be erased. Create a separate book for training.'});return}
 if(!SYNC.resetArm){SYNC.resetArm=true;b.textContent='Click again to erase this book for everyone';setTimeout(()=>{SYNC.resetArm=false;if(E)render()},6000);return}
 SYNC.resetArm=false;try{await rpc('dc_reset',{p_book:SYNC.book.book_id});clearDraft(['']);E=null;await reload(true);gate('setup',{ok:'Book erased. Set it up again.'})}catch(e){toast({ok:false,msg:friendly(e)})}}
function webHeader(){const b=SYNC.book;if(!b)return;document.querySelectorAll('.band [data-gs]').forEach(x=>{x.textContent=SYNC.local?(x.dataset.gs=='books'?'Shared books':'Leave'):(x.dataset.gs=='books'?'Switch book':'Sign out')});const w=$('#c-who');if(w&&SYNC.local){if(!w.querySelector('#c-staff')||w.dataset.u!==UID){w.dataset.u=UID;w.innerHTML=`<select id="c-staff" aria-label="Working as">${LSTAFF.map(k=>`<option value="${k}" ${k==UID?'selected':''}>${H(USERS[k].name)} — ${H(USERS[k].role)}</option>`).join('')}</select>`}}else if(w)w.innerHTML=SYNC.me?`<b>${H(SYNC.me.display_name)}</b> <span class="w-r">${H(SYNC.role)}</span>`:'';const k=$('#c-book');if(k)k.textContent=b.name+' ('+bcode(b)+')'}
function onlineBanner(){if(SYNC.local)return`<div class="note warn"><span class="ic warn">!</span><span><b>Working in this browser only.</b> Everything works and is saved on this device. Use <b>Signed in</b> at the top to act as each person (Teller, Manager, Finance, Auditor). To share the books with your staff online, see the Team page.</span></div>`;if(SYNC.mode=='readonly')return`<div class="note info"><span class="ic info">i</span><span><b>Read only.</b> As ${H(ROLE_TITLE[SYNC.role]||SYNC.role)} you can read the books, every report and the audit trail.</span></div>`;
 if(SYNC.mode=='error')return`<div class="note bad"><span class="ic bad">!</span><span><b>Your last step is not saved yet.</b> Check your connection. <button type="button" data-gs="savenow">Save now</button></span></div>`;return''}

/* ---------- this-browser mode: every feature, saved on this device only ---------- */
const LKEY='pb_closing_local',LMODE='pb_closing_mode',LUID='pb_closing_local_uid',LSTAFF=['farhan','amina','daniel','sara'];
function localNote(){return`<div class="note warn"><span class="ic warn">!</span><span><b>This browser only.</b> The book is saved on this device. Your staff cannot see it until the shared books are switched on.</span></div>`}
function howOnline(){return`<details class="g-new"><summary>How to switch on shared books (one time, about 2 minutes)</summary><ol style="margin:0;padding-left:20px;line-height:1.7">
 <li>Sign in at <b>supabase.com</b> and open the PrimeBook project.</li><li>Click <b>SQL Editor</b>, then <b>New query</b>.</li>
 <li>Paste the whole file <b>supabase/daily-closing.sql</b> from the PrimeBook GitHub repository and click <b>Run</b>.</li>
 <li>Under <b>Authentication → URL Configuration</b>, add <b class="mono">${H(location.origin+'/closing')}</b> to the Redirect URLs.</li>
 <li>Come back here and press <b>Check again</b>.</li></ol></details>`}
function setLocalUser(uid){if(!USERS[uid])uid='amina';UID=uid;ls.s(LUID,uid);SYNC.me={display_name:USERS[uid].name,email:''};SYNC.role=USERS[uid].role;SYNC.canEdit=true;SYNC.mode='local'}
function localSave(){try{localStorage.setItem(LKEY,JSON.stringify({v:1,book:E?E.B:null,board:Object.fromEntries(CCYS.map(c=>[c,{b:BOARD[c].b,s:BOARD[c].s}]))}));return true}catch(e){return false}}
function startLocal(){stopBook();clearInterval(pollT);SYNC.local=true;ls.s(LMODE,'local');SYNC.book={book_id:'vancouver-local',name:'Vancouver',role:'Owner',display_name:''};SYNC.members=[];SYNC.saves=[];
 configure({branch:'Vancouver',code:'VAN'});setLocalUser(ls.g(LUID)||'amina');let st=null;try{st=JSON.parse(ls.g(LKEY))}catch(e){}
 if(st&&st.board)applyBoard(st.board);
 if(st&&st.book&&Array.isArray(st.book.days)&&st.book.days.length){E=Book(st.book);E.real=true;E.acct=myId();VIEW=VIEWS.some(v=>v[0]==(location.hash||'').slice(1))?location.hash.slice(1):'dashboard';showApp();render()}
 else{E=null;gate('setup')}}
function leaveLocal(){SYNC.local=false;ls.d(LMODE);stopBook();SYNC.mode='loading';if(SB)showBooks({},false);else gate('login')}
document.addEventListener('change',e=>{if(e.target.id=='c-staff'&&SYNC.local){setLocalUser(e.target.value);render();toast({ok:true,msg:'Now working as '+USERS[UID].name+' ('+USERS[UID].role+').'})}});
function vTeamLocal(){return`<section class="sec"><div class="sec-h"><div><span class="eyebrow">This browser only</span><h2>Team</h2></div><p>4 staff</p></div>
 <p class="lede">In this mode one person works the whole close on this device. Switch who you are acting as with <b>Signed in</b> at the top; each role sees exactly the rights it has, and separation of duties still applies (the person who prepares or submits the day cannot approve it).</p>
 <div class="tw"><table><thead><tr><th>Name</th><th>Role</th><th>Can do</th><th></th></tr></thead><tbody>${LSTAFF.map(k=>`<tr><td><b>${H(USERS[k].name)}</b>${k==UID?' <span class="mu">(acting now)</span>':''}</td><td>${H(USERS[k].title)}</td><td class="mu" style="font-size:12.5px">${H({Teller:'Open day, record, count, statements, explain variances, submit',Manager:'All of the Teller, plus approve rates, adjustments and the day, lock, reverse',Finance:'Closing rates, approve adjustments, return, reverse, lock',Auditor:'Read everything, change nothing'}[USERS[k].role])}</td><td>${k==UID?'':`<button type="button" data-as="${k}">Act as ${H(USERS[k].name)}</button>`}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="sec"><div class="sec-h"><h3>Share the books with your staff online</h3></div><p>Once shared books are switched on, each person signs in with their own email and password, the owner adds staff here by email, and every save is checked by the server.</p>${howOnline()}</section>`}
document.addEventListener('click',e=>{const b=e.target.closest('button[data-as]');if(!b||!SYNC.local)return;setLocalUser(b.dataset.as);render();toast({ok:true,msg:'Now working as '+USERS[UID].name+' ('+USERS[UID].role+').'})});

/* ---------- boot ---------- */
async function boot(){const h=location.hash.replace(/^#/,'');
 if(ls.g(LMODE)=='local'&&!/access_token=|error_description=/.test(h))return startLocal();
 if(h&&/access_token=|error_description=/.test(h)){const q=new URLSearchParams(h);history.replaceState(null,'',location.pathname);
  if(q.get('error_description'))return gate('login',{err:q.get('error_description').replace(/\+/g,' ')});
  if(q.get('access_token')){keep(fixS({access_token:q.get('access_token'),refresh_token:q.get('refresh_token'),expires_at:+q.get('expires_at')||0,expires_in:+q.get('expires_in')||3600}));
   try{const u=await api('/auth/v1/user');SB.user=u;keep(SB)}catch(e){}
   if(q.get('type')=='recovery'){startSession();return gate('reset')}
   return afterSignIn(q.get('type')=='signup'?'Email confirmed. Welcome.':'')}}
 if(SB&&SB.refresh_token){try{if(SB.expires_at-60<Date.now()/1000)await refresh();return afterSignIn()}catch(e){keep(null)}}
 gate('login')}
let E=null,UID='',VIEW='dashboard',UAT=runUAT();
