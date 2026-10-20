// Two-device sync conflict, end to end in Chromium, against a fake Supabase that implements the
// same version-guarded PATCH the app relies on (books?id=eq.X&version=eq.N).
const { chromium } = require('playwright');
const url = process.argv[2], tag = process.argv[3] || 'run', out = require('os').tmpdir() + '/primebook-test-' + tag;
require('fs').mkdirSync(out, { recursive: true });
const SB = 'https://htrlqotaetdwccervhmd.supabase.co';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const uid = 'aaaaaaaa-0000-4000-8000-000000000001', email = 'owner@test.local';
const today = new Date().toISOString().slice(0, 10);
const server = { row: { id: 'bbbbbbbb-0000-4000-8000-000000000001', name: 'Test Bureau', version: 1, updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
  data: { base: 'USD', co: { name: 'Test Bureau' }, br: [{ id: 'b1', name: 'Main Branch' }], users: [{ name: 'Admin', role: 'Owner', br: 'All' }], cust: [{ id: 'c1', name: 'Walk-in / Cash', type: 'Customer' }], rates: { EUR: { b: 1.07, s: 1.1 } }, pos: {}, items: [], ist: {}, inv: [], fx: [],
    j: [{ id: 1, date: '2026-10-01', br: 'b1', memo: 'Opening capital', cust: '', lines: [['1000', 100000, 0], ['3000', 0, 100000]] }] } }, patches: [] };
let sess = 0;
async function fake(route) {
  const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
  const json = (code, body) => route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(body) });
  if (p === '/auth/v1/token') { sess++; const t = 'x.' + b64({ sub: uid, email, role: 'authenticated', aal: 'aal1', session_id: 'cccccccc-0000-4000-8000-00000000000' + sess, exp: Math.floor(Date.now() / 1000) + 3600 }) + '.sig';
    return json(200, { access_token: t, refresh_token: 'r' + sess, expires_in: 3600, user: { id: uid, email } }); }
  if (p === '/auth/v1/user') return json(200, { id: uid, email, factors: [] });
  if (p.startsWith('/auth/v1/')) return json(200, {});
  if (p === '/rest/v1/books' && m === 'GET') return json(200, server.row ? [server.row] : []);
  if (p === '/rest/v1/books' && m === 'PATCH') {
    const ver = +u.searchParams.get('version').replace('eq.', ''), body = JSON.parse(req.postData());
    server.patches.push({ from: ver, ok: ver === server.row.version });
    if (ver !== server.row.version) return json(200, []);
    Object.assign(server.row, body, { updated_at: new Date().toISOString() }); return json(200, [server.row]);
  }
  if (p.startsWith('/rest/v1/rpc/')) return json(404, { code: 'PGRST202', message: 'Could not find the function' });
  return json(404, {});
}
async function device(b, name) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.request().url().startsWith(SB) ? fake(r) : r.abort());
  const page = await ctx.newPage(); page.errs = [];
  page.on('pageerror', e => page.errs.push(e.message)); page.on('dialog', d => d.accept());
  await page.goto(url); await page.waitForTimeout(1200);
  await page.fill('form[data-cf=login] input[name=em]', email); await page.fill('form[data-cf=login] input[name=p]', 'correct horse battery');
  await page.click('form[data-cf=login] button'); await page.waitForTimeout(3500);
  await page.evaluate(() => { const r = document.getElementById('rmd'); if (r) r.remove(); });
  page.name = name; return page;
}
const sell = (page, memo) => page.evaluate(([memo, d]) => { post({ date: d, br: 'b1', memo, lines: [['1200', 500, 0], ['4100', 0, 500]] }); save(); go(); return S.j.length; }, [memo, today]);
(async () => {
  const b = await chromium.launch();
  const A = await device(b, 'Airport till'), B = await device(b, 'Main till');
  const inApp = [await A.locator('#m .top').count(), await B.locator('#m .top').count()];
  await sell(A, 'Sale on device A'); await A.waitForTimeout(3000);          // pushes v1 -> v2
  await sell(B, 'Sale on device B'); await B.waitForTimeout(3500);          // push fails -> conflict modal
  await B.screenshot({ path: out + '/conflict-modal.png' });
  const buttons = await B.locator('#pbm button').allInnerTexts();
  let action = '', download = null;
  if (await B.locator('#pbc2').count()) { action = 'clicked "Keep this device\'s copy" (old build)'; await B.click('#pbc2'); await B.waitForTimeout(3500); }
  else if (await B.locator('#pbc1').count()) {
    action = 'clicked "' + (await B.locator('#pbc1').innerText()) + '"';
    const [dl] = await Promise.all([B.waitForEvent('download', { timeout: 5000 }).catch(() => null), B.click('#pbc1')]);
    download = dl ? dl.suggestedFilename() : null; await B.waitForTimeout(3000);
  }
  const memos = server.row.data.j.map(x => x.memo);
  const bAfter = await B.evaluate(() => S.j.map(x => x.memo)).catch(() => 'n/a');
  console.log(JSON.stringify({ tag, inApp, conflictButtons: buttons, action, downloadedFile: download, serverVersion: server.row.version,
    serverJournal: memos, deviceAJournalSurvivesInCloud: memos.includes('Sale on device A'), deviceBNowShows: bAfter,
    patches: server.patches, pageErrors: [...A.errs, ...B.errs] }, null, 1));
  if (tag !== 'old') { const ok = memos.includes('Sale on device A') && !!download; console.log(ok ? 'PASS: conflict keeps the other device\'s sale' : 'FAIL: conflict lost data'); if (!ok) process.exitCode = 1; }
  await b.close();
})();
