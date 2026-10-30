#!/usr/bin/env bash
# Alle Tests gegen app/index.html. Aufruf aus dem Repository: bash tests/run-all.sh
set -u
cd "$(dirname "$0")"
APP="$(cd .. && pwd)/app/index.html"
mkdir -p out
fail=0
run() { local name=$1; shift; local out; out=$(timeout 300 node "$@" 2>&1 | grep -v -E 'ERR_FAILED|^DARK'); if echo "$out" | grep -q -E 'TimeoutError|pageerror|VIEW ERROR|^ERR \[.+\]|^ERR [^ \[]'; then echo "FEHLER  $name"; echo "$out" | tail -8; fail=1; else echo "ok      $name"; fi; }
run "Grundablauf (Heute, Woche, Kalender)" run.js "$APP"   # schreibt store.json für run2/run3
for t in run2 run3 run4 run5 run6 run7 run8 run9; do run "$t" $t.js "$APP"; done
run "Automatisch verteilen" auto.js "$APP"
run "Termine im Kalender" kterm.js "$APP"
run "Wiederholung, Notizen, Stand, Darstellung" runde.js "$APP"
run "Folgewiederholung, Zeitstrahl, Statistik" runde2.js "$APP"
# App-Teile (Offline, Sichern/Laden) brauchen einen Webserver
( cd ../app && python3 -m http.server 8765 >/dev/null 2>&1 & echo $! > ../tests/out/server.pid ); sleep 1
run "Offline, Sichern und Laden" pwa.js
kill "$(cat out/server.pid)" 2>/dev/null
[ $fail = 0 ] && echo "Alle Tests bestanden." || { echo "Es gab Fehler."; exit 1; }
