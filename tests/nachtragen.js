// Vergangene Tage: frei bearbeitbar bis 23:59 des Folgetags, danach nur nach unten korrigieren;
// Hinzufügen nur über „Fehler korrigieren“, dann mit Schildchen „nachgetragen“
const L = require('./lib');

const seed = {
  bloecke: { b1: { titel: 'Block Mi offen', woche: '2026-11-02', tag: '2026-11-04', status: 'offen', quelle: 'frei', erstellt: 1 },
    b2: { titel: 'Block Mo offen', woche: '2026-11-02', tag: '2026-11-02', status: 'offen', quelle: 'frei', erstellt: 2 },
    b3: { titel: 'Block Mo erledigt', woche: '2026-11-02', tag: '2026-11-02', status: 'erledigt', erledigtAm: '2026-11-02', zeit: 60, wiederholen: true, sr: { stufe: 1, faellig: '2026-11-03' }, quelle: 'frei', erstellt: 3 },
    b4: { titel: 'Block Mo mit Zeit', woche: '2026-11-02', tag: '2026-11-02', status: 'erledigt', erledigtAm: '2026-11-02', zeit: 90, wiederholen: false, quelle: 'frei', erstellt: 4 } },
  routinen: { r1: { titel: 'Sport', haeufigkeit: { art: 'taeglich' }, zustand: 'aktiv' } },
  termine: { t1: { titel: 'Vorlesung', wochentage: [0, 2], von: '10:00', bis: '12:00', zustand: 'aktiv' } } };
const GESPERRT = 'Dieser Tag ist abgeschlossen';

L.run(async () => {
  // Heute = Do 5.11.: gestern (Mi) ist noch offen, Montag ist zu
  let p = await L.open(seed, 'sim-2026-11-05-1000');
  await L.go(p, 'woche');
  L.expect('Woche: Links zu den vergangenen Tagen', await p.locator('[data-a=editDay]').allTextContents(), ['Tag ansehen · korrigieren', 'Tag ansehen · korrigieren', 'Tag bearbeiten']);
  await L.click(p, '[data-a=editDay][data-d="2026-11-04"]');
  await L.click(p, '[data-a=tBlock][data-id=b1]'); await L.click(p, '[data-a=tRoutine]'); await L.click(p, '[data-a=tTermin]');
  await L.click(p, '[data-a=startAdd]'); await L.fill(p, '#neu-eintrag', 'Abendzeile vergessen'); await L.click(p, '[data-a=doAdd]');
  let s = await L.store(p);
  L.expect('gestern: Block abgehakt am Mittwoch, ohne „nachgetragen“', [s.bloecke.b1.status, s.bloecke.b1.erledigtAm, !!s.bloecke.b1.nachgetragen], ['erledigt', '2026-11-04', false]);
  L.expect('gestern: neue Zeile direkt erledigt, ohne „nachgetragen“', Object.values(s.bloecke).filter((x) => x.titel === 'Abendzeile vergessen').map((x) => [x.tag, x.status, !!x.nachgetragen]), [['2026-11-04', 'erledigt', false]]);
  L.expect('gestern: Routine und Termin abgehakt, ohne „nachgetragen“', s.tage['2026-11-04'], { routinen: { r1: { erledigt: true, nachgetragen: false } }, termine: { t1: { erledigt: true, nachgetragen: false } } });
  L.expect('vergangener Tag hat keine Timer-Knöpfe', await p.locator('[data-a=startT]').count(), 0);

  // Montag: abgeschlossen
  await L.click(p, '[data-a=dayBack]'); await L.click(p, '[data-a=editDay][data-d="2026-11-02"]');
  L.has('Montag zeigt „abgeschlossen“', await L.text(p), GESPERRT);
  await L.click(p, '[data-a=tBlock][data-id=b2]');
  L.has('Montag: Haken setzen wird abgelehnt', await L.toast(p), GESPERRT);
  L.expect('Montag: b2 bleibt offen', (await L.store(p)).bloecke.b2.status, 'offen');
  await L.click(p, '[data-a=startAdd]');
  L.expect('Montag: Hinzufügen öffnet kein Eingabefeld', await p.locator('#neu-eintrag').count(), 0);
  await L.click(p, '[data-a=tRoutine]');
  L.ok('Montag: Routine abhaken abgelehnt', !(((await L.store(p)).tage['2026-11-02'] || {}).routinen || {}).r1, (await L.store(p)).tage['2026-11-02']);
  // nach unten korrigieren ist erlaubt
  await L.click(p, '[data-a=openT][data-ref="b:b4"]'); await L.fill(p, '[data-in=zeit]', '2:00'); await L.click(p, '[data-a=saveT]');
  L.expect('Montag: Zeit erhöhen abgelehnt', (await L.store(p)).bloecke.b4.zeit, 90);
  await L.fill(p, '[data-in=zeit]', '0:45'); await L.click(p, '[data-a=saveT]'); // das Feld bleibt nach der Ablehnung offen
  s = await L.store(p);
  L.expect('Montag: Zeit verringern erlaubt, ohne „nachgetragen“', [s.bloecke.b4.zeit, !!s.bloecke.b4.nachgetragen], [45, false]);
  await L.click(p, '[data-a=menu][data-m=bb4]'); await L.click(p, '[data-a=editB][data-id=b4]');
  await L.fill(p, '#name-b4', 'Block Mo umbenannt'); await L.click(p, '[data-a=saveB][data-id=b4]');
  L.expect('Montag: Text ändern erlaubt', (await L.store(p)).bloecke.b4.titel, 'Block Mo umbenannt');
  await L.click(p, '[data-a=tBlock][data-id=b3]');
  L.expect('Montag: Haken weg erlaubt', (await L.store(p)).bloecke.b3.status, 'offen');
  await L.click(p, '[data-a=tBlock][data-id=b3]');
  L.expect('Montag: Haken wieder setzen abgelehnt', (await L.store(p)).bloecke.b3.status, 'offen');
  await L.click(p, '[data-a=menu][data-m=bb4]'); await L.click(p, '[data-a=delB][data-id=b4]');
  L.ok('Montag: Löschen erlaubt', !(await L.store(p)).bloecke.b4);

  // Notausgang „Fehler korrigieren“: danach Hinzufügen erlaubt, mit Schildchen „nachgetragen“
  await L.click(p, '[data-a=korrAsk]'); await L.click(p, '[data-a=korrYes]');
  await L.click(p, '[data-a=tBlock][data-id=b2]'); await L.click(p, '[data-a=tBlock][data-id=b3]');
  await L.click(p, '[data-a=openT][data-ref="b:b3"]'); await L.fill(p, '[data-in=zeit]', '1:30'); await L.click(p, '[data-a=saveT]');
  await L.click(p, '[data-a=tRoutine]');
  await L.click(p, '[data-a=startAdd]'); await L.fill(p, '#neu-eintrag', 'Nachtrag Mo'); await L.click(p, '[data-a=doAdd]');
  s = await L.store(p);
  L.expect('korrigiert: b2 erledigt + nachgetragen', [s.bloecke.b2.status, !!s.bloecke.b2.nachgetragen], ['erledigt', true]);
  L.expect('korrigiert: b3 erledigt, 90 min, nachgetragen', [s.bloecke.b3.status, s.bloecke.b3.zeit, !!s.bloecke.b3.nachgetragen], ['erledigt', 90, true]);
  L.expect('korrigiert: Routine nachgetragen', s.tage['2026-11-02'].routinen.r1, { erledigt: true, nachgetragen: true });
  L.expect('korrigiert: neue Zeile am Montag, erledigt, nachgetragen', Object.values(s.bloecke).filter((x) => x.titel === 'Nachtrag Mo').map((x) => [x.tag, x.status, !!x.nachgetragen]), [['2026-11-02', 'erledigt', true]]);
  L.has('Schildchen „nachgetragen“ sichtbar', await L.text(p), 'nachgetragen');
  await L.click(p, '[data-a=dayBack]');
  L.has('Woche: Montag-Zusammenfassung', await L.text(p, '[data-k="d-2026-11-02"]'), 'erfasst 1:30 h');
  await L.go(p, 'heute');
  L.has('zurück zu Heute zeigt den heutigen Tag', await L.text(p), 'Donnerstag, 5. November');
  await p.context().close();

  // Grenze des Kulanzfensters: Mittwoch ist bis Do 23:59 offen, ab Fr 0:00 zu
  for (const [hash, offen] of [['sim-2026-11-05-2359', true], ['sim-2026-11-06-0000', false]]) {
    p = await L.open(seed, hash);
    await L.go(p, 'woche'); await L.click(p, '[data-a=editDay][data-d="2026-11-04"]');
    await L.click(p, '[data-a=tBlock][data-id=b1]');
    s = await L.store(p);
    L.expect(hash + ': Mittwoch ' + (offen ? 'noch offen' : 'abgeschlossen'), s.bloecke.b1.status, offen ? 'erledigt' : 'offen');
    await p.context().close();
  }
});
