const { chromium } = require('playwright');
const file = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const seed = { routinen: { r1: { titel: '10-Finger', haeufigkeit: { art: 'alle', n: 2, ab: '2026-11-02' }, zustand: 'aktiv', reihenfolge: 1 }, r2: { titel: 'Sport', haeufigkeit: { art: 'tage', tage: [1, 3] }, zustand: 'pausiert', reihenfolge: 2 } },
    termine: { t1: { titel: 'Vorlesung IPR', wochentage: [1], von: '10:00', bis: '12:00', zustand: 'aktiv' } } };
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript('window.__seed = ' + JSON.stringify(seed)); await p.addInitScript({ path: __dirname + '/mock-app.js' });
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await p.goto('file://' + file + '#sim-2026-11-03-0900'); await p.waitForTimeout(400);
  const t = await p.textContent('#main');
  console.log('Di Heute: IPR', t.includes('Vorlesung IPR'), '| 10-Finger (Di ist kein 2-Tages-Tag)', t.includes('10-Finger'), '| Sport pausiert', t.includes('Sport'));
  await p.click('.bottom [data-v=woche]'); await p.waitForTimeout(200);
  const w = await p.textContent('#main');
  console.log('Woche: 10-Finger Mi', /Mi4\.11\.[^]*10-Finger/.test(w), '| IPR', w.includes('Vorlesung IPR'));
  await p.goto('file://' + file + '#sim-2026-11-04-0900'); await p.waitForTimeout(400);
  console.log('Mi Heute 10-Finger', (await p.textContent('#main')).includes('10-Finger'));
  console.log('ERR', errs); await b.close();
})();
