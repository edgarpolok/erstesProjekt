# Lernsystem – Arbeitsnotiz

Persönlicher Lernplaner eines Jurastudenten als Web-App. Antworten und Texte in der App auf Deutsch, du-Form.

## Stand

- **Nur noch die App in `app/` wird weiterentwickelt.** Das frühere Claude-Artefakt „Lernsystem“ bleibt unverändert als Archiv.
- Genutzt wird die App auf einem MacBook, installiert über Safari („Zum Dock hinzufügen“). Ein Gerät, keine Synchronisierung.
- Veröffentlicht über GitHub Pages: https://edgarpolok.github.io/erstesProjekt/ – der Workflow `.github/workflows/pages.yml` läuft bei jedem Push auf den Standard-Branch.

## Aufbau

- `app/index.html` enthält die ganze App (CSS und JavaScript inline). Abschnitte sind mit `/* ================= … ================= */` markiert: Grundlagen (Datum, Zeit-Simulation), Speicher, Darstellung (HTML → DOM abgleichen), Fachlogik, Aktionen, Ansichten Heute / Woche / Kalender und Zahlen / Themen / Einstellungen, Gerüst und Ereignisse.
- Daten liegen in `localStorage` unter `lernsystem-daten-v1`, aufgeteilt in Sammlungen (`themen`, `bloecke`, `vorhaben`, `wochen`, `tage`, `termine`, `routinen`, `etappen`, `pausen`, `meta`, `module`). `put`/`patch`/`del` ändern den Stand `D` und speichern gebündelt.
- Sichern und Laden: Einstellungen → „Daten auf diesem Gerät“, Format `{ format: 'lernsystem', version: 1, exportiert, daten }`.
- `app/sw.js`: Offline-Speicher; die Seite selbst zuerst aus dem Netz, damit Updates sofort ankommen.
- Keine Claude-Funktionen: Wochenverteilung (`allocRegel`) und Wocheneinschätzung laufen nach festen Regeln.

## Regeln aus dem Entwurf, die nicht kaputtgehen dürfen

- Kein Druck: keine roten Markierungen außer dem gedämpften X an Liegengebliebenem, keine Serien, Statistik nur unter Kalender → „Statistik“.
- Termine verrutschen nie; ausweichen müssen nur verteilte Lernblöcke.
- Vergangene Tage: frei bearbeitbar bis 23:59 des Folgetags; danach nur nach unten korrigieren (Haken weg, Zeit verringern, Text, Löschen). Hinzufügen nur über „Fehler korrigieren“, dann mit Schildchen „nachgetragen“.
- Timer über Mitternacht: Zeit zählt für den Starttag; holt man einen Block danach in einen neuen Tag, bleibt die alte Zeit beim alten Tag (`zeitFrueher`).
- Wiederholung: Abstände 1, 3, 7, 14, 30, 60, 90, 120 Tage, jeweils ab der letzten Wiederholung; Zeit der Woche verteilt sich nach Fälligkeit, Überfälliges über die restlichen Tage. Neues (und seine Folgewiederholungen) bekommt in geplanten Wochen Zeit dazu.
- Jede datenändernde Aktion geht über `undoable(...)` und ist 5 Sekunden lang rückgängig zu machen. Löschen fragt vorher nach.

## Testen

```bash
bash tests/run-all.sh
```

Playwright und Chromium sind in der Cloud-Umgebung vorinstalliert. Die Tests laden `app/index.html` mit Testdaten (`tests/mock-app.js` schreibt `window.__seed` in den Speicher, `window.__store` liest ihn) und simulieren die Uhr über `#sim-JJJJ-MM-TT-HHMM`. `window.__ls` gibt Zugriff auf interne Funktionen. Vor jedem Push alle Tests laufen lassen; neue Funktionen bekommen einen eigenen Test in `tests/`.

Persönliche Daten (Sicherungen, Umzugsdateien) gehören nie ins Repository; `.gitignore` schließt `*.json` aus.
