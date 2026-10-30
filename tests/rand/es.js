const L = require('./lib');
(async () => {
  await L.init();
  const base = { bloecke: { y: { titel: 'Einheit', woche: '2026-10-19', tag: '2026-10-20', status: 'erledigt', erledigtAm: '2026-10-20', wiederholen: true, sr: { stufe: 5, faellig: '2026-10-29' } } },
    termine: { t: { titel: 'Langer Termin', datum: '2026-10-29', von: '08:00', bis: '18:00' } }, vorhaben: { v: { name: 'V groß', std: 12, ab: '2026-11-02', wochen: 1 }, v2: { name: 'V klein', std: 1, ab: '2026-11-02', wochen: 1 } } };
  const cfgs = {
    single: { abstaende: [5], maxAbstand: 5 },
    b1o1: { bloeckeProTag: 1, obergrenze: 1 },
    allfrei: { tagesumfang: ['frei', 'frei', 'frei', 'frei', 'frei', 'frei', 'frei'] },
    puffFrei: { pufferTag: 6 },
    zero: { obergrenze: 0, zeitKurz: 0 },
    garbage: { abstaende: 'x', tagesumfang: [1, 2], pufferTag: 99, bloeckeProTag: 'a', obergrenze: -5 }
  };
  for (const k of Object.keys(cfgs)) {
    const seed = JSON.parse(JSON.stringify(base)); seed.meta = { config: cfgs[k] };
    const p = await L.open(seed, 'sim-2026-10-31-1000', 1280);
    for (const v of ['heute', 'woche', 'kalender', 'themen', 'einstellungen']) { await L.go(p, v); await L.check(p, k + '-' + v); }
    await L.go(p, 'woche'); await L.click(p, '[data-a=wkNext]'); 
    const info = await p.evaluate(() => { const T = '2026-11-02'; return { cap: __ls.capacity2(T), wdh: __ls.weekWdh(T).split, srAbst: __ls.srItems().map(i => i.sr.stufe) }; });
    if (await p.$('[data-a=planClaude]')) { await L.click(p, '[data-a=planClaude]'); await p.waitForTimeout(300); }
    await L.check(p, k + '-planned');
    const st = await L.store(p);
    console.log(k, JSON.stringify(info), 'blocks:', JSON.stringify(Object.values(st.bloecke).filter(b => b.vorhaben).map(b => [b.tag && b.tag.slice(5), b.std, b.titel])));
    await L.shot(p, 'es-' + k);
    // rate the due wdh under single
    if (k === 'single') {
      const q = await L.open(st, 'sim-2026-10-29-1000', 420);
      await q.waitForTimeout(200);
      if (await q.$('[data-a=wdhOpen]')) { await L.click(q, '[data-a=wdhOpen]'); await L.click(q, '[data-a=rateW][data-r=sicher]'); }
      console.log('single rated', JSON.stringify((await L.store(q)).bloecke.y.sr));
      await L.check(q, 'single-rate');
    }
  }
  // whole week pause + termin longer than cap today
  const seed = JSON.parse(JSON.stringify(base)); seed.pausen = { p: { name: 'Urlaub', art: 'frei', von: '2026-10-26', bis: '2026-11-08' } };
  const p = await L.open(seed, 'sim-2026-10-29-1000', 360);
  for (const v of ['heute', 'woche', 'kalender']) { await L.go(p, v); await L.check(p, 'pause-' + v); await L.shot(p, 'pause-' + v); }
  await L.go(p, 'woche'); await L.click(p, '[data-a=wkNext]'); const r = await L.check(p, 'pause-next'); console.log('pause next week:', r.t.slice(0, 300).replace(/\n/g, ' | '));
  // UI abstaende edit
  const q = await L.open(base, 'sim-2026-10-29-1000', 1280);
  await L.go(q, 'einstellungen'); await L.click(q, '[data-a=esOpen][data-v=abst]'); await q.fill('#es-abst', '2'); await L.click(q, '[data-a=esAbst]');
  console.log('cfg after abst 2:', JSON.stringify((await L.store(q)).meta.config));
  await L.click(q, '[data-a=esOpen][data-v=max]'); await L.check(q, 'max'); await L.shot(q, 'es-max');
  for (let i = 0; i < 15; i++) await L.click(q, '[data-a=esOpen][data-v=ober]').then(() => 0).catch(() => 0);
  await L.click(q, '[data-a=esOpen][data-v=ober]').catch(() => 0);
  for (let i = 0; i < 14; i++) await q.click('[data-a=esStep][data-d="-0.5"]').catch(() => 0);
  await q.waitForTimeout(200);
  console.log('obergrenze min', JSON.stringify((await L.store(q)).meta.config.obergrenze));
  console.log(L.errs.join('\n'));
  await L.browser.close();
})();
