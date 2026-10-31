// Sicherungs-Erinnerung in der Woche: ab Planungstag, nur wenn die letzte Sicherung lange genug her ist
const L = require('./lib');
const SA = 'sim-2026-10-31-1000'; // Samstag (Planungstag)
const MI = 'sim-2026-10-28-1000'; // Mittwoch
const seed = (meta) => ({ meta });

// Woche öffnen und den Text des Kastens (oder null) liefern
async function kasten(p) {
  await L.go(p, 'woche');
  return (await p.$('[data-k=sicherung]')) ? await L.text(p, '[data-k=sicherung]') : null;
}

L.run(async () => {
  // 1) Noch nie gesichert, am Planungstag
  let p = await L.open({}, SA, 1280);
  let k = await kasten(p);
  L.ok('Samstag, nie gesichert: Kasten erscheint', k !== null);
  L.has('nie gesichert: Text', k || '', 'Noch nie gesichert');
  L.has('Kasten hat den Knopf „Jetzt sichern“', await L.text(p, '[data-k=sicherung] [data-a=esExport]'), 'Jetzt sichern');
  await p.context().close();

  // 2) Vor dem Planungstag kein Kasten
  p = await L.open({}, MI, 1280);
  L.expect('Mittwoch: kein Kasten', await kasten(p), null);
  await p.context().close();

  // 3) Texte nach Alter der Sicherung
  const faelle = [
    ['2026-10-29', null, 'zu frisch (2 Tage): kein Kasten'],
    ['2026-10-18', null, '13 Tage her: kein Kasten'],
    ['2026-10-17', 'Letzte Sicherung vor 2 Wochen', '14 Tage her: Wochen'],
    ['2026-10-03', 'Letzte Sicherung vor 4 Wochen', '28 Tage her: 4 Wochen'],
    ['2026-10-10', 'Letzte Sicherung vor 3 Wochen', '21 Tage her: 3 Wochen'],
  ];
  for (const [am, erwartet, label] of faelle) {
    p = await L.open(seed({ sicherung: { am } }), SA, 1280);
    const t = await kasten(p);
    if (erwartet === null) L.expect(label, t, null); else L.has(label, t || '', erwartet);
    await p.context().close();
  }
  // Tage-Schreibweise unter 14 Tagen (Schwelle 7)
  p = await L.open(seed({ config: { sicherungTage: 7 }, sicherung: { am: '2026-10-24' } }), SA, 1280);
  L.has('Schwelle 7: 7 Tage her zeigt „vor 7 Tagen“', (await kasten(p)) || '', 'Letzte Sicherung vor 7 Tagen');
  await p.context().close();
  p = await L.open(seed({ config: { sicherungTage: 7 }, sicherung: { am: '2026-10-25' } }), SA, 1280);
  L.expect('Schwelle 7: 6 Tage her, kein Kasten', await kasten(p), null);
  await p.context().close();

  // 4) Aus (0): nie ein Kasten
  p = await L.open(seed({ config: { sicherungTage: 0 } }), SA, 1280);
  L.expect('sicherungTage 0: kein Kasten trotz „nie gesichert“', await kasten(p), null);
  await p.context().close();

  // 5) Einstellungen: freie Zahl setzt die Schwelle
  p = await L.open(seed({ sicherung: { am: '2026-10-22' } }), SA, 1280); // 9 Tage her
  L.expect('9 Tage her, Standard 14: kein Kasten', await kasten(p), null);
  await L.go(p, 'einstellungen');
  const setze = async (n) => { await L.fill(p, '#es-sich', String(n)); await p.press('#es-sich', 'Enter'); await p.waitForTimeout(100); };
  await setze(7);
  L.expect('7 setzt sicherungTage', (await L.store(p)).meta.config.sicherungTage, 7);
  L.has('mit 7: Kasten ab 7 Tagen', (await kasten(p)) || '', 'Letzte Sicherung vor 9 Tagen');
  await L.go(p, 'einstellungen');
  await setze(0);
  L.expect('0 setzt sicherungTage', (await L.store(p)).meta.config.sicherungTage, 0);
  L.expect('mit 0: kein Kasten', await kasten(p), null);
  await L.go(p, 'einstellungen');
  await setze(30);
  L.expect('30 setzt sicherungTage', (await L.store(p)).meta.config.sicherungTage, 30);
  await L.go(p, 'einstellungen');
  await setze(14);
  L.expect('14 setzt sicherungTage', (await L.store(p)).meta.config.sicherungTage, 14);
  await setze(45);
  L.expect('freie Zahl 45 Tage', (await L.store(p)).meta.config.sicherungTage, 45);
  await setze(400);
  L.expect('400 abgelehnt, bleibt 45', (await L.store(p)).meta.config.sicherungTage, 45);
  await p.context().close();

  // 6) „Jetzt sichern“ trägt das heutige Datum ein, der Kasten verschwindet
  p = await L.open({}, SA, 1280);
  await kasten(p);
  await p.click('[data-k=sicherung] [data-a=esExport]');
  await p.waitForTimeout(300);
  L.expect('nach Sichern: Datum heute', (await L.store(p)).meta.sicherung.am, '2026-10-31');
  L.expect('nach Sichern: Kasten weg', (await p.$('[data-k=sicherung]')), null);
  await p.context().close();
});
