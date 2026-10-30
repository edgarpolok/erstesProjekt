const L = require('./lib');
const LONG = 'Rechtsgeschäftslehre'.repeat(11); // 220 chars, no spaces
const LONG2 = 'Sehr langer Blocktitel mit vielen Wörtern '.repeat(6) + 'X'.repeat(120);
(async () => {
  await L.init();
  const themen = { a: { name: LONG, eltern: null, zustand: 'aktiv' } };
  themen.b = { name: LONG + 'B', eltern: 'a', zustand: 'aktiv' };
  themen.c = { name: LONG + 'C', eltern: 'b', zustand: 'aktiv' };
  themen.d = { name: LONG + 'D', eltern: 'c', zustand: 'aktiv', sr: { stufe: 2, faellig: '2026-10-29' } };
  for (let i = 0; i < 110; i++) themen['s' + i] = { name: 'Unterthema ' + i + ' ' + (i % 10 === 0 ? LONG : ''), eltern: ['a', 'b', 'c'][i % 3], zustand: 'aktiv' };
  for (let i = 0; i < 6; i++) themen['g' + i] = { name: 'Gebiet' + i + LONG.slice(0, 60), eltern: null, zustand: 'aktiv' };
  const bloecke = {
    x1: { titel: LONG2, woche: '2026-10-26', tag: '2026-10-29', status: 'offen', quelle: 'claude', std: 3, gebiet: 'a', erstellt: 1 },
    x2: { titel: LONG, woche: '2026-10-26', tag: '2026-10-29', status: 'erledigt', erledigtAm: '2026-10-29', wiederholen: true, gebiet: 'a', zeit: 30, erstellt: 2, sr: { stufe: 1, faellig: '2026-10-29' } },
    x3: { titel: LONG, woche: '2026-10-26', tag: null, status: 'offen', quelle: 'liste', std: 2, erstellt: 3, gebiet: 'g1' },
    x4: { titel: 'Unit ' + LONG, thema: 'd', status: 'erledigt', erledigtAm: '2026-10-20', woche: '2026-10-19', tag: '2026-10-20', wiederholen: true },
    x5: { titel: LONG2, woche: '2026-10-19', tag: '2026-10-21', status: 'offen', quelle: 'claude', erstellt: 5, gebiet: 'a' },
    x6: { titel: 'wdh ' + LONG, wdhVon: 'd', thema: 'd', woche: '2026-10-26', tag: '2026-10-29', status: 'erledigt', erledigtAm: '2026-10-29', erstellt: 6 }
  };
  const seed = { themen, bloecke,
    routinen: { r1: { titel: 'Routine ' + LONG, haeufigkeit: { art: 'taeglich' }, zustand: 'aktiv', notiz: LONG }, r2: { titel: 'Kurz', haeufigkeit: { art: 'tage', tage: [3] }, zustand: 'aktiv' } },
    termine: { t1: { titel: 'Termin ' + LONG, wochentage: [3], von: '08:00', bis: '09:00', zustand: 'aktiv' }, t2: { titel: 'Einmalig ' + LONG, datum: '2026-10-29', von: '13:00', bis: '14:00' }, t3: { titel: 'Dritter', datum: '2026-10-29', von: '15:00' } },
    etappen: { e1: { name: 'Etappe ' + LONG, von: '2026-10-01', bis: '2026-12-20', ziel: LONG } },
    pausen: { p1: { name: 'Pause ' + LONG, art: 'wdh', von: '2026-11-09', bis: '2026-11-20' } },
    vorhaben: { v1: { name: 'Vorhaben ' + LONG, std: 6, ab: '2026-11-02', wochen: 3, wdhVon: 'd', erstellt: 1, reihenfolge: 1 } },
    meta: { vorschlaege: { liste: [{ text: LONG, am: '2026-10-20' }] } }
  };
  for (const w of [1280]) {
    const p = await L.open(seed, 'sim-2026-10-29-1000', w);
    await L.check(p, 'heute'); 
    if (await p.$('[data-a=wdhOpen]')) await L.click(p, '[data-a=wdhOpen]');
    await L.click(p, '[data-a=poolOpen]');
    await L.click(p, '[data-a=menu][data-m=bx1]');
    await L.check(p, 'heute-open'); await L.shot(p, 'long-heute-' + w);
    await L.go(p, 'woche'); await L.check(p, 'woche'); await L.shot(p, 'long-woche-' + w);
    await L.click(p, '[data-a=wkNext]'); await L.click(p, '[data-a=vMore]'); await L.check(p, 'woche-next'); await L.shot(p, 'long-woche-next-' + w);
    await L.go(p, 'kalender'); await L.check(p, 'kal'); await L.shot(p, 'long-kal-' + w);
    await L.click(p, '[data-a=kTab][data-v=zahlen]'); await L.check(p, 'zahlen'); await L.shot(p, 'long-zahlen-' + w);
    await L.click(p, '[data-a=kTab][data-v=kalender]');
    await L.go(p, 'themen'); await L.check(p, 'themen'); await L.shot(p, 'long-themen-' + w);
    // open nodes and select deepest
    await p.evaluate(() => { __ls.S; }); 
    await p.evaluate(() => { document.querySelectorAll('[data-a=thTog][aria-expanded=false]').forEach((b) => b.click()); }); await p.waitForTimeout(200);
    await p.evaluate(() => { document.querySelectorAll('[data-a=thTog][aria-expanded=false]').forEach((b) => b.click()); }); await p.waitForTimeout(200);
    await L.check(p, 'themen-open'); await L.shot(p, 'long-themen-open-' + w);
    await L.click(p, '[data-a=thSel][data-id=d]'); await L.check(p, 'themen-d'); console.log(await p.evaluate(() => Array.from(document.querySelectorAll('#main *')).filter(e => e.scrollWidth > e.clientWidth + 2 && e.clientWidth>0).map(e => e.tagName + '.' + e.className + ' sw=' + e.scrollWidth + ' cw=' + e.clientWidth + ' ' + getComputedStyle(e).overflowX).slice(-12)));await L.shot(p, 'long-themen-d-' + w);
    await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esREdit][data-id=r1]'); await L.check(p, 'es'); await L.shot(p, 'long-es-' + w);
  }
  console.log(L.errs.join('\n'));
  await L.browser.close();
})();
