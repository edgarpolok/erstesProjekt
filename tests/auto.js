const { chromium } = require('playwright');
const file = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const run = async (seed, hash, rows) => {
    const p = await b.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript('window.__seed = ' + JSON.stringify(seed)); await p.addInitScript({ path: __dirname + '/mock-app.js' });
    await p.goto('file://' + file + '#' + hash); await p.waitForTimeout(400);
    const out = await p.evaluate((rows) => { const T = '2026-11-09'; const cap = window.__ls.capacity(T, {}, T, true); const r = window.__ls.allocRegel(rows, cap); return { cap, days: Object.fromEntries(Object.entries(r.days).map(([d, l]) => [d, l.map((x) => x.titel + ' ' + x.std)])), over: r.over.map((x) => x.titel + ' ' + x.hours) }; }, rows);
    await p.close(); return out;
  };
  const rows = [
    { id: 'k1', titel: 'Klein 1h', hours: 1, modus: null },
    { id: 'k2', titel: 'Klein 2h', hours: 2, modus: null },
    { id: 'g', titel: 'Groß 1 Tag', hours: 6, modus: null },
    { id: 's', titel: 'Fest am Stück 2h', hours: 2, modus: 'stueck' }
  ];
  console.log('ohne Pause', JSON.stringify(await run({}, 'sim-2026-11-07-1000', rows), null, 0));
  const pause = { pausen: { p: { von: '2026-11-16', bis: '2026-11-22', art: 'frei', name: 'Urlaub' } } };
  console.log('Pause danach', JSON.stringify(await run(pause, 'sim-2026-11-07-1000', [{ id: 'k1', titel: 'Klein 1h', hours: 1, modus: null }, { id: 'g', titel: 'Groß 2 Tage', hours: 12, modus: null }]), null, 0));
  console.log('ERR', errs); await b.close();
})();
