// Timer-Randfälle: Silvester über Mitternacht, freier Timer über den Wochenwechsel, Wiederholungs-Timer,
// Löschen / Zurücklegen / Abhaken während der Timer läuft, vergessener Timer (höchstens 12 h)
const L = require('../lib');
const blockAm = (d, w) => ({ bloecke: { b1: { titel: 'Block A', woche: w || '2026-12-28', tag: d, status: 'offen', quelle: 'frei', erstellt: 1 }, b2: { titel: 'Block B', woche: w || '2026-12-28', tag: d, status: 'offen', quelle: 'frei', erstellt: 2 } } });

L.run(async () => {
  // Silvester 23:50 Block A, 23:55 Block B, neu laden am 1.1. 0:20, stoppen
  let p = await L.open(blockAm('2026-12-31'), 'sim-2026-12-31-2350');
  await L.click(p, '[data-a=startT][data-art=b][data-id=b1]');
  await L.sim(p, '2026-12-31', 23 * 60 + 55);
  await L.click(p, '[data-a=startT][data-art=b][data-id=b2]');
  let s = await L.store(p);
  L.expect('zweiter Start: A 5 min, Timer bei B', [s.bloecke.b1.zeit, s.meta.timer.id], [5, 'b2']);
  await p.context().close();
  p = await L.open(s, 'sim-2027-01-01-0020');
  L.has('Timerleiste am Neujahrsmorgen', await L.text(p, '.timerbar'), 'Block B');
  await L.click(p, '[data-a=stopT]');
  s = await L.store(p);
  L.expect('B: 25 min, bleibt am 31.12.', [s.bloecke.b2.zeit, s.bloecke.b2.tag], [25, '2026-12-31']);
  await p.context().close();

  // Freier Timer So 3.1. 23:50 bis Mo 4.1. 0:20: zählt für Sonntag in KW 53
  p = await L.open({}, 'sim-2027-01-03-2350');
  await L.click(p, '[data-a=startT][data-art=f]');
  s = await L.store(p); await p.context().close();
  p = await L.open(s, 'sim-2027-01-04-0020');
  await L.click(p, '[data-a=stopT]');
  L.expect('freie Lernzeit am Sonntag in KW 53', Object.values((await L.store(p)).bloecke).map((b) => [b.titel, b.tag, b.woche, b.zeit, b.status]), [['Freie Lernzeit', '2027-01-03', '2026-12-28', 30, 'erledigt']]);
  L.expect('Montag: noch nichts erfasst', await p.evaluate(() => window.__ls.erfasstAt('2027-01-04')), 0);
  await p.context().close();

  // Wiederholungs-Timer über Mitternacht: Zeit zählt für Silvester
  p = await L.open({ bloecke: { e1: { titel: 'Einheit', woche: '2026-12-21', tag: '2026-12-22', status: 'erledigt', erledigtAm: '2026-12-22', wiederholen: true, sr: { stufe: 1, faellig: '2026-12-23', letzte: null, bewertung: null } } } }, 'sim-2026-12-31-2350');
  await L.click(p, '[data-a=startT][data-art=w]');
  s = await L.store(p); await p.context().close();
  p = await L.open(s, 'sim-2027-01-01-0030');
  await L.click(p, '[data-a=stopT]');
  s = await L.store(p);
  L.expect('Wiederholung: 40 min am 31.12., nichts am 1.1.', [s.tage['2026-12-31'].wdh.zeiten['e:e1'], (s.tage['2027-01-01'] && s.tage['2027-01-01'].wdh || {}).zeiten || null], [40, null]);
  await p.context().close();

  // Löschen während der Timer läuft: Timer stoppt, Rückgängig bringt den Block mit der Zeit zurück
  p = await L.open(blockAm('2026-12-30'), 'sim-2026-12-30-1000');
  await L.click(p, '[data-a=startT][data-art=b][data-id=b1]');
  await L.sim(p, '2026-12-30', 11 * 60);
  await L.click(p, '[data-a=menu][data-m=bb1]'); await L.click(p, '[data-a=delB]');
  s = await L.store(p);
  L.expect('gelöscht: Timer aus, Block weg', [s.meta.timer.laeuft, !!s.bloecke.b1], [false, false]);
  await L.click(p, '.toast [data-a=undo]');
  s = await L.store(p);
  L.expect('rückgängig: Block mit 60 min zurück, Timer bleibt aus', [s.bloecke.b1 && s.bloecke.b1.zeit, s.meta.timer.laeuft], [60, false]);
  await p.context().close();

  // Zurücklegen aus der Woche während der Timer läuft
  p = await L.open(blockAm('2026-12-30'), 'sim-2026-12-30-1000', 1280);
  await L.click(p, '[data-a=startT][data-art=b][data-id=b1]');
  await L.go(p, 'woche'); await L.click(p, '[data-a=wMenu][data-id=b1]'); await L.click(p, '[data-a=wPool][data-id=b1]');
  s = await L.store(p);
  L.expect('zurückgelegt: Timer aus, Block ohne Tag', [s.meta.timer.laeuft, s.bloecke.b1.tag], [false, null]);
  await p.context().close();

  // Vergessener Timer: 3 Tage -> 12 h mit Hinweis
  p = await L.open(blockAm('2026-12-28'), 'sim-2026-12-28-1000');
  await L.click(p, '[data-a=startT][data-art=b][data-id=b1]');
  s = await L.store(p); await p.context().close();
  p = await L.open(s, 'sim-2026-12-31-1000');
  L.has('Timerleiste zeigt 72 h', await L.text(p, '.timerbar'), '71:59');
  await L.click(p, '[data-a=stopT]'); await p.waitForTimeout(100);
  L.expect('höchstens 12 h eingetragen', (await L.store(p)).bloecke.b1.zeit, 720);
  L.has('Hinweis auf die 12 h', await L.toast(p), 'Der Timer lief über 12 h');
});
