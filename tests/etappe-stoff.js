// Etappe mit Stoff (Kalender): Äste wählen, Fortschritt je nach Themenbaum, kein Countdown
const L = require('./lib');
const HASH = 'sim-2026-11-04-1000';
const T = {
  zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' },
  sp: { name: 'Schwerpunkt IPR', eltern: 'zr', zustand: 'aktiv' },
  a: { name: 'Rom I', eltern: 'sp', zustand: 'aktiv', durchAm: '2026-11-01' },
  b: { name: 'Rom II', eltern: 'sp', zustand: 'aktiv' },
  leer: { name: 'Völkerrecht', eltern: 'zr', zustand: 'aktiv' },
};
const E = (o) => ({ e1: Object.assign({ name: 'Schwerpunktphase', von: '2026-11-02', bis: '2027-02-28', ziel: '' }, o) });
const est = (p, id) => L.text(p, '[data-k=est-' + id + ']');
const balken = (p, id) => p.locator('[data-k=est-' + id + '] + span[role=img]').count();

// Kalender mit offener Etappenliste
async function kal(seed) {
  const p = await L.open(seed, HASH, 1280);
  await L.go(p, 'kalender');
  if (!(await p.locator('[data-k^=est-]').count())) await p.click('[data-a=kList]').catch(() => {});
  await p.waitForTimeout(150);
  return p;
}

L.run(async () => {
  // 1) Etappe mit Stoff anlegen und speichern
  let p = await L.open({ themen: T }, HASH, 1280);
  await L.go(p, 'kalender');
  await L.click(p, '[data-a=kNew][data-v=etappe]');
  await L.fill(p, '#k-name', 'Schwerpunktphase'); await L.fill(p, '#k-von', '2026-11-02'); await L.fill(p, '#k-bis', '2027-02-28');
  L.expect('ohne Ast: kein Schalter „vollständig“', await p.locator('[data-k=kKomplett]').count(), 0);
  await p.selectOption('#k-stoff', 'sp'); await L.click(p, '[data-a=kStoffAdd]');
  L.expect('Ast erscheint als Zeile', await p.locator('[data-k=kst-sp]').count(), 1);
  L.has('Zeile zeigt den Pfad', await L.text(p, '[data-k=kst-sp]'), 'Zivilrecht › Schwerpunkt IPR');
  L.has('Zeile hat „entfernen“', await L.text(p, '[data-k=kst-sp]'), 'entfernen');
  L.has('Schalter „vollständig angelegt“ erscheint', await L.text(p, '[data-k=kKomplett]'), 'Stoff vollständig angelegt');
  // zweiten Ast hinzufügen und wieder entfernen
  await p.selectOption('#k-stoff', 'leer'); await L.click(p, '[data-a=kStoffAdd]');
  L.expect('zweiter Ast da', await p.locator('[data-k=kst-leer]').count(), 1);
  await L.click(p, '[data-a=kStoffDel][data-id=leer]');
  L.expect('Ast entfernt', await p.locator('[data-k=kst-leer]').count(), 0);
  L.expect('der andere Ast bleibt', await p.locator('[data-k=kst-sp]').count(), 1);
  await L.click(p, '[data-a=kSave]');
  let s = await L.store(p);
  let id = Object.keys(s.etappen)[0];
  L.expect('Etappe gespeichert mit Stoff', [s.etappen[id].name, s.etappen[id].stoff], ['Schwerpunktphase', ['sp']]);
  L.ok('noch nicht als vollständig markiert', !s.etappen[id].stoffKomplett);
  // Bearbeiten: vollständig einschalten
  if (!(await p.locator('[data-a=kEdit]').count())) await p.click('[data-a=kList]');
  await L.click(p, '[data-a=kEdit][data-id=' + id + ']');
  L.expect('Bearbeiten zeigt den Ast', await p.locator('[data-k=kst-sp]').count(), 1);
  await L.click(p, '[data-a=tGanz][data-k=kKomplett]');
  await L.click(p, '[data-a=kSave]');
  s = await L.store(p);
  L.expect('vollständig gespeichert', s.etappen[id].stoffKomplett, true);
  L.has('Anzeige „1 von 2 Themen“', await est(p, id), 'Schwerpunkt IPR · 1 von 2 Themen durchgearbeitet');
  await p.context().close();

  // 2) Ast ohne Unterthemen, nicht vollständig
  p = await kal({ themen: T, etappen: E({ stoff: ['leer'] }) });
  L.has('Ast ohne Unterthemen', await est(p, 'e1'), 'Völkerrecht · noch keine Themen angelegt');
  L.expect('ohne Themen kein Balken', await balken(p, 'e1'), 0);
  await p.context().close();

  // 3) Ast mit Unterthemen: bisher angelegt, kein Balken
  p = await kal({ themen: T, etappen: E({ stoff: ['sp'] }) });
  L.has('bisher angelegte Themen', await est(p, 'e1'), 'Schwerpunkt IPR · 1 von 2 bisher angelegten Themen durchgearbeitet');
  L.expect('nicht vollständig: kein Fortschrittsbalken', await balken(p, 'e1'), 0);
  // Später angelegtes Unterthema zählt mit
  await L.go(p, 'themen');
  await L.click(p, '[data-a=thSel][data-id=sp]');
  await L.fill(p, '#th-sub', 'Rom III'); await L.click(p, '[data-a=thSubAdd]');
  await L.go(p, 'kalender');
  if (!(await p.locator('[data-k=est-e1]').count())) await p.click('[data-a=kList]');
  await p.waitForTimeout(150);
  L.has('neues Unterthema zählt automatisch mit', await est(p, 'e1'), '1 von 3 bisher angelegten Themen');
  await p.context().close();

  // 4) Vollständig angelegt: Balken
  p = await kal({ themen: Object.assign({}, T, { c: { name: 'Rom III', eltern: 'sp', zustand: 'aktiv' } }), etappen: E({ stoff: ['sp'], stoffKomplett: true }) });
  L.has('vollständig: Text', await est(p, 'e1'), '1 von 3 Themen durchgearbeitet');
  L.hasNot('vollständig: nicht „bisher“', await est(p, 'e1'), 'bisher');
  L.expect('vollständig: Balken vorhanden', await balken(p, 'e1'), 1);
  L.expect('Balken beschriftet', await p.getAttribute('[data-k=est-e1] + span[role=img]', 'aria-label'), '1 von 3 durchgearbeitet');
  await p.context().close();

  // 5) Abgeschlossene Themen zählen nicht mit
  const t5 = Object.assign({}, T, { c: { name: 'Rom III', eltern: 'sp', zustand: 'abgeschlossen', durchAm: '2026-11-02' } });
  p = await kal({ themen: t5, etappen: E({ stoff: ['sp'] }) });
  L.has('abgeschlossenes Thema zählt nicht', await est(p, 'e1'), '1 von 2 bisher angelegten Themen');
  await p.context().close();

  // 6) Mehrere Äste: zusammengezählt, ohne Doppelte
  p = await kal({ themen: T, etappen: E({ stoff: ['sp', 'zr'] }) });
  // zr enthält sp, a, b, leer (Teilbaum) – a, b nur einmal; leer ist ein Thema ohne Kinder
  L.has('mehrere Äste ohne Doppelte', await est(p, 'e1'), '1 von 4 bisher angelegten Themen');
  L.has('mehrere Äste: beide Namen', await est(p, 'e1'), 'Schwerpunkt IPR, Zivilrecht');
  await p.context().close();

  p = await kal({ themen: Object.assign({}, T, { x: { name: 'Steuerrecht', eltern: null, zustand: 'aktiv' }, y: { name: 'AO', eltern: 'x', zustand: 'aktiv', durchAm: '2026-11-03' } }), etappen: E({ stoff: ['sp', 'x'] }) });
  L.has('zwei getrennte Äste zusammengezählt', await est(p, 'e1'), '2 von 3 bisher angelegten Themen');
  await p.context().close();

  // 7) Laufender Durchgang
  const t7 = Object.assign({}, T, { a: { name: 'Rom I', eltern: 'sp', zustand: 'aktiv', frueher: ['2026-10-01'], durchAm: null } });
  p = await kal({ themen: t7, etappen: E({ stoff: ['sp'] }) });
  L.has('laufender Durchgang: nennt „Durchgang“', await est(p, 'e1'), 'Durchgang');
  L.has('laufender Durchgang: Rom I zählt nicht', await est(p, 'e1'), '0 von 2 bisher angelegten Themen');
  await p.context().close();

  // 8) Kein Countdown, Woche zeigt „bis <Datum>“
  p = await kal({ themen: T, etappen: E({ stoff: ['sp'], stoffKomplett: true, ziel: 'Klausur im Februar' }) });
  const kt = await L.text(p);
  L.ok('Kalender: kein „noch X Wochen“', !/noch \d+ Wochen?/i.test(kt));
  L.ok('Kalender: kein „Tage bis“', !/Tage bis/i.test(kt));
  await L.go(p, 'woche');
  const wt = await L.text(p);
  L.has('Woche zeigt die Etappe', wt, 'Schwerpunktphase');
  L.ok('Woche: „bis <Datum>“', /bis \d{1,2}\.\s?(\d{1,2}\.|[A-Za-zä]+)/.test(wt), wt.slice(0, 300));
  L.ok('Woche: kein „noch X Wochen“', !/noch \d+ Wochen?/i.test(wt));
  L.ok('Woche: kein „Tage bis“', !/Tage bis/i.test(wt));
  await p.context().close();
});
