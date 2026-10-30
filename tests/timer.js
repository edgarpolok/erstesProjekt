// Timer: übersteht Neuladen, zählt über Mitternacht für den Starttag, alte Zeit bleibt beim alten Tag (zeitFrueher)
const L = require('./lib');

L.run(async () => {
  // 1) Block-Timer starten, 25 Minuten später neu laden (andere Breite), stoppen
  let p = await L.open({ bloecke: { b1: { titel: 'Fälle Rom I', woche: '2026-10-26', tag: '2026-10-29', status: 'offen', quelle: 'frei', erstellt: 1 } } }, 'sim-2026-10-29-1000');
  await L.click(p, '[data-a=startT][data-art=b][data-id=b1]');
  let s = await L.store(p);
  L.expect('Timer läuft für Block b1', [s.meta.timer.laeuft, s.meta.timer.art, s.meta.timer.id, s.meta.timer.datum], [true, 'b', 'b1', '2026-10-29']);
  await p.context().close();
  p = await L.open(s, 'sim-2026-10-29-1025', 1280);
  L.has('Timerleiste nach Neuladen sichtbar', await L.text(p, '.timerbar'), 'Fälle Rom I');
  await L.click(p, '[data-a=stopT]');
  s = await L.store(p);
  L.expect('nach Stopp: 25 min am Block, Timer aus', [s.bloecke.b1.zeit, s.meta.timer.laeuft], [25, false]);
  await p.context().close();

  // 2) Zweiten Timer starten stoppt den ersten
  p = await L.open({ bloecke: { a: { titel: 'A', woche: '2026-10-26', tag: '2026-10-29', status: 'offen', erstellt: 1 }, b: { titel: 'B', woche: '2026-10-26', tag: '2026-10-29', status: 'offen', erstellt: 2 } } }, 'sim-2026-10-29-1000');
  await L.click(p, '[data-a=startT][data-art=b][data-id=a]');
  await L.sim(p, '2026-10-29', 10 * 60 + 5);
  await L.click(p, '[data-a=startT][data-art=b][data-id=b]');
  s = await L.store(p);
  L.expect('zweiter Start: A bekommt 5 min, Timer läuft für B', [s.bloecke.a.zeit, s.meta.timer.id], [5, 'b']);
  // Abhaken stoppt den laufenden Timer
  await L.sim(p, '2026-10-29', 10 * 60 + 45);
  await L.click(p, '[data-a=tBlock][data-id=b]');
  s = await L.store(p);
  L.expect('abhaken während Timer: 40 min, erledigt, Timer aus', [s.bloecke.b.zeit, s.bloecke.b.status, s.meta.timer.laeuft], [40, 'erledigt', false]);
  await p.context().close();

  // 3) Über Mitternacht: Block-Timer 23:45 -> 0:10 zählt für den Starttag
  p = await L.open({ bloecke: { b1: { titel: 'Block A', woche: '2026-11-02', tag: '2026-11-04', status: 'offen', quelle: 'frei', erstellt: 1 } } }, 'sim-2026-11-04-2345');
  await L.click(p, '[data-a=startT][data-art=b]');
  await L.sim(p, '2026-11-05', 10);
  await L.click(p, '[data-a=stopT]');
  s = await L.store(p);
  L.expect('über Mitternacht: 25 min, Block bleibt am Mittwoch', [s.bloecke.b1.zeit, s.bloecke.b1.tag], [25, '2026-11-04']);
  L.expect('erfasst Mi / Do', await p.evaluate(() => [window.__ls.erfasstAt('2026-11-04'), window.__ls.erfasstAt('2026-11-05')]), [0, 0]);
  // Block in den neuen Tag holen, 10 min weiterlernen, abhaken: alte 25 min bleiben beim Mittwoch
  await L.sim(p, '2026-11-05', 20);
  await L.click(p, '[data-a=poolOpen]'); await L.click(p, '[data-a=pull]');
  await L.click(p, '[data-a=startT][data-art=b]'); await L.sim(p, '2026-11-05', 30); await L.click(p, '[data-a=stopT]'); await L.click(p, '[data-a=tBlock]');
  s = await L.store(p);
  L.expect('geholt und abgehakt: Tag, Zeit gesamt, zeitFrueher', [s.bloecke.b1.tag, s.bloecke.b1.zeit, s.bloecke.b1.zeitFrueher, s.bloecke.b1.status], ['2026-11-05', 35, { '2026-11-04': 25 }, 'erledigt']);
  L.expect('erfasst: Mi 25 min, Do 10 min', await p.evaluate(() => [window.__ls.erfasstAt('2026-11-04'), window.__ls.erfasstAt('2026-11-05')]), [25, 10]);
  L.has('Heute zeigt nur die 10 min von heute', await L.text(p, '.h2row .small'), 'heute erfasst: 0:10 h');

  // 4) Freier Timer über Mitternacht: neue Zeile am Starttag
  await L.sim(p, '2026-11-05', 23 * 60 + 45); await L.click(p, '[data-a=startT][data-art=f]'); await L.sim(p, '2026-11-06', 10); await L.click(p, '[data-a=stopT]');
  await L.sim(p, '2026-11-06', 20); await L.click(p, '[data-a=startT][data-art=f]'); await L.sim(p, '2026-11-06', 30); await L.click(p, '[data-a=stopT]');
  s = await L.store(p);
  const frei = Object.values(s.bloecke).filter((x) => x.titel === 'Freie Lernzeit').map((x) => [x.tag, x.zeit, x.status, x.sr || null]).sort();
  L.expect('freie Lernzeit: je eine erledigte Zeile am Starttag, ohne Wiederholung', frei, [['2026-11-05', 25, 'erledigt', null], ['2026-11-06', 10, 'erledigt', null]]);
});
