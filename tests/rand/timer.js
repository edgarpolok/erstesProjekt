const L = require('./lib');
(async () => {
  await L.init();
  // Block on Thursday 2026-12-31 at 23:50
  const seed = { bloecke: { b1: { titel: 'Block A', woche: '2026-12-28', tag: '2026-12-31', status: 'offen', quelle: 'frei', erstellt: 1 }, b2: { titel: 'Block B', woche: '2026-12-28', tag: '2026-12-31', status: 'offen', quelle: 'frei', erstellt: 2 } } };
  const seedOn = (d) => { const x = JSON.parse(JSON.stringify(seed)); Object.values(x.bloecke).forEach((b) => { b.tag = d; b.woche = '2026-12-28'; }); return x; }; // Block am jeweiligen Testtag
  let p = await L.open(seed, 'sim-2026-12-31-2350', 420);
  await L.click(p, '[data-a=startT][data-art=b][data-id=b1]');
  console.log('timer doc', JSON.stringify((await L.store(p)).meta));
  // start second timer on b2 while b1 runs
  await p.evaluate(() => __ls.setSim('2026-12-31', 23 * 60 + 55)); await p.waitForTimeout(100);
  await L.click(p, '[data-a=startT][data-art=b][data-id=b2]');
  let st = await L.store(p);
  console.log('after 2nd start: b1 zeit', st.bloecke.b1.zeit, 'timer', st.meta.timer.id);
  // reload at 00:20 next day (year change)
  let snap = await L.store(p);
  let q = await L.open(snap, 'sim-2027-01-01-0020', 420);
  await L.check(q, 'heute after midnight');
  await L.shot(q, 'timer-after-midnight');
  console.log('bar', await q.evaluate(() => (document.querySelector('.timerbar') || {}).innerText));
  await L.click(q, '[data-a=stopT]');
  st = await L.store(q);
  console.log('b2 after stop', JSON.stringify(st.bloecke.b2));
  // free timer across midnight / week
  q = await L.open({}, 'sim-2027-01-03-2350', 420);  // Sunday
  await L.click(q, '[data-a=startT][data-art=f]');
  snap = await L.store(q);
  q = await L.open(snap, 'sim-2027-01-04-0020', 420);
  await L.click(q, '[data-a=stopT]');
  st = await L.store(q);
  console.log('free timer blocks', JSON.stringify(Object.values(st.bloecke).map(b => [b.titel, b.tag, b.woche, b.zeit, b.status])));
  console.log('heute erfasst text', (await L.check(q, 'x')).t.slice(0, 300).replace(/\n/g, ' | '));
  // wdh timer
  const seedW = { bloecke: { e1: { titel: 'Einheit', woche: '2026-12-21', tag: '2026-12-22', status: 'erledigt', erledigtAm: '2026-12-22', wiederholen: true, sr: { stufe: 1, faellig: '2026-12-23' } } } };
  q = await L.open(seedW, 'sim-2026-12-31-2350', 420);
  await q.waitForTimeout(300);
  console.log('tage', JSON.stringify((await L.store(q)).tage));
  const hasW = await q.$('[data-a=wdhOpen]');
  if (hasW) { await L.click(q, '[data-a=wdhOpen]'); await L.click(q, '[data-a=startT][data-art=w]'); }
  snap = await L.store(q);
  q = await L.open(snap, 'sim-2027-01-01-0030', 420);
  await L.check(q, 'wdh-midnight');
  await L.click(q, '[data-a=stopT]');
  st = await L.store(q);
  console.log('wdh tage after', JSON.stringify(st.tage));
  // delete block while timer running
  q = await L.open(seedOn('2026-12-30'), 'sim-2026-12-30-1000', 420);
  await L.click(q, '[data-a=startT][data-art=b][data-id=b1]');
  await q.evaluate(() => __ls.setSim('2026-12-30', 11 * 60)); 
  await L.click(q, '[data-a=menu][data-m=bb1]'); await L.click(q, '[data-a=delB]');
  st = await L.store(q); console.log('after delete: timer', JSON.stringify(st.meta.timer), 'b1', !!st.bloecke.b1);
  await L.click(q, '.toast [data-a=undo]');
  st = await L.store(q); console.log('after undo: b1', JSON.stringify(st.bloecke.b1), 'timer', JSON.stringify(st.meta.timer));
  // push to pool from Woche while timer runs
  q = await L.open(seedOn('2026-12-30'), 'sim-2026-12-30-1000', 1280);
  await L.click(q, '[data-a=startT][data-art=b][data-id=b1]');
  await L.go(q, 'woche');
  await L.click(q, '[data-a=pushB][data-id=b1]');
  st = await L.store(q); console.log('after pushToPool: timer', JSON.stringify(st.meta.timer), 'b1 tag', st.bloecke.b1.tag);
  await L.shot(q, 'timer-pushpool');
  // check done while running
  q = await L.open(seedOn('2026-12-30'), 'sim-2026-12-30-1000', 420);
  await L.click(q, '[data-a=startT][data-art=b][data-id=b1]');
  await q.evaluate(() => __ls.setSim('2026-12-30', 10 * 60 + 40));
  await L.click(q, '[data-a=tBlock][data-id=b1]');
  st = await L.store(q); console.log('done while running', st.bloecke.b1.zeit, st.bloecke.b1.status, JSON.stringify(st.meta.timer));
  // very long timer: 3 days
  q = await L.open(seedOn('2026-12-28'), 'sim-2026-12-28-1000', 420);
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
