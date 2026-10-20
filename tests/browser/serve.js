// Static server for public/ that applies the "/*" headers from public/_headers (Cloudflare format).
const http = require('http'), fs = require('fs'), path = require('path');
const root = process.argv[2], port = +process.argv[3];
const hdrs = {}; let cur = null;
for (const line of fs.readFileSync(path.join(root, '_headers'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  if (!/^\s/.test(line)) { cur = line.trim(); hdrs[cur] = {}; continue; }
  const i = line.indexOf(':'); hdrs[cur][line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript' };
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; if (p === '/portal') p = '/portal.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', ...hdrs['/*'] });
  fs.createReadStream(f).pipe(r);
}).listen(port, () => console.log('serving', root, port));
