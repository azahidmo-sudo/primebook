// Shared helper: open the app in preview mode and complete the company profile step.
const { chromium } = require('playwright');
module.exports = async function open(url, out) {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, rt => rt.abort());
  const page = await ctx.newPage(); const log = [];
  page.on('console', m => { if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || /CSPV|Content Security Policy/i.test(m.text())) log.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => log.push('pageerror: ' + e.message.slice(0, 300)));
  page.dialogs = []; page.on('dialog', d => { page.dialogs.push(d.message()); d.accept(); });
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error('CSPV ' + e.violatedDirective + ' ' + e.blockedURI)));
  await page.goto(url); await page.waitForTimeout(1200);
  await page.locator('[data-cs=c_offline]').first().click(); await page.waitForTimeout(2000);
  await page.evaluate(() => { const A = JSON.parse(localStorage.getItem('fd_auth') || '[]'); A.forEach(x => { if (x.id == 'preview') x.pd = 1; }); localStorage.setItem('fd_auth', JSON.stringify(A)); });
  await page.reload(); await page.waitForTimeout(2500);
  await page.evaluate(() => { const r = document.getElementById('rmd'); if (r) r.remove(); });
  if (out) await page.screenshot({ path: out });
  return { b, page, log };
};
