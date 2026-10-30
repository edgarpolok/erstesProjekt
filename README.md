# Lernsystem

Persönlicher Lernplaner als installierbare Web-App: **Heute**, **Woche**, **Kalender**, **Themen** und **Einstellungen**.

- Läuft komplett im Browser, auch offline.
- Alle Daten liegen nur auf dem eigenen Gerät (im Browser-Speicher). Es gibt kein Konto und keinen Server.
- Sicherung und Umzug: **Einstellungen → Daten auf diesem Gerät → Daten sichern / Daten laden** (eine JSON-Datei).

## Aufbau

| Datei | Zweck |
| --- | --- |
| `app/index.html` | die ganze App (HTML, CSS, JavaScript in einer Datei) |
| `app/sw.js` | Offline-Speicher; lädt die Seite zuerst aus dem Netz, damit Updates sofort ankommen |
| `app/manifest.webmanifest`, `app/icons/` | Name und Symbol für die Installation |
| `.github/workflows/pages.yml` | veröffentlicht `app/` über GitHub Pages bei jedem Push auf den Standard-Branch |

## Installieren auf dem Mac

- **Safari** (ab macOS Sonoma): App-Adresse öffnen → Menü **Ablage → Zum Dock hinzufügen**.
- **Chrome oder Edge**: App-Adresse öffnen → Installieren-Symbol rechts in der Adressleiste.

Wichtig: Die Daten gehören zu dem Browser, in dem die App installiert ist. Safari und Chrome haben getrennte Daten.

## Lokal ausprobieren

```bash
cd app && python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. Zum Testen anderer Tage lässt sich die Uhr simulieren, z. B. `http://localhost:8000/#sim-2026-12-31-2350`.
