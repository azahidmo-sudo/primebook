#!/bin/sh
cd "$(dirname "$0")"
./reset.sh && curl -s 127.0.0.1:8780/__reset >/dev/null && timeout 500 python3 e2e.py 2>&1 | grep -v "^  \|Traceback\|^\s*~\|\^" | tail -70
