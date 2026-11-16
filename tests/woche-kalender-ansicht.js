// Wochenansicht: Tage zugeklappt mit Terminen (Uhrzeit, zeitlich sortiert) und „Lernen: …“, nur heute offen.
// Kalender: Termine mit Uhrzeit und Titel (höchstens drei je Tag, sonst zwei und „+N weitere“), alle Tage gleich hoch.
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

  // Woche als Spalten (umschaltbar ab 900 px)
  await L.click(p, '[data-a=wAnsicht][data-v=sp]');
  L.expect('Spalten: sieben Tage nebeneinander', await p.$$eval('.wbrett .wcol', (e) => e.filter((x) => x.offsetTop === e[0].offsetTop).length), 7);
  const sp29 = await L.text(p, '.wcol[data-k="wc-2026-10-29"]');
  L.ok('Spalte: Termine nach Uhrzeit, dann Lernen', /Termine.*9–12\s*Repetitorium.*14–16\s*Vorlesung Strafrecht.*Lernen.*BGB AT.*Routinen.*Anki/.test(sp29), sp29);
  L.has('Spalte zeigt Erledigt-Stand', sp29, '0/4');
  await L.noHScroll(p, 'Woche als Spalten');
  await L.click(p, '.wcol[data-k="wc-2026-10-30"] [data-a=wAdd]');
  await L.fill(p, '#w-add', 'Schuldrecht');
  await L.click(p, '[data-a=wAddSave]');
  L.has('in der Spalte hinzugefügt', await L.text(p, '.wcol[data-k="wc-2026-10-30"]'), 'Schuldrecht');
  await L.click(p, '.wcol[data-k="wc-2026-10-29"] [data-a=tmEdit]');
  L.expect('Terminformular steht unter den Spalten', await p.$$eval('.wbform #tm-titel', (e) => e.length), 1);
  await L.click(p, '[data-a=wAnsicht][data-v=li]');
  L.expect('zurück zur Liste', await p.$$eval('.day', (e) => e.length), 7);
  // Spalten sind ab 900 px der Standard; Abhaken direkt in der Spalte (heute und gestern), nicht an kommenden Tagen
  const sp = await L.open(Object.assign({}, seed, { bloecke: { b1: seed.bloecke.b1, b2: { titel: 'ZPO', woche: '2026-10-26', tag: '2026-10-28', status: 'offen', reihenfolge: 2 } } }), 'sim-2026-10-28-1000', { w: 1280, spalten: true });
  await L.go(sp, 'woche');
  L.expect('Spalten ohne Umschalten', await sp.$$eval('.wbrett .wcol', (e) => e.length), 7);
  await L.click(sp, '.wcol[data-k="wc-2026-10-28"] [data-a=wTick][data-k=b]');
  L.expect('Block in der Spalte abgehakt', (await L.store(sp)).bloecke.b2.status, 'erledigt');
  await L.click(sp, '.wcol[data-k="wc-2026-10-28"] [data-a=wTick][data-k=r]');
  L.expect('Routine in der Spalte abgehakt', (await L.store(sp)).tage['2026-10-28'].routinen.r1.erledigt, true);
  L.has('Stand im Spaltenkopf', await L.text(sp, '.wcol[data-k="wc-2026-10-28"] .hd'), '2/2');
  await L.click(sp, '.wcol[data-k="wc-2026-10-28"] [data-a=wTick][data-k=b]');
  L.expect('nochmal tippen nimmt den Haken zurück', (await L.store(sp)).bloecke.b2.status, 'offen');
  await L.click(sp, '.wcol[data-k="wc-2026-10-27"] [data-a=wTick][data-k=r]');
  L.expect('gestern geht noch', (await L.store(sp)).tage['2026-10-27'].routinen.r1.erledigt, true);
  L.expect('kommende Tage ohne Abhaken', await sp.$$eval('.wcol[data-k="wc-2026-10-29"] [data-a=wTick]', (e) => e.length), 0);
  L.expect('älter als gestern ohne Abhaken', await sp.$$eval('.wcol[data-k="wc-2026-10-26"] [data-a=wTick]', (e) => e.length), 0);
  const schmal = await L.open(seed, 'sim-2026-10-28-1000', 390);
  await L.go(schmal, 'woche');
  L.expect('am iPhone kein Umschalter', await schmal.$$eval('[data-a=wAnsicht]', (e) => e.length), 0);

  await L.go(p, 'kalender');
  const kw46 = await L.text(p, '.week[data-k="kw-2026-11-09"]');
  L.has('Klausur als Text', kw46, 'Klausur ÖR');
  L.has('fünf Termine an einem Tag: zwei als Text, dann „+3 weitere“', kw46, '+3 weitere');
  L.hasNot('späterer Termin nicht als Text', kw46, 'Lerngruppe');
  L.hasNot('Einmaliges geht vor: wöchentlicher Termin dann nicht als Text', kw46, 'Repetitorium');
  const do19 = await L.text(p, '.kal button.cell[data-d="2026-11-19"]');
  L.ok('wöchentliche Termine mit Uhrzeit und Titel', /9\s*Repetitorium.*14\s*Vorlesung Strafrecht/s.test(do19), do19);
  L.expect('bei mehr als drei Terminen zwei Zeilen', await p.$$eval('.kal button.cell[data-d="2026-11-12"] .tm', (e) => e.length), 2);
  L.has('volle Liste beim Darüberfahren', await p.getAttribute('.kal button.cell[data-d="2026-11-12"]', 'title'), '17–19 Lerngruppe');
  const hs = await p.$$eval('.kal .cell', (e) => e.map((x) => x.offsetHeight).filter((h, i, a) => a.indexOf(h) === i));
  L.expect('alle Tageskästchen gleich hoch', hs.length, 1);
});
