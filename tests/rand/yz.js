const L = require('./lib'); const fs = require('fs');
(async () => {
  await L.init();
  const seed = JSON.parse(fs.readFileSync(__dirname + '/out/year-store.json'));
  seed.bloecke.k1 = { titel: 'Jan', status: 'erledigt', erledigtAm: '2027-01-05', woche: '2027-01-04', tag: '2027-01-05', gebiet: 'zr' };
  const p = await L.open(seed, 'sim-2027-01-13-1000', 1280);
  await L.go(p, 'kalender'); await L.click(p, '[data-a=kTab][data-v=zahlen]');
  for (const per of ['monat', 'gesamt']) { await L.click(p, '[data-a=kPeriod][data-v=' + per + ']'); const r = await L.check(p, per); console.log(per, r.t.slice(0, 700).replace(/\n/g, ' | ')); }
  await L.shot(p, 'year-zahlen-jan');
  console.log(L.errs); await L.browser.close();
})();
