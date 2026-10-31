// Wochenansicht: Tage zugeklappt mit Terminen (Uhrzeit, zeitlich sortiert) und „Lernen: …“, nur heute offen.
// Kalender: wöchentliche Termine nur als Punkte, Besonderes als Text (höchstens zwei, dann „+N“), alle Tage gleich hoch.
const L = require('./lib');
const seed = {
  routinen: { r1: { titel: 'Anki', haeufigkeit: { art: 'taeglich' }, zustand: 'aktiv', reihenfolge: 1 } },
  termine: {
    t1: { titel: 'Vorlesung Strafrecht', wochentage: [3], von: '14:00', bis: '16:00' },
    t2: { titel: 'Repetitorium', wochentage: [3], von: '09:00', bis: '12:00' },
    t3: { titel: 'Klausur ÖR', datum: '2026-11-12', von: '09:00', bis: '14:00', art: 'klausur' },
    t4: { titel: 'Sprechstunde', datum: '2026-11-12', von: '15:00', bis: '16:00' },
    t5: { titel: 'Lerngruppe', datum: '2026-11-12', von: '17:00', bis: '19:00' },
  },
  bloecke: { b1: { titel: 'BGB AT', woche: '2026-10-26', tag: '2026-10-29', status: 'offen', reihenfolge: 1 } },
};
L.run(async () => {
  const p = await L.open(seed, 'sim-2026-10-28-1000', 1280);
  await L.go(p, 'woche');
  L.expect('heute aufgeklappt', await p.getAttribute('.day[data-k="d-2026-10-28"] .lbl', 'aria-expanded'), 'true');
  L.expect('kommender Tag zugeklappt', await p.getAttribute('.day[data-k="d-2026-10-29"] .lbl', 'aria-expanded'), 'false');
  const doT = await L.text(p, '.day[data-k="d-2026-10-29"]');
  L.ok('Donnerstag zeigt Termine zeitlich sortiert', /9–12\s*Repetitorium.*14–16\s*Vorlesung Strafrecht/.test(doT), doT);
  L.has('Donnerstag zeigt Lernblöcke', doT, 'Lernen: BGB AT');
  L.has('Donnerstag zeigt Erledigt-Stand', doT, 'von');
  L.ok('Woche: Tage-Spalte breiter als Nebenspalte', await p.$eval('.cols.zweidrittel', (e) => e.children[0].offsetWidth > e.children[1].offsetWidth * 1.6), 'Spaltenbreiten');

  await L.go(p, 'kalender');
  const kw46 = await L.text(p, '.week[data-k="kw-2026-11-09"]');
  L.has('Klausur als Text', kw46, 'Klausur ÖR');
  L.has('drei Besondere: „+1“', kw46, '+1');
  L.hasNot('dritter besonderer Termin nicht als Text', kw46, 'Lerngruppe');
  L.hasNot('wöchentlicher Termin nicht als Text', kw46, 'Repetitorium');
  L.expect('wöchentliche Termine als Punkte', await p.$$eval('.kal button.cell[data-d="2026-11-12"] .foot i', (e) => e.length), 2);
  L.has('volle Liste beim Darüberfahren', await p.getAttribute('.kal button.cell[data-d="2026-11-12"]', 'title'), '17–19 Lerngruppe');
  const hs = await p.$$eval('.kal .cell', (e) => e.map((x) => x.offsetHeight).filter((h, i, a) => a.indexOf(h) === i));
  L.expect('alle Tageskästchen gleich hoch', hs.length, 1);
});
