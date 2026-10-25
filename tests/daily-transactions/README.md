# Daily transactions – cash desk tests

`dx3.src.js` is the source of the `<script id="dx3">` block in `public/index.html`.
Edit it here, then run `python3 build.py` to inject it (idempotent).

End-to-end suite (Playwright, Python):

```
cd public && python3 -m http.server 8765 &
cd tests/daily-transactions && python3 suite.py
```

The suite uses preview mode with the fixture in `seed.js` (CAD books, two branches,
CAD and USD banks, an inactive bank) and checks dropdown filtering, journal generation,
non-income receipts, FX (book vs spot, realized gain/loss), transfers, overdraft rules,
approvals, role permissions, reversal and correction, closed days, trial balance and
daily closing figures.
