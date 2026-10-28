"""End-to-end test of /closing against the local Supabase stand-in (real SQL in Postgres)."""
import json, sys, time, urllib.request, subprocess, os
from playwright.sync_api import sync_playwright
BASE = 'http://127.0.0.1:8780'
SHOTS = os.path.join(os.path.dirname(__file__), 'shots'); os.makedirs(SHOTS, exist_ok=True)
R = []
def check(name, cond, info=''):
    R.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  -> ' + str(info)[:300]), flush=True)
def confirm(em): urllib.request.urlopen(BASE + '/__confirm?email=' + em).read()
def toast(p):
    try: p.wait_for_selector('#toast:not([hidden])', timeout=6000); return p.inner_text('#toast')
    except Exception: return ''
def clear_toast(p): p.evaluate("()=>{const t=document.querySelector('#toast');t.hidden=true;t.textContent=''}")
def idle(p, ms=400):
    p.wait_for_function("()=>!/Saving/.test((document.querySelector('#c-sync')||{}).textContent||'')", timeout=10000); p.wait_for_timeout(ms)
def act(p, sel, expect_ok=True):
    clear_toast(p); p.click(sel); t = toast(p); idle(p); return t
def signup_login(p, em, pw='correct-horse-1'):
    p.goto(BASE + '/closing'); p.wait_for_selector('form[data-g=login]')
    p.click('[data-gs=signup]'); p.fill('#g-em', em); p.fill('#g-pw', pw); p.fill('#g-pw2', pw); p.click('form[data-g=signup] button[type=submit]')
    p.wait_for_selector('text=Check your email'); confirm(em)
    p.click('[data-gs=login]'); p.fill('#g-em', em); p.fill('#g-pw', pw); p.click('form[data-g=login] button[type=submit]')

with sync_playwright() as pw:
    br = pw.chromium.launch()
    errs = []
    def ctx(w=1280, h=900):
        c = br.new_context(viewport={'width': w, 'height': h}); pg = c.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.add_init_script("window.__T=[];new MutationObserver(()=>{const t=document.querySelector('#toast');if(t&&!t.hidden&&t.textContent)window.__T.push(t.textContent)}).observe(document,{subtree:true,childList:true,attributes:true,characterData:true})")
        return pg
    # ---------- owner ----------
    o = ctx()
    o.goto(BASE + '/closing'); o.wait_for_selector('form[data-g=login]')
    o.screenshot(path=SHOTS + '/01-login.png')
    o.fill('#g-em', 'asha@x.com'); o.fill('#g-pw', 'nope-nope-1'); o.click('form[data-g=login] button[type=submit]')
    o.wait_for_selector('.note.bad'); check('wrong login shows a clear error', 'incorrect' in o.inner_text('.note.bad'), o.inner_text('#gate'))
    o.click('[data-gs=signup]'); o.fill('#g-em', 'asha@x.com'); o.fill('#g-pw', 'short'); o.fill('#g-pw2', 'short'); o.click('form[data-g=signup] button[type=submit]')
    check('short password refused', '10 characters' in o.inner_text('#gate'))
    signup_login(o, 'asha@x.com')
    o.wait_for_selector('text=Your branch books'); check('new user sees empty books screen with guidance', 'No books yet' in o.inner_text('#gate'))
    o.fill('#g-bn', 'Vancouver'); check('book code suggested from name', o.input_value('#g-bc') == 'vancouver', o.input_value('#g-bc'))
    o.fill('#g-dn', 'Asha'); o.click('form[data-g=create] button[type=submit]')
    o.wait_for_selector('form[data-g=setup]'); check('owner lands on book setup', True)
    o.fill('#s-date', '2026-11-02')
    for k, v in {'#s-1000': '2,000', '#s-1005': '8000', '#s-1010': '15000', '#s-1210': '1200', '#s-fc-USD': '1500', '#s-cad-USD': '2025'}.items(): o.fill(k, v)
    check('opening total computed', '28,225.00' in o.inner_text('#s-tot'), o.inner_text('#s-tot'))
    o.fill('#s-fc-AED', '100'); check('currency without CAD cost flagged', 'Check the figures' in o.inner_text('#s-tot')); o.fill('#s-fc-AED', '')
    o.screenshot(path=SHOTS + '/02-setup.png', full_page=True)
    o.click('form[data-g=setup] button[type=submit]')
    o.wait_for_selector('#shell:not([hidden]) #app .sec'); idle(o)
    check('dashboard shows the new book', 'Vancouver (VAN)' in o.inner_text('#c-book') and 'Not opened' in o.inner_text('#c-status'), o.inner_text('.band'))
    check('signed-in identity in the band', 'asha' in o.inner_text('#c-who').lower() and 'owner' in o.inner_text('#c-who').lower(), o.inner_text('#c-who'))
    # team
    o.click('#nav [data-view=team]'); o.wait_for_selector('#tm-form'); o.wait_for_function("()=>!document.querySelector('#app').innerText.includes('Loading…')")
    for em, nm, rl in [('farhan@x.com', 'Farhan', 'Teller'), ('amina@x.com', 'Amina', 'Manager'), ('sara@x.com', 'Sara', 'Auditor')]:
        o.fill('#tm-email', em); o.fill('#tm-name', nm); o.select_option('#tm-role', rl); clear_toast(o); o.click('[data-tm-save]'); t = toast(o)
        check('owner adds ' + nm, 'Saved' in t, t); o.wait_for_timeout(300)
    o.fill('#tm-email', 'x@x.com'); o.fill('#tm-name', 'farhan'); clear_toast(o); o.click('[data-tm-save]'); t = toast(o)
    check('duplicate ledger name refused with plain message', 'already uses that name' in t, t)
    check('team shows invited status', o.inner_text('#app').count('Invited') == 3, o.inner_text('#app'))
    o.screenshot(path=SHOTS + '/03-team.png', full_page=True)
    # ---------- teller ----------
    f = ctx()
    signup_login(f, 'farhan@x.com')
    f.wait_for_selector('#shell:not([hidden]) #app .sec'); check('member with one book goes straight to it', 'Farhan' in f.inner_text('#c-who'))
    t = act(f, '[data-act=open]'); check('teller opens the day', 'Open' in f.inner_text('#c-status'), t)
    f.click('#nav [data-view=transactions]'); f.wait_for_selector('#f-amt, [data-f=amt]')
    f.fill('[data-f=amt]', '500'); f.fill('[data-f=ext]', 'DL-4471'); t = act(f, '[data-act=record]'); check('teller records a USD purchase', 'TX-001' in f.inner_text('#app'), t)
    reg = f.inner_text('#tx-register') if f.query_selector('#tx-register') else f.inner_text('#app')
    check('register shows branch code and real staff name', 'VAN' in reg and 'Farhan' in reg, reg[:400])
    # owner sees it live
    o.click('#nav [data-view=transactions]'); o.wait_for_function("()=>document.querySelector('#app').innerText.includes('TX-001')", timeout=12000)
    check('owner screen updates live from the server', True)
    # ---------- auditor ----------
    s = ctx(390, 844)
    signup_login(s, 'sara@x.com'); s.wait_for_selector('#shell:not([hidden]) #app .sec')
    check('auditor sees read-only banner', 'Read only' in s.inner_text('#app'), s.inner_text('#app')[:300])
    s.click('#nav [data-view=transactions]'); s.wait_for_timeout(300)
    s.screenshot(path=SHOTS + '/04-auditor-mobile.png', full_page=False)
    w = s.evaluate('()=>document.documentElement.scrollWidth'); check('no sideways scroll on a phone', w <= 392, w)
    # ---------- conflict: two people act on the same revision ----------
    f.click('#nav [data-view=transactions]'); o.click('#nav [data-view=transactions]')
    f.fill('[data-f=amt]', '100'); o.fill('[data-f=amt]', '200'); f.fill('[data-f=ext]', 'PP-1'); o.fill('[data-f=ext]', 'PP-2')
    f.evaluate("()=>window.__hold=1")
    clear_toast(f); clear_toast(o)
    o.click('[data-act=record]'); f.click('[data-act=record]')
    tf, to = toast(f), toast(o); idle(f, 1500); idle(o, 1500)
    f.wait_for_timeout(6000)
    a1, a2 = f.inner_text('#app'), o.inner_text('#app')
    n = sum(1 for x in ['TX-002', 'TX-003'] if x in a1)
    allt=' | '.join(f.evaluate('()=>window.__T')+o.evaluate('()=>window.__T'))
    check('simultaneous saves: one wins, the other is told and refreshed', 'Someone else saved first' in allt, allt[-400:])
    check('both screens converge on the same ledger', ('TX-003' in a1) == ('TX-003' in a2) and ('TX-002' in a1) == ('TX-002' in a2), (n,))
    # ---------- full close: counts, statements, rates, approval, lock, next day ----------
    f.click('#nav [data-view=reconcile]'); f.wait_for_selector('[data-fill]'); f.click('[data-fill]'); f.fill('#c-wit', 'Amina')
    t = act(f, '[data-act=count]'); check('teller saves counts', 'ount' in t, t)
    f.click('[data-fill]'); t = act(f, '[data-act=stmt-bank]'); check('bank statement saved', t, t)
    f.click('[data-fill]'); t = act(f, '[data-act=stmt-taaj]'); check('Taaj statement saved', t, t)
    a = ctx(); signup_login(a, 'amina@x.com'); a.wait_for_selector('#shell:not([hidden]) #app .sec')
    a.click('#nav [data-view=reconcile]'); a.wait_for_timeout(400)
    if a.query_selector('#rt-USD'):
        a.fill('#rt-USD', '1.36'); a.fill('#rs-src-USD', 'Treasury 17:00 fixing'); t = act(a, '[data-act=rateSet][data-ccy=USD]'); check('manager sets USD closing rate', 'USD' in t, t)
        t = act(o, '[data-act=rateAp][data-ccy=USD]') if False else None
        o.click('#nav [data-view=reconcile]'); o.wait_for_function("()=>!!document.querySelector('[data-act=rateAp][data-ccy=USD]')", timeout=12000)
        t = act(o, '[data-act=rateAp][data-ccy=USD]'); check('owner (second person) approves the rate', 'approved' in t, t)
    f.click('#nav [data-view=dashboard]'); f.wait_for_timeout(5500); f.click('#nav [data-view=dashboard]')
    if f.query_selector('[data-act=completeRecon]'):
        t = act(f, '[data-act=completeRecon]'); check('teller completes reconciliations', 'econcil' in t, t)
    f.click('#nav [data-view=dashboard]'); t = act(f, '[data-act=submit]'); check('teller submits the day', 'Submitted' in f.inner_text('#c-status'), (t, f.inner_text('#dash-next')))
    a.click('#nav [data-view=dashboard]'); a.wait_for_function("()=>/Submitted/.test(document.querySelector('#c-status').innerText)", timeout=12000)
    t = act(a, '[data-act=approve]'); check('manager approves', 'Approved' in a.inner_text('#c-status'), t)
    t = act(a, '[data-act=lock]'); check('manager locks the day', 'Locked' in a.inner_text('#c-status'), t)
    t = act(a, '[data-act=next]'); check('next-day opening generated', '2026-11-03' in t or 'generated' in t.lower(), t)
    a.click('[data-go-latest]'); a.wait_for_timeout(300)
    check('next business day available', '3 Nov' in a.inner_text('#c-date') or 'Nov 3' in a.inner_text('#c-date'), a.inner_text('#c-date'))
    a.screenshot(path=SHOTS + '/05-day2.png', full_page=False)
    # ---------- server-side protection against a tampered browser ----------
    res = f.evaluate("""async()=>{const sb=JSON.parse(localStorage.getItem('pb_closing_sb'));const h={apikey:'k','Content-Type':'application/json',Authorization:'Bearer '+sb.access_token};
      const st=await (await fetch('/rest/v1/dc_state?book_id=eq.vancouver&select=rev,meta',{headers:h})).json();
      const d=await (await fetch('/rest/v1/dc_days?book_id=eq.vancouver&select=date,day,audit&order=date.asc',{headers:h})).json();
      const day=d[0].day;day.js=[];
      const r=await fetch('/rest/v1/rpc/dc_save',{method:'POST',headers:h,body:JSON.stringify({p_book:'vancouver',p_base_rev:st[0].rev,p_meta:st[0].meta,p_days:[{date:d[0].date,day,audit:d[0].audit}],p_note:'tamper'})});
      return (await r.json()).message}""")
    check('server refuses edits to a locked day even from a tampered browser', 'locked' in (res or '').lower(), res)
    # ---------- deactivate: access ends ----------
    o.click('#nav [data-view=team]'); o.wait_for_selector('[data-tm-toggle="sara@x.com"]'); clear_toast(o); o.click('[data-tm-toggle="sara@x.com"]'); t = toast(o)
    check('owner deactivates the auditor', 'Deactivated' in t, t)
    s.wait_for_selector('text=no longer have access', timeout=15000); check('deactivated person is removed from the book live', True)
    # ---------- sign out / session restore ----------
    f.reload(); f.wait_for_selector('#shell:not([hidden]) #app .sec'); check('reload keeps you signed in and in your book', 'Farhan' in f.inner_text('#c-who'))
    f.click('.band [data-gs=signout]'); f.wait_for_selector('form[data-g=login]'); check('sign out returns to the sign-in screen', 'signed out' in f.inner_text('#gate'))
    # UAT still passes in the web build
    a.click('#nav [data-view=uat]'); a.wait_for_timeout(500); txt = a.inner_text('#app')
    import re as _re
    mm=_re.search(r'passed\s+(\d+).*?failed\s+(\d+)', txt.lower(), _re.S)
    check('engine UAT suite passes in the web build', mm and mm.group(2)=='0' and int(mm.group(1))>=28, txt[:300])
    o.click('#nav [data-view=settings]'); o.wait_for_selector('[data-rb-save]'); o.fill('#rb-b-USD', '1.34'); o.fill('#rb-s-USD', '1.39'); clear_toast(o); o.click('[data-rb-save]'); t = toast(o)
    check('owner saves the rate board', 'saved' in t.lower(), t); idle(o)
    a.wait_for_timeout(6000); a.click('#nav [data-view=settings]'); check('rate board reaches other staff', a.input_value('#rb-b-USD') == '1.3400', a.input_value('#rb-b-USD'))
    o.click('#nav [data-view=team]'); o.wait_for_timeout(1200); o.screenshot(path=SHOTS + '/06-history.png', full_page=True)
    check('save history recorded by the server', 'Rate board' in o.inner_text('#app'), '')
    o.click('#nav [data-view=dashboard]'); o.wait_for_timeout(300); o.screenshot(path=SHOTS + '/07-dashboard.png', full_page=False)
    real = [e for e in errs if not any(k in e for k in ('favicon','400','404','ERR_TUNNEL','fonts.g'))]
    check('no script errors', not real, real[:5])
    br.close()
print(f'\n{sum(R)}/{len(R)} passed'); sys.exit(0 if all(R) else 1)
