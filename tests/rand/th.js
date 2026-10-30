const L = require('./lib');
(async () => {
  await L.init();
  const th = { g1: { name: 'Zivil', eltern: null, zustand: 'aktiv' }, g2: { name: 'Straf', eltern: null, zustand: 'aktiv' },
    a: { name: 'A', eltern: 'g1', zustand: 'aktiv' }, a1: { name: 'A1', eltern: 'a', zustand: 'aktiv' }, a2: { name: 'A2', eltern: 'a1', zustand: 'aktiv' },
    s: { name: 'S', eltern: 'g2', zustand: 'aktiv', sr: { stufe: 4, faellig: '2026-11-20' } }, s1: { name: 'S1', eltern: 's', zustand: 'aktiv', sr: { stufe: 2, faellig: '2026-11-01' } } };
  const bl = { u1: { titel: 'U-S1', thema: 's1', gebiet: 'g2', status: 'erledigt', erledigtAm: '2026-10-20', woche: '2026-10-19', wiederholen: true },
    u2: { titel: 'U-S', thema: 's', gebiet: 'g2', status: 'erledigt', erledigtAm: '2026-10-20', woche: '2026-10-19', wiederholen: true } };
  const p = await L.open({ themen: th, bloecke: bl }, 'sim-2026-10-29-1000', 1280);
  await L.go(p, 'themen');
  const api = (fn) => p.evaluate(fn);
  const exp = async () => { for (let i = 0; i < 4; i++) { await p.evaluate(() => document.querySelectorAll('[data-a=thTog][aria-expanded=false]').forEach((b) => b.click())); await p.waitForTimeout(120); } };
  await exp();
  // depth: create under a2 (depth 3)
  await L.click(p, '[data-a=thSel][data-id=a2]');
  console.log('sub input at depth4?', !!(await p.$('#th-sub')));
  console.log('move opts for a (subtree depth 2):', await p.evaluate(() => { document.querySelector('[data-a=thSel][data-id=a]').click(); return 1; }).then(() => p.waitForTimeout(150)).then(() => p.$$eval('#th-move option', (o) => o.map((x) => x.textContent.trim()).join(','))));
  // merge S (with child S1) into A1 (depth 2): S1 would end at depth 3 -> allowed. merge S into A2 (depth 3): S1 depth 4 -> rejected
  await L.click(p, '[data-a=thSel][data-id=s]');
  await p.selectOption('#th-merge', 'a2'); await L.click(p, '[data-a=thMerge]');
  console.log('merge into a2 toast:', await p.textContent('.toast').catch(() => '-'));
  await p.selectOption('#th-merge', 'a1'); await L.click(p, '[data-a=thMerge]');
  let st = await L.store(p);
  console.log('after merge s->a1: s1 parent', st.themen.s1 && st.themen.s1.eltern, '| u1 gebiet', st.bloecke.u1.gebiet, '(topOf s1 now g1) | u2', st.bloecke.u2.thema, st.bloecke.u2.gebiet, '| a1 sr', JSON.stringify(st.themen.a1.sr));
  await L.check(p, 'after merge');
  // undo merge
  await L.click(p, '.toast [data-a=undo]'); st = await L.store(p);
  console.log('undo merge: s exists', !!st.themen.s, 's1 parent', st.themen.s1.eltern, 'u2', st.bloecke.u2.thema, 'a1 sr', JSON.stringify(st.themen.a1.sr));
  await L.check(p, 'after undo');
  // delete g1 tree then navigate away then undo
  await exp(); await L.click(p, '[data-a=thSel][data-id=g1]'); await L.click(p, '[data-a=thDelAsk]'); await L.click(p, '[data-a=thDel]');
  await L.go(p, 'heute'); await L.check(p, 'heute after del');
  const hasUndo = !!(await p.$('.toast [data-a=undo]')); console.log('undo visible on other view', hasUndo);
  if (hasUndo) await L.click(p, '.toast [data-a=undo]');
  st = await L.store(p); console.log('after undo del: themen', Object.keys(st.themen).sort().join(','));
  // closed theme with selected detail & subthemes: abgeschlossen parent then try move child under closed?
  await L.go(p, 'themen'); await L.click(p, '[data-a=thSel][data-id=s]'); await L.click(p, '[data-a=thZ][data-v=abgeschlossen]');
  st = await L.store(p); console.log('srItems after closing s', await api(() => __ls.srItems().map(i => i.ref).join(',')));
  await L.click(p, '[data-a=thZ][data-v=aktiv]');
  st = await L.store(p); console.log('reactivated sr s', JSON.stringify(st.themen.s.sr), 's1', JSON.stringify(st.themen.s1.sr));
  await L.check(p, 'end');
  // rename to empty / whitespace
  await p.fill('#th-name', '   '); await L.click(p, '[data-a=thRen]'); console.log('rename empty toast:', await p.textContent('.toast').catch(() => '-'));
  // create gebiet with same name twice
  await L.click(p, '[data-a=thBack]').catch(() => {});
  console.log(L.errs.join('\n'));
  await L.browser.close();
})();
