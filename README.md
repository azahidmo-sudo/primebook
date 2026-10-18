# PrimeBook

Single-page accounting and forex app. Hosted on Cloudflare, data in Supabase.

## Client portal login
1. Run `supabase/session-guard.sql`, then `supabase/client-portal.sql` once in Supabase (SQL Editor).
2. Supabase > Authentication > URL Configuration: add `https://primebook.azahid-mo.workers.dev/portal` to Redirect URLs.
3. In PrimeBook > Customers > Customer Portal: enable a client, press Send invite, share the email, access code and portal address.
Clients sign in at `/portal`. They can only read the records published for their own login.
