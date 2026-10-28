# Daily Closing web app tests (/closing)

Runs the real `supabase/daily-closing.sql` in a local PostgreSQL 16 and drives
`public/closing.html` in Chromium against a small local stand-in for Supabase
(sign-in and REST), so every save goes through the real database functions.

    # one-time: a throwaway local Postgres on port 5499 (socket in /var/tmp/dcpg)
    initdb -D /var/tmp/dcpg/data -U postgres -A trust
    pg_ctl -D /var/tmp/dcpg/data -o "-p 5499 -k /var/tmp/dcpg" start

    python3 sql_test.py          # 47 database checks: roles, conflicts, locked days, audit trail
    python3 shim.py 8780 &       # local Supabase stand-in serving ../../public
    ./run.sh                     # 44 browser checks with four staff in parallel browsers

Requires Python Playwright with Chromium.
