const { chromium } = require('playwright');
const fs = require('fs');
const U = 'http://localhost:8765/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_INTERNET_DISCONNECTED|net::ERR/.test(m.text())) errs.push('console ' + m.text()); });
  const c = async (s) => { await p.click(s); await p.waitForTimeout(250); };
  await p.goto(U); await p.waitForTimeout(800);
  console.log('Titel', await p.title(), '| h1', await p.textContent('h1'));
  const man = await p.evaluate(async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href); return r.ok ? (await r.json()).name : 'FEHLT'; });
  console.log('Manifest', man);
  // Eintrag anlegen, neu laden -> bleibt
  await c('[data-a=startAdd]'); await p.fill('#neu-eintrag', 'Erster echter Eintrag'); await c('[data-a=addDone]'); await c('[data-a=doAdd]');
  await p.reload(); await p.waitForTimeout(800);
  console.log('nach Neuladen sichtbar', (await p.textContent('#main')).includes('Erster echter Eintrag'));
  // Service Worker und offline
  await p.evaluate(() => navigator.serviceWorker.ready); await p.reload(); await p.waitForTimeout(800);
  console.log('SW aktiv', await p.evaluate(() => !!navigator.serviceWorker.controller));
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(800);
  console.log('offline geladen', (await p.textContent('#main')).includes('Erster echter Eintrag'));
  await c('.side [data-v=woche]'); console.log('offline Woche ok', (await p.textContent('h1')));
  await ctx.setOffline(false);
  // Sichern
  await c('.side [data-v=einstellungen]');
  await p.screenshot({ path: __dirname + '/out/app-einst.png', fullPage: true });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-a=esExport]')]);
  const path = __dirname + '/out/sicherung.json'; await dl.saveAs(path);
  const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  console.log('Sicherung', dl.suggestedFilename(), j.format, Object.keys(j.daten.bloecke).length, 'Einträge');
  // Alles löschen (anderer Tab / frisch) und laden
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(800);
  await c('.side [data-v=einstellungen]');
  console.log('leer vor Laden', await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('lernsystem-daten-v1') || '{"bloecke":{}}').bloecke || {}).length));
  fs.writeFileSync(__dirname + '/out/kaputt.json', '{"hallo":1}');
  await p.setInputFiles('input[data-ch=esImport]', __dirname + '/out/kaputt.json'); await p.waitForTimeout(400);
  console.log('kaputte Datei', await p.textContent('.toast').catch(() => '-'));
  await p.setInputFiles('input[data-ch=esImport]', path); await p.waitForTimeout(400);
  await p.screenshot({ path: __dirname + '/out/app-import.png', fullPage: true });
  await c('[data-a=esImportYes]');
  await c('.side [data-v=heute]');
  console.log('nach Laden sichtbar', (await p.textContent('#main')).includes('Erster echter Eintrag'));
  await p.reload(); await p.waitForTimeout(800);
  console.log('nach Laden + Neuladen', (await p.textContent('#main')).includes('Erster echter Eintrag'));
  console.log('ERR', errs); await b.close();
})();
