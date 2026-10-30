const L = require('./lib');
(async () => {
  await L.init();
  const X = '<img src=x onerror="window.__xss=1">"\'&<script>window.__xss=2</script>';
  for (const [nm, seed] of [['empty', {}], ['xss', {
    themen: { a: { name: X, eltern: null, zustand: 'aktiv', farbe: 'x" onclick="window.__xss=3' }, b: { name: X + 'b', eltern: 'a', zustand: 'abgeschlossen', abgeschlossenAm: '2026-10-20' } },
    bloecke: { ['q"><img src=x onerror=window.__xss=4>']: { titel: X, woche: '2026-10-26', tag: '2026-10-29', status: 'offen', quelle: 'frei', gebiet: 'a', erstellt: 1 }, y: { titel: X, woche: '2026-10-19', tag: '2026-10-20', status: 'erledigt', erledigtAm: '2026-10-20', wiederholen: true, sr: { stufe: 1, faellig: '2026-10-21' }, zeit: 20 }, z: { titel: X, woche: '2026-10-19', status: 'offen', tag: null } },
    routinen: { r: { titel: X, haeufigkeit: { art: 'taeglich' }, notiz: X, zustand: 'aktiv' } },
    termine: { t: { titel: X, datum: '2026-10-29', von: '10:00', bis: '11:00' }, t2: { titel: X, wochentage: [3], von: '<b>', zustand: 'aktiv' } },
    etappen: { e: { name: X, von: '2026-10-01', bis: '2026-10-20', ziel: X } }, pausen: { p: { name: X, art: 'wdh', von: '2026-10-28', bis: '2026-10-30' } },
    vorhaben: { v: { name: X, ab: '2026-11-02', wochen: 1 } }, wochen: { '2026-10-19': { einschaetzung: { text: X, am: '2026-10-24', quelle: X } } },
    meta: { vorschlaege: { liste: [{ text: X, am: X }] }, timer: { laeuft: true, art: 'f', titel: X, start: 0 } }
  }]]) {
    for (const w of [360, 1280]) {
      const p = await L.open(seed, 'sim-2026-10-29-1000', w);
      const views = ['heute', 'woche', 'kalender', 'themen', 'einstellungen'];
      for (const v of views) {
        await L.go(p, v); await L.check(p, nm + '-' + v);
        if (v === 'woche') { await L.click(p, '[data-a=wkPrev]'); await L.check(p, nm + '-woche-prev'); await L.click(p, '[data-a=wkNext]'); await L.click(p, '[data-a=wkNext]'); await L.check(p, nm + '-woche-next'); if (await p.$('[data-a=planClaude]')) { await L.click(p, '[data-a=planClaude]'); await p.waitForTimeout(300); await L.check(p, nm + '-plan'); } }
        if (v === 'kalender') { await L.click(p, '[data-a=kTab][data-v=zahlen]'); await L.check(p, nm + '-zahlen'); await L.shot(p, nm + '-zahlen-' + w); for (const per of ['etappe', 'gesamt']) { if (await p.$('[data-a=kPeriod][data-v=' + per + ']')) { await L.click(p, '[data-a=kPeriod][data-v=' + per + ']'); await L.check(p, nm + '-zahlen-' + per); } } await L.click(p, '[data-a=kTab][data-v=kalender]'); }
        if (v === 'themen' && nm === 'xss') { await L.click(p, '[data-a=thSel][data-id=a]'); await L.check(p, 'xss-thdetail'); await L.click(p, '[data-a=thClosed]').catch(() => {}); }
        await L.shot(p, nm + '-' + v + '-' + w);
      }
      console.log(nm, w, 'xss flag', await p.evaluate(() => window.__xss));
    }
  }
  console.log(L.errs.join('\n'));
  await L.browser.close();
})();
