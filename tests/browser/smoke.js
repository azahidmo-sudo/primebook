// Renders every view in V and records render errors, page errors and CSP violations.
const open = require('./onboard.js');
const url = process.argv[2], tag = process.argv[3] || 'run'; require('fs').mkdirSync(require('os').tmpdir() + '/primebook-test-' + tag, { recursive: true });
(async () => {
  const { b, page, log } = await open(url);
  const keys = await page.evaluate(() => Object.keys(V).filter(k => typeof V[k] == 'function'));
  const failed = {};
  for (const k of keys) {
    const r = await page.evaluate(k => { try { view = k; go(); return ''; } catch (e) { return String(e && e.message || e).slice(0, 120); } }, k);
    if (r) failed[k] = r;
    await page.evaluate(() => { const o = document.getElementById('pberr'); if (o) o.remove(); document.querySelectorAll('#rmd,#pbm,#pbvag').forEach(x => x.remove()); });
  }
  await page.waitForTimeout(500);
  const csp = log.filter(x => /CSPV|Content Security/.test(x));
  console.log(JSON.stringify({ tag, views: keys.length, renderFailures: Object.keys(failed).length, failed, cspViolations: [...new Set(csp)], otherErrors: [...new Set(log.filter(x => !/CSPV|Content Security/.test(x)))].slice(0, 15) }, null, 1));
  if (csp.length) { console.log('FAIL: CSP violations'); process.exitCode = 1; } else console.log('PASS: no CSP violations across ' + keys.length + ' views');
  await b.close();
})();
