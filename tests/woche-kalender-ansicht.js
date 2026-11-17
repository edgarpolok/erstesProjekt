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
  // Liste (unter 900 px)
  const li = await L.open(seed, 'sim-2026-10-28-1000', 880);
  await L.go(li, 'woche');
  L.expect('Liste: heute aufgeklappt', await li.getAttribute('.day[data-k="d-2026-10-28"] .lbl', 'aria-expanded'), 'true');
  L.expect('Liste: kommender Tag zugeklappt', await li.getAttribute('.day[data-k="d-2026-10-29"] .lbl', 'aria-expanded'), 'false');
  const doT = await L.text(li, '.day[data-k="d-2026-10-29"]');
  L.ok('Donnerstag zeigt Termine zeitlich sortiert', /9–12\s*Repetitorium.*14–16\s*Vorlesung Strafrecht/.test(doT), doT);
  L.has('Donnerstag zeigt Lernblöcke', doT, 'Lernen: BGB AT');
  L.has('Donnerstag zeigt Erledigt-Stand', doT, 'von');
  L.expect('Liste ohne Spalten', await li.$$eval('.wbrett', (e) => e.length), 0);

  // Woche als Spalten (ab 900 px immer)
  const mehr = { b1: seed.bloecke.b1, b2: { titel: 'ZPO', woche: '2026-10-26', tag: '2026-10-28', status: 'offen', reihenfolge: 2, zeit: 50 }, b3: { titel: 'Sachenrecht', woche: '2026-10-26', status: 'offen', reihenfolge: 3 } };
  const p = await L.open(Object.assign({}, seed, { bloecke: mehr }), 'sim-2026-10-28-1000', 1280);
  await L.go(p, 'woche');
  L.expect('Spalten: sieben Tage nebeneinander', await p.$$eval('.wbrett .wcol', (e) => e.filter((x) => x.offsetTop === e[0].offsetTop).length), 7);
  L.expect('keine Liste, kein Umschalter', await p.$$eval('.day, [data-a=wAnsicht]', (e) => e.length), 0);
  const sp29 = await L.text(p, '.wcol[data-k="wc-2026-10-29"]');
  L.ok('Spalte: Termine nach Uhrzeit, dann Lernen', /Termine.*9–12\s*Repetitorium.*14–16\s*Vorlesung Strafrecht.*Lernen.*BGB AT.*Routinen.*Anki/.test(sp29), sp29);
  L.has('Spalte zeigt Erledigt-Stand', sp29, '0/4');
  L.has('erfasste Zeit im Spaltenkopf', await L.text(p, '.wcol[data-k="wc-2026-10-28"] .hd'), '0:50 h erfasst');
  L.expect('vergangene Tage abgedunkelt', await p.$$eval('.wcol.before', (e) => e.length), 2);
  await L.noHScroll(p, 'Woche als Spalten');
  await L.click(p, '.wcol[data-k="wc-2026-10-30"] [data-a=wAdd]');
  await L.fill(p, '#w-add', 'Schuldrecht');
  await L.click(p, '[data-a=wAddSave]');
  L.has('in der Spalte hinzugefügt', await L.text(p, '.wcol[data-k="wc-2026-10-30"]'), 'Schuldrecht');
  await L.click(p, '.wcol[data-k="wc-2026-10-29"] [data-a=tmEdit]');
  L.expect('Terminformular steht unter den Spalten', await p.$$eval('.wbform #tm-titel', (e) => e.length), 1);
  await L.click(p, '.wbform [data-a=tmCancel]');

  // Abhaken direkt in der Spalte (heute und gestern), nicht an kommenden Tagen
  await L.click(p, '.wcol[data-k="wc-2026-10-28"] [data-a=wTick][data-k=b]');
  L.expect('Block in der Spalte abgehakt', (await L.store(p)).bloecke.b2.status, 'erledigt');
  await L.click(p, '.wcol[data-k="wc-2026-10-28"] [data-a=wTick][data-k=r]');
  L.expect('Routine in der Spalte abgehakt', (await L.store(p)).tage['2026-10-28'].routinen.r1.erledigt, true);
  L.has('Stand im Spaltenkopf', await L.text(p, '.wcol[data-k="wc-2026-10-28"] .hd'), '2/2');
  await L.click(p, '.wcol[data-k="wc-2026-10-28"] [data-a=wTick][data-k=b]');
  L.expect('nochmal tippen nimmt den Haken zurück', (await L.store(p)).bloecke.b2.status, 'offen');
  await L.click(p, '.wcol[data-k="wc-2026-10-27"] [data-a=wTick][data-k=r]');
  L.expect('gestern geht noch', (await L.store(p)).tage['2026-10-27'].routinen.r1.erledigt, true);
  L.expect('kommende Tage ohne Abhaken', await p.$$eval('.wcol[data-k="wc-2026-10-29"] [data-a=wTick]', (e) => e.length), 0);
  L.expect('älter als gestern ohne Abhaken', await p.$$eval('.wcol[data-k="wc-2026-10-26"] [data-a=wTick]', (e) => e.length), 0);

  // „Noch offen" am Brett und Ziehen mit der Maus
  L.has('„Noch offen“ liegt am Brett', await L.text(p, '.wpool'), 'Sachenrecht');
  await p.dragAndDrop('.wpool [data-drag=b3]', '.wcol[data-k="wc-2026-10-31"]'); await p.waitForTimeout(200);
  let st = await L.store(p);
  L.expect('aus „Noch offen“ auf einen Tag gezogen', [st.bloecke.b3.tag, st.bloecke.b3.fest], ['2026-10-31', true]);
  await p.dragAndDrop('.wcol [data-drag=b1]', '.wcol[data-k="wc-2026-11-01"]'); await p.waitForTimeout(200);
  L.expect('Block auf einen anderen Tag gezogen', (await L.store(p)).bloecke.b1.tag, '2026-11-01');
  L.has('Ziehen lässt sich rückgängig machen', await L.toast(p), 'Rückgängig');
  await p.dragAndDrop('.wcol [data-drag=b2]', '.wcol[data-k="wc-2026-10-26"]'); await p.waitForTimeout(200);
  L.expect('vergangener Tag ist kein Ziel', (await L.store(p)).bloecke.b2.tag, '2026-10-28');
  await p.dragAndDrop('.wcol [data-drag=b3]', '.wpool'); await p.waitForTimeout(200);
  st = await L.store(p);
  L.expect('zurück nach „Noch offen“ gezogen', [st.bloecke.b3.tag, st.bloecke.b3.zurueckgelegt], [null, true]);
  // Reihenfolge innerhalb eines Tages und Stundenangabe
  const q = await L.open({ bloecke: { x1: { titel: 'Eins', woche: '2026-10-26', tag: '2026-10-29', status: 'offen', erstellt: 1, std: 2 }, x2: { titel: 'Zwei', woche: '2026-10-26', tag: '2026-10-29', status: 'offen', erstellt: 2, std: 1.5 }, x3: { titel: 'Drei', woche: '2026-10-26', tag: '2026-10-30', status: 'offen', erstellt: 3 } } }, 'sim-2026-10-28-1000', 1440);
  await L.go(q, 'woche');
  const reihe = (d) => q.$$eval('.wcol[data-k="wc-' + d + '"] .it[data-b]', (e) => e.map((x) => x.dataset.b));
  L.has('Stunden am Block', await L.text(q, '.it[data-b=x1]'), '2 h');
  L.has('geplante Stunden im Spaltenkopf', await L.text(q, '.wcol[data-k="wc-2026-10-29"] .hd'), '3½ h geplant');
  await q.dragAndDrop('.it[data-b=x2]', '.it[data-b=x1]', { targetPosition: { x: 40, y: 3 } }); await q.waitForTimeout(200);
  L.expect('im Tag nach oben gezogen', await reihe('2026-10-29'), ['x2', 'x1']);
  await q.dragAndDrop('.it[data-b=x3]', '.it[data-b=x1]', { targetPosition: { x: 40, y: 3 } }); await q.waitForTimeout(200);
  L.expect('von einem anderen Tag an eine Stelle gezogen', await reihe('2026-10-29'), ['x2', 'x3', 'x1']);
  L.expect('gezogener Block liegt fest am Tag', [(await L.store(q)).bloecke.x3.tag, (await L.store(q)).bloecke.x3.fest], ['2026-10-29', true]);
  await L.click(q, '.toast [data-a=undo], [data-a=undo]');
  L.expect('Rückgängig stellt Tag und Reihenfolge wieder her', [await reihe('2026-10-29'), await reihe('2026-10-30')], [['x2', 'x1'], ['x3']]);
  await L.click(q, '.wcol[data-k="wc-2026-10-31"] [data-a=wAdd]');
  await L.fill(q, '#w-add', 'Ohne Umfang'); await L.click(q, '[data-a=wAddSave]');
  await L.fill(q, '#w-add', 'Mit Umfang'); await L.fill(q, '#w-add-std', '1,5'); await L.click(q, '[data-a=wAddSave]');
  const neu = Object.values((await L.store(q)).bloecke).filter((b) => b.tag === '2026-10-31').map((b) => [b.titel, b.std == null ? null : b.std]);
  L.expect('Hinzufügen: Stunden nur, wenn eingetragen', neu, [['Ohne Umfang', null], ['Mit Umfang', 1.5]]);
  L.has('eingetragene Stunden zählen im Kopf', await L.text(q, '.wcol[data-k="wc-2026-10-31"] .hd'), '1½ h geplant');
  L.ok('breiter Bildschirm wird genutzt', await q.$eval('.wbrett', (e) => e.offsetWidth > 1100), 'Breite');
  await L.noHScroll(q, 'Woche bei 1440');
  L.expect('Termine sind nicht ziehbar', await p.$$eval('.wcol .it[draggable]', (e) => e.filter((x) => !x.dataset.drag || !/^b/.test(x.dataset.drag)).length), 0);

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
