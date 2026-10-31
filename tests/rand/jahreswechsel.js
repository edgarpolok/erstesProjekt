// Jahreswechsel 2026/27 (KW 53): Routinen, Wochenköpfe, Kalenderzeilen, Wochenwechsel, Planung, Statistik
const L = require('../lib');

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
const AUFGREIFEN = / kurz aufgreifen$/;
const kopf = async (p) => (await L.text(p, '.wkhead .kw')) + ' / ' + (await L.text(p, '.wkhead h1'));

L.run(async () => {
  let p = await L.open(seed, 'sim-2026-12-29-1000', 1280);
  const hits = await p.evaluate(() => { const o = []; let d = '2026-12-24'; for (let i = 0; i < 18; i++) { o.push(d.slice(5) + ':' + window.__ls.routinenAt(d).map((r) => r.titel[0]).join('')); const x = new Date(d + 'T12:00Z'); x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10); } return o.join(' '); });
  L.expect('Routinen über den Jahreswechsel (Pause 24.–26.12., Sport alle 3 ab 26.12.)', hits, '12-24: 12-25: 12-26: 12-27:A 12-28:A 12-29:SA 12-30:A 12-31:A 01-01:SA 01-02:A 01-03:A 01-04:SA 01-05:A 01-06:A 01-07:SA 01-08:A 01-09:A 01-10:SA');
  await L.go(p, 'woche');
  
  const koepfe = [await kopf(p)];
  for (let i = 0; i < 2; i++) { await L.click(p, '[data-a=wkNext]'); koepfe.push(await kopf(p)); }
  for (let i = 0; i < 4; i++) { await L.click(p, '[data-a=wkPrev]'); koepfe.push(await kopf(p)); }
  L.expect('Wochenköpfe um den Jahreswechsel', koepfe, ['KW 53 · 28. Dez – 3. Jan / Diese Woche', 'KW 1 · 4. – 10. Jan / Nächste Woche', 'KW 2 · 11. – 17. Jan / In 2 Wochen', 'KW 1 · 4. – 10. Jan / Nächste Woche', 'KW 53 · 28. Dez – 3. Jan / Diese Woche', 'KW 52 · 21. – 27. Dez / Letzte Woche', 'KW 51 · 14. – 20. Dez / Vor 2 Wochen']);
  await L.go(p, 'kalender');
  const zeilen = await p.$$eval('.kwbtn', (els) => els.map((e) => e.innerText.replace(/\n/g, ' ')).join(' | '));
  L.has('Kalender: KW 53 und KW 1 hintereinander', zeilen, 'KW 52 21.12.–27.12. | KW 53 28.12.–3.1. | KW 1 4.1.–10.1.');
  await L.click(p, '[data-a=kTab][data-v=zahlen]');
  await p.context().close();

  // 2025/26: Donnerstag der Woche liegt schon im neuen Jahr -> KW 1 beginnt am 29.12.2025
  p = await L.open({}, 'sim-2025-12-30-1000', 1280);
  await L.go(p, 'woche');
  L.expect('Woche 29.12.2025 ist KW 1', await kopf(p), 'KW 1 · 29. Dez – 4. Jan / Diese Woche');
  await L.click(p, '[data-a=wkPrev]');
  L.expect('Woche davor ist KW 52', await kopf(p), 'KW 52 · 22. – 28. Dez / Letzte Woche');
  await p.context().close();

  // 4.1.2027: Wochenwechsel aus KW 53
  p = await L.open(seed, 'sim-2027-01-04-0900', 1280);
  await L.go(p, 'woche');
  L.expect('Liegengebliebenes aus KW 51 und KW 53', (await p.locator('[data-a=carryKeep]').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).sort(), ['o1', 'o2', 'o3']);
  L.has('Herkunft „aus KW 53“', await L.text(p), 'aus KW 53');
  await L.click(p, '[data-a=carryKeep][data-id=o1]');
  const o1 = (await L.store(p)).bloecke.o1;
  L.expect('mitgenommen in KW 1', [o1.woche, o1.tag, o1.mitgenommen, o1.ausWoche], ['2027-01-04', null, true, '2026-12-28']);
  L.expect('„Noch offen“ in KW 1', await p.evaluate(() => window.__ls.poolOf('2027-01-04').map((b) => b.titel)), ['Offen Silvester']);
  await L.go(p, 'heute');
  await p.context().close();

  // Sa 26.12. (Pause) ist Planungstag: KW 53 planen
  p = await L.open(seed, 'sim-2026-12-26-1000', 1280);
  await L.go(p, 'woche');
  L.expect('Planungstag auch in der Pause', await p.locator('[data-a=goPlanNext]').count(), 1);
  await L.click(p, '[data-a=wkNext]');
  const vor = await p.evaluate(() => ['2027-01-01', '2027-01-02'].map((d) => window.__ls.wdhListe(d).map((x) => [d, x.ref])).flat());
  L.expect('KW 53: zwei fällige Wiederholungen (Neujahr, 2.1.)', vor, [['2027-01-01', 'e:u2'], ['2027-01-02', 't:sat']]);
  await L.click(p, '[data-a=vAdd]'); await L.fill(p, '.vrow input.inp', 'Großes Vorhaben'); await p.press('.vrow input.inp', 'Tab'); await p.waitForTimeout(150);
  await L.click(p, '[data-a=vStd][data-h="12"]');
  await L.click(p, '[data-a=planClaude]'); await p.waitForTimeout(500);
  const s = await L.store(p);
  const plan = Object.values(s.bloecke).filter((b) => b.vorhaben);
  L.expect('KW 53 übergeben', s.wochen['2026-12-28'].status, 'uebergeben');
  L.expect('12 h verteilt', plan.filter((b) => !AUFGREIFEN.test(b.titel)).reduce((a, b) => a + b.std, 0), 12);
  L.ok('alle Blöcke in KW 53 (28.12.–3.1.)', plan.every((b) => b.woche === '2026-12-28' && b.tag >= '2026-12-28' && b.tag <= '2027-01-03'), plan.map((b) => b.tag));
  const cap = await p.evaluate(() => window.__ls.capacity2('2026-12-28'));
  const proTag = {}; plan.forEach((b) => { proTag[b.tag] = (proTag[b.tag] || 0) + b.std; });
  L.ok('kein Tag über seiner Kapazität', Object.keys(proTag).every((d) => proTag[d] <= (cap[d] || 0) + 0.5 + 1e-9), { proTag, cap });
  const wsp = await p.evaluate(() => window.__ls.wdhSplit('2026-12-28'));
  L.expect('Wiederholungszeit an den Fälligkeitstagen', [wsp['2027-01-01'], wsp['2027-01-02']], [15, 15]);
  await p.context().close();

  // 13.1.2027: Statistik zählt die Wochen über den Jahreswechsel richtig
  const z = JSON.parse(JSON.stringify(s));
  z.bloecke.k1 = { titel: 'Jan', status: 'erledigt', erledigtAm: '2027-01-05', woche: '2027-01-04', tag: '2027-01-05', gebiet: 'zr' };
  p = await L.open(z, 'sim-2027-01-13-1000', 1280);
  await L.go(p, 'kalender'); await L.click(p, '[data-a=kTab][data-v=zahlen]');
  await L.click(p, '[data-a=kPeriod][data-v=monat]');
  L.has('Statistik letzter Monat: KW 51 bis KW 1 = 4 Wochen', await L.text(p), 'KW 51 bis KW 1 · 4 Wochen');
  await L.click(p, '[data-a=kPeriod][data-v=gesamt]');
  L.has('Statistik gesamt: KW 50 bis KW 1 = 5 Wochen', await L.text(p), 'KW 50 bis KW 1 · 5 Wochen');
});
