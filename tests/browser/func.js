const open = require('./onboard.js');
const url = process.argv[2], tag = process.argv[3] || 'run'; require('fs').mkdirSync(require('os').tmpdir() + '/primebook-test-' + tag, { recursive: true });
(async () => {
  const { b, page, log } = await open(url);
  const R = {};
  // 1. Closed day: an ordinary entry, a closing reversal, and an FX revaluation, all dated a closed day.
  R.closedDay = await page.evaluate(() => {
    const d = today(), out = {}; const n0 = S.j.length;
    const tryPost = o => { try { post(o); return 'posted'; } catch (e) { return 'refused: ' + e.message.slice(0, 90); } };
    out.beforeClose = tryPost({ date: d, br: 'b1', tt: 'Closing variance', memo: 'variance', lines: [['6500', 5, 0], ['1000', 0, 5]] });
    const vj = S.j[S.j.length - 1].id;
    S.closings.push({ id: 'zT', date: d, br: 'b1', acc: 'cash|b1', accLabel: 'Cash', rows: [], je: [vj], by: 'Admin' });
    out.ordinaryEntry = tryPost({ date: d, br: 'b1', memo: 'late sale', lines: [['1000', 50, 0], ['4100', 0, 50]] });
    out.fxRevaluation = tryPost({ date: d, br: 'b1', tt: 'FX revaluation', memo: 'reval', lines: [['1100', 1, 0], ['4200', 0, 1]] });
    out.otherBranchSameDay = S.br.length > 1 ? tryPost({ date: d, br: S.br[1].id, memo: 'other branch', lines: [['1000', 50, 0], ['4100', 0, 50]] }) : 'n/a (one branch)';
    try { (window.dcReopen || dcReopen)('zT'); out.reopen = S.closings.some(c => c.id == 'zT') ? 'closing still present' : 'reopened; reversal posted: ' + S.j.some(x => x.tt == 'Closing reversal'); } catch (e) { out.reopen = 'error: ' + e.message; }
    out.afterReopen = tryPost({ date: d, br: 'b1', memo: 'sale after reopen', lines: [['1000', 50, 0], ['4100', 0, 50]] });
    return out;
  });
  // 2. View as: add a cashier, act as them, then try to switch to the Owner and to another cashier.
  await page.evaluate(() => { S.users.push({ name: 'Cara Cashier', role: 'Cashier', br: 'All', status: 'Active' }, { name: 'Ben Cashier', role: 'Cashier', br: 'All', status: 'Active' }); ensure(); S.me = 1; save(); go(); });
  await page.waitForTimeout(500);
  const sw = async i => { await page.evaluate(i => { const s = document.getElementById('us'); s.value = String(i); s.dispatchEvent(new Event('change')); }, i); await page.waitForTimeout(500); };
  await sw(0);
  R.viewAsToOwner = { dialogShown: await page.locator('#pbvag').count() > 0, activeUserNow: await page.evaluate(() => me().name) };
  if (R.viewAsToOwner.dialogShown) {
    await page.screenshot({ path: require('os').tmpdir() + '/primebook-test-' + tag + '/view-as-gate.png' });
    await page.fill('#pbvag input[type=password]', 'whatever'); await page.click('#pbvag button[type=submit]'); await page.waitForTimeout(800);
    R.viewAsToOwner.afterSubmitInPreview = await page.evaluate(() => me().name); // preview has no password, so rstVerify() returns null and the switch is allowed
  }
  await page.evaluate(() => { S.me = 1; save(); go(); }); await page.waitForTimeout(300);
  await sw(2);
  R.viewAsToCashier = { dialogShown: await page.locator('#pbvag').count() > 0, activeUserNow: await page.evaluate(() => me().name) };
  // 3. View as with a real password check that fails (simulate an online book).
  await page.evaluate(() => { S.me = 1; save(); go(); window.__vc = window.pbVerifyCloud; window.pbVerifyCloud = async () => false; }); await page.waitForTimeout(300);
  const hasGate = await page.evaluate(() => typeof window.pbViewAs == 'function');
  if (hasGate) {
    await sw(0); await page.fill('#pbvag input[type=password]', 'wrong'); await page.click('#pbvag button[type=submit]'); await page.waitForTimeout(600);
    R.viewAsWrongPassword = { stillCashier: await page.evaluate(() => me().name), message: await page.locator('#pbvage').innerText().catch(() => '') };
    await page.evaluate(() => { const o = document.getElementById('pbvag'); if (o) o.remove(); window.pbVerifyCloud = window.__vc; S.me = 1; save(); go(); });
  }
  // 4. Online reset without server history, through the real Reset form.
  await page.evaluate(() => { S.me = 0; save(); window.__keep = [window.PB_CLOUD, window.pbUid, window.pbRest]; window.PB_CLOUD = {}; window.pbUid = () => 'u1';
    window.pbRest = async () => { throw Object.assign(new Error('Could not find the function'), { status: 404 }); }; view = 'clr'; go(); });
  await page.waitForTimeout(600);
  const n0 = await page.evaluate(() => S.j.length); const d0 = page.dialogs.length;
  if (await page.locator('#rstf').count()) {
    await page.check('#rstf input[name=s_tx]'); await page.fill('#rstf input[name=confirm]', 'RESET'); await page.fill('#rstf input[name=rpw]', 'x');
    await page.click('#rstf button'); await page.waitForTimeout(1200);
  }
  R.onlineReset = { formFound: await page.locator('#rstf').count() > 0 || page.dialogs.length > d0, journalsBefore: n0, journalsAfter: await page.evaluate(() => S.j.length), alerts: page.dialogs.slice(d0).map(m => m.slice(0, 110)) };
  await page.evaluate(() => { [window.PB_CLOUD, window.pbUid, window.pbRest] = window.__keep; });
  // 5. Email verification code.
  R.emailCode = await page.evaluate(() => { const msgs = []; const oa = window.alert; window.alert = m => msgs.push(m); S.users[0].email = 'a@b.co'; try { sendCode(0); } catch (e) {} window.alert = oa; return { codeGenerated: !!(typeof ep != 'undefined' && ep && ep.code), alert: (msgs[0] || '').slice(0, 80) }; });
  R.consoleErrors = log;
  console.log(JSON.stringify({ tag, ...R }, null, 1));
  if (tag !== 'old') {
    const c = R.closedDay, fail = [];
    if (!/^refused: The cash day/.test(c.ordinaryEntry)) fail.push('closed day not enforced');
    if (c.fxRevaluation !== 'posted' || !/reversal posted: true/.test(c.reopen) || c.afterReopen !== 'posted') fail.push('closing exemptions broken');
    if (!R.viewAsToOwner.dialogShown || R.viewAsToOwner.activeUserNow === 'Admin') fail.push('view-as gate missing');
    if (R.viewAsToCashier.dialogShown) fail.push('gate shown for cashier switch');
    if (!R.viewAsWrongPassword || R.viewAsWrongPassword.stillCashier !== 'Cara Cashier') fail.push('wrong password switched user');
    if (R.onlineReset.journalsAfter !== R.onlineReset.journalsBefore || !/turned off/.test(R.onlineReset.alerts.join(' '))) fail.push('online reset not blocked');
    if (R.emailCode.codeGenerated) fail.push('demo email code still generated');
    if (R.consoleErrors.length) fail.push('console errors');
    console.log(fail.length ? 'FAIL: ' + fail.join('; ') : 'PASS: phase 0 functional checks'); if (fail.length) process.exitCode = 1;
  }
  await b.close();
})();
