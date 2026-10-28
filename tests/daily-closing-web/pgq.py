import subprocess, json, secrets
PSQL=['psql','-h','/var/tmp/dcpg','-p','5499','-U','postgres','-d','dct','-X','-q','-t','-A','-v','ON_ERROR_STOP=1']
def lit(v):
    if v is None: return 'null'
    s=v if isinstance(v,str) else json.dumps(v)
    t='q'+secrets.token_hex(4)
    return f'${t}${s}${t}$'
def q(uid, sql):
    """run sql as the authenticated user uid (None = anon); returns (ok, text)"""
    pre = "begin;\n"
    if uid: pre += f"set local role authenticated; set local request.jwt.claim.sub = '{uid}';\n"
    else: pre += "set local role anon;\n"
    p=subprocess.run(PSQL, input=pre+sql+"\ncommit;\n", capture_output=True, text=True)
    if p.returncode: 
        err=p.stderr.strip().splitlines()
        msg=[l for l in err if 'ERROR' in l]
        return False, (msg[0].split('ERROR:',1)[1].strip() if msg else p.stderr.strip())
    return True, p.stdout.strip()
def admin(sql):
    p=subprocess.run(PSQL, input=sql, capture_output=True, text=True)
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout.strip()
