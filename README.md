# PrimeBook

Single-page accounting and forex app. Hosted on Cloudflare, data in Supabase.

## Client portal login
1. Run `supabase/session-guard.sql`, then `supabase/client-portal.sql` once in Supabase (SQL Editor).
2. Supabase > Authentication > URL Configuration: add `https://primebook.azahid-mo.workers.dev/portal` to Redirect URLs.
3. In PrimeBook > Customers > Customer Portal: enable a client, press Send invite, share the email, access code and portal address.
Clients sign in at `/portal`. They can only read the records published for their own login.

## Server-side book history (Phase 0)
1. Run `supabase/book-history.sql` once in Supabase (SQL Editor). Every save then keeps the previous version in `books_history`, versions must step by one, and the API can no longer delete a book.
2. To restore: `select * from pb_book_versions('<book id>');` then `select pb_book_restore('<book id>', <version>);` (a restore is a new version, so it can be undone).
3. "Reset data" on an online book stays off until this is installed.
4. Turn on Point-in-Time Recovery in Supabase (Database > Backups) if your plan offers it.

## Audit checks
Run `supabase/audit-checks.sql` (read-only) and keep the output. It shows whether `books` has row-level security and which policies protect it.

## Tests
`tests/run.sh` runs the browser regression tests (Playwright + Chromium) and the SQL test (needs a throwaway PostgreSQL, never production). See the header of `tests/run.sh`.
