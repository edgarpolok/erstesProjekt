#!/usr/bin/env bash
# Alle Tests gegen app/index.html. Aufruf aus dem Repository: bash tests/run-all.sh
# Andere Fassung der App prüfen: bash tests/run-all.sh pfad/zur/index.html
# Randfälle (langsamer): bash tests/rand/run-rand.sh  (= run-all.sh --rand)
# Jede Testdatei (*.js außer lib.js und mock-app.js) läuft automatisch mit. Ein Test gilt nur als bestanden,
# wenn node mit 0 endet UND die Zeile „ERGEBNIS …: N Prüfungen, 0 Fehler“ mit N > 0 erscheint.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "${1:-}" = "--rand" ]; then shift; DIR="$DIR/rand"; fi
APP="$(realpath "${1:-$(dirname "$0")/../app/index.html}")"
[ -f "$APP" ] || { echo "FEHLER  App nicht gefunden: $APP"; exit 1; }
cd "$DIR" || exit 1
fail=0; bekannt=""
for f in *.js; do
  case "$f" in lib.js|mock-app.js) continue ;; esac
  t="${f%.js}"
  out=$(timeout 600 node "$f" "$APP" 2>&1); code=$?
  erg=$(echo "$out" | grep '^ERGEBNIS ' | tail -1)
  if [ $code -eq 0 ] && echo "$erg" | grep -q -E ': [1-9][0-9]* Prüfungen, 0 Fehler'; then
    echo "ok      $t  (${erg#*: })"
  else
    fail=1
    echo "FEHLER  $t  (${erg#*: })"
    if [ $code -eq 124 ]; then echo "        Zeitüberschreitung nach 600 s"; fi
    if echo "$out" | grep -q '^FEHLER: '; then echo "$out" | grep '^FEHLER: ' | head -12 | sed 's/^FEHLER: /        /'
    else echo "$out" | grep -v -E '^\s*$' | tail -6 | sed 's/^/        /'; fi
  fi
  b=$(echo "$out" | grep -E '^(BEKANNT|BEHOBEN\?) ' | sed "s/^/        $t: /")
  [ -n "$b" ] && bekannt="$bekannt$b"$'\n'
done
# Persönliche Daten (Sicherungen, Umzugsdateien) nie ins Repository: außer app/*.json keine JSON-Dateien
json=$(git -C "$DIR" ls-files --full-name ':/*.json' 2>/dev/null | grep -v '^app/' || true)
if [ -n "$json" ]; then fail=1; echo "FEHLER  JSON-Dateien im Repository (Sicherungen gehören nicht hinein):"; echo "$json" | sed 's/^/        /'; fi
if [ -n "$bekannt" ]; then echo "Bekannte Abweichungen der App von CLAUDE.md (gemeldet, noch nicht entschieden):"; printf '%s' "$bekannt"; fi
[ $fail = 0 ] && echo "Alle Tests bestanden." || { echo "Es gab Fehler."; exit 1; }
