const L = require('./lib');
(async () => {
  await L.init();
  for (const h of ['sim-2026-10-25-0230', 'sim-2027-03-28-0230', 'sim-2027-03-28-0200', 'sim-2026-10-25-0300', 'sim-2027-03-28-2359', 'sim-2026-10-24-2359']) {
    const p = await L.open({}, h, 420);
    const r = await L.check(p, h);
    console.log(h, '->', await p.evaluate(() => __ls.today()), (r.t.match(/Simulation:[^\n]*/) || [''])[0]);
  }
  // timer across DST end: start 01:30 2026-10-25, stop 03:30 (2h wallclock + 1h repeated = 3h real)
  const seed = { bloecke: { b1: { titel: 'X', woche: '2026-10-19', tag: '2026-10-25', status: 'offen', quelle: 'frei', erstellt: 1 } } };
  let p = await L.open(seed, 'sim-2026-10-25-0130', 420);
  await L.click(p, '[data-a=startT][data-art=b]');
  let s = await L.store(p);
  p = await L.open(s, 'sim-2026-10-25-0330', 420);
  await L.click(p, '[data-a=stopT]'); s = await L.store(p);
  console.log('DST timer minutes (expect 180 real)', s.bloecke.b1.zeit);
  // week views over DST weeks
  p = await L.open({ routinen: { r: { titel: 'R', haeufigkeit: { art: 'alle', n: 2, ab: '2026-10-20' }, zustand: 'aktiv' } } }, 'sim-2026-10-25-0230', 1280);
  await L.go(p, 'woche'); await L.check(p, 'woche dst');
  console.log(await p.evaluate(() => ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2027-03-27', '2027-03-28', '2027-03-29'].map(d => d + ':' + __ls.routinenAt(d).length).join(' ')));
  console.log('ERR', L.errs);
  await L.browser.close();
})();
