// App über einen Webserver (wie GitHub Pages): Manifest, Speichern über Neuladen, Offline-Start über den Service Worker,
// Seite zuerst aus dem Netz (Updates kommen sofort an), Sichern und Laden der Daten
const L = require('./lib');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(L.APP);
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
let version = ''; // wird an den Titel gehängt, um ein Update der Seite zu simulieren
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f.endsWith('/')) f += 'index.html';
  const file = path.join(ROOT, f);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(file);
  if (file.endsWith('index.html') && version) body = Buffer.from(body.toString().replace('<title>Lernsystem</title>', '<title>Lernsystem' + version + '</title>'));
  res.writeHead(200, { 'Content-Type': TYPEN[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(body);
});

L.run(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const U = 'http://localhost:' + server.address().port + '/';
  const ctx = await L.browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => L.fail('Skriptfehler in der App', e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts|net::ERR/.test(m.text())) L.fail('Konsole', m.text()); });
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  const fremd = new Set(); // Keine Claude-Funktionen, keine Synchronisierung: nur eigene Dateien und Schriften
  p.on('request', (r) => { const h = new URL(r.url()).hostname; if (!/^(localhost|127\.0\.0\.1|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(h) && !/^(blob|data):/.test(r.url())) fremd.add(h); });
  const c = async (s) => { await p.click(s, { timeout: 4000 }); await p.waitForTimeout(250); };
  const main = () => p.textContent('#main');
  const laden = async () => { await p.reload(); await p.waitForTimeout(800); };
  try {
    await p.goto(U); await p.waitForTimeout(800);
    L.expect('Titel', await p.title(), 'Lernsystem');
    L.expect('Manifest erreichbar mit Namen', await p.evaluate(async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href); return r.ok ? (await r.json()).name : 'FEHLT'; }), 'Lernsystem');

    // Daten, Ansicht und Darstellung überstehen das Neuladen
    await c('[data-a=startAdd]'); await p.fill('#neu-eintrag', 'Erster echter Eintrag'); await c('[data-a=addDone]'); await c('[data-a=doAdd]');
    await laden();
    L.has('Eintrag nach Neuladen sichtbar', await main(), 'Erster echter Eintrag');
    await c('.side [data-v=themen]'); await laden();
    L.expect('Ansicht bleibt nach Neuladen', await p.evaluate(() => window.__ls.S.view), 'themen');
    await c('.side [data-v=einstellungen]'); await c('[data-a=esDesign][data-v=dunkel]'); await laden();
    L.expect('Darstellung „dunkel“ bleibt nach Neuladen', await p.evaluate(() => document.documentElement.getAttribute('data-theme')), 'dark');
    await c('.side [data-v=einstellungen]'); await c('[data-a=esDesign][data-v=auto]');
    await c('.side [data-v=heute]');

    // Service Worker: offline startet die App mit den Daten
    await p.evaluate(() => navigator.serviceWorker.ready); await laden();
    L.ok('Service Worker steuert die Seite', await p.evaluate(() => !!navigator.serviceWorker.controller));
    await ctx.setOffline(true); await laden();
    L.has('offline: Eintrag sichtbar', await main(), 'Erster echter Eintrag');
    await c('.side [data-v=woche]');
    L.has('offline: Woche öffnet', await p.textContent('h1'), 'Woche');
    await ctx.setOffline(false);
    // Update der Seite kommt beim nächsten Laden sofort an (Netz zuerst), offline gilt danach die neue Fassung
    version = ' v2'; await laden();
    L.expect('neue Fassung sofort geladen', await p.title(), 'Lernsystem v2');
    await ctx.setOffline(true); await laden();
    L.expect('offline: zuletzt geladene Fassung', await p.title(), 'Lernsystem v2');
    await ctx.setOffline(false); version = ''; await laden();

    // Sichern
    await c('.side [data-v=einstellungen]');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-a=esExport]')]);
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
    const datei = path.join(__dirname, 'out', 'test-sicherung.json'); await dl.saveAs(datei);
    const j = JSON.parse(fs.readFileSync(datei, 'utf8'));
    L.ok('Dateiname mit Datum', /^lernsystem-sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    L.expect('Format der Sicherung', [j.format, j.version, typeof j.exportiert], ['lernsystem', 1, 'string']);
    L.expect('Sicherung enthält den Eintrag', Object.values(j.daten.bloecke).map((b) => b.titel), ['Erster echter Eintrag']);
    L.ok('Sicherung enthält alle Sammlungen', ['themen', 'bloecke', 'vorhaben', 'wochen', 'tage', 'termine', 'routinen', 'etappen', 'pausen', 'meta', 'module'].every((k) => j.daten[k] && typeof j.daten[k] === 'object'), Object.keys(j.daten));

    // Leerer Speicher (frischer Browser-Kontext wie ein neues Gerät): kaputte Datei abgelehnt, Sicherung laden
    const ctx2 = await L.browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
    const q = await ctx2.newPage();
    q.on('pageerror', (e) => L.fail('Skriptfehler in der App (leerer Speicher)', e.message));
    await q.route('**/fonts.googleapis.com/**', (r) => r.abort());
    const cq = async (sel) => { await q.click(sel, { timeout: 4000 }); await q.waitForTimeout(250); };
    await q.goto(U); await q.waitForTimeout(800);
    await cq('.side [data-v=einstellungen]');
    L.hasNot('leerer Speicher: Eintrag nicht da', await q.textContent('#main'), 'Erster echter Eintrag');
    const kaputt = path.join(__dirname, 'out', 'test-kaputt.json'); fs.writeFileSync(kaputt, '{"hallo":1}');
    await q.setInputFiles('input[data-ch=esImport]', kaputt); await q.waitForTimeout(400);
    L.has('kaputte Datei abgelehnt', await q.textContent('.toast').catch(() => ''), 'keine Sicherung des Lernsystems');
    L.expect('kaputte Datei: keine Rückfrage zum Laden', await q.locator('[data-a=esImportYes]').count(), 0);
    await q.setInputFiles('input[data-ch=esImport]', datei); await q.waitForTimeout(400);
    L.expect('Laden fragt nach', await q.locator('[data-a=esImportYes]').count(), 1);
    await cq('[data-a=esImportYes]');
    await cq('.side [data-v=heute]');
    L.has('nach Laden sichtbar', await q.textContent('#main'), 'Erster echter Eintrag');
    await q.reload(); await q.waitForTimeout(800);
    L.has('nach Laden und Neuladen sichtbar', await q.textContent('#main'), 'Erster echter Eintrag');
    await ctx2.close();
    fs.rmSync(datei); fs.rmSync(kaputt);
    L.expect('keine Anfragen an fremde Dienste', Array.from(fremd), []);
  } finally {
    server.close();
  }
});
