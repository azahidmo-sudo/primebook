#!/usr/bin/env bash
# Runs the Phase 0 regression tests.
#   Browser tests: need Node 18+ and Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
#   SQL test:      needs psql pointed at a throwaway PostgreSQL 15+ database (PGHOST/PGPORT/PGDATABASE). Never production.
# Usage: tests/run.sh [browser|sql|all]   (default: all)
set -euo pipefail
cd "$(dirname "$0")/.."
what="${1:-all}"
status=0

if [[ "$what" == "browser" || "$what" == "all" ]]; then
  port=8137
  node tests/browser/serve.js "$PWD/public" "$port" >/dev/null 2>&1 &
  srv=$!
  trap 'kill $srv 2>/dev/null || true' EXIT
  sleep 1
  for t in func conflict smoke; do
    echo "== $t"
    node "tests/browser/$t.js" "http://localhost:$port/" ci | grep -E '^(PASS|FAIL)' || status=1
  done
fi

if [[ "$what" == "sql" || "$what" == "all" ]]; then
  echo "== book-history.sql"
  psql -v ON_ERROR_STOP=1 -q -f tests/book-history.test.sql | grep -E 'passed|FAIL' || status=1
fi

exit $status
