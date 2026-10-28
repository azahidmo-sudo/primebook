import json,subprocess,os
from playwright.sync_api import sync_playwright
def seed():
    return json.loads(subprocess.check_output(['node','-e','console.log(JSON.stringify(require("./seed.js")()))'],cwd=os.path.dirname(os.path.abspath(__file__))))
def open_app(p,state=None,width=1440,height=900,role_idx=0,view='dtx'):
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':width,'height':height})
    pg=ctx.new_page()
    errs=[]
    pg.on('pageerror',lambda e:errs.append('PAGEERROR '+str(e)))
    pg.on('dialog',lambda d:(errs.append('DIALOG '+d.message),d.accept()))
    ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
    pg.goto('http://localhost:8766/index.html');pg.wait_for_timeout(800)
    pg.click('[data-cs="c_offline"]');pg.wait_for_timeout(1500)
    s=state or seed(); s['me']=role_idx
    k=pg.evaluate("()=>K")
    pg.evaluate("([k,v])=>{localStorage.setItem(k,v);putAccs(accs().map(a=>a.id=='preview'?{...a,pd:1,name:'ZAHID'}:a))}",[k,json.dumps(s)])
    pg.reload();pg.wait_for_timeout(1500)
    try:
        pg.click('text=Got it',timeout=1500)
    except Exception: pass
    pg.evaluate("(v)=>{view=v;go()}",view);pg.wait_for_timeout(600)
    return b,pg,errs
