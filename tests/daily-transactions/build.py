import re,os
P=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','public','index.html')
s=open(P,encoding='utf8').read()
js=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'dx3.src.js'),encoding='utf8').read()
assert '</script' not in js
blk='<script id="dx3">\n'+js+'\n</script>'
if '<script id="dx3">' in s:
    s=re.sub(r'<script id="dx3">\n.*?\n</script>',lambda m:blk,s,flags=re.S)
else:
    assert s.rstrip().endswith('</script></body></html>')
    s=s.rstrip()[:-len('</body></html>')]+'\n'+blk+'\n</body></html>\n'
a="if(tb=='reg'){\n  if(!selA)"
b="if(tb=='reg'&&window.dx3Reg){body=window.dx3Reg(d)}\n else if(tb=='reg'){\n  if(!selA)"
if b not in s:
    assert s.count(a)==1; s=s.replace(a,b)
open(P,'w',encoding='utf8').write(s);print('built',len(s))
