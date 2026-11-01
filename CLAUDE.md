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
- Erweiterungen im Datenmodell: wöchentliche Termine mit `ausfall: [{ von, bis }]`; Lernblöcke mit `fest: true` hat der Nutzer selbst auf einen Tag gelegt (bleiben beim Verteilen und Ausweichen liegen); Klausuren sind einmalige Termine mit `art: 'klausur'`, `gebiet`, `ergebnis: { punkte, ohne, am }`, `fehler: [{ text, block }]` (Fehler → Lerneinheit mit `quelle: 'klausur'` im Eingang); wöchentliche Klausuren sind wöchentliche Termine mit `art: 'klausur'`, Ergebnis und Fehler je Termin unter `ergebnisse: { datum: { ergebnis, fehler } }` (in der Statistik mit Id `termin@datum`); spontan eintragen unter Heute → Hinzufügen → Mehr; Themen haben neben `durchAm` (laufender Durchgang) `frueher: [Datum|null]` (vorige Durchgänge); Etappen haben `stoff: [Themen-Ids]` und `stoffKomplett`; `meta.config.sicherungTage` (Erinnerung ans Sichern, 0–365 Tage, 0 = aus); `meta.config.pufferTag` −1 = kein Puffer; `meta.config.tagesumfang[i]` ist 'voll' | 'halb' | 'frei' oder eine eigene Stundenzahl (Wiederholungs-Richtwert dann anteilig zur Obergrenze); Schalter `meta.config.leichterNachPause` (75 % Platz in der Woche nach einer Pause) und `meta.config.aufgreifen` (großes Vorhaben am letzten Tag kurz aufgreifen), beide standardmäßig an; Vorhaben-Umfang `std` darf jede Stundenzahl sein (Knöpfe oder Feld „oder eigene Stunden“); Tagesliste der Wiederholung `tage[d].wdh = { min, liste: [{ ref, min, geholt? }], bew: { ref: { r, vorher, nachgetragen?, zeitNach? } }, zeiten: { ref: Minuten } }` (älteres `wdh.zeit` = Zeit für den ganzen Tag, zählt weiter mit; `wochen[*].wdhMin/wdhVerteilung` werden nicht mehr benutzt). Timer einer Zeile: `art: 'w'`, `id: 'Tag~t.themaId'`.
- Themen: eine einzige Ansicht (früher Reiter „Baum“ und „Stand“). Jedes Gebiet ist ein zuklappbarer Block mit Zusammenfassung („X von Y durchgearbeitet“), jede Themenzeile zeigt kurz den Stand. Der Zustand `'abgeschlossen'` heißt in der Oberfläche „erledigt“ (gespeichert bleibt `'abgeschlossen'`, Anzeige über `zWort`). Knopf „nur Offenes“ blendet Durchgearbeitetes aus (Wege zu offenen Unterthemen bleiben, Zusammenfassungen zählen weiter alles); gemerkt nur für die Anzeige unter `lernsystem-nur-offen` in localStorage.
- Keine Tastenkürzel (auf Wunsch des Nutzers entfernt: Zahlen störten bei Eingaben).
- Keine Claude-Funktionen: Wochenverteilung (`allocRegel`) und Wocheneinschätzung laufen nach festen Regeln.

## Regeln aus dem Entwurf, die nicht kaputtgehen dürfen

- Kein Druck: keine roten Markierungen außer dem gedämpften X an Liegengebliebenem, keine Serien, Statistik nur unter Kalender → „Statistik“.
- Termine verrutschen nie; ausweichen müssen nur verteilte Lernblöcke.
- Vergangene Tage: frei bearbeitbar bis 23:59 des Folgetags; danach nur nach unten korrigieren (Haken weg, Zeit verringern, Text, Löschen). Hinzufügen nur über „Fehler korrigieren“, dann mit Schildchen „nachgetragen“.
- Timer über Mitternacht: Zeit zählt für den Starttag; holt man einen Block danach in einen neuen Tag, bleibt die alte Zeit beim alten Tag (`zeitFrueher`).
- Wiederholung: Abstände 1, 3, 7, 14, 30, 60, 90, 120 Tage, jeweils ab der letzten Wiederholung. Jedes fällige Thema ist eine eigene Zeile im „Plan für heute“ (mit Ring: Zahl = Abstand, Bogen = Stufe; Timer und Zeit je Zeile; Bewertung = erledigt). Richtwert pro Tag (`meta.config.wdhProTag`, Standard 60 min) × Tagesumfang (halber Tag die Hälfte, freier Tag nichts automatisch); Ältestes zuerst, was darüber liegt, steht einzeln in „Noch offen“ („+ Heute“ holt es dazu) und kommt am nächsten Tag zuerst. Der Richtwert begrenzt nichts. Die Woche zeigt pro Tag eine aufklappbare Zeile, künftige Tage „voraussichtlich“ (gerechnet mit „sicher“). Die Wochenplanung zeigt nur eine Schätzung, die beim Verteilen frei gehalten wird. Rechte Spalte in Heute: nur Routinen.
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
| `wiederholung.js` | Abstände 1–120 ab der letzten Wiederholung, Zeilen im Tag bis zum Richtwert (halber/freier Tag), Rest in „Noch offen“, holen und später, Ring und Fälligkeit, Zeit je Zeile, Vorschau in der Woche, Wiederholungspause |
| `timer.js` | Timer über Neuladen und Mitternacht, `zeitFrueher` |
| `nachtragen.js` | Kulanzfenster bis 23:59 des Folgetags, nur nach unten korrigieren, „Fehler korrigieren“ → „nachgetragen“ |
| `termine-kalender.js` | Termine (einmalig, ganztägig, wöchentlich), Pausen, Etappen, Zeitstrahl, Statistik |
| `themen.js` | Baum, Eingang, Zustände, Filter „nur Offenes“, Zusammenlegen, Löschen mit Nachfrage, Beispiele, Suche, Notizen, Stand |
| `einstellungen.js` | Stellschrauben mit Eingabeprüfung, Routinen, wiederkehrende Termine, hell/dunkel |
| `einstellungen-freiheit.js` | Wiederholung pro Tag als freie Zahl, „kein Puffer“, eigene Stunden je Wochentag, Schalter „nach Pause leichter“ und „kurz aufgreifen“, Vorhaben mit eigenen Stunden |
| `rueckgaengig.js` | Rückgängig je Aktion (stellt den alten Stand genau her), nochmal tippen bei Abhaken/Bewerten, 5 Sekunden |
| `kein-druck.js` | keine roten Markierungen außer dem gedämpften X, keine Serien, Statistik nur unter Kalender → „Statistik“ |
| `sicherung-erinnerung.js` | Erinnerung ans Sichern in der Woche ab Planungstag, Abstand einstellbar |
| `termin-ausfall.js` | wöchentliche Termine fallen an einem Tag oder in einem Zeitraum aus |
| `klausuren.js` | Klausur eintragen (Kalender, Woche, spontan aus Heute, wöchentlich), Blöcke weichen aus, Punkte je Termin, Fehler → Wiederholung, Schnitt und Verlauf |
| `durchgaenge.js` | neuer Durchgang auf jeder Ebene, Stand in der Themenliste und Zeitstrahl |
| `gliederung.js` | Gliederung einfügen (Einrückung, Nummern, vier Ebenen, Vorhandenes weiterverwenden) |
| `etappe-stoff.js` | Etappe mit Stoff: „X von Y bisher angelegten Themen“, Balken erst bei vollständigem Stoff |
| `woche-kalender-ansicht.js` | Woche: Tage zugeklappt mit Terminen (Uhrzeit) und „Lernen: …“, nur heute offen, zwei Drittel Breite; Kalender: wöchentliche Termine als Punkte, Besonderes als Text mit „+N“, gleich hohe Tage |
| `woche-tage-bearbeiten.js` | Woche: „+ Hinzufügen“ an heute/kommenden Tagen (Lernblock, „stattdessen Termin“), „⋯“-Menü (Umbenennen, anderer Tag, „Noch offen“, Löschen) mit Rückgängig; von Hand gelegte Blöcke (`fest`) bleiben beim Ausweichen und erneuten Verteilen liegen |
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
