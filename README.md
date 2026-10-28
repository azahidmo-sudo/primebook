# PrimeBook

Single-page accounting and forex app. Hosted on Cloudflare, data in Supabase.

## Client portal login
1. Run `supabase/session-guard.sql`, then `supabase/client-portal.sql` once in Supabase (SQL Editor).
2. Supabase > Authentication > URL Configuration: add `https://primebook.azahid-mo.workers.dev/portal` to Redirect URLs.
3. In PrimeBook > Customers > Customer Portal: enable a client, press Send invite, share the email, access code and portal address.
Clients sign in at `/portal`. They can only read the records published for their own login.

## Approval workflow (maker, checker, approver)
Cash In/Out, transfers, customer receipts and supplier payments entered by roles other than Owner or Manager are posted only after an Owner or Manager approves them in Daily transactions > Approval centre. Versions, comments and decisions are kept; posted entries are never edited (use a reversing entry).
Optional but recommended: run `supabase/approval-workflow.sql` once in Supabase. It adds an append-only, hash-chained copy of the audit trail (`pb_apw_audit`) that the app fills automatically. Test it with `supabase/tests/approval-audit.test.sh`.
Limit: staff roles are stored inside the books data and share one cloud login, so role rules are enforced by the app, not by the database.

## Daily closing control (branch-day close, lock, reopen)
Daily transactions > Daily closing now opens with a control section: a state per branch and day (Open, Counting, Reconciling, Pending approval, Closed, Locked, Reopened), a readiness checklist whose blockers link to the screen that fixes them, variance records (reason, evidence, maker, checker), reopen requests that another manager or owner must approve, a carry-forward bridge, an all-branches roll-up and a printable audit pack.
- A day can only be closed when every blocking check passes. A variance above its threshold needs a reason, evidence and a second person.
- Locking a day stores an immutable snapshot with a hash. The audit pack is drawn from that snapshot, and a changed snapshot is reported.
- Reopening needs a reason and approval from someone other than the requester. The old closing, its variance entries and the lock are kept in the history.
- Policy (Owner only): blind count, dual-count threshold, variance thresholds by branch and currency, suspense limit, bank-line SLA, cutoff time and holidays by branch.
- Closing events use the same hash-chained audit as the Approval centre, mirrored to `pb_apw_audit` when `supabase/approval-workflow.sql` has been run.
Limits: role rules are enforced in the app, not by the database. Remittance orders and FX deals keep their own approvals.

## Receivables dashboard (Parties → Receivables)
Customer receivables by currency, aging, customer, branch and period, built on the existing ledger.
- Original-currency balances are never added together. Totals are base-currency (CAD) equivalents at the rate each item was booked, with the current board rate and its date shown beside them.
- Invoices, payments, unapplied credit and customer advances (GL 2150) are tracked separately. Payments are applied oldest-invoice-first, the same rule as the customer statement.
- Tie-out card proves the customer sub-ledger equals GL 1200, and flags duplicate receipt references.
- Click any customer or invoice for balances, allocation, GL posting, audit trail and full transaction history. CSV export on customers, invoices, payments and a customer's history.
- Payments are recorded through the existing receipt flow and its maker-checker approval (Approval centre). The dashboard is read-only.

## Typography system
One global type layer (end of `public/index.html`, `ty-sys`): Inter throughout, a single heading scale in sentence case, consistent table header and cell sizes, and tabular lining numerals on every figure so amounts, balances and rates align. A small post-render pass right-aligns numeric table columns and their headers. Presentation only; no data or accounting logic is touched.

## Daily cash report (Cashbook → Daily Cash Report)
Printable report in the company-document layout: company header, Receipts and Payments split into Cash / Non-cash / Total, cash reconciliation (opening, receipts, payments, transfers out, expected, counted, over/(short), status against the closing tolerance, closing carried forward), the denomination count saved at closing, notes and signature lines. One report per currency (currencies are never combined), till/account selector, previous/next day, per-account table, other-currencies summary, transaction listing, CSV export and print/PDF. Read-only: it reads the day's entries and the saved closing; it posts nothing.
## Month log

Cash Management > Month Log lists every day of a month on one page: receipts (cash and non-cash), cash payments, opening, expected and counted cash, over/(short), deposits, closing cash and status, with month totals, days short, KPI tiles and a receipts-by-day chart. Pick month, till/account and currency; click a day to open its Daily Cash Report; export CSV or print. Days that were never counted show as Not closed. Test: `tests/t1860.js` equivalent in the workspace (`w/t1860.js`).

## Daily Closing System (reconciliations, closing reports, next-day opening)
Daily transactions > Daily closing > **Reconciliations** and **Closing reports** extend the closing control above.
- **Bank reconciliation:** statement balance, reference and reconciling items (for example uncleared cheques). The difference to the books must be zero or have a reason.
- **Safe:** any cash sub-account named "Safe" or "Vault" is counted and reconciled like the till.
- **Currency stock count:** each currency is counted on its own, with a witness. A difference needs a reason and reference, then a stock adjustment raised by one person and approved by another manager or owner (Dr/Cr 6500 Cash Over/Short against 1100 at average cost).
- **Settlement agents (for example Taaj System):** each agent has its own receivable account ("Due from …"). Its balance is matched to the agent statement every day. A receipt from an agent that credits income instead of the agent account blocks the close.
- **Closing rates:** daily rates with their source, entered by an owner, manager or accountant and approved by another manager or owner. If there is no daily rate, the approved monthly FX closing rate is used, then the board mid rate.
- **Readiness:** all of the above are added as readiness checks. Owners can switch the bank, stock and agent requirements off. A day can no longer be locked while any blocker remains, and nothing can be posted to a locked branch day.
- **Snapshot:** locking stores the closing data in the snapshot, so the reports for a locked day never change.
- **Next-day opening:** the next day's opening balances are compared with the last locked close, and any change made to a locked day is reported as a blocker.
- **Closing reports:** opening balances, transaction register (CSV), account closing and trial balance, cash variance, bank, safe, multi-currency stock with closing rates and unrealized FX, remittance settlement, income and expense, exceptions, branch summary, staff activity with separation-of-duty checks, next-day opening, and journal-entry trace.

Income and expense are closed to P&L in the snapshot and the next-day opening (presented as current earnings). No daily closing journal is posted, so monthly and yearly income statements keep working.
Currency stock is stored as a current position, so the split by currency for earlier dates comes from locked snapshots.
Tests: `tests/daily-closing` (Playwright, 55 checks). Edit `dcs.src.js`, run `build.py`, serve `public/` on port 8766 and run `suite.py`.

## Daily Closing web app (`/closing`)

A separate page on this site, `https://<your-primebook-site>/closing`, where each branch runs its
daily close online. Every member of staff signs in with their own email and password; the books live
in your PrimeBook Supabase database.

**One-time setup**

1. Supabase dashboard → SQL Editor → New query → paste `supabase/daily-closing.sql` → Run.
   (If you use `supabase/session-guard.sql`, run that first; the closing tables then get the same
   session protection.)
2. Supabase dashboard → Authentication → URL Configuration → add `https://<your-primebook-site>/closing`
   to the Redirect URLs, so confirmation and password-reset links come back to the page.
3. Open `/closing`, choose **Create an account**, confirm your email, sign in, and create the branch
   book (for example *Vancouver*). You become its Owner.
4. Enter the opening balances for the first business day (or load the training sample in a separate
   training book).
5. Team page → add each person's email, ledger name and role (Teller, Manager, Finance, Auditor).
   Send them the `/closing` link; they create an account with that same email.

**What the server enforces** (whatever the browser does): only active members can read a book;
auditors cannot save; every save carries the revision it was based on, so two people can never
overwrite each other; the audit trail is append-only and each new entry must carry the saver's own
account; a locked day can never change; approving or locking needs a Manager, Finance or Owner who
did not prepare or submit the day; every save is logged with who and when (`dc_saves`).
Finer rules (which role may record, count or reverse) are enforced by the page.

**Sources and tests:** the page is built from `closing/` with `python3 closing/build.py`
(do not edit `public/closing.html` by hand). Tests are in `tests/daily-closing-web/`
(47 database checks, 44 browser checks with four staff working at once).
