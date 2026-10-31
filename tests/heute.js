// Heute: Eintrag hinzufügen, abhaken, Zeit eintragen, Rest bei Teilerledigung, Termine und Routinen des Tages
const L = require('./lib');
const nur = (s, f) => Object.values(s.bloecke).filter(f);

L.run(async () => {
  // 1) Leerer Mittwoch: Eintrag anlegen, abhaken, Zeit eintragen
  let p = await L.open({}, 'sim-2026-10-28-1000');
  L.has('leerer Tag zeigt den Hinweis', await L.text(p), 'Dein Plan ist gerade leer');
  await L.click(p, '[data-a=startAdd]');
  await L.fill(p, '#neu-eintrag', 'Schuldrecht AT – Unmöglichkeit');
  await L.click(p, '[data-a=doAdd]');
  let s = await L.store(p);
  let b = Object.values(s.bloecke);
  L.expect('neuer Eintrag: Anzahl Blöcke', b.length, 1);
  L.expect('neuer Eintrag: Titel, Tag, Woche, Status', [b[0].titel, b[0].tag, b[0].woche, b[0].status], ['Schuldrecht AT – Unmöglichkeit', '2026-10-28', '2026-10-26', 'offen']);
  L.has('neuer Eintrag steht in Heute', await L.text(p), 'Schuldrecht AT – Unmöglichkeit');

  await L.click(p, '[data-a=tBlock]');
  b = Object.values((await L.store(p)).bloecke)[0];
  L.expect('abgehakt: Status und Datum', [b.status, b.erledigtAm], ['erledigt', '2026-10-28']);
  L.expect('abgehakt: erste Wiederholung am nächsten Tag (Abstand 1)', b.sr && [b.sr.stufe, b.sr.faellig], [1, '2026-10-29']);
  L.ok('abgehakt ohne Schildchen „nachgetragen“', !b.nachgetragen, b.nachgetragen);

  await L.click(p, '[data-a=openT]'); await L.fill(p, '[data-in=zeit]', '1:15'); await L.click(p, '[data-a=saveT]');
  L.expect('Zeit 1:15 eingetragen = 75 min', Object.values((await L.store(p)).bloecke)[0].zeit, 75);
  await L.click(p, '[data-a=openT]'); await L.fill(p, '[data-in=zeit]', 'abc'); await L.click(p, '[data-a=saveT]');
  L.has('ungültige Zeit wird abgelehnt', await L.toast(p), 'Zeit bitte als 1:30');
  L.expect('ungültige Zeit ändert nichts', Object.values((await L.store(p)).bloecke)[0].zeit, 75);

  // Leerer Text wird nicht angelegt
  await L.click(p, '[data-a=startAdd]'); await L.fill(p, '#neu-eintrag', '   '); await L.click(p, '[data-a=doAdd]');
  L.expect('leerer Text legt nichts an', Object.keys((await L.store(p)).bloecke).length, 1);
  await p.context().close();

  // 2) Teilweise erledigt: 3 h geplant, 1 h gelernt -> 2 h Rest in „Noch offen“; Haken weg nimmt den Rest wieder heraus
  const seedRest = { bloecke: { z: { titel: 'Klausur ZPO', woche: '2026-10-26', tag: '2026-10-29', status: 'offen', quelle: 'claude', std: 3, vorhaben: 'v1', erstellt: 1 } } };
  p = await L.open(seedRest, 'sim-2026-10-29-1000');
  await L.click(p, '[data-a=tBlock][data-id=z]');
  L.expect('ohne Zeit kein Rest', nur(await L.store(p), (x) => x.restVon).length, 0);
  await L.click(p, '[data-a=openT][data-ref="b:z"]'); await L.fill(p, '[data-in=zeit]', '1:00'); await L.click(p, '[data-a=saveT]');
  s = await L.store(p);
  let rest = nur(s, (x) => x.restVon === 'z');
  L.expect('Rest angelegt: Anzahl', rest.length, 1);
  L.expect('Rest: 2 h, ohne Tag, in derselben Woche, offen, gleiches Vorhaben', rest[0] && [rest[0].std, rest[0].tag, rest[0].woche, rest[0].status, rest[0].vorhaben, rest[0].titel], [2, null, '2026-10-26', 'offen', 'v1', 'Klausur ZPO']);
  L.has('Hinweis zum Rest', await L.toast(p), 'Rest 2 h bleibt diese Woche offen');
  await L.click(p, '[data-a=openT][data-ref="b:z"]'); await L.fill(p, '[data-in=zeit]', '2:00'); await L.click(p, '[data-a=saveT]');
  rest = nur(await L.store(p), (x) => x.restVon === 'z');
  L.expect('mehr Zeit verkleinert den Rest auf 1 h', rest.map((x) => x.std), [1]);
  await L.click(p, '[data-a=openT][data-ref="b:z"]'); await L.fill(p, '[data-in=zeit]', '2:45'); await L.click(p, '[data-a=saveT]');
  L.expect('unter 30 min Rest: kein Rest mehr', nur(await L.store(p), (x) => x.restVon === 'z').length, 0);
  await L.click(p, '[data-a=openT][data-ref="b:z"]'); await L.fill(p, '[data-in=zeit]', '1:00'); await L.click(p, '[data-a=saveT]');
  L.expect('Rest wieder da', nur(await L.store(p), (x) => x.restVon === 'z').length, 1);
  await L.click(p, '[data-a=tBlock][data-id=z]');
  L.expect('Haken weg entfernt den Rest', nur(await L.store(p), (x) => x.restVon === 'z').length, 0);
  await p.context().close();

  // 3) Termine und Routinen am richtigen Tag (0 = Montag)
  const seedTag = { routinen: { r1: { titel: '10-Finger', haeufigkeit: { art: 'alle', n: 2, ab: '2026-11-02' }, zustand: 'aktiv', reihenfolge: 1 }, r2: { titel: 'Sport', haeufigkeit: { art: 'tage', tage: [1, 3] }, zustand: 'pausiert', reihenfolge: 2 }, r3: { titel: 'Anki', haeufigkeit: { art: 'tage', tage: [1] }, zustand: 'aktiv', reihenfolge: 3 } },
    termine: { t1: { titel: 'Vorlesung IPR', wochentage: [1], von: '10:00', bis: '12:00', zustand: 'aktiv' }, t2: { titel: 'AG Mittwoch', wochentage: [2], von: '14:00', bis: '16:00', zustand: 'aktiv' } } };
  p = await L.open(seedTag, 'sim-2026-11-03-0900');
  let t = await L.text(p);
  L.has('Di: wöchentlicher Termin am Dienstag', t, 'Vorlesung IPR');
  L.hasNot('Di: Termin vom Mittwoch fehlt', t, 'AG Mittwoch');
  L.has('Di: Routine an festen Wochentagen', t, 'Anki');
  L.hasNot('Di: Routine alle 2 Tage ab Mo nicht am Di', t, '10-Finger');
  L.hasNot('Di: pausierte Routine fehlt', t, 'Sport');
  await L.click(p, '[data-a=tTermin][data-id=t1]');
  L.expect('Termin abgehakt', (await L.store(p)).tage['2026-11-03'].termine.t1.erledigt, true);
  await L.click(p, '[data-a=tRoutine][data-id=r3]');
  L.expect('Routine abgehakt', (await L.store(p)).tage['2026-11-03'].routinen.r3.erledigt, true);
  L.expect('Routinen an Tagen (Mo–Do)', await p.evaluate(() => ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => window.__ls.routinenAt(d).map((r) => r.titel).join('+'))), ['10-Finger', 'Anki', '10-Finger', '', '10-Finger']);
  await L.go(p, 'woche');
  await L.click(p, '.day[data-k="d-2026-11-04"] .lbl'); // kommende Tage starten zugeklappt
  L.ok('Woche: 10-Finger am Mittwoch', /Mi4\.11\.[^]*10-Finger/.test(await L.text(p)));
  await p.context().close();
  p = await L.open(seedTag, 'sim-2026-11-04-0900');
  t = await L.text(p);
  L.has('Mi: 10-Finger', t, '10-Finger');
  L.has('Mi: AG Mittwoch', t, 'AG Mittwoch');
  L.hasNot('Mi: Vorlesung IPR fehlt', t, 'Vorlesung IPR');
});
