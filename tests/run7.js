const { chromium } = require('playwright');
const file = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const th = { zr: { name: 'Zivilrecht', eltern: null, beispiel: true, zustand: 'aktiv' }, sat: { name: 'Schuldrecht AT', eltern: 'zr', beispiel: true, zustand: 'aktiv' }, sb: { name: 'Schadensberechnung', eltern: 'sat', beispiel: true, zustand: 'aktiv', sr: { stufe: 1, faellig: '2026-10-30' } },
    mine: { name: 'Mein Thema', eltern: 'sat', zustand: 'aktiv' }, sr: { name: 'Strafrecht', eltern: null, beispiel: true, zustand: 'aktiv' } };
  const bl = { b1: { titel: 'Beispiel-Einheit', thema: 'sb', status: 'erledigt', erledigtAm: '2026-10-20', beispiel: true, woche: '2026-10-19' }, b2: { titel: 'Meine Einheit', thema: 'sb', status: 'erledigt', erledigtAm: '2026-10-21', woche: '2026-10-19' } };
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript('window.__seed = ' + JSON.stringify({ themen: th, bloecke: bl })); await p.addInitScript({ path: __dirname + '/mock-app.js' });
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await p.goto('file://' + file + '#sim-2026-10-29-1000'); await p.waitForTimeout(400);
  const c = async (s) => { await p.click(s); await p.waitForTimeout(200); };
  const names = () => p.evaluate(() => Object.keys(__store.themen).map(k => k + ':' + __store.themen[k].name + '<' + __store.themen[k].eltern).join(', '));
  await c('.side [data-v=themen]');
  await p.screenshot({ path: __dirname + '/out/bsp.png', fullPage: true });
  // Einzeln: Zivilrecht samt Unterthemen löschen, dann rückgängig
  await c('[data-a=thSel][data-id=zr]'); await c('[data-a=thDelAsk]'); await p.screenshot({ path: __dirname + '/out/confirm1.png' }); await c('[data-a=thConfirmNo]'); console.log('abbrechen ok', await p.evaluate(() => Object.keys(__store.themen).length)); await c('[data-a=thDelAsk]'); await c('[data-a=thDel]');
  console.log('nach löschen', await names(), '| eingang', await p.evaluate(() => Object.values(__store.bloecke).map(x => x.titel + ':' + x.thema).join(',')));
  await c('.toast [data-a=undo]'); console.log('nach undo', await names());
  // Alle Beispiele entfernen
  await p.screenshot({ path: __dirname + '/out/bspfoot.png' }); await c('[data-a=thBspAsk]'); await p.screenshot({ path: __dirname + '/out/confirm2.png' }); await c('[data-a=thDelBsp]'); await p.screenshot({ path: __dirname + '/out/nachbsp.png' });
  console.log('nach bsp', await names(), '| bloecke', await p.evaluate(() => JSON.stringify(Object.values(__store.bloecke).map(x => [x.titel, x.thema, !!x.sr]))));
  await c('.toast [data-a=undo]'); console.log('undo bsp', await names());
  console.log('ERR', errs); await b.close();
})();
