const L = require('./lib');
const LONG = 'Rechtsgeschäftslehre'.repeat(11);
(async () => {
  await L.init();
  const themen = { a: { name: 'A', eltern: null, zustand: 'aktiv' }, d: { name: LONG, eltern: 'a', zustand: 'aktiv', sr: { stufe: 2, faellig: '2026-10-29' } }, e: { name: LONG, eltern: 'a', zustand: 'aktiv' } };
  const bloecke = { x: { titel: 'u', thema: 'd', status: 'erledigt', erledigtAm: '2026-10-20', woche: '2026-10-19', wiederholen: true } };
  const p = await L.open({ themen, bloecke }, 'sim-2026-10-29-1000', 1280);
  await L.go(p, 'themen');
  const r = await L.check(p, 'nm-with-sub');
  console.log(r.sw, await p.$$eval('.trow .nm', (els) => els.map((e) => e.scrollWidth + '/' + e.clientWidth)));
  await L.click(p, '[data-a=thSel][data-id=e]'); const r2 = await L.check(p, 'sel'); console.log('after select', r2.sw, await p.$eval('.trow.cur', (e) => getComputedStyle(e).whiteSpace + ' border=' + getComputedStyle(e).borderTopWidth + ' pad=' + getComputedStyle(e).paddingLeft)); await L.shot(p, 'long-tree-selected-1280', false);
  console.log(L.errs); await L.browser.close();
})();
