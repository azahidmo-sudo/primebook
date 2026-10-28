function vDesign(){const ent=[
 ['branch','id, code, name, timezone, base_currency (CAD), status','A location that closes its own day.'],
 ['staff_user','id, name, email, role, branch_ids[], status, mfa','Signed-in person. Role and branches come from the identity provider.'],
 ['role_permission','role, permission, scope (branch / all)','What each role may do. Changes are approved and logged.'],
 ['business_day','id, branch_id, business_date, status, prev_day_id, opened_by/at, submitted_by/at, approved_by/at, locked_by/at, reopen_count','One row per branch per date. Status drives the workflow.'],
 ['account','code, name, class (A/L/E/I/X), group, currency (fixed or multi), sub_type (till, safe, bank, fx_stock, settlement), branch_scope, active','Chart of accounts. Only A, L, E carry forward.'],
 ['opening_balance','day_id, account, currency, fc_amount, cad_amount, source_day_id, adjustment_id','Written only by the system from the prior locked close.'],
 ['transaction','ref (TX-…), day_id, branch, staff, created_at, type, description, customer/agent ref, ccy, amount, rate_id, status','The business event the teller records.'],
 ['journal_entry','ref, type (TX / ADJ / REV / CL / FXR), transaction_ref, posted_by, approved_by, reverses_ref, posted_at','The accounting record. Never updated after posting.'],
 ['journal_line','entry_ref, line_no, account, currency, fc_amount, rate, rate_id, debit_cad, credit_cad','Sum of debits = sum of credits per entry, in CAD.'],
 ['fx_rate','id, date, currency, type (buy / sell / mid / closing), rate, source, published_at, approved_by','Every rate used is stored with its source.'],
 ['fx_cost_pool','branch, currency, qty, cad_cost, avg_rate (after each movement)','Weighted average cost for realized gain on sale.'],
 ['cash_count','day_id, account, currency, denomination, quantity, counted_by, witness','Till, safe and foreign-note counts.'],
 ['reconciliation','day_id, account, type, expected, actual, variance, variance_cad, reason, support_ref, status, prepared_by, reviewed_by','One per account to reconcile.'],
 ['recon_item','reconciliation_id, ref, description, amount, age_days, cleared_ref','Outstanding cheques, deposits in transit, unmatched agent lines.'],
 ['adjustment','ref (ADJ-…), day_id, reason, journal_ref, requested_by, approved_by, status','The only way to change balances outside a transaction.'],
 ['agent_statement','agent (Taaj), date, line_ref, amount, matched_journal_ref','Imported settlement statements.'],
 ['exception','day_id, type, severity, owner, due, status, resolution','Anything needing a human decision.'],
 ['audit_log','seq, at, user, role, branch, action, entity, before, after, result, device, prev_hash, hash','Append-only, hash-chained.']];
 const perms=[['Open day / load opening','✓','✓','—','—'],['Record transactions','✓','✓','—','—'],['Enter cash and stock counts','✓','✓ (witness)','—','—'],['Explain variances','✓','✓','—','—'],['Raise adjustment','✓','✓','—','—'],['Approve adjustment (not own)','—','✓','✓','—'],['Submit day','✓','✓','—','—'],['Approve day (not own)','—','✓','—','—'],['Return day with reason','—','✓','✓','—'],['Lock day / next-day opening','—','✓','✓','—'],['Reverse posted transaction','—','✓','✓','—'],['Reopen locked day (reason + 2nd approver)','—','—','✓','—'],['Publish and approve closing rates','—','—','✓ (Treasury)','—'],['Edit opening balances','—','—','—','—'],['View reports and audit trail','Own branch','Own branch','All','All']];
 return`<section class="sec"><div class="sec-h"><div><span class="eyebrow">Architecture</span><h2>How the system fits together</h2></div></div>
 <p class="lede">One ledger, many branches. Tellers record business events; the system turns each into a balanced journal. The closing workflow sits on top of the ledger and decides when a branch day can be approved and locked. Reports read the same ledger, so they always agree.</p>
 <div class="grid3"><div class="stack"><h3>Capture</h3><p class="mu">Teller screens for buy, sell, remittance payout, settlement, expense and transfer. Each picks accounts from the chart of accounts and a rate from the rate board.</p></div>
 <div class="stack"><h3>Ledger</h3><p class="mu">Posting service validates, balances and writes journals in CAD with the original currency, amount and rate on every line. Posted entries are append-only.</p></div>
 <div class="stack"><h3>Close</h3><p class="mu">Business-day service: opening carry-forward, counts, reconciliations, blockers, approvals, lock, P&amp;L close and next-day opening.</p></div></div></section>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Workflow</span><h2>Business-day states</h2></div><p>Each transition is permission-checked and logged</p></div>
 <pre class="mermaid">stateDiagram-v2
  [*] --> NotOpened
  NotOpened --> Open: Open day (Teller) - opening loaded from prior locked close
  Open --> Open: Record transactions, count, reconcile, explain variances
  Open --> Submitted: Submit (zero blockers)
  Submitted --> Returned: Return with reason (Manager)
  Returned --> Submitted: Correct and resubmit
  Submitted --> Approved: Approve (Manager, not the preparer)
  Approved --> Locked: Lock day - CL entry closes P&amp;L
  Locked --> NextDayOpen: Generate next-day opening (carries balance-sheet balances, rates proposed for approval)
  Locked --> Reopened: Reopen (Finance, reason, second approver)
  Reopened --> Submitted</pre></section>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Data model</span><h2>Core tables</h2></div></div><div class="tw"><table><thead><tr><th>Table</th><th>Key fields</th><th>Purpose</th></tr></thead><tbody>${ent.map(e=>`<tr><td class="ref">${e[0]}</td><td style="min-width:320px">${A(e[1])}</td><td>${A(e[2])}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Chart of accounts used in the sample</span><h2>Accounts</h2></div></div><div class="tw"><table><thead><tr><th>Code</th><th>Name</th><th>Class</th><th>Currency</th><th>At close</th></tr></thead><tbody>${ACC.map(a=>`<tr><td class="ref">${a.code}</td><td>${A(a.name)}${a.code=='1210'?' <span class="tag">asset, not income</span>':''}</td><td>${A(a.grp)}</td><td>${a.ccy}</td><td>${a.bs?'Carry forward':'Close to 3900'}</td></tr>`).join('')}</tbody></table></div>
 <div class="callout"><h3>Taaj System</h3><p>1210 Due from Taaj System is a settlement asset (a due-from-agent receivable). Paying out a Taaj remittance increases it. A cash or bank receipt from Taaj reduces it (<span class="mono">Dr 1000 or 1010 / Cr 1210</span>). Only the commission is income. Receipts from Taaj must never be posted to an income account; the posting service rejects that combination.</p></div></section>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Access</span><h2>Role permissions</h2></div><p>Branch scope applies to every row</p></div><div class="tw"><table class="matrix"><thead><tr><th>Permission</th><th>Teller</th><th>Branch Manager</th><th>Finance</th><th>Auditor</th></tr></thead><tbody>${perms.map(r=>`<tr>${r.map((c,i)=>`<td>${i==0?A(c):c=='—'?'<span class="x">—</span>':c.startsWith('✓')?'<span class="y">'+A(c)+'</span>':A(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Policies</span><h2>Accounting rules</h2></div></div><div class="grid2">
 <div class="stack"><h3>Opening balances</h3><p class="mu">Copied by the system from the prior day's locked close, by branch, account and currency. No input field exists. A correction is an adjustment journal with reason, maker and a different approver.</p>
 <h3>Closing</h3><p class="mu">Closing = opening + debits − credits, per account and currency. Assets, liabilities and equity carry forward. At lock, a CL entry moves every income and expense balance to 3900, so they open at zero next day. Period income statements read journals excluding CL entries.</p></div>
 <div class="stack"><h3>Foreign exchange</h3><p class="mu">Each foreign currency has its own stock account and is counted, reconciled and totalled on its own. Lines keep the foreign amount and rate; CAD is the functional currency for every total. Sales and payouts realize gain or loss against weighted average cost. Unrealized gain or loss is calculated daily at Treasury closing rates and posted at month-end, reversed on the first day of the next month.</p>
 <h3>Corrections</h3><p class="mu">Nothing posted is edited or deleted. A reversal (REV) mirrors the original. A reopened day keeps its first approval history and needs a fresh approval.</p></div></div></section>`}

function vCtl(){const vr=[
 ['VR-01','Business date','Cannot post to a future date, a locked date, or a date before the branch go-live.','Reject'],
 ['VR-02','Branch scope','Staff can select and post only in branches assigned to them.','Reject'],
 ['VR-03','Opening','Opening balances are system-written from the prior locked close; no user may edit them.','Reject'],
 ['VR-04','Prior day','A day cannot open until the previous business day is locked.','Reject'],
 ['VR-05','Balance','Each journal must balance in CAD to the cent; at least two lines; no zero or negative amounts.','Reject'],
 ['VR-06','Reference','Transaction and journal references are unique per company and never reused.','Reject'],
 ['VR-07','Accounts','Account must be active and allowed for the purpose: cash/bank in “paid from”, income only from earned income, Taaj receipts only against 1210.','Reject'],
 ['VR-08','Currency','Line currency must match the account currency; multi-currency accounts keep a separate balance per currency.','Reject'],
 ['VR-09','Rate','Every foreign line needs a rate with a source. A rate more than 2% from the board rate needs a manager override with reason.','Reject / approve'],
 ['VR-10','Funds','Till and FX stock can never go below zero. Bank accounts follow their overdraft limit.','Reject'],
 ['VR-11','Counts','Denomination quantities are whole numbers ≥ 0; counted total = Σ denomination × quantity.','Reject'],
 ['VR-12','Variance','Any variance ≠ 0 needs a reason (10+ characters) and a supporting reference.','Blocker'],
 ['VR-13','Stock variance','A stock variance is cleared only by an approved adjustment at carrying cost.','Blocker'],
 ['VR-14','Reconciliation','Bank and agent settlement differences must be zero after listed outstanding items.','Blocker'],
 ['VR-15','Closing rates','Closing rates for every held currency approved before submit.','Blocker'],
 ['VR-16','Segregation','Maker ≠ checker for adjustments, day approval and reopening.','Reject'],
 ['VR-17','Lock','No posting, count or reason change after submit unless the day is returned; nothing after lock unless Finance reopens.','Reject'],
 ['VR-18','Compliance','Cash transactions of CAD 10,000 or more (single or 24-hour aggregate) flagged for the FINTRAC large cash report before submit.','Blocker'],
 ['VR-19','Reversal','Only Manager or Finance; reason required; original stays and is linked.','Reject']];
 const integ=[['Identity provider (SSO)','Sign-in, MFA, role and branch assignment','Real time'],['General ledger / posting API','All journals; month-end consolidation','Real time'],['Treasury rate feed','Buy, sell and closing mid rates with source and approver','Morning and 17:00 PT'],['Bank statement feed','Statement lines for bank reconciliation (CSV or BAI2)','Daily'],['Taaj agent portal','Payout confirmations and daily settlement statement','Hourly + daily statement'],['Compliance (FINTRAC)','Large cash and suspicious transaction reports; KYC references','Event driven'],['Document store','Count sheets, receipts, incident reports linked by reference','On upload'],['Notifications','Blockers, pending approvals, overdue closes to managers','Event driven'],['Reporting / export','PDF and CSV of every report; read-only API for BI','On demand']];
 return`<section class="sec"><div class="sec-h"><div><span class="eyebrow">Validation and control rules</span><h2>What the system enforces</h2></div></div><div class="tw"><table><thead><tr><th>Rule</th><th>Area</th><th>Rule</th><th>Outcome</th></tr></thead><tbody>${vr.map(r=>`<tr><td class="ref">${r[0]}</td><td>${r[1]}</td><td style="min-width:320px">${A(r[2])}</td><td>${chip(r[3]=='Blocker'?'Blocks submit':r[3])}</td></tr>`).join('')}</tbody></table></div></section>
 <div class="grid2"><section class="sec"><div class="sec-h"><div><span class="eyebrow">Dashboard</span><h2>Blockers</h2></div></div><p class="lede">Submit and Approve stay disabled while any blocker is open. The live list for Vancouver:</p><ul class="checks">${E.checks(D).map(c=>`<li><span class="ic ${c.ok?'ok':c.sev=='block'?'bad':'warn'}">${c.ok?'✓':'!'}</span><span>${A(c.text)}</span><span></span></li>`).join('')}</ul></section>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Exceptions</span><h2>Exception handling</h2></div></div><div class="tw"><table><thead><tr><th>Severity</th><th>Examples</th><th>Handling</th></tr></thead><tbody>
 <tr><td>${chip('High')}</td><td>Till variance, unmatched agent settlement, unbalanced posting attempt</td><td>Blocks submit. Manager notified at once. Resolve same day.</td></tr>
 <tr><td>${chip('Medium')}</td><td>FX stock variance, rate override, reversal</td><td>Needs reason + reference + approved adjustment. Visible to Finance.</td></tr>
 <tr><td>${chip('Low')}</td><td>Outstanding bank item, refused actions</td><td>Monitored; escalates after 7 days or repeated attempts.</td></tr>
 <tr><td>${chip('Info')}</td><td>Unrealized FX moves, compliance threshold checks</td><td>Reported; no action unless limits are breached.</td></tr></tbody></table></div></section></div>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Audit trail</span><h2>What is recorded</h2></div></div><p class="lede">Every action, including refused attempts, writes one append-only entry: time, user, role, branch, action, entity and reference, before and after values, result, and device. Each entry carries a hash of itself plus the previous entry, so a change to history breaks the chain. Auditors read everything and change nothing.</p></section>
 <section class="sec"><div class="sec-h"><div><span class="eyebrow">Integration points</span><h2>Connected systems</h2></div></div><div class="tw"><table><thead><tr><th>System</th><th>Exchange</th><th>Timing</th></tr></thead><tbody>${integ.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div></section>`}

