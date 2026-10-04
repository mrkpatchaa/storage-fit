#!/usr/bin/env bash
set -euo pipefail

PORT="${SMOKE_PORT:-4173}"
DOM_OUT="${SMOKE_DOM_OUT:-/tmp/storage-fit-smoke-dom.html}"
SERVER_LOG="${SMOKE_SERVER_LOG:-/tmp/storage-fit-smoke-server.log}"
CHROME_LOG="${SMOKE_CHROME_LOG:-/tmp/storage-fit-smoke-chrome.log}"

python3 -m http.server "$PORT" --bind 127.0.0.1 >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
cleanup(){
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 50); do
  if curl -fsS "http://127.0.0.1:$PORT/tests/smoke.html" >/dev/null; then
    break
  fi
  sleep 0.1
done
curl -fsS "http://127.0.0.1:$PORT/tests/smoke.html" >/dev/null

CHROME="${CHROME_BIN:-}"
if [[ -z "$CHROME" ]]; then
  for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$candidate" >/dev/null 2>&1; then
      CHROME=$(command -v "$candidate")
      break
    fi
  done
fi

if [[ -z "$CHROME" ]]; then
  echo "No Chrome/Chromium binary found." >&2
  exit 1
fi

"$CHROME" \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --virtual-time-budget=60000 \
  --dump-dom \
  "http://127.0.0.1:$PORT/tests/smoke.html" \
  >"$DOM_OUT" 2>"$CHROME_LOG"

if ! grep -q 'data-smoke-complete="true"' "$DOM_OUT"; then
  echo "Browser smoke tests did not complete." >&2
  tail -n 60 "$CHROME_LOG" >&2 || true
  exit 1
fi

if ! grep -q 'data-smoke-failures="0"' "$DOM_OUT"; then
  echo "Browser smoke tests failed:" >&2
  python3 - "$DOM_OUT" <<'PY'
from html.parser import HTMLParser
from pathlib import Path
import sys

class Failures(HTMLParser):
    def __init__(self):
        super().__init__()
        self.capture = False
        self.current = []
        self.failures = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "li" and attrs.get("class") == "fail":
            self.capture = True
            self.current = []

    def handle_data(self, data):
        if self.capture:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == "li" and self.capture:
            self.failures.append("".join(self.current).strip())
            self.capture = False

parser = Failures()
parser.feed(Path(sys.argv[1]).read_text())
for failure in parser.failures:
    print(f"  - {failure}")
PY
  exit 1
fi

python3 - "$DOM_OUT" <<'PY'
from pathlib import Path
import re
import sys

html = Path(sys.argv[1]).read_text()
passed = re.search(r'data-smoke-passed="(\d+)"', html)
total = re.search(r'data-smoke-total="(\d+)"', html)
if not passed or not total:
    raise SystemExit("Smoke result counters are missing")
print(f"Browser smoke tests passed: {passed.group(1)}/{total.group(1)}")
PY
