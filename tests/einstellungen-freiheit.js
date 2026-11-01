// Mehr Freiheit in den Einstellungen: Wiederholung als freie Zahl, kein Puffer, eigene Stunden je Wochentag,
// Schalter „nach Pause leichter“ und „kurz aufgreifen“, Vorhaben mit eigenen Stunden
const L = require('./lib');

L.run(async () => {
  let p = await L.open({}, 'sim-2026-10-29-1800', 1280);
  const cfg = () => p.evaluate(() => window.__ls.cfg());
  await L.go(p, 'einstellungen');

  // Wiederholung pro Tag: freie Zahl
  await L.click(p, '[data-a=esOpen][data-v=wdhtag]');
  await L.fill(p, '#es-wdh', '50'); await L.click(p, '[data-a=esWdh]');
  L.expect('Wiederholung 50 min', (await cfg()).wdhProTag, 50);
  await L.click(p, '[data-a=esOpen][data-v=wdhtag]');
  await L.fill(p, '#es-wdh', '700'); await L.click(p, '[data-a=esWdh]');
  L.expect('700 abgelehnt', (await cfg()).wdhProTag, 50);
  L.has('Hinweis bei 700', await L.toast(p), 'von 0 bis 600');

  // Kein Puffer
  await L.click(p, '[data-a=esOpen][data-v=puf]');
  await L.click(p, '[data-a=esSet][data-k=pufferTag][data-n="-1"]');
  L.expect('kein Puffer gespeichert', (await cfg()).pufferTag, -1);
  L.has('Anzeige „kein Puffer“', await L.text(p, '[data-k=s-puf]'), 'kein Puffer');
  const cap = await p.evaluate(() => window.__ls.capacity('2026-11-02', {}, '2026-11-02', true));
  L.ok('ohne Puffer hat der Samstag Platz', cap['2026-11-07'] > 0, cap);
  L.expect('kein Pufferdatum', await p.evaluate(() => window.__ls.pufferDate('2026-11-02')), null);

  // Eigene Stunden je Wochentag (Freitag = 4)
  await L.click(p, '[data-a=esOpen][data-v=umf]');
  await L.fill(p, '[data-ch=esUmfH][data-i="4"]', '3,5'); await p.press('[data-ch=esUmfH][data-i="4"]', 'Enter'); await p.waitForTimeout(100);
  L.expect('Freitag 3,5 h', (await cfg()).tagesumfang[4], 3.5);
  const cap2 = await p.evaluate(() => window.__ls.capacity('2026-11-02', {}, '2026-11-02', true));
  L.ok('Freitag weniger Platz als Donnerstag', cap2['2026-11-06'] < cap2['2026-11-05'], cap2);
  L.expect('Richtwert Wiederholung anteilig (50 × 3,5/6 ≈ 30)', await p.evaluate(() => window.__ls.wdhRichtwert('2026-11-06')), 30);
  L.has('Zusammenfassung zeigt Stunden', await L.text(p, '[data-k=s-umf]'), 'Fr 3,5 h');
  await L.click(p, '[data-a=esUmf][data-i="4"][data-v=voll]');
  L.expect('wieder voll', (await cfg()).tagesumfang[4], 'voll');

  // Schalter
  L.expect('Schalter standardmäßig an', [(await cfg()).leichterNachPause, (await cfg()).aufgreifen], [true, true]);
  await L.click(p, '[data-a=esToggle][data-k=aufgreifen]');
  await L.click(p, '[data-a=esToggle][data-k=leichterNachPause]');
  L.expect('Schalter aus', [(await cfg()).leichterNachPause, (await cfg()).aufgreifen], [false, false]);
  const res = await p.evaluate(() => window.__ls.allocRegel([{ id: 'v1', titel: 'Großes', hours: 8, modus: 'stueck' }], { '2026-11-02': 6, '2026-11-03': 6, '2026-11-04': 6 }));
  L.ok('ohne „aufgreifen“ kein Kurz-Aufgreifen', !Object.values(res.days).some((l) => l.some((x) => x.aufgreifen)), res.days);
  await p.context().close();

  // Nach Pause leichter: Pause in der Vorwoche
  const pausen = { p1: { von: '2026-10-26', bis: '2026-10-30', art: 'frei', name: 'Urlaub' } };
  for (const an of [true, false]) {
    p = await L.open({ pausen: pausen, meta: { config: { leichterNachPause: an } } }, 'sim-2026-10-29-1800', 1280);
    const c = await p.evaluate(() => window.__ls.capacity('2026-11-02', {}, '2026-11-02', true)['2026-11-02']);
    L.expect('Montag nach Pause, Schalter ' + (an ? 'an' : 'aus'), c, an ? 4.5 : 6);
    await p.context().close();
  }

  // Vorhaben mit eigenen Stunden
  p = await L.open({ vorhaben: { v1: { name: 'Schuldrecht AT', std: null, ab: '2026-10-26', wochen: 1, reihenfolge: 1, erstellt: 1 } } }, 'sim-2026-10-29-1800', 1280);
  await L.go(p, 'woche'); await L.click(p, '[data-a=planShow]');
  const feld = '[data-ch=vStdFrei][data-id=v1]';
  L.ok('Feld für eigene Stunden da', (await p.locator(feld).count()) === 1, await p.locator(feld).count());
  await L.fill(p, feld, '4,5'); await p.press(feld, 'Enter'); await p.waitForTimeout(100);
  L.expect('Vorhaben 4,5 h', (await L.store(p)).vorhaben.v1.std, 4.5);
  L.expect('Feld zeigt 4,5', await p.inputValue(feld), '4,5');
  await L.click(p, '[data-a=vStd][data-id=v1][data-h="2"]');
  L.expect('Knopf 2 h ersetzt eigene Stunden', (await L.store(p)).vorhaben.v1.std, 2);
  L.expect('Feld leer bei Knopfwert', await p.inputValue(feld), '');
  await p.context().close();
});
