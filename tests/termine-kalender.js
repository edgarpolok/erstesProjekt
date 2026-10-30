// Kalender: Termine eintragen (einmalig, ganztägig, wöchentlich mit Ende), Fehlerfälle, Pausen und Etappen,
// Zeitstrahl und Statistik; Breite ohne waagerechte Scrollleiste
const L = require('./lib');

L.run(async () => {
  for (const w of [1280, 390]) {
    const tg = w + ' px: ';
    const p = await L.open({}, 'sim-2026-11-03-1000', w);
    await L.go(p, 'kalender');
    L.expect(tg + 'vergangene Tage nicht antippbar', await p.locator('.kal button.cell[data-d="2026-11-02"]').count(), 0);
    L.expect(tg + 'heute antippbar', await p.locator('.kal button.cell[data-d="2026-11-03"]').count(), 1);
    // Tag antippen öffnet das Formular mit diesem Datum
    await L.click(p, '.kal button.cell[data-d="2026-11-05"]');
    L.expect(tg + 'Formular übernimmt das Datum', await p.inputValue('#k-datum'), '2026-11-05');
    await L.fill(p, '#k-name', 'Klausur Strafrecht'); await L.fill(p, '#k-t-von', '09:00'); await L.fill(p, '#k-t-bis', '13:00'); await L.click(p, '[data-a=kSave]');
    // ganztägig
    await L.click(p, '[data-a=kNew][data-v=termin]'); await L.fill(p, '#k-name', 'Abgabe Seminararbeit'); await L.fill(p, '#k-datum', '2026-11-20'); await L.click(p, '[data-a=tGanz][data-k=kGanz]'); await L.click(p, '[data-a=kSave]');
    // jede Woche bis 16.12.
    await L.click(p, '.kal button.cell[data-d="2026-11-04"]'); await L.fill(p, '#k-name', 'AG Zivilrecht'); await L.fill(p, '#k-t-von', '14:00'); await L.fill(p, '#k-t-bis', '16:00'); await L.click(p, '[data-a=tGanz][data-k=kWdh]'); await L.fill(p, '#k-tend', '2026-12-16'); await L.click(p, '[data-a=kSave]');
    // Fehlerfälle
    await L.click(p, '[data-a=kNew][data-v=termin]'); await L.fill(p, '#k-name', 'Alt'); await L.fill(p, '#k-datum', '2026-11-01'); await L.fill(p, '#k-t-von', '10:00'); await L.click(p, '[data-a=kSave]');
    L.expect(tg + 'Termin in der Vergangenheit abgelehnt', await L.text(p, '.kalaside .err'), 'Neue Termine gehen ab heute.');
    await L.fill(p, '#k-datum', '2026-11-10'); await L.fill(p, '#k-t-von', ''); await L.click(p, '[data-a=kSave]');
    L.expect(tg + 'Termin ohne Uhrzeit abgelehnt', await L.text(p, '.kalaside .err'), 'Ein Termin braucht eine Uhrzeit (von) oder „ganztägig“.');
    await L.click(p, '[data-a=kCancel]');
    const term = Object.values((await L.store(p)).termine).map((t) => [t.titel, t.datum || ('wö ' + (t.wochentage || []).join()), t.von, t.bis, !!t.ganztags, t.ab || '', t.endet || '']).sort();
    L.expect(tg + 'gespeicherte Termine', term, [
      ['AG Zivilrecht', 'wö 2', '14:00', '16:00', false, '2026-11-04', '2026-12-16'],
      ['Abgabe Seminararbeit', '2026-11-20', '', '', true, '', ''],
      ['Klausur Strafrecht', '2026-11-05', '09:00', '13:00', false, '', '']]);
    const at = await p.evaluate(() => ['2026-10-28', '2026-11-04', '2026-11-11', '2026-12-16', '2026-12-23'].map((d) => window.__ls.termineAt(d).map((x) => x.titel).join()));
    L.expect(tg + 'wöchentlicher Termin: erst ab Start, bis einschließlich Ende', at, ['', 'AG Zivilrecht', 'AG Zivilrecht', 'AG Zivilrecht', '']);
    L.expect(tg + 'ganztägig zählt 0 min Lernzeit', await p.evaluate(() => window.__ls.termineAt('2026-11-20').map((x) => x.min)), [0]);
    await L.noHScroll(p, 'Kalender');
    // Heute am 20.11. zeigt den ganztägigen Termin; Termin aus der Woche eintragen
    await L.sim(p, '2026-11-20', 9 * 60); await L.go(p, 'heute');
    L.has(tg + 'Heute 20.11. zeigt „ganztägig“', await L.text(p), 'ganztägig');
    await L.go(p, 'woche'); await L.click(p, '[data-a=tfOpen]'); await L.fill(p, '#tf-titel', 'Sprechstunde'); await L.click(p, '[data-a=tGanz][data-k=tfGanz]'); await L.click(p, '[data-a=tfSave]');
    L.expect(tg + 'Termin aus der Woche: heute, ganztägig', Object.values((await L.store(p)).termine).filter((t) => t.titel === 'Sprechstunde').map((t) => [t.datum, !!t.ganztags]), [['2026-11-20', true]]);
    await L.noHScroll(p, 'Woche');
    await p.context().close();
  }

  // Pause und Etappe anlegen
  let p = await L.open({}, 'sim-2026-10-28-1000');
  await L.go(p, 'kalender');
  await L.click(p, '[data-a=kNew][data-v=pause]'); await L.fill(p, '#k-name', 'Urlaub'); await L.fill(p, '#k-von', '2026-11-09'); await L.fill(p, '#k-bis', '2026-11-15'); await L.click(p, '[data-a=kSave]');
  await L.click(p, '[data-a=kNew][data-v=etappe]'); await L.fill(p, '#k-name', 'Examensvorbereitung'); await L.fill(p, '#k-von', '2026-10-01'); await L.fill(p, '#k-bis', '2026-12-20'); await L.click(p, '[data-a=kSave]');
  let s = await L.store(p);
  L.expect('Pause gespeichert', Object.values(s.pausen).map((x) => [x.name, x.von, x.bis]), [['Urlaub', '2026-11-09', '2026-11-15']]);
  L.expect('Etappe gespeichert', Object.values(s.etappen).map((x) => [x.name, x.von, x.bis]), [['Examensvorbereitung', '2026-10-01', '2026-12-20']]);
  L.expect('Pause gilt genau 9.–15.11.', await p.evaluate(() => ['2026-11-08', '2026-11-09', '2026-11-15', '2026-11-16'].map((d) => !!window.__ls.pauseAt(d).frei || !!window.__ls.pauseAt(d).wdh || !!window.__ls.pauseAt(d).name)), [false, true, true, false]);
  await L.click(p, '[data-a=kTab][data-v=zahlen]');
  await p.context().close();

  // Zeitstrahl und Statistik: Reiter in dieser Reihenfolge, Zeitstrahl zeigt gelernte Wochen
  p = await L.open({ bloecke: { a: { titel: 'Rom I neu', woche: '2026-11-02', tag: '2026-11-02', status: 'erledigt', erledigtAm: '2026-11-02', zeit: 60, wiederholen: true, sr: { stufe: 1, faellig: '2026-11-03', letzte: null, bewertung: null } } } }, 'sim-2026-11-06-0900', 1280);
  await L.go(p, 'kalender');
  L.expect('Reiter im Kalender', await p.locator('[data-a=kTab]').allTextContents(), ['Kalender', 'Zeitstrahl', 'Statistik']);
  await L.click(p, '[data-a=kTab][data-v=zeit]');
  L.ok('Zeitstrahl hat einen Punkt', (await p.locator('[data-a=zsSel]').count()) >= 1);
  await L.click(p, '[data-a=zsSel]');
  L.has('Woche im Detail zeigt die Einheit', await L.text(p, '[aria-label="Woche im Detail"]'), 'Rom I neu');
  await L.click(p, '[data-a=zsPrev]'); await L.click(p, '[data-a=zsNow]');
  await L.click(p, '[data-a=kTab][data-v=zahlen]');
  L.has('Statistik zeigt den Wiederholungsstand', await L.text(p), 'Wiederholungsstand');
  await p.context().close();
  p = await L.open({}, 'sim-2026-11-06-0900', 390);
  await L.go(p, 'kalender'); await L.click(p, '[data-a=kTab][data-v=zeit]');
  await L.noHScroll(p, 'Zeitstrahl');
});
