// Einstellungen: Stellschrauben mit Prüfung der Eingaben, Routinen, wiederkehrende Termine, Darstellung hell/dunkel
const L = require('./lib');

L.run(async () => {
  let p = await L.open({}, 'sim-2026-10-29-1800');
  await L.go(p, 'einstellungen');
  const cfg = async () => (await L.store(p)).meta.config || {};
  await L.click(p, '[data-a=esOpen][data-v=plan]'); await L.click(p, '[data-a=esSet][data-k=planungstag][data-n="6"]');
  L.expect('Planungstag Sonntag', (await cfg()).planungstag, 6);
  await L.click(p, '[data-a=esOpen][data-v=abst]'); await L.fill(p, '#es-abst', '1, 2, 5, 10'); await L.click(p, '[data-a=esAbst]');
  L.expect('eigene Abstände übernommen, höchster wird Obergrenze', [(await cfg()).abstaende, (await cfg()).maxAbstand], [[1, 2, 5, 10], 10]);
  for (const falsch of ['3, 1', '0, 2', '1, 1', 'x', '']) {
    if (!(await p.locator('#es-abst').count())) await L.click(p, '[data-a=esOpen][data-v=abst]'); // bleibt nach Ablehnung offen
    await L.fill(p, '#es-abst', falsch); await L.click(p, '[data-a=esAbst]');
    L.expect('Abstände „' + falsch + '“ abgelehnt', (await cfg()).abstaende, [1, 2, 5, 10]);
  }
  L.has('Hinweis bei falschen Abständen', await L.toast(p), 'Bitte ganze Tage, aufsteigend');
  await L.click(p, '[data-a=esOpen][data-v=ober]'); await L.click(p, '[data-a=esStep][data-d="0.5"]');
  L.expect('Obergrenze 6 -> 6,5 h', (await cfg()).obergrenze, 6.5);
  await L.click(p, '[data-a=esOpen][data-v=umf]'); await L.click(p, '[data-a=esUmf][data-i="6"][data-v=halb]');
  L.expect('Sonntag halber Tag', (await cfg()).tagesumfang, ['voll', 'voll', 'voll', 'voll', 'voll', 'halb', 'halb']);
  L.expect('Kapazität Sonntag halbiert', await p.evaluate(() => window.__ls.capacity('2026-11-02', {}, '2026-11-02', true)['2026-11-08']), 3.25);
  await L.click(p, '[data-a=esOpen][data-v=bl]');
  await L.fill(p, '#es-bl', '12'); await L.click(p, '[data-a=esBl]');
  L.has('Blöcke pro Tag: 12 abgelehnt', await L.toast(p), 'Bitte eine Zahl von 1 bis 10');
  await L.fill(p, '#es-bl', '7'); await L.click(p, '[data-a=esBl]');
  L.expect('Blöcke pro Tag 7', (await cfg()).bloeckeProTag, 7);

  // Routine und wiederkehrender Termin
  await L.click(p, '[data-a=esRNew]'); await L.fill(p, '#r-titel', '10-Finger'); await L.click(p, '[data-a=esRArt][data-v=alle]'); await L.fill(p, '#r-n', '2'); await L.click(p, '[data-a=esRSave]');
  await L.click(p, '[data-a=esTNew]'); await L.fill(p, '#t-titel', 'Vorlesung IPR'); await L.click(p, '[data-a=esTTag][data-i="1"]'); await L.fill(p, '#t-von', '10:00'); await L.fill(p, '#t-bis', '12:00'); await L.click(p, '[data-a=esTSave]');
  let s = await L.store(p);
  L.expect('Routine gespeichert', Object.values(s.routinen).map((r) => [r.titel, r.haeufigkeit, r.zustand]), [['10-Finger', { art: 'alle', n: 2, ab: '2026-10-29' }, 'aktiv']]);
  L.expect('Termin gespeichert (Dienstag = 1)', Object.values(s.termine).map((t) => [t.titel, t.wochentage, t.von, t.bis, t.datum]), [['Vorlesung IPR', [1], '10:00', '12:00', null]]);
  const rid = Object.keys(s.routinen)[0];
  await L.click(p, '[data-a=esRZ][data-id="' + rid + '"][data-v=pausiert]');
  L.expect('Routine pausiert', (await L.store(p)).routinen[rid].zustand, 'pausiert');
  L.expect('pausierte Routine erscheint an keinem Tag', await p.evaluate(() => window.__ls.routinenAt('2026-10-31').length), 0);

  // Darstellung (dass sie nach dem Neuladen bleibt, prüft app-offline.js über http; unter file:// hält Chromium den Speicher nicht zuverlässig)
  await L.click(p, '[data-a=esDesign][data-v=dunkel]');
  L.expect('dunkel: Attribut und Hintergrund', await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]), ['dark', 'rgb(18, 18, 20)']);
  await L.click(p, '[data-a=esDesign][data-v=hell]');
  L.expect('hell', await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]), ['light', 'rgb(245, 245, 247)']);
  await L.click(p, '[data-a=esDesign][data-v=auto]');
  L.expect('automatisch: kein festes Attribut', await p.evaluate(() => document.documentElement.getAttribute('data-theme')), null);
  await p.context().close();

  // System dunkel + automatisch: alle Ansichten heil, dunkler Hintergrund
  p = await L.open({}, 'sim-2026-11-03-1000', { w: 1280, dark: true });
  L.expect('System dunkel: dunkler Hintergrund', await p.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(18, 18, 20)');
  for (const v of ['woche', 'kalender', 'themen', 'einstellungen', 'heute']) await L.go(p, v);
});
