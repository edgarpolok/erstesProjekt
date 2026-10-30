// Wochenverteilung nach festen Regeln (allocRegel); Termine verrutschen nie, ausweichen müssen nur verteilte Lernblöcke
const L = require('./lib');
const AUFGREIFEN = / kurz aufgreifen$/;

// Regeln, die für jede Verteilung gelten müssen
function pruefeVerteilung(label, rows, r) {
  Object.keys(r.days).forEach((d) => {
    const summe = r.days[d].reduce((a, x) => a + x.std, 0);
    L.ok(label + ': ' + d + ' nicht über der Tageskapazität', summe <= r.cap[d] + 1e-9, summe + ' > ' + r.cap[d]);
  });
  rows.forEach((row) => {
    let summe = 0; const tage = [];
    Object.keys(r.days).forEach((d) => r.days[d].forEach((x) => { if (x.titel === row.titel) { summe += x.std; tage.push(d); } }));
    const ueber = r.over.filter((x) => x.titel === row.titel).reduce((a, x) => a + x.hours, 0);
    L.expect(label + ': „' + row.titel + '“ vollständig verteilt (Stunden)', summe + ueber, row.hours);
    if (row.modus === 'stueck') L.expect(label + ': „' + row.titel + '“ am Stück an einem Tag', tage.length, 1);
  });
}

L.run(async () => {
  // 1) Reine Regel: vier Vorhaben in einer leeren Woche (Mo–Fr je 6 h)
  let p = await L.open({}, 'sim-2026-11-07-1000');
  const verteile = (rows) => p.evaluate((rows) => {
    const T = '2026-11-09'; const cap = window.__ls.capacity(T, {}, T, true); const r = window.__ls.allocRegel(rows, cap);
    const days = {}; Object.keys(r.days).forEach((d) => { days[d] = r.days[d].map((x) => ({ titel: x.titel, std: x.std })); });
    return { cap, days, over: r.over.map((x) => ({ titel: x.titel, hours: x.hours })) };
  }, rows);
  const rows = [
    { id: 'k1', titel: 'Klein 1h', hours: 1, modus: null },
    { id: 'k2', titel: 'Klein 2h', hours: 2, modus: null },
    { id: 'g', titel: 'Groß 1 Tag', hours: 6, modus: null },
    { id: 's', titel: 'Fest am Stück 2h', hours: 2, modus: 'stueck' }
  ];
  let r = await verteile(rows);
  L.expect('Kapazität Mo–Fr', r.cap, { '2026-11-09': 6, '2026-11-10': 6, '2026-11-11': 6, '2026-11-12': 6, '2026-11-13': 6 });
  L.expect('nichts übrig', r.over, []);
  pruefeVerteilung('leere Woche', rows, r);
  L.expect('„Groß 1 Tag“ bekommt einen ganzen Tag', r.days['2026-11-09'].filter((x) => x.titel === 'Groß 1 Tag').map((x) => x.std), [6]);
  L.ok('am Ende der Woche kurz aufgreifen', Object.values(r.days).some((l) => l.some((x) => AUFGREIFEN.test(x.titel))));

  // 2) Mehr als passt: Rest landet in „over“, nicht in überfüllten Tagen
  const viel = [{ id: 'a', titel: 'Riesig', hours: 40, modus: null }];
  r = await verteile(viel);
  pruefeVerteilung('überfüllte Woche', viel, r);
  L.ok('überfüllte Woche: Rest wird gemeldet', r.over.length > 0, r.over);
  await p.context().close();

  // 3) Geplante Woche mit Termin: Termin bleibt, Blöcke weichen aus (Di 8–14 Uhr = 6 h belegt)
  const termin = { titel: 'Klausur Strafrecht', datum: '2026-11-10', von: '08:00', bis: '14:00' };
  p = await L.open({ termine: { t1: termin } }, 'sim-2026-11-07-1000', 1280);
  await L.go(p, 'woche'); await L.click(p, '[data-a=wkNext]');
  await L.click(p, '[data-a=vAdd]'); await L.fill(p, '.vrow input.inp', 'Großes Vorhaben'); await p.press('.vrow input.inp', 'Tab'); await p.waitForTimeout(150);
  await L.click(p, '[data-a=vStd][data-h="12"]');
  await L.click(p, '[data-a=planClaude]'); await p.waitForTimeout(300);
  let s = await L.store(p);
  L.expect('Woche ist übergeben', s.wochen['2026-11-09'] && s.wochen['2026-11-09'].status, 'uebergeben');
  L.expect('Termin unverändert', s.termine.t1, termin);
  const plan = Object.values(s.bloecke).filter((b) => b.vorhaben);
  L.expect('kein Block am Termin-Tag', plan.filter((b) => b.tag === '2026-11-10').length, 0);
  L.expect('12 h verteilt (ohne „kurz aufgreifen“)', plan.filter((b) => !AUFGREIFEN.test(b.titel)).reduce((a, b) => a + b.std, 0), 12);
  const proTag = {}; plan.forEach((b) => { proTag[b.tag] = (proTag[b.tag] || 0) + b.std; });
  L.ok('kein Tag über 6 h', Object.values(proTag).every((h) => h <= 6), proTag);
  await p.context().close();

  // 4) Termin nachträglich in eine übergebene Woche: Termin bleibt genau so, der Block weicht aus
  const seed = { wochen: { '2026-11-02': { status: 'uebergeben', wdhMin: 0, wdhVerteilung: {} } },
    bloecke: { b1: { titel: 'Vorhaben Do', woche: '2026-11-02', tag: '2026-11-05', status: 'offen', quelle: 'claude', std: 5, erstellt: 1 }, b2: { titel: 'Eigener Eintrag Do', woche: '2026-11-02', tag: '2026-11-05', status: 'offen', quelle: 'frei', erstellt: 2 } } };
  p = await L.open(seed, 'sim-2026-11-03-1000', 1280);
  await L.go(p, 'kalender');
  await L.click(p, '.kal button.cell[data-d="2026-11-05"]');
  await L.fill(p, '#k-name', 'Klausur Strafrecht'); await L.fill(p, '#k-t-von', '09:00'); await L.fill(p, '#k-t-bis', '13:00'); await L.click(p, '[data-a=kSave]');
  s = await L.store(p);
  L.expect('neuer Termin genau wie eingegeben', Object.values(s.termine).map((t) => [t.titel, t.datum, t.von, t.bis]), [['Klausur Strafrecht', '2026-11-05', '09:00', '13:00']]);
  L.ok('verteilter Block weicht vom Termin-Tag aus', s.bloecke.b1.tag !== '2026-11-05', s.bloecke.b1.tag);
  L.ok('ausgewichener Block bleibt in der Woche und nicht in der Vergangenheit', !s.bloecke.b1.tag || (s.bloecke.b1.tag >= '2026-11-03' && s.bloecke.b1.tag <= '2026-11-08'), s.bloecke.b1.tag);
  L.expect('eigener Eintrag bleibt am Donnerstag', s.bloecke.b2.tag, '2026-11-05');
});
