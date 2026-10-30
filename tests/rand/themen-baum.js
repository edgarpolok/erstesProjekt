// Themenbaum an seinen Grenzen: höchstens vier Ebenen, Verschieben/Zusammenlegen, Löschen und Rückgängig aus einer
// anderen Ansicht, Abschließen samt Unterthemen, leerer Name
const L = require('../lib');
const th = { g1: { name: 'Zivil', eltern: null, zustand: 'aktiv' }, g2: { name: 'Straf', eltern: null, zustand: 'aktiv' },
  a: { name: 'A', eltern: 'g1', zustand: 'aktiv' }, a1: { name: 'A1', eltern: 'a', zustand: 'aktiv' }, a2: { name: 'A2', eltern: 'a1', zustand: 'aktiv' },
  s: { name: 'S', eltern: 'g2', zustand: 'aktiv', sr: { stufe: 4, faellig: '2026-11-20' } }, s1: { name: 'S1', eltern: 's', zustand: 'aktiv', sr: { stufe: 2, faellig: '2026-11-01' } } };
const bl = { u1: { titel: 'U-S1', thema: 's1', gebiet: 'g2', status: 'erledigt', erledigtAm: '2026-10-20', woche: '2026-10-19', wiederholen: true },
  u2: { titel: 'U-S', thema: 's', gebiet: 'g2', status: 'erledigt', erledigtAm: '2026-10-20', woche: '2026-10-19', wiederholen: true } };

L.run(async () => {
  const p = await L.open({ themen: th, bloecke: bl }, 'sim-2026-10-29-1000', 1280);
  await L.go(p, 'themen');
  const auf = async () => { for (let i = 0; i < 4; i++) { await p.evaluate(() => document.querySelectorAll('[data-a=thTog][aria-expanded=false]').forEach((b) => b.click())); await p.waitForTimeout(120); } };
  await auf();
  await L.click(p, '[data-a=thSel][data-id=a2]');
  L.expect('vierte Ebene: kein Feld für Unterthemen', await p.locator('#th-sub').count(), 0);
  await L.click(p, '[data-a=thSel][data-id=a]');
  L.expect('A (zwei Ebenen darunter) nur nach oben oder in Gebiete verschiebbar', await p.$$eval('#th-move option', (o) => o.map((x) => x.textContent.trim())), ['Verschieben nach …', 'Oberste Ebene (eigenes Gebiet)', 'Straf', 'Zivil']);
  // S (mit S1) in A2 zusammenlegen: S1 käme auf Ebene 5 -> abgelehnt; in A1 -> erlaubt
  await L.click(p, '[data-a=thSel][data-id=s]');
  await p.selectOption('#th-merge', 'a2'); await L.click(p, '[data-a=thMerge]');
  L.has('Zusammenlegen zu tief abgelehnt', await L.toast(p), 'mehr als vier Ebenen');
  L.ok('abgelehnt: S noch da', !!(await L.store(p)).themen.s);
  await p.selectOption('#th-merge', 'a1'); await L.click(p, '[data-a=thMerge]');
  let s = await L.store(p);
  L.expect('S in A1: S weg, S1 unter A1, Einheiten umgehängt, Gebiet neu', [!!s.themen.s, s.themen.s1.eltern, s.bloecke.u1.gebiet, s.bloecke.u2.thema, s.bloecke.u2.gebiet], [false, 'a1', 'g1', 'a1', 'g1']);
  L.expect('A1 übernimmt den Wiederholungsstand von S', s.themen.a1.sr, { stufe: 4, faellig: '2026-11-20' });
  await L.click(p, '.toast [data-a=undo]');
  s = await L.store(p);
  L.expect('rückgängig: alles wie vorher', [!!s.themen.s, s.themen.s1.eltern, s.bloecke.u2.thema, s.bloecke.u2.gebiet, s.themen.a1.sr], [true, 's', 's', 'g2', undefined]);
  // Zivil samt Baum löschen, in eine andere Ansicht wechseln, dort rückgängig
  await auf(); await L.click(p, '[data-a=thSel][data-id=g1]'); await L.click(p, '[data-a=thDelAsk]'); await L.click(p, '[data-a=thDel]');
  L.expect('Zivil-Baum gelöscht', Object.keys((await L.store(p)).themen).sort(), ['g2', 's', 's1']);
  await L.go(p, 'heute');
  L.expect('Rückgängig auch in anderer Ansicht', await p.locator('.toast [data-a=undo]').count(), 1);
  await L.click(p, '.toast [data-a=undo]');
  L.expect('Baum wieder da', Object.keys((await L.store(p)).themen).sort(), ['a', 'a1', 'a2', 'g1', 'g2', 's', 's1']);
  // S abschließen: S und S1 fallen aus der Wiederholung; wieder aktiv: beide starten neu ab morgen
  await L.go(p, 'themen'); await L.click(p, '[data-a=thSel][data-id=s]'); await L.click(p, '[data-a=thZ][data-v=abgeschlossen]');
  L.expect('abgeschlossen: keine Wiederholung für S und S1', await p.evaluate(() => window.__ls.srItems().map((i) => i.ref)), []);
  await L.click(p, '[data-a=thZ][data-v=aktiv]');
  s = await L.store(p);
  L.expect('reaktiviert: S und S1 neu ab morgen', [s.themen.s.sr, s.themen.s1.sr], [{ stufe: 1, faellig: '2026-10-30', letzte: null, bewertung: null }, { stufe: 1, faellig: '2026-10-30', letzte: null, bewertung: null }]);
  // leerer Name
  await L.fill(p, '#th-name', '   '); await L.click(p, '[data-a=thRen]');
  L.has('leerer Name abgelehnt', await L.toast(p), 'Der Name darf nicht leer sein');
  L.expect('Name bleibt', (await L.store(p)).themen.s.name, 'S');
});
