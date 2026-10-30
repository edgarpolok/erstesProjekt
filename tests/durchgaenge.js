// Durchgänge: mehrere Durchgänge durch den Stoff, auf jeder Ebene des Themenbaums
// (neu beginnen, Schalter, Hinweis auf frühere Durchgänge, Stand, Zeitstrahl, alte Daten ohne Durchgänge)
const L = require('./lib');

// Zivilrecht > Schuldrecht AT > (Unmöglichkeit, Verzug); Zivilrecht > Kaufrecht
const baum = () => ({
  zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' },
  sat: { name: 'Schuldrecht AT', eltern: 'zr', zustand: 'aktiv', durchAm: '2026-10-20' },
  u: { name: 'Unmöglichkeit', eltern: 'sat', zustand: 'aktiv', durchAm: '2026-10-21' },
  kr: { name: 'Kaufrecht', eltern: 'zr', zustand: 'aktiv', durchAm: '2026-10-22' },
  v: { name: 'Verzug', eltern: 'sat', zustand: 'aktiv' },
});
const HASH = 'sim-2026-11-04-1000';
const fr = (s, id) => s.themen[id].frueher;
const da = (s, id) => s.themen[id].durchAm === undefined ? null : s.themen[id].durchAm;

async function oeffne(id) {
  const p = await L.open({ themen: baum() }, HASH, 1280);
  await L.go(p, 'themen');
  await L.click(p, '[data-a=thSel][data-id=' + id + ']');
  return p;
}

L.run(async () => {
  // 1) Neuen Durchgang für Schuldrecht AT beginnen: gilt für sat, u, v – nicht für kr und zr
  let p = await oeffne('sat');
  L.has('Knopf nennt die Unterthemen', await L.text(p, '[data-a=thNeuDurch][data-id=sat]'), 'neuen Durchgang beginnen (mit allen Unterthemen)');
  const vorher = await L.store(p);
  await L.click(p, '[data-a=thNeuDurch][data-id=sat]');
  let s = await L.store(p);
  L.expect('sat: frueher', fr(s, 'sat'), ['2026-10-20']);
  L.expect('Unmöglichkeit: frueher', fr(s, 'u'), ['2026-10-21']);
  L.expect('Verzug: frueher (damals nicht durchgearbeitet)', fr(s, 'v'), [null]);
  L.expect('sat: durchAm zurückgesetzt', da(s, 'sat'), null);
  L.expect('u: durchAm zurückgesetzt', da(s, 'u'), null);
  L.expect('v: durchAm bleibt leer', da(s, 'v'), null);
  L.expect('Kaufrecht unverändert', s.themen.kr, vorher.themen.kr);
  L.expect('Zivilrecht unverändert', s.themen.zr, vorher.themen.zr);
  L.ok('Kaufrecht und Zivilrecht ohne frueher', fr(s, 'kr') === undefined && fr(s, 'zr') === undefined);
  await L.click(p, '.toast [data-a=undo]');
  s = await L.store(p);
  L.expect('rückgängig: alle Themen wie vorher', L.diff(vorher, s), []);
  L.ok('rückgängig: kein frueher bei Schuldrecht AT', fr(s, 'sat') === undefined || fr(s, 'sat').length === 0);

  // Thema ohne Unterthemen: Knopf ohne Zusatz, nur dieses Thema betroffen
  await L.go(p, 'themen');
  await L.click(p, '[data-a=thSel][data-id=kr]');
  const krKnopf = await L.text(p, '[data-a=thNeuDurch][data-id=kr]');
  L.has('Blatt: Knopf', krKnopf, 'neuen Durchgang beginnen');
  L.hasNot('Blatt: Knopf ohne Zusatz', krKnopf, 'mit allen Unterthemen');
  await L.click(p, '[data-a=thNeuDurch][data-id=kr]');
  s = await L.store(p);
  L.expect('Kaufrecht: frueher', fr(s, 'kr'), ['2026-10-22']);
  L.ok('Schuldrecht AT von Kaufrecht unberührt', fr(s, 'sat') === undefined || fr(s, 'sat').length === 0);
  await p.context().close();

  // 2) Danach durcharbeiten: Schalter, Beschriftung, frühere Durchgänge
  p = await oeffne('sat');
  await L.click(p, '[data-a=thNeuDurch][data-id=sat]');
  await L.click(p, '[data-a=thDurch][data-id=sat]');
  s = await L.store(p);
  L.expect('sat durchgearbeitet heute', s.themen.sat.durchAm, '2026-11-04');
  L.has('Schalter nennt den 2. Durchgang', await L.text(p, '[data-a=thDurch][data-id=sat]'), 'im 2. Durchgang');
  L.has('früherer Durchgang mit Datum', await L.text(p, '[data-k=th-frueher]'), '1. Durchgang 20. Oktober 2026');
  // Verzug liegt unter dem zugeklappten Schuldrecht AT: erst aufklappen
  await L.click(p, '[data-a=thTog][data-id=sat]');
  await L.click(p, '[data-a=thSel][data-id=v]');
  L.has('Verzug: 1. Durchgang nicht abgeschlossen', await L.text(p, '[data-k=th-frueher]'), '1. Durchgang nicht abgeschlossen');
  await p.context().close();

  // 3) Oberste Ebene: gilt für alle Unterthemen; zweimal hintereinander → Durchgang 3
  p = await oeffne('zr');
  await L.click(p, '[data-a=thNeuDurch][data-id=zr]');
  s = await L.store(p);
  L.expect('Zivilrecht: Durchgang 1 gemerkt (nie durchgearbeitet)', fr(s, 'zr'), [null]);
  L.expect('alle Themen haben genau einen früheren Durchgang', ['zr', 'sat', 'u', 'v', 'kr'].map((k) => fr(s, k).length), [1, 1, 1, 1, 1]);
  L.expect('Kaufrecht: früheres Datum', fr(s, 'kr'), ['2026-10-22']);
  L.ok('kein Thema mehr im laufenden Durchgang durchgearbeitet', ['zr', 'sat', 'u', 'v', 'kr'].every((k) => da(s, k) === null));
  await L.click(p, '[data-a=thNeuDurch][data-id=zr]');
  s = await L.store(p);
  L.expect('zweiter Neubeginn: zwei frühere Durchgänge überall', ['zr', 'sat', 'u', 'v', 'kr'].map((k) => fr(s, k).length), [2, 2, 2, 2, 2]);
  L.expect('Unmöglichkeit: Reihenfolge der Durchgänge', fr(s, 'u'), ['2026-10-21', null]);
  L.has('Schalter nennt den 3. Durchgang', await L.text(p, '[data-a=thDurch][data-id=zr]'), 'im 3. Durchgang');
  await p.context().close();

  // 4) Stand: Zusammenfassung und Zeilen
  p = await L.open({ themen: baum() }, HASH, 1280);
  await L.go(p, 'themen');
  await L.click(p, '[data-a=thTab][data-v=stand]');
  let sum = await L.text(p, '[aria-label="Stand Zivilrecht"]');
  L.hasNot('ohne Neubeginn kein Hinweis auf Durchgänge', sum, 'Durchgang');
  L.has('ohne Neubeginn: Zählung über Unterthemen', sum, '3 von 4 durchgearbeitet');
  await L.click(p, '[data-a=thTab][data-v=baum]').catch(() => {});
  await L.click(p, '[data-a=thSel][data-id=sat]');
  await L.click(p, '[data-a=thNeuDurch][data-id=sat]');
  await L.click(p, '[data-a=thTab][data-v=stand]');
  sum = await L.text(p, '[aria-label="Stand Zivilrecht"]');
  L.has('Zusammenfassung zeigt Durchgang 1–2', sum, 'Durchgang 1–2 ·');
  L.has('nur Kaufrecht zählt als durchgearbeitet', sum, 'von 4 durchgearbeitet');
  L.has('genau eines von vier', sum, '1 von 4');
  L.has('Unmöglichkeit: 2. Durchgang offen', await L.text(p, '[data-k=st-u]'), '2. Durchgang offen');
  // Schuldrecht AT jetzt durcharbeiten
  await L.click(p, '[data-a=thTab][data-v=baum]').catch(() => {});
  await L.click(p, '[data-a=thSel][data-id=sat]');
  await L.click(p, '[data-a=thDurch][data-id=sat]');
  await L.click(p, '[data-a=thTab][data-v=stand]');
  L.has('Schuldrecht AT: durchgearbeitet im 2. Durchgang', await L.text(p, '[data-k=st-sat]'), 'durchgearbeitet 4.11. (2. Durchgang)');
  L.has('Zusammenfassung zählt Schuldrecht AT mit', await L.text(p, '[aria-label="Stand Zivilrecht"]'), '2 von 4 durchgearbeitet');
  const nachSat = await L.store(p);

  // 5) Zeitstrahl: Durchgearbeitet mit Durchgang
  await L.go(p, 'kalender');
  await L.click(p, '[data-a=kTab][data-v=zeit]');
  await L.click(p, '[data-k=zs-zr] [data-a=zsSel] >> nth=-1');
  const detail = await L.text(p, '[aria-label="Woche im Detail"]');
  L.has('Zeitstrahl: Abschnitt Durchgearbeitet', detail, 'Durchgearbeitet');
  L.has('Zeitstrahl: Schuldrecht AT im 2. Durchgang', detail, 'Schuldrecht AT (2. Durchgang)');
  L.ok('Stand nach dem Durcharbeiten gespeichert', nachSat.themen.sat.durchAm === '2026-11-04');
  await p.context().close();

  // 6) Bestehende Daten ohne frueher: Durchgang 1, kein Hinweis
  p = await oeffne('sat');
  const alt = await L.text(p);
  L.hasNot('altes Thema: kein „im … Durchgang“', await L.text(p, '[data-a=thDurch][data-id=sat]'), 'Durchgang');
  L.ok('altes Thema: keine Liste früherer Durchgänge', (await p.locator('[data-k=th-frueher]').count()) === 0);
  L.has('altes Thema: Schalter zeigt das Datum', await L.text(p, '[data-a=thDurch][data-id=sat]'), 'am 20. Oktober 2026');
  await L.click(p, '[data-a=thTab][data-v=stand]');
  L.hasNot('alter Stand: kein Hinweis auf Durchgänge', await L.text(p, '[aria-label="Stand Zivilrecht"]'), 'Durchgang');
  L.has('alter Stand: Zeile wie bisher', await L.text(p, '[data-k=st-u]'), 'durchgearbeitet 21.10.');
  L.ok('alte Daten: Ansicht heil', !/konnte nicht angezeigt/.test(alt));
  await p.context().close();
});
