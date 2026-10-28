"""Local stand-in for Supabase (auth + PostgREST) backed by the real SQL in local Postgres.
Serves /home/claude/pb-main/public as the site, with /closing -> closing.html.
Usage: python3 shim.py PORT
"""
import json, os, re, secrets, sys, uuid, threading, urllib.parse
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(__file__))
from pgq import q, admin, lit

PUB = os.path.join(ROOT, 'public')
USERS = {}   # email -> {id, pw}
TOK = {}     # token -> uid
LOCK = threading.Lock()
LOG = []
PROCS = {}
def procs():
    if not PROCS:
        out = admin("select json_agg(json_build_object('n',p.proname,'set',p.proretset,'args',coalesce(p.proargnames,'{}'),'types',(select json_agg(format_type(t,null)) from unnest(p.proargtypes) t))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';")
        for p in json.loads(out): PROCS[p['n']] = p
    return PROCS

def token_for(uid):
    a = 'at.' + secrets.token_hex(12); r = 'rt.' + secrets.token_hex(12)
    TOK[a] = uid; TOK[r] = uid
    return a, r

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, body=None, ctype='application/json'):
        b = b'' if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode())
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(b)
    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n) or b'{}') if n else {}
    def uid(self):
        a = (self.headers.get('Authorization') or '').replace('Bearer ', '')
        return TOK.get(a)
    def do_GET(self): self.route('GET')
    def do_POST(self): self.route('POST')
    def do_PUT(self): self.route('PUT')
    def route(self, m):
        u = urllib.parse.urlparse(self.path); p = u.path; qs = urllib.parse.parse_qs(u.query)
        LOG.append((m, p, (self.headers.get('Authorization') or '')[-6:]))
        try:
            if p.startswith('/auth/v1/'): return self.auth(m, p[9:], qs)
            if p.startswith('/rest/v1/'): return self.rest(m, p[9:], qs, u.query)
            if p == '/__confirm':
                em = qs['email'][0]; admin(f"update auth.users set email_confirmed_at=now() where email={lit(em)};"); return self.send(200, {'ok': 1})
            if p == '/__reset':
                USERS.clear(); TOK.clear(); PROCS.clear(); return self.send(200, {'ok': 1})
            if p == '/__log': return self.send(200, LOG[-200:])
            return self.static(p)
        except Exception as e:
            return self.send(500, {'message': str(e)})
    def static(self, p):
        if p in ('/', ''): p = '/index.html'
        if p == '/closing': p = '/closing.html'
        f = os.path.normpath(os.path.join(PUB, p.lstrip('/')))
        if not f.startswith(PUB) or not os.path.isfile(f): return self.send(404, b'not found', 'text/plain')
        b = open(f, 'rb').read()
        if f.endswith('closing.html'):
            b = b.replace(b'<script>', b'<script>window.__DC_API=location.origin;</script><script>', 1)
        self.send(200, b, 'text/html; charset=utf-8' if f.endswith('.html') else 'application/octet-stream')
    def auth(self, m, ep, qs):
        b = self.body() if m in ('POST', 'PUT') else {}
        if ep == 'signup':
            em = b['email'].lower()
            with LOCK:
                if em in USERS: return self.send(400, {'msg': 'User already registered'})
                uid = str(uuid.uuid4()); USERS[em] = {'id': uid, 'pw': b['password']}
                admin(f"insert into auth.users(id,email,email_confirmed_at) values ('{uid}',{lit(em)},null);")
            return self.send(200, {'id': uid, 'email': em})
        if ep == 'token':
            gt = qs.get('grant_type', [''])[0]
            if gt == 'password':
                em = b['email'].lower(); x = USERS.get(em)
                if not x or x['pw'] != b['password']: return self.send(400, {'error_description': 'Invalid login credentials'})
                conf = admin(f"select email_confirmed_at is not null from auth.users where id='{x['id']}';")
                if conf != 't': return self.send(400, {'error_description': 'Email not confirmed'})
                uid = x['id']
            else:
                uid = TOK.get(b.get('refresh_token'))
                if not uid: return self.send(400, {'error_description': 'Invalid Refresh Token'})
            a, r = token_for(uid); em = [k for k, v in USERS.items() if v['id'] == uid][0]
            return self.send(200, {'access_token': a, 'refresh_token': r, 'expires_in': 3600, 'user': {'id': uid, 'email': em}})
        if ep == 'user':
            uid = self.uid()
            if not uid: return self.send(401, {'msg': 'invalid JWT'})
            em = [k for k, v in USERS.items() if v['id'] == uid][0]
            if m == 'PUT': USERS[em]['pw'] = b.get('password', USERS[em]['pw'])
            return self.send(200, {'id': uid, 'email': em})
        if ep in ('logout', 'recover'): return self.send(204)
        return self.send(404, {'msg': 'no such auth endpoint'})
    def rest(self, m, path, qs, raw):
        uid = self.uid()
        if not uid: return self.send(401, {'message': 'JWT expired'})
        if path.startswith('rpc/'):
            fn = path[4:]; pr = procs().get(fn)
            if not pr: return self.send(404, {'message': f'Could not find the function public.{fn}', 'code': 'PGRST202'})
            b = self.body(); types = dict(zip(pr['args'], pr['types'] or []))
            args = ', '.join(f"{k} => {lit(v if not isinstance(v, bool) else ('true' if v else 'false'))}::{types[k]}" for k, v in b.items())
            sql = (f"select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.{fn}({args}) t;" if pr['set'] else f"select to_jsonb(public.{fn}({args}));")
            ok, out = q(uid, sql)
            if not ok:
                LOG.append(('ERR', fn, out, b.get('p_base_rev'), self.uid()))
                return self.send(400, {'message': out, 'code': 'P0001'})
            return self.send(200, (out or 'null').encode())
        tbl = path
        if not re.fullmatch(r'[a-z_]+', tbl): return self.send(400, {'message': 'bad table'})
        cols = qs.pop('select', ['*'])[0]; order = qs.pop('order', [None])[0]; limit = qs.pop('limit', [None])[0]
        where = []
        for k, vs in qs.items():
            v = vs[0]
            if not v.startswith('eq.'): return self.send(400, {'message': 'only eq filters'})
            where.append(f"{k} = {lit(v[3:])}")
        sql = f"select coalesce(json_agg(t),'[]') from (select {cols} from public.{tbl}" + (' where ' + ' and '.join(where) if where else '')
        if order:
            c, d = (order.split('.') + ['asc'])[:2]; sql += f" order by {c} {d}"
        if limit: sql += f" limit {int(limit)}"
        ok, out = q(uid, sql + ") t;")
        if not ok: return self.send(400, {'message': out})
        return self.send(200, out.encode())

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8780
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
