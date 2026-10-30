#!/usr/bin/env bash
# Randfall-Tests (Jahreswechsel, Zeitumstellung, Timer, lange Namen, Sonderzeichen, extreme Einstellungen).
# Langsamer als run-all.sh, deshalb getrennt: nach größeren Umbauten laufen lassen. Aufruf: bash tests/rand/run-rand.sh
set -u
cd "$(dirname "$0")"; mkdir -p out
fail=0
for t in timer timer2 year yz dst long long3 nm empty th es es2; do
  out=$(timeout 600 node $t.js 2>&1 | grep -v ERR_FAILED)
  if echo "$out" | grep -q -E 'TimeoutError|pageerror|VIEW ERROR|HSCROLL|console: |TypeError|xss flag [^u]'; then echo "FEHLER  $t"; echo "$out" | grep -E 'TimeoutError|pageerror|VIEW ERROR|HSCROLL|console: |TypeError|xss flag' | head -5; fail=1; else echo "ok      $t"; fi
done
[ $fail = 0 ] && echo "Alle Randfall-Tests bestanden." || { echo "Es gab Fehler."; exit 1; }
