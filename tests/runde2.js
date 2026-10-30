// Folgewiederholung von Neuem in geplanter Woche, Zeitstrahl, Reiter „Statistik“, Notiz-Symbol
const { chromium } = require('playwright');
const file = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const open = async (seed, hash, w) => {
    const p = await b.newPage({ viewport: { width: w || 1280, height: 900 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript('window.__seed = ' + JSON.stringify(seed)); await p.addInitScript({ path: __dirname + '/mock-app.js' });
    await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
    await p.goto('file://' + file + '#' + hash); await p.waitForTimeout(400); return p;
  };
  const c = async (p, s) => { await p.click(s); await p.waitForTimeout(200); };
  const store = (p) => p.evaluate(() => JSON.parse(JSON.stringify(__store)));
  const leer = {}; ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].forEach((d) => { leer[d] = 0; });
  // Montag lernen (geplante Woche), Dienstag sicher bewerten -> Freitag muss Zeit und das Thema haben
  let p = await open({ wochen: { '2026-11-02': { status: 'fertig', wdhMin: 0, wdhVerteilung: leer } } }, 'sim-2026-11-02-1800');
  await c(p, '[data-a=startAdd]'); await p.fill('#neu-eintrag', 'Rom I neu'); await c(p, '[data-a=addDone]'); await c(p, '[data-a=doAdd]');
  let s = await store(p); await p.close();
  p = await open(s, 'sim-2026-11-03-1000');
  await c(p, '[data-a=wdhOpen]'); await c(p, '[data-a=rateW][data-r=sicher]');
  s = await store(p);
  const v = s.wochen['2026-11-02'].wdhVerteilung;
  console.log('Verteilung nach Dienstag', JSON.stringify(v), '| faellig', Object.values(s.bloecke)[0].sr.faellig);
  if (!(v['2026-11-06'] > 0)) errs.push('Freitag ohne Wiederholungszeit');
  // Bewertung zurücknehmen nimmt die Zeit wieder raus
  await c(p, '[data-a=rateW][data-r=sicher]');
  console.log('nach Zurücknehmen Fr', (await store(p)).wochen['2026-11-02'].wdhVerteilung['2026-11-06']);
  await c(p, '[data-a=rateW][data-r=sicher]'); s = await store(p); await p.close();
  p = await open(s, 'sim-2026-11-06-0900');
  const fr = (await p.textContent('#main')).includes('Rom I neu');
  console.log('Freitag in der Wiederholung:', fr); if (!fr) errs.push('Freitag: Einheit fehlt');
  // Zeitstrahl und Statistik
  await c(p, '.side [data-v=kalender]');
  console.log('Reiter', await p.locator('[data-a=kTab]').allTextContents());
  await c(p, '[data-a=kTab][data-v=zeit]');
  const pts = await p.locator('[data-a=zsSel]').count();
  console.log('Zeitstrahl Punkte', pts); if (!pts) errs.push('Zeitstrahl leer');
  await c(p, '[data-a=zsSel]'); console.log('Detail', (await p.textContent('[aria-label="Woche im Detail"]')).replace(/\s+/g, ' ').slice(0, 120));
  await p.screenshot({ path: __dirname + '/out/zeitstrahl.png' });
  await c(p, '[data-a=zsPrev]'); await c(p, '[data-a=zsNow]');
  await c(p, '[data-a=kTab][data-v=zahlen]'); console.log('Statistik ok', !(await p.textContent('#main')).includes('konnte nicht'));
  await p.close();
  p = await open({ themen: { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv', notiz: 'Wichtig' } } }, 'sim-2026-11-06-0900', 390);
  await c(p, '.bottom [data-v=themen]'); console.log('Notiz-Symbol', await p.locator('[aria-label="hat eine Notiz"]').count());
  await c(p, '.bottom [data-v=kalender]'); await c(p, '[data-a=kTab][data-v=zeit]');
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (sw[0] > sw[1]) errs.push('HSCROLL 390 ' + sw);
  console.log('ERR', errs); await b.close();
})();
