// Woche: Vorhaben planen und verteilen lassen, Termin aus der Woche, Liegengebliebenes mitnehmen oder streichen,
// dieselben Daten an späteren Tagen ohne Anzeigefehler
const L = require('./lib');
const AUFGREIFEN = / kurz aufgreifen$/;

L.run(async () => {
  // 1) Mittwoch: laufende Woche planen
  let p = await L.open({}, 'sim-2026-10-28-1000');
  await L.go(p, 'woche'); await L.click(p, '[data-a=planShow]');
  await L.click(p, '[data-a=vAdd]'); await L.fill(p, '.vrow input.inp[data-ch=vName]', 'Sachenrecht – Eigentümer-Besitzer'); await p.press('.vrow input.inp[data-ch=vName]', 'Tab'); await p.waitForTimeout(150);
  await L.click(p, '[data-a=vStd][data-h="6"]');
  await L.click(p, '[data-a=vAdd]'); await p.locator('.vrow input.inp[data-ch=vName]').nth(1).fill('Klausur ZPO'); await p.locator('.vrow input.inp[data-ch=vName]').nth(1).press('Tab'); await p.waitForTimeout(150);
  let s = await L.store(p);
  L.expect('zwei Vorhaben angelegt', Object.values(s.vorhaben).map((v) => [v.name, v.std]).sort(), [['Klausur ZPO', null], ['Sachenrecht – Eigentümer-Besitzer', 6]]);
  await L.click(p, '[data-a=planClaude]'); await p.waitForTimeout(300);
  s = await L.store(p);
  L.expect('Woche übergeben', s.wochen['2026-10-26'].status, 'uebergeben');
  const plan = Object.values(s.bloecke).filter((b) => b.vorhaben);
  const stunden = (name) => plan.filter((b) => b.titel === name).reduce((a, b) => a + b.std, 0);
  L.expect('Sachenrecht: 6 h verteilt', stunden('Sachenrecht – Eigentümer-Besitzer'), 6);
  L.expect('Klausur ZPO ohne Umfang: ½ Tag = 3 h geschätzt', stunden('Klausur ZPO'), 3);
  L.ok('nichts in vergangene Tage verteilt', plan.every((b) => b.tag >= '2026-10-28' && b.tag <= '2026-11-01'), plan.map((b) => b.tag));
  L.ok('alle Blöcke offen und in dieser Woche', plan.every((b) => b.status === 'offen' && b.woche === '2026-10-26'));
  // Termin aus der Woche: heute 10–15 Uhr
  await L.click(p, '[data-a=wAdd]'); await L.click(p, '[data-a=tfOpen]'); await L.fill(p, '#tf-titel', 'Sprechstunde'); await L.fill(p, '#tf-von', '10:00'); await L.fill(p, '#tf-bis', '15:00'); await L.click(p, '[data-a=tfSave]');
  s = await L.store(p);
  L.expect('Termin aus der Woche gespeichert', Object.values(s.termine).map((t) => [t.titel, t.datum, t.von, t.bis]), [['Sprechstunde', '2026-10-28', '10:00', '15:00']]);
  L.has('Termin steht in der Woche', await L.text(p), 'Sprechstunde');
  // Blättern
  await L.click(p, '[data-a=wkNext]'); L.has('nächste Woche', await L.text(p, '.wkhead'), 'Nächste Woche');
  await L.click(p, '[data-a=wkPrev]'); await L.click(p, '[data-a=wkPrev]'); L.has('letzte Woche', await L.text(p, '.wkhead'), 'Letzte Woche');
  await L.click(p, '[data-a=wkNext]'); L.has('diese Woche', await L.text(p, '.wkhead'), 'Diese Woche');
  await L.go(p, 'kalender'); await L.go(p, 'themen');
  s = await L.store(p);
  await p.context().close();

  // 2) Dieselben Daten an späteren Tagen: alle Ansichten heil (Fehler prüft lib.js bei jedem Klick)
  for (const h of ['sim-2026-10-29-0800', 'sim-2026-10-31-1900', 'sim-2026-11-02-0900', 'sim-2026-11-11-0900', 'sim-2026-11-16-0900']) {
    const q = await L.open(s, h, 1280);
    for (const v of ['woche', 'kalender', 'themen', 'einstellungen', 'heute']) await L.go(q, v);
    L.ok(h + ': Ansichten geöffnet', true);
    await q.context().close();
  }

  // 3) Wochenwechsel: Liegengebliebenes aus der Vorwoche mitnehmen oder streichen
  const seed = { bloecke: {
    o1: { titel: 'Offen Freitag', status: 'offen', woche: '2026-10-26', tag: '2026-10-30', quelle: 'claude', std: 2 },
    o2: { titel: 'Offen Donnerstag', status: 'offen', woche: '2026-10-26', tag: '2026-10-29', quelle: 'claude', std: 1 } } };
  p = await L.open(seed, 'sim-2026-11-02-0900', 1280);
  await L.go(p, 'woche');
  let t = await L.text(p);
  L.has('Liegengebliebenes wird angeboten', t, 'Offen Freitag');
  L.expect('zwei Punkte zum Mitnehmen', await p.locator('[data-a=carryKeep]').count(), 2);
  await L.click(p, '[data-a=carryKeep][data-id=o1]');
  s = await L.store(p);
  L.expect('mitgenommen: neue Woche, ohne Tag', [s.bloecke.o1.woche, s.bloecke.o1.tag, s.bloecke.o1.mitgenommen, s.bloecke.o1.ausWoche, s.bloecke.o1.status], ['2026-11-02', null, true, '2026-10-26', 'offen']);
  L.expect('mitgenommen liegt in „Noch offen“', await p.evaluate(() => window.__ls.poolOf('2026-11-02').map((b) => b.titel)), ['Offen Freitag']);
  await L.click(p, '[data-a=carryDrop][data-id=o2]');
  s = await L.store(p);
  L.expect('gestrichen', [s.bloecke.o2.status, s.bloecke.o2.gestrichenAm], ['gestrichen', '2026-11-02']);
  await L.click(p, '.toast [data-a=undo]');
  L.expect('Streichen rückgängig', (await L.store(p)).bloecke.o2.status, 'offen');
  await L.go(p, 'heute'); await L.click(p, '[data-a=poolOpen]');
  L.has('Heute: „Noch offen“ zeigt den mitgenommenen Block', await L.text(p), 'Offen Freitag');
  await L.click(p, '[data-a=pull][data-id=o1]');
  L.expect('„+ Heute“ holt ihn auf heute', (await L.store(p)).bloecke.o1.tag, '2026-11-02');
});
