#!/usr/bin/env bash
# Randfall-Tests (Jahreswechsel, Zeitumstellung, Timer, lange Namen, Sonderzeichen, extreme Einstellungen).
# Langsamer als run-all.sh, deshalb getrennt: nach größeren Umbauten laufen lassen. Aufruf: bash tests/rand/run-rand.sh
exec bash "$(dirname "$0")/../run-all.sh" --rand "$@"
