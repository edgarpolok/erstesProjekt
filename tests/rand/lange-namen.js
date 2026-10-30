// Lange Namen ohne Leerzeichen, tiefer Baum mit 120 Themen: keine Ansicht wird breiter als der Bildschirm
const L = require('../lib');
const LONG = 'Rechtsgeschäftslehre'.repeat(11); // 220 Zeichen ohne Leerzeichen
const LONG2 = 'Sehr langer Blocktitel mit vielen Wörtern '.repeat(6) + 'X'.repeat(120);

const themen = { a: { name: LONG, eltern: null, zustand: 'aktiv' } };
themen.b = { name: LONG + 'B', eltern: 'a', zustand: 'aktiv' };
themen.c = { name: LONG + 'C', eltern: 'b', zustand: 'aktiv' };
themen.d = { name: LONG + 'D', eltern: 'c', zustand: 'aktiv', sr: { stufe: 2, faellig: '2026-10-29' } };
for (let i = 0; i < 110; i++) themen['s' + i] = { name: 'Unterthema ' + i + ' ' + (i % 10 === 0 ? LONG : ''), eltern: ['a', 'b', 'c'][i % 3], zustand: 'aktiv' };
for (let i = 0; i < 6; i++) themen['g' + i] = { name: 'Gebiet' + i + LONG.slice(0, 60), eltern: null, zustand: 'aktiv' };
const seed = { themen,
  bloecke: {
    x1: { titel: LONG2, woche: '2026-10-26', tag: '2026-10-29', status: 'offen', quelle: 'claude', std: 3, gebiet: 'a', erstellt: 1 },
    x2: { titel: LONG, woche: '2026-10-26', tag: '2026-10-29', status: 'erledigt', erledigtAm: '2026-10-29', wiederholen: true, gebiet: 'a', zeit: 30, erstellt: 2, sr: { stufe: 1, faellig: '2026-10-29' } },
    x3: { titel: LONG, woche: '2026-10-26', tag: null, status: 'offen', quelle: 'liste', std: 2, erstellt: 3, gebiet: 'g1' },
    x4: { titel: 'Unit ' + LONG, thema: 'd', status: 'erledigt', erledigtAm: '2026-10-20', woche: '2026-10-19', tag: '2026-10-20', wiederholen: true },
    x5: { titel: LONG2, woche: '2026-10-19', tag: '2026-10-21', status: 'offen', quelle: 'claude', erstellt: 5, gebiet: 'a' },
    x6: { titel: 'wdh ' + LONG, wdhVon: 'd', thema: 'd', woche: '2026-10-26', tag: '2026-10-29', status: 'erledigt', erledigtAm: '2026-10-29', erstellt: 6 }
  },
  routinen: { r1: { titel: 'Routine ' + LONG, haeufigkeit: { art: 'taeglich' }, zustand: 'aktiv', notiz: LONG }, r2: { titel: 'Kurz', haeufigkeit: { art: 'tage', tage: [3] }, zustand: 'aktiv' } },
  termine: { t1: { titel: 'Termin ' + LONG, wochentage: [3], von: '08:00', bis: '09:00', zustand: 'aktiv' }, t2: { titel: 'Einmalig ' + LONG, datum: '2026-10-29', von: '13:00', bis: '14:00' }, t3: { titel: 'Dritter', datum: '2026-10-29', von: '15:00' } },
  etappen: { e1: { name: 'Etappe ' + LONG, von: '2026-10-01', bis: '2026-12-20', ziel: LONG } },
  pausen: { p1: { name: 'Pause ' + LONG, art: 'wdh', von: '2026-11-09', bis: '2026-11-20' } },
  vorhaben: { v1: { name: 'Vorhaben ' + LONG, std: 6, ab: '2026-11-02', wochen: 3, wdhVon: 'd', erstellt: 1, reihenfolge: 1 } },
  meta: { vorschlaege: { liste: [{ text: LONG, am: '2026-10-20' }] } }
};

L.run(async () => {
  for (const w of [360, 1280]) {
    const p = await L.open(seed, 'sim-2026-10-29-1000', w);
    const breite = (wo) => L.noHScroll(p, wo);
    await breite('Heute');
    await L.click(p, '[data-a=wdhOpen]'); await L.click(p, '[data-a=poolOpen]'); await L.click(p, '[data-a=menu][data-m=bx1]');
    await breite('Heute aufgeklappt');
    await L.go(p, 'woche'); await breite('Woche');
    await L.click(p, '[data-a=wkNext]'); await L.click(p, '[data-a=vMore]'); await breite('Planung');
    await L.go(p, 'kalender'); await breite('Kalender');
    await L.click(p, '[data-a=kTab][data-v=zahlen]'); await breite('Statistik');
    await L.click(p, '[data-a=kTab][data-v=kalender]');
    await L.go(p, 'themen'); await breite('Themen');
    for (let i = 0; i < 3; i++) { await p.evaluate(() => document.querySelectorAll('[data-a=thTog][aria-expanded=false]').forEach((b) => b.click())); await p.waitForTimeout(200); }
    await breite('Themen aufgeklappt');
    await L.click(p, '[data-a=thSel][data-id=d]'); await breite('tiefstes Thema');
    L.expect(w + ' px: Baumzeilen laufen nicht über', await p.$$eval('.trow .nm', (els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length), 0);
    await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esREdit][data-id=r1]'); await breite('Routine bearbeiten');
    await p.context().close();
  }
});
