const L = require('./lib');
(async () => {
  await L.init();
  // Block on Thursday 2026-12-31 at 23:50
  const seed = { bloecke: { b1: { titel: 'Block A', woche: '2026-12-28', tag: '2026-12-31', status: 'offen', quelle: 'frei', erstellt: 1 }, b2: { titel: 'Block B', woche: '2026-12-28', tag: '2026-12-31', status: 'offen', quelle: 'frei', erstellt: 2 } } };
const seed2 = JSON.parse(JSON.stringify(seed).replace(/2026-12-31/g,'2026-12-30'));
// delete block while timer running
  q = await L.open(seed2, 'sim-2026-12-30-1000', 420);
  await L.click(q, '[data-a=startT][data-art=b][data-id=b1]');
  await q.evaluate(() => __ls.setSim('2026-12-30', 11 * 60)); 
  await L.click(q, '[data-a=menu][data-m=bb1]'); await L.click(q, '[data-a=delB]');
  st = await L.store(q); console.log('after delete: timer', JSON.stringify(st.meta.timer), 'b1', !!st.bloecke.b1);
  await L.click(q, '.toast [data-a=undo]');
  st = await L.store(q); console.log('after undo: b1', JSON.stringify(st.bloecke.b1), 'timer', JSON.stringify(st.meta.timer));
  // push to pool from Woche while timer runs
  q = await L.open(seed2, 'sim-2026-12-30-1000', 1280);
  await L.click(q, '[data-a=startT][data-art=b][data-id=b1]');
  await L.go(q, 'woche');
  await L.click(q, '[data-a=pushB][data-id=b1]');
  st = await L.store(q); console.log('after pushToPool: timer', JSON.stringify(st.meta.timer), 'b1 tag', st.bloecke.b1.tag);
  await L.shot(q, 'timer-pushpool');
  // check done while running
  q = await L.open(seed2, 'sim-2026-12-30-1000', 420);
  await L.click(q, '[data-a=startT][data-art=b][data-id=b1]');
  await q.evaluate(() => __ls.setSim('2026-12-30', 10 * 60 + 40));
  await L.click(q, '[data-a=tBlock][data-id=b1]');
  st = await L.store(q); console.log('done while running', st.bloecke.b1.zeit, st.bloecke.b1.status, JSON.stringify(st.meta.timer));
  // very long timer: 3 days
  q = await L.open(JSON.parse(JSON.stringify(seed).replace(/2026-12-31/g,'2026-12-28')), 'sim-2026-12-28-1000', 420);
  await L.click(q, '[data-a=startT][data-art=b][data-id=b1]');
  snap = await L.store(q);
  q = await L.open(snap, 'sim-2026-12-31-1000', 420);
  console.log('bar 3d', await q.evaluate(() => (document.querySelector('.timerbar') || {}).innerText));
  await L.click(q, '[data-a=stopT]');
  st = await L.store(q); console.log('3 day timer zeit', st.bloecke.b1.zeit);
  await L.shot(q, 'timer-3days');
  console.log('ERR', L.errs);
  await L.browser.close();
})();
