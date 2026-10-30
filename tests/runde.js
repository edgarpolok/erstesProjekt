// Wiederholung über die Woche, neue Einheit in geplanter Woche, Blöcke 1–10, Darstellung, Notizen, Stand
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
  // 1) Überfälliges verteilt sich über die restliche Woche
  const due = {}; ['a', 'b', 'c', 'd'].forEach((k, i) => { due[k] = { titel: 'Einheit ' + k, woche: '2026-10-26', tag: '2026-10-2' + (6 + i), status: 'erledigt', erledigtAm: '2026-10-2' + (6 + i), wiederholen: true, sr: { stufe: 1, faellig: i < 3 ? '2026-11-03' : '2026-11-04' } }; });
  let p = await open({ bloecke: due }, 'sim-2026-11-04-0900');
  await c(p, '.side [data-v=woche]'); await c(p, '[data-a=planShow]'); await c(p, '[data-a=planFertig]');
  const v = await p.evaluate(() => __store.wochen['2026-11-02'].wdhVerteilung);
  console.log('1) Verteilung', JSON.stringify(v));
  if (v['2026-11-04'] >= 60) errs.push('1) alles auf heute: ' + JSON.stringify(v));
  await p.close();
  // 5) Neue Einheit in geplanter Woche -> morgen Wiederholung
  const plan = { wochen: { '2026-11-02': { status: 'fertig', wdhMin: 0, wdhVerteilung: { '2026-11-02': 0, '2026-11-03': 0, '2026-11-04': 0, '2026-11-05': 0, '2026-11-06': 0, '2026-11-07': 0, '2026-11-08': 0 } } } };
  p = await open(plan, 'sim-2026-11-04-1800');
  await c(p, '[data-a=startAdd]'); await p.fill('#neu-eintrag', 'IPR Vorlesung 3'); await c(p, '[data-a=addDone]'); await c(p, '[data-a=doAdd]');
  let st = await p.evaluate(() => JSON.stringify(__store));
  console.log('5) Woche nach Eintrag', JSON.stringify(JSON.parse(st).wochen['2026-11-02'].wdhVerteilung['2026-11-05']), 'min morgen');
  let q = await open(JSON.parse(st), 'sim-2026-11-05-0800');
  const hasW = (await q.textContent('#main')).includes('IPR Vorlesung 3');
  console.log('5) morgen in der Wiederholung:', hasW); if (!hasW) errs.push('5) Einheit fehlt morgen');
  await q.close();
  // Haken weg nimmt die Zeit wieder heraus
  await c(p, '[data-a=tBlock]');
  console.log('5) nach Haken weg', await p.evaluate(() => __store.wochen['2026-11-02'].wdhVerteilung['2026-11-05']));
  await p.close();
  // 2) Blöcke pro Tag 1–10, 3) Darstellung
  p = await open({}, 'sim-2026-11-04-1000');
  await c(p, '.side [data-v=einstellungen]'); await c(p, '[data-a=esOpen][data-v=bl]');
  await p.fill('#es-bl', '12'); await c(p, '[data-a=esBl]'); console.log('2) 12 ->', await p.textContent('.toast').catch(() => '-'));
  await p.fill('#es-bl', '7'); await c(p, '[data-a=esBl]'); console.log('2) 7 ->', await p.evaluate(() => __store.meta.config.bloeckeProTag));
  await c(p, '[data-a=esDesign][data-v=dunkel]');
  const bg = await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]);
  console.log('3) dunkel', JSON.stringify(bg));
  await p.screenshot({ path: __dirname + '/out/runde-dunkel.png' });
  await p.reload(); await p.waitForTimeout(400);
  console.log('3) nach Neuladen', await p.evaluate(() => document.documentElement.getAttribute('data-theme')));
  await c(p, '.side [data-v=einstellungen]'); await c(p, '[data-a=esDesign][data-v=auto]');
  console.log('3) automatisch', await p.evaluate(() => document.documentElement.getAttribute('data-theme')));
  await p.close();
  // 4) Notiz am Thema, beim Bewerten ergänzen, 6) Stand
  const seed = { themen: { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' }, sat: { name: 'Schuldrecht AT', eltern: 'zr', zustand: 'aktiv', sr: { stufe: 3, faellig: '2026-11-04' }, notiz: '§ 254 sitzt' }, sb: { name: 'Schadensberechnung', eltern: 'sat', zustand: 'aktiv' }, kr: { name: 'Kaufrecht', eltern: 'zr', zustand: 'aktiv' } },
    bloecke: { u1: { titel: 'Mitverschulden', thema: 'sat', status: 'erledigt', erledigtAm: '2026-10-20', woche: '2026-10-19', wiederholen: true } },
    tage: { '2026-10-28': { wdh: { liste: [{ ref: 't:sat', min: 15 }], min: 15, bew: { 't:sat': { r: 'sicher' } } } } } };
  p = await open(seed, 'sim-2026-11-04-1000');
  await c(p, '[data-a=wdhOpen]');
  console.log('4) Notiz in Wiederholung sichtbar', (await p.textContent('.wdh')).includes('§ 254 sitzt'));
  await c(p, '[data-a=rateW][data-r=teilweise]');
  await p.fill('[data-in="wn_t_sat"]', 'Gehilfen nochmal'); await c(p, '[data-a=wNote]');
  console.log('4) Notiz jetzt', JSON.stringify(await p.evaluate(() => __store.themen.sat.notiz)));
  await c(p, '.side [data-v=themen]'); await c(p, '[data-a=thSel][data-id=sat]');
  await p.fill('#th-notiz', 'Neu geschrieben'); await p.click('h1'); await p.waitForTimeout(250);
  console.log('4) Notiz im Thema geändert', JSON.stringify(await p.evaluate(() => __store.themen.sat.notiz)));
  await c(p, '[data-a=thDurch]');
  console.log('6) durchAm', await p.evaluate(() => __store.themen.sat.durchAm));
  await c(p, '[data-a=thTab][data-v=stand]');
  const stand = (await p.textContent('#main')).replace(/\s+/g, ' ');
  console.log('6) Stand', stand.slice(stand.indexOf('Zivilrecht'), stand.indexOf('Zivilrecht') + 330));
  if (!/2× wiederholt/.test(stand)) errs.push('6) Wiederholungen nicht gezählt');
  await p.screenshot({ path: __dirname + '/out/runde-stand.png', fullPage: true });
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (sw[0] > sw[1]) errs.push('HSCROLL ' + sw);
  await p.close();
  p = await open(seed, 'sim-2026-11-04-1000', 390); await c(p, '.bottom [data-v=themen]'); await c(p, '[data-a=thTab][data-v=stand]');
  const sw2 = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); if (sw2[0] > sw2[1]) errs.push('HSCROLL 390 ' + sw2);
  await p.screenshot({ path: __dirname + '/out/runde-stand-390.png', fullPage: true });
  console.log('ERR', errs); await b.close();
})();
