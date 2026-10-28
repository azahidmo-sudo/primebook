#!/usr/bin/env python3
"""Build public/closing.html (the /closing web app) from the sources in this folder.

  engine.js        accounting engine (shared with the Daily Closing sample)
  ui.js            screens (shared with the sample)
  views_static.js  System design and Controls pages
  web.js           web platform layer: sign-in, books, team, settings, server sync
  style.css        base styles

Run:  python3 closing/build.py        (from the repository root)
"""
import os, re, sys
H = os.path.dirname(os.path.abspath(__file__))
R = lambda f: open(os.path.join(H, f), encoding='utf-8').read()
OUT = os.path.join(H, '..', 'public', 'closing.html')

def sub(s, old, new, count=1, label=''):
    n = s.count(old)
    if n < 1 or (count and n != count):
        sys.exit(f'build: patch "{label or old[:60]}" expected {count or "1+"} match(es), found {n}')
    return s.replace(old, new)

# ---------- engine: configurable branch, live clock, blank books ----------
eng = R('engine.js')
eng = sub(eng, "const BASE='CAD',BRANCH='Vancouver';", "const BASE='CAD';let BRANCH='Vancouver',BCODE='VAN';", label='branch')
eng = sub(eng, "'DC-VAN-'", "'DC-'+BCODE+'-'", count=0, label='refs')
eng = sub(eng, " E.ts=(D,at)=>{if(at)return D.date+' '+at;",
          " E.ts=(D,at)=>{if(at)return D.date+' '+at;if(E.real)return D.date+' '+new Date().toLocaleTimeString('en-GB',{timeZone:'America/Vancouver',hour:'2-digit',minute:'2-digit',hour12:false});", label='clock')
eng = sub(eng, "function seed(){const E=Book();", "function seed(acct){const E=Book();E.acct=acct||'';", label='seed')
eng = sub(eng, "if(typeof module!=='undefined')",
          "function configure(o){if(o.branch)BRANCH=o.branch;if(o.code)BCODE=o.code}\n"
          "function blankBook(date,opening,from){return Book({v:2,days:[newDay(date,opening,from)],cur:0,seq:{TX:0,ADJ:0},audit:[]})}\n"
          "if(typeof module!=='undefined')", label='exports')

# ---------- ui: swap the artifact sync block for the web layer ----------
ui = R('ui.js')
a = ui.index("const KEY='brimapay-daily-closing-v2';")
b = ui.index("let E=seed(),UID='farhan',VIEW='dashboard',UAT=runUAT();")
b = ui.index('\n', b) + 1
ui = ui[:a] + R('web.js') + '\nfunction startShared(){}\n' + ui[b:]
ui = sub(ui, "function act(a,p,key){if(SYNC.mode=='readonly'", "function act_artifact(a,p,key){if(SYNC.mode=='readonly'", label='act')
ui = sub(ui, "const val=id=>{",
         "function act(a,p,key){if(!E||!SYNC.book)return{ok:false};\n"
         " if(!WRITERS.includes(SYNC.role)){toast({ok:false,msg:'Your role is read only. You can read every report and the audit trail.'});return{ok:false}}\n"
         " E.acct=myId();const r=E.act(UID,a,p||{});save((USERS[UID]||{}).name+': '+(r.ok?'':'refused · ')+a);if(r.ok&&key)clearDraft(key);toast(r);render();return r}\n"
         "const val=id=>{", label='act2')
ui = sub(ui, "$('#c-user').innerHTML=Object.entries(USERS).map(([k,u])=>`<option value=\"${k}\">${A(u.name)} — ${A(u.title)}</option>`).join('');\n", "", label='cuser1')
ui = sub(ui, "$('#c-user').addEventListener('change',e=>{UID=e.target.value;render()});\n", "", label='cuser2')
ui = sub(ui, "function header(){const D=D_();", "function header(){webHeader();const D=D_();", label='header')
ui = sub(ui, "const VIEWS=[['dashboard','Dashboard'],['transactions','Transactions'],['reconcile','Reconcile'],['reports','Reports'],",
         "const VIEWS=[['dashboard','Dashboard'],['transactions','Transactions'],['reconcile','Reconcile'],['reports','Reports'],['team','Team'],['settings','Settings'],", label='views')
ui = sub(ui, "uat:vUat})[VIEW]()", "uat:vUat,team:vTeam,settings:vSet})[VIEW]()", label='viewmap')
# the artifact's banner is replaced by the web one
s0 = ui.index("function onlineBanner(){if(SYNC.mode=='empty')")
ui = ui[:s0] + ui[ui.index("const FEATURES=[", s0):]
# reset button and handler
ui = sub(ui, "${SYNC.mode=='local'||SYNC.canEdit?`<button type=\"button\" class=\"ghost\" data-reset>${SYNC.mode=='local'?'Reset to the sample day':'Reset shared books to the sample day'}</button>`:''}",
         "${SYNC.canEdit&&!E.B.days.some(d=>d.status=='Locked')?`<button type=\"button\" class=\"ghost\" data-reset>Erase this book and start over</button>`:''}", label='resetbtn')
r0 = ui.index("if(b.dataset.reset!=null){if(SYNC.mode=='local')")
r1 = ui.index("toast({ok:true,msg:'Shared books reset to the 27-Oct sample day for everyone.'});return}", r0)
r1 = ui.index('return}', r1) + len('return}')
ui = ui[:r0] + "if(b.dataset.reset!=null){resetBook(b);return}" + ui[r1:]
# wording that assumed the sample staff switch
ui = sub(ui, "Switch staff at the top to see each role's rights", "What you can do depends on your role (see Team)", label='feat')
ui = sub(ui, "w.value=UID=='amina'?'Farhan':'Amina'", "w.value=''", label='witness')
ui = sub(ui, "'TJ-STMT-VAN-'", "'TJ-STMT-'+BCODE+'-'", label='taajref')
ui = sub(ui, "<td>VAN</td>", "<td>${A(BCODE)}</td>", label='regbranch')
ui = sub(ui, '<textarea id="ret-reason">Attach the incident report to the variance before approval.</textarea>',
         '<textarea id="ret-reason" placeholder="What must be corrected (at least 10 characters)"></textarea>', label='ret')
ui = re.sub(r"Switch to Farhan or Amina[^<`']*", "Ask a Teller or Manager to record them.", ui, count=1)
# keep Team and Settings inputs through live refreshes
ui = sub(ui, "rv-|ret-)/;", "rv-|ret-|tm-|rb-)/;", label='drx')
# keep the cursor where it was when a live update redraws the page
ui = sub(ui, " $('#app').innerHTML=`<div class=\"view\">", " const ae=document.activeElement,aid=ae&&ae.id&&ae.closest&&ae.closest('#app')?ae.id:'',ass=ae&&ae.selectionStart;\n $('#app').innerHTML=`<div class=\"view\">", label='focus1')
ui = sub(ui, "if(el&&!el.disabled)el.value=DRAFT[k]});", "if(el&&!el.disabled)el.value=DRAFT[k]});\n if(aid){const el=document.getElementById(aid);if(el&&el!==document.activeElement){el.focus();try{if(ass!=null)el.setSelectionRange(ass,ass)}catch(e){}}}", label='focus2')
# boot
ui = sub(ui, "E=seed();render();initOnline();", "boot();", label='boot')

st = R('views_static.js').replace("E.checks(D)", "E.checks(D_())").replace("The live list for Vancouver:", "The live list for ${A(BRANCH)}:")
ui = sub(ui, '/*@@STATIC@@*/', st, label='static')

css = R('style.css') + R('web.css')
csp = ("default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; connect-src 'self' https://htrlqotaetdwccervhmd.supabase.co; img-src 'self' data:; "
       "base-uri 'none'; form-action 'none'")
html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="{csp}">
<title>Daily Closing · PrimeBook</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600&display=swap">
<style>
{css}
</style>
</head>
<body>
<div id="gate"></div>
<div id="shell" hidden>
<div class="band"><div class="wrap">
  <div class="brand"><b>BRIMAPAY · Daily Closing</b><small>PrimeBook · base currency CAD</small></div>
  <div class="ctl"><label for="c-date">Business date</label><select id="c-date"></select></div>
  <div class="ctl"><label>Branch</label><span id="c-book" class="w-v"></span></div>
  <div class="ctl"><label>Signed in</label><span id="c-who" class="w-v"></span></div>
  <div class="ctl"><label>Day status</label><span id="c-status"></span></div>
  <div class="ctl"><label>Books</label><span id="c-sync"></span></div>
  <div class="ctl w-acts"><button type="button" class="w-btn" data-gs="books">Switch book</button><button type="button" class="w-btn" data-gs="signout">Sign out</button></div>
</div></div>
<div class="rail"><div class="wrap"><ol id="rail" aria-label="Closing workflow"></ol></div></div>
<nav class="nav" aria-label="Sections"><div class="wrap" id="nav" style="display:flex;gap:2px;overflow-x:auto"></div></nav>
<main class="wrap"><div id="app"></div></main>
</div>
<div id="toast" class="toast" role="status" hidden></div>
<script>
{eng}
{ui}
</script>
</body>
</html>
"""
assert '</script' not in (eng + ui).replace('<\\/script', ''), 'script tag inside code'
open(OUT, 'w', encoding='utf-8').write(html)
print('wrote', os.path.relpath(OUT), len(html), 'bytes')
