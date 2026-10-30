// Zeitumstellung (25.10.2026 Ende der Sommerzeit, 28.3.2027 Beginn): Tageswechsel, Timer, Routinen-Rhythmus
const L = require('../lib');

L.run(async () => {
  for (const [h, tag] of [['sim-2026-10-25-0230', '2026-10-25'], ['sim-2027-03-28-0230', '2027-03-28'], ['sim-2027-03-28-0200', '2027-03-28'], ['sim-2026-10-25-0300', '2026-10-25'], ['sim-2027-03-28-2359', '2027-03-28'], ['sim-2026-10-24-2359', '2026-10-24']]) {
    const p = await L.open({}, h);
    L.expect(h + ': heutiger Tag', await p.evaluate(() => window.__ls.today()), tag);
    await L.noHScroll(p, 'Heute');
    await p.context().close();
  }
  // Timer über das Ende der Sommerzeit: 1:30 bis 3:30 Uhr Wanduhr = 3 echte Stunden
  const seed = { bloecke: { b1: { titel: 'X', woche: '2026-10-19', tag: '2026-10-25', status: 'offen', quelle: 'frei', erstellt: 1 } } };
  let p = await L.open(seed, 'sim-2026-10-25-0130');
  await L.click(p, '[data-a=startT][data-art=b]');
  let s = await L.store(p); await p.context().close();
  p = await L.open(s, 'sim-2026-10-25-0330');
  await L.click(p, '[data-a=stopT]');
  L.expect('Timer über die Zeitumstellung: 180 min', (await L.store(p)).bloecke.b1.zeit, 180);
  await p.context().close();
  // Routine „alle 2 Tage“ behält den Rhythmus über beide Umstellungen
  p = await L.open({ routinen: { r: { titel: 'R', haeufigkeit: { art: 'alle', n: 2, ab: '2026-10-20' }, zustand: 'aktiv' } } }, 'sim-2026-10-25-0230', 1280);
  await L.go(p, 'woche');
  L.expect('Routine alle 2 Tage über die Umstellungen', await p.evaluate(() => ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2027-03-27', '2027-03-28', '2027-03-29'].map((d) => window.__ls.routinenAt(d).length)), [1, 0, 1, 0, 1, 0, 1]);
  L.expect('Woche der Umstellung hat 7 Tage', await p.locator('[data-k^="d-2026-10-"]').count(), 7);
});
