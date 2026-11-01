// PrimeBook edge worker. Serves the static app and adds two security features:
//  1. GET /api/whoami   -> the caller's IP as seen by Cloudflare (used by Settings > Access & security)
//  2. ALLOWED_IPS       -> optional hard network restriction for every request (comma-separated IPs or IPv4 CIDRs)
const v4 = s => { const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s); if (!m) return null; const p = m.slice(1).map(Number); if (p.some(x => x > 255)) return null; return ((p[0] * 16777216) + (p[1] << 16) + (p[2] << 8) + p[3]) >>> 0; };
const match = (ip, list) => list.some(e => {
  e = e.trim().toLowerCase(); if (!e) return false;
  const [a, m] = e.split('/'); if (m == null) return a === ip.toLowerCase();
  const n = v4(ip), b = v4(a); if (n == null || b == null) return false;
  const bits = +m, mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((n & mask) >>> 0) === ((b & mask) >>> 0);
});
export default {
  async fetch(req, env) {
    const ip = req.headers.get('CF-Connecting-IP') || '';
    const allowed = (env.ALLOWED_IPS || '').split(',').filter(x => x.trim());
    if (allowed.length && !match(ip, allowed)) {
      return new Response('Access from this network is not allowed.', { status: 403, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
    }
    const url = new URL(req.url);
    if (url.pathname === '/api/whoami') {
      return new Response(JSON.stringify({ ip }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    return env.ASSETS.fetch(req);
  }
};
