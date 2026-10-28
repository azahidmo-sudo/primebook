import re,os,sys
H=os.path.dirname(os.path.abspath(__file__))
P=sys.argv[1] if len(sys.argv)>1 else os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','public','index.html')
s=open(P,encoding='utf8').read()
def rep(a,b):
    global s
    if b in s: return
    n=s.count(a); assert n==1,(n,a[:80]); s=s.replace(a,b)
# 1 tabs
rep("const TABS=[['cockpit','Cockpit'],['ready','Readiness'],['var','Variances'],['reopen','Reopen'],['hq','All branches'],['pack','Audit pack'],['policy','Policy']];",
    "const TABS=[['cockpit','Cockpit'],['ready','Readiness'],['var','Variances'],['recon','Reconciliations'],['reopen','Reopen'],['hq','All branches'],['pack','Audit pack'],['reports','Closing reports'],['policy','Policy']];")
# 2 routing
rep("const body=v=='ready'?readiness(d):","const body=v=='recon'&&window.dcsRecon?brSel(d)+dcsRecon(selB(),d):v=='reports'&&window.dcsReports?brSel(d)+dcsReports(selB(),d):v=='ready'?readiness(d):")
# 3 readiness hook
rep(" const wn=[...ex.warn];if(isHol(b,d)"," if(window.dcsReady)try{window.dcsReady(b,d,add)}catch(e){console.error(e)}\n const wn=[...ex.warn];if(isHol(b,d)")
# 4 reconciling state includes the new checks
rep("ready(b,d).blockers.filter(x=>['rec','susp','late','brg'].includes(x.id))","ready(b,d).blockers.filter(x=>['rec','susp','late','brg'].includes(x.id)||/^dcs/.test(x.id))")
# 5 snapshot
rep("readiness:ready(b,d).score,generated:nowI()}}","readiness:ready(b,d).score,dcs:window.dcsSnap?window.dcsSnap(b,d):null,generated:nowI()}}")
# 6 lock refuses open blockers
rep("throw new Error('Only a closed day can be locked. Current state: '+ST[state(b,d)][0]+'.');",
    "throw new Error('Only a closed day can be locked. Current state: '+ST[state(b,d)][0]+'.');\n {const rb=ready(b,d).blockers;if(rb.length)throw new Error('The day cannot be locked while '+rb.length+' blocker'+(rb.length==1?' remains':'s remain')+'. First: '+rb[0].label+'. '+(rb[0].detail||''))}")
# fix route + label
rep("const lab={ent:'Open entries',","const lab={rcn:'Open reconciliations',ent:'Open entries',")
rep("window.cpcFix=(t,b)=>{window.__cpb=b;","window.cpcFix=(t,b)=>{window.__cpb=b;if(t=='rcn'){window.__cpv='recon';return go()}")
# pre-existing bug on main: brNm is not in scope in dtxClose (crashes Daily closing for single-branch users)
rep("<p class=\"tw-sub\">${A(br=='all'?'All branches':brNm(br))}","<p class=\"tw-sub\">${A(br=='all'?'All branches':bn(br))}")
# closing-time stock adjustments (already maker-checker approved) are not late entries
rep("!['Closing variance','Closing reversal','Opening'].includes(x.tt)","!['Closing variance','Closing reversal','Opening','Stock count adjustment'].includes(x.tt)")
js=open(os.path.join(H,'dcs.src.js'),encoding='utf8').read()
assert '</script' not in js
blk='<script id="dcs">\n'+js+'\n</script>'
if '<script id="dcs">' in s: s=re.sub(r'<script id="dcs">\n.*?\n</script>',lambda m:blk,s,flags=re.S)
else:
    t=s.rstrip(); assert t.endswith('</body></html>'),t[-40:]
    s=t[:-len('</body></html>')]+'\n'+blk+'\n</body></html>\n'
open(P,'w',encoding='utf8').write(s);print('built',len(s))
