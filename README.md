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
