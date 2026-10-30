const { chromium } = require('playwright');
const fs = require('fs');
const file = process.argv[2];
const store = fs.readFileSync(__dirname + '/store.json', 'utf8');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const q = await b.newPage({ viewport: { width: 420, height: 900 } });
  q.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await q.addInitScript('window.__seed = ' + store);
  await q.addInitScript({ path: __dirname + '/mock-app.js' });
  await q.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await q.goto('file://' + file + '#sim-2026-10-29-1800'); await q.waitForTimeout(400);
  const c = async (s) => { await q.click(s); await q.waitForTimeout(150); };
  await c('[data-a=wdhOpen]');
  await c('[data-a=rateW][data-r=sicher]');
  const sr1 = await q.evaluate(() => JSON.stringify(Object.values(window.__store.bloecke).filter(b=>b.sr).map(b=>b.sr)));
  await c('[data-a=rateW][data-r=nicht]');
  const sr2 = await q.evaluate(() => JSON.stringify(Object.values(window.__store.bloecke).filter(b=>b.sr).map(b=>b.sr)));
  await c('[data-a=rateW][data-r=nicht]');
  const sr3 = await q.evaluate(() => JSON.stringify(Object.values(window.__store.bloecke).filter(b=>b.sr).map(b=>b.sr)));
  console.log('sicher', sr1); console.log('nicht', sr2); console.log('zurueck', sr3);
  // Teilweise: Klausur ZPO 3h, Zeit 1:00 -> Rest 2h
  const zpo = await q.evaluate(() => Object.keys(window.__store.bloecke).find(k => window.__store.bloecke[k].titel === 'Klausur ZPO' && window.__store.bloecke[k].tag === '2026-10-29'));
  await c('[data-a=tBlock][data-id="' + zpo + '"]');
  await c('[data-a=openT][data-ref="b:' + zpo + '"]'); await q.fill('[data-in=zeit]', '1:00'); await c('[data-a=saveT]');
  console.log('toast', await q.textContent('.toast').catch(() => '-'));
  const rest = await q.evaluate((id) => JSON.stringify(Object.values(window.__store.bloecke).filter(b => b.restVon === id)), zpo);
  console.log('rest', rest);
  await c('[data-a=poolOpen]');
  await q.screenshot({ path: __dirname + '/out/rate.png', fullPage: true });
  // Rest rückgängig über Haken entfernen
  await c('[data-a=tBlock][data-id="' + zpo + '"]');
  console.log('rest nach Haken weg', await q.evaluate((id) => Object.values(window.__store.bloecke).filter(b => b.restVon === id).length, zpo));
  console.log('ERR', errs.join('\n'));
  await b.close();
})();
