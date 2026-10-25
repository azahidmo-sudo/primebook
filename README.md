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
