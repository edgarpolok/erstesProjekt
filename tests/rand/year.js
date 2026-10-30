const L = require('./lib');
const fs = require('fs');
(async () => {
  await L.init();
  const seed = {
    themen: { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' }, sat: { name: 'Schuldrecht AT', eltern: 'zr', zustand: 'aktiv', sr: { stufe: 3, faellig: '2027-01-02' } } },
    bloecke: {
      u1: { titel: 'Unmöglichkeit', thema: 'sat', status: 'erledigt', erledigtAm: '2026-12-10', woche: '2026-12-07', tag: '2026-12-10', wiederholen: true },
      u2: { titel: 'Einzeln im Eingang', status: 'erledigt', erledigtAm: '2026-12-29', woche: '2026-12-28', tag: '2026-12-29', wiederholen: true, sr: { stufe: 2, faellig: '2027-01-01' } },
      u3: { titel: 'Erledigt KW53', status: 'erledigt', erledigtAm: '2026-12-30', woche: '2026-12-28', tag: '2026-12-30', zeit: 50, gebiet: 'zr' },
      o1: { titel: 'Offen Silvester', status: 'offen', woche: '2026-12-28', tag: '2026-12-31', quelle: 'claude', std: 2 },
      o2: { titel: 'Offen ohne Tag', status: 'offen', woche: '2026-12-28', tag: null, quelle: 'liste', std: 3 },
      o3: { titel: 'Uralt offen', status: 'offen', woche: '2026-12-14', tag: '2026-12-15', quelle: 'claude' }
    },
    routinen: { r1: { titel: 'Sport alle 3', haeufigkeit: { art: 'alle', n: 3, ab: '2026-12-26' }, zustand: 'aktiv' }, r2: { titel: 'Anki', haeufigkeit: { art: 'taeglich' }, zustand: 'aktiv' } },
    termine: { t1: { titel: 'Vorlesung', wochentage: [0, 3], von: '10:00', bis: '12:00', zustand: 'aktiv' } },
    etappen: { e1: { name: 'Winter', von: '2026-12-01', bis: '2027-01-15' } },
    pausen: { p1: { name: 'Weihnachten', art: 'frei', von: '2026-12-24', bis: '2026-12-26' } }
  };
  // routine hits across year
  let p = await L.open(seed, 'sim-2026-12-29-1000', 1280);
  const hits = await p.evaluate(() => { const o = []; let d = '2026-12-24'; for (let i = 0; i < 18; i++) { o.push(d.slice(5) + ':' + __ls.routinenAt(d).map(r => r.titel[0]).join('')); const x = new Date(d + 'T12:00Z'); x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10); } return o.join(' '); });
  console.log('routines', hits);
  await L.go(p, 'woche'); await L.check(p, 'woche kw53'); await L.shot(p, 'year-woche-kw53');
  const hdr = []; 
  for (let i = 0; i < 3; i++) { hdr.push(await p.textContent('.wkhead .kw') + ' / ' + await p.textContent('.wkhead h1')); await L.click(p, '[data-a=wkNext]'); await L.check(p, 'next' + i); }
  for (let i = 0; i < 6; i++) { await L.click(p, '[data-a=wkPrev]'); await L.check(p, 'prev' + i); hdr.push(await p.textContent('.wkhead .kw') + ' / ' + await p.textContent('.wkhead h1')); }
  console.log(hdr.join('\n'));
  await L.go(p, 'kalender'); await L.check(p, 'kal'); await L.shot(p, 'year-kal');
  const kwRows = await p.$$eval('.kwbtn', (els) => els.map((e) => e.innerText.replace(/\n/g, ' ')).join(' | '));
  console.log('kal rows', kwRows);
  await L.click(p, '[data-a=kTab][data-v=zahlen]'); await L.check(p, 'zahlen'); await L.shot(p, 'year-zahlen');
  // Jan 4 2027 carry-over
  p = await L.open(seed, 'sim-2027-01-04-0900', 1280);
  await L.go(p, 'woche'); const r = await L.check(p, 'woche kw1'); await L.shot(p, 'year-woche-kw1');
  console.log('KW1 text:', r.t.slice(0, 1500).replace(/\n/g, ' | '));
  // keep o1
  await L.click(p, '[data-a=carryKeep][data-id=o1]');
  const st = await L.store(p); console.log('o1 after keep', JSON.stringify(st.bloecke.o1));
  console.log('pool', await p.evaluate(() => JSON.stringify(__ls.poolOf('2027-01-04').map(b => b.titel))));
  await L.go(p, 'heute'); await L.click(p, '[data-a=poolOpen]'); const rh = await L.check(p, 'heute kw1'); console.log('heute pool', rh.t.slice(0, 800).replace(/\n/g, ' | '));
  // planning on Saturday 2026-12-26 is in pause (frei) -> planning card for KW53?
  p = await L.open(seed, 'sim-2026-12-26-1000', 1280);
  await L.go(p, 'woche'); const r2 = await L.check(p, 'woche pause sat'); await L.shot(p, 'year-woche-sat');
  console.log('Sat 26.12 woche:', r2.t.slice(0, 600).replace(/\n/g, ' | '));
  const nxt = await p.$('[data-a=goPlanNext]'); console.log('plan link?', !!nxt);
  await L.click(p, '[data-a=wkNext]');
  console.log('need KW53', await p.evaluate(() => JSON.stringify(__ls.wdhNeed('2026-12-28'))));
  await L.click(p, '[data-a=vAdd]'); await p.fill('.vrow input.inp', 'Großes Vorhaben'); await p.press('.vrow input.inp', 'Tab'); await p.waitForTimeout(150);
  await L.click(p, '[data-a=vStd][data-h="12"]');
  await L.click(p, '[data-a=planClaude]'); await p.waitForTimeout(500);
  await L.check(p, 'after plan'); await L.shot(p, 'year-plan-kw53');
  const st2 = await L.store(p);
  console.log('plan blocks', JSON.stringify(Object.values(st2.bloecke).filter(b => b.vorhaben).map(b => [b.tag, b.std, b.titel])));
  console.log('wochen', JSON.stringify(st2.wochen['2026-12-28']));
  fs.writeFileSync(__dirname + '/out/year-store.json', JSON.stringify(st2));
  console.log('ERR', L.errs);
  await L.browser.close();
})();
