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
- Erweiterungen im Datenmodell: wöchentliche Termine mit `ausfall: [{ von, bis }]`; Klausuren sind einmalige Termine mit `art: 'klausur'`, `gebiet`, `ergebnis: { punkte, ohne, am }`, `fehler: [{ text, block }]` (Fehler → Lerneinheit mit `quelle: 'klausur'` im Eingang); Themen haben neben `durchAm` (laufender Durchgang) `frueher: [Datum|null]` (vorige Durchgänge); Etappen haben `stoff: [Themen-Ids]` und `stoffKomplett`; `meta.config.sicherungTage` (Erinnerung ans Sichern, 0 = aus).
- Tastenkürzel (`KEYS`, Übersicht mit „?“ und in den Einstellungen): N, 1–4, T, /, ⌘Z, ?, Esc – nur außerhalb von Eingabefeldern.
- Keine Claude-Funktionen: Wochenverteilung (`allocRegel`) und Wocheneinschätzung laufen nach festen Regeln.

## Regeln aus dem Entwurf, die nicht kaputtgehen dürfen

- Kein Druck: keine roten Markierungen außer dem gedämpften X an Liegengebliebenem, keine Serien, Statistik nur unter Kalender → „Statistik“.
- Termine verrutschen nie; ausweichen müssen nur verteilte Lernblöcke.
- Vergangene Tage: frei bearbeitbar bis 23:59 des Folgetags; danach nur nach unten korrigieren (Haken weg, Zeit verringern, Text, Löschen). Hinzufügen nur über „Fehler korrigieren“, dann mit Schildchen „nachgetragen“.
- Timer über Mitternacht: Zeit zählt für den Starttag; holt man einen Block danach in einen neuen Tag, bleibt die alte Zeit beim alten Tag (`zeitFrueher`).
- Wiederholung: Abstände 1, 3, 7, 14, 30, 60, 90, 120 Tage, jeweils ab der letzten Wiederholung; Zeit der Woche verteilt sich nach Fälligkeit, Überfälliges über die restlichen Tage. Neues (und seine Folgewiederholungen) bekommt in geplanten Wochen Zeit dazu.
- Datenändernde Aktionen gehen über `undoable(...)` und sind 5 Sekunden lang rückgängig zu machen. Ausnahme: Abhaken und Bewerten nimmt man durch nochmaliges Tippen zurück. Nachfrage vor dem Löschen nur bei Themen; Blöcke, Pausen, Routinen, Termine und Vorhaben löschen sofort, mit Rückgängig.

## Testen

```bash
bash tests/run-all.sh
```

Playwright und Chromium sind in der Cloud-Umgebung vorinstalliert. Jede Testdatei bringt ihre eigenen Testdaten mit und baut auf `tests/lib.js` auf:

- `L.run(async () => { … })` startet den Browser, sammelt Ergebnisse und setzt den Exit-Code.
- `L.open(seed, 'sim-JJJJ-MM-TT-HHMM', breite)` öffnet die App in einem frischen Browser-Kontext mit diesen Daten und dieser Uhrzeit; `L.click`, `L.fill`, `L.go(p, 'woche')`, `L.sim(p, datum, minuten)`, `L.store(p)`, `L.text(p, sel)`, `L.toast(p)`, `L.noHScroll(p, wo)`.
- Prüfungen: `L.expect(text, ist, erwartet)`, `L.ok(text, bedingung, ist)`, `L.has` / `L.hasNot` für Texte. Ein Fehlschlag schreibt „FEHLER: text: erwartet X, ist Y“. Skriptfehler, Konsolenfehler und „konnte nicht angezeigt“ nach jedem Klick zählen automatisch als Fehler.
- `L.known(…)` markiert eine bekannte Abweichung der App von einer Regel unten: wird als „BEKANNT“ gemeldet, lässt den Lauf aber grün, bis der Nutzer entschieden hat. Ist sie behoben, meldet der Test „BEHOBEN?“; dann in `L.expect` umwandeln.
- `tests/mock-app.js` schreibt `window.__seed` beim ersten Laden in den Speicher, `window.__store` liest ihn; `window.__ls` gibt Zugriff auf interne Funktionen.

`run-all.sh` führt jede `*.js` in `tests/` aus (neue Dateien laufen automatisch mit). Bestanden ist ein Test nur mit Exit-Code 0 und mindestens einer Prüfung. Eine andere Fassung prüfen: `bash tests/run-all.sh pfad/zur/index.html`.

| Datei | prüft |
|---|---|
| `heute.js` | Hinzufügen, Abhaken, Zeit, Rest bei Teilerledigung, Termine und Routinen des Tages |
| `woche-planen.js` | Vorhaben planen, Termin aus der Woche, Liegengebliebenes mitnehmen/streichen, spätere Tage |
| `verteilen.js` | `allocRegel` (Kapazität, alles verteilt, am Stück), Termine verrutschen nie, Blöcke weichen aus |
| `wiederholung.js` | Abstände 1–120 ab der letzten Wiederholung, Verteilung nach Fälligkeit, Zeit für Neues und Folgewiederholungen |
| `timer.js` | Timer über Neuladen und Mitternacht, `zeitFrueher` |
| `nachtragen.js` | Kulanzfenster bis 23:59 des Folgetags, nur nach unten korrigieren, „Fehler korrigieren“ → „nachgetragen“ |
| `termine-kalender.js` | Termine (einmalig, ganztägig, wöchentlich), Pausen, Etappen, Zeitstrahl, Statistik |
| `themen.js` | Baum, Eingang, Zustände, Zusammenlegen, Löschen mit Nachfrage, Beispiele, Suche, Notizen, Stand |
| `einstellungen.js` | Stellschrauben mit Eingabeprüfung, Routinen, wiederkehrende Termine, hell/dunkel |
| `rueckgaengig.js` | Rückgängig je Aktion (stellt den alten Stand genau her), nochmal tippen bei Abhaken/Bewerten, 5 Sekunden |
| `kein-druck.js` | keine roten Markierungen außer dem gedämpften X, keine Serien, Statistik nur unter Kalender → „Statistik“ |
| `sicherung-erinnerung.js` | Erinnerung ans Sichern in der Woche ab Planungstag, Abstand einstellbar |
| `tastenkuerzel.js` | Kürzel, Übersicht mit „?“, keine Auslösung beim Tippen |
| `termin-ausfall.js` | wöchentliche Termine fallen an einem Tag oder in einem Zeitraum aus |
| `klausuren.js` | Klausur eintragen, Blöcke weichen aus, Punkte, Fehler → Wiederholung, Schnitt und Verlauf |
| `durchgaenge.js` | neuer Durchgang auf jeder Ebene, Stand und Zeitstrahl |
| `gliederung.js` | Gliederung einfügen (Einrückung, Nummern, vier Ebenen, Vorhandenes weiterverwenden) |
| `etappe-stoff.js` | Etappe mit Stoff: „X von Y bisher angelegten Themen“, Balken erst bei vollständigem Stoff |
| `app-offline.js` | über einen eigenen Webserver: Neuladen, Service Worker offline, Updates sofort, Sichern/Laden, keine fremden Dienste |

Unter `file://` hält Chromium localStorage/sessionStorage beim Neuladen nicht zuverlässig; alles, was das Neuladen überstehen muss, prüft deshalb `app-offline.js` über http.

Gegenprobe nach größeren Testumbauten: einen kleinen Fehler in eine Kopie der App einbauen (z. B. im Scratchpad), `bash tests/run-all.sh kopie/index.html` laufen lassen, der zuständige Test muss „FEHLER“ melden. Die Kopie danach löschen.

Persönliche Daten (Sicherungen, Umzugsdateien) gehören nie ins Repository; `.gitignore` schließt `*.json` aus, und `run-all.sh` meldet einen Fehler, wenn außer `app/*.json` eine JSON-Datei eingecheckt ist.

Randfall-Tests liegen getrennt in `tests/rand/`, weil sie langsamer sind: `bash tests/rand/run-rand.sh`. Nach größeren Umbauten laufen lassen. Dateien: `zeitumstellung.js`, `jahreswechsel.js` (KW 53), `timer-grenzen.js` (Silvester, 12-h-Grenze, Löschen während der Timer läuft), `lange-namen.js`, `sonderzeichen.js` (HTML in Namen wird nie ausgeführt), `themen-baum.js` (vier Ebenen), `einstellungen-extrem.js`.

## Zusammenarbeit

- Mit dem Nutzer auf Deutsch, verständlich und ohne Fachjargon schreiben.
- Bei Konzept- und Gestaltungsfragen erst Vorschläge mit Empfehlung machen und nachfragen, dann bauen. Fehlerbehebungen und klar beschriebene Wünsche direkt umsetzen.
- Nur an der App arbeiten. Das frühere Claude-Artefakt „Lernsystem“ ist Archiv und wird nicht mehr geändert.
- Der Nutzer verwendet die App in Safari auf einem MacBook (über „Zum Dock hinzufügen“), mit Daten nur auf diesem Gerät.
- Tokens sparen: `tests/run-all.sh` einmal pro Arbeitsrunde vor dem Push, Ausgaben gefiltert lesen, Bildschirmfotos nur ansehen, wenn sich das Aussehen geändert hat oder ein Layout-Test fehlschlägt. Neue Tests nur für neue Logik.
- Mechanische Aufgaben (Tests umbauen, Dateien aufräumen, Massenänderungen) dürfen an Agenten mit schwächerem Modell oder weniger Denkaufwand gegeben werden; das Ergebnis selbst prüfen.
- Nach jeder Runde kurz berichten: was geändert wurde, was getestet wurde, was nicht testbar war.
