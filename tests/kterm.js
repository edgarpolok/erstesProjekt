const { chromium } = require('playwright');
const file = process.argv[2]; const mock = __dirname + '/mock-app.js';
(async () => {
  const b = await chromium.launch(); const errs = [];
  // Übergebene Woche mit Blöcken, um das Ausweichen zu prüfen
  const seed = { wochen: { '2026-11-02': { status: 'uebergeben', wdhMin: 0, wdhVerteilung: {} } },
    bloecke: { b1: { titel: 'Vorhaben Do', woche: '2026-11-02', tag: '2026-11-05', status: 'offen', quelle: 'claude', std: 5, erstellt: 1 } } };
  for (const w of [1280, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    p.on('pageerror', (e) => errs.push(w + ' ' + e.message));
    await p.addInitScript('window.__seed = ' + JSON.stringify(seed)); await p.addInitScript({ path: mock });
    await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
    await p.goto('file://' + file + '#sim-2026-11-03-1000'); await p.waitForTimeout(400);
    const c = async (s) => { await p.click(s); await p.waitForTimeout(200); };
    const term = () => p.evaluate(() => Object.values(__store.termine).map((t) => [t.titel, t.datum || ('wö ' + (t.wochentage || []).join()), t.von, t.bis, !!t.ganztags, t.ab || '', t.endet || '']));
    await c(w >= 900 ? '.side [data-v=kalender]' : '.bottom [data-v=kalender]');
    console.log(w, 'Tag-Knöpfe ab heute', await p.locator('.kal button.cell').count(), '| vergangene klickbar', await p.locator('.kal button.cell[data-d="2026-11-02"]').count());
    // 1) Tag antippen: Do 5.11., Klausur 9–13 -> Block muss ausweichen, Termin bleibt
    await c('.kal button.cell[data-d="2026-11-05"]');
    console.log(w, 'Formular-Datum', await p.inputValue('#k-datum'));
    await p.fill('#k-name', 'Klausur Strafrecht'); await p.fill('#k-t-von', '09:00'); await p.fill('#k-t-bis', '13:00'); await c('[data-a=kSave]');
    console.log(w, 'Block b1 jetzt', JSON.stringify(await p.evaluate(() => __store.bloecke.b1.tag)));
    // 2) + Termin ganztägig
    await c('[data-a=kNew][data-v=termin]'); await p.fill('#k-name', 'Abgabe Seminararbeit'); await p.fill('#k-datum', '2026-11-20'); await c('[data-a=tGanz][data-k=kGanz]'); await c('[data-a=kSave]');
    // 3) jede Woche, bis
    await c('.kal button.cell[data-d="2026-11-04"]'); await p.fill('#k-name', 'AG Zivilrecht'); await p.fill('#k-t-von', '14:00'); await p.fill('#k-t-bis', '16:00'); await c('[data-a=tGanz][data-k=kWdh]'); await p.fill('#k-tend', '2026-12-16'); await c('[data-a=kSave]');
    // 4) Fehlerfälle: Vergangenheit, ohne Zeit
    await c('[data-a=kNew][data-v=termin]'); await p.fill('#k-name', 'Alt'); await p.fill('#k-datum', '2026-11-01'); await p.fill('#k-t-von', '10:00'); await c('[data-a=kSave]');
    console.log(w, 'Fehler Vergangenheit:', await p.textContent('.kalaside .err'));
    await p.fill('#k-datum', '2026-11-10'); await p.fill('#k-t-von', ''); await c('[data-a=kSave]');
    console.log(w, 'Fehler ohne Zeit:', await p.textContent('.kalaside .err'));
    await c('[data-a=kCancel]');
    console.log(w, 'Termine', JSON.stringify(await term()));
    // Wirkung: Heute am 20.11. zeigt ganztägig; Kalender zeigt AG am 11.11.; Rückgängig-Test
    const t = await p.evaluate(() => [__ls.termineAt('2026-11-11').map((x) => x.titel).join(), __ls.termineAt('2026-12-23').map((x) => x.titel).join(), __ls.termineAt('2026-11-20').map((x) => x.titel + ':' + x.min).join()]);
    console.log(w, '11.11.', t[0], '| 23.12. (nach Ende)', t[1] || '-', '| 20.11. Minuten', t[2]);
    if (w >= 900) await p.screenshot({ path: __dirname + '/out/kterm-' + w + '.png' });
    await p.evaluate(() => __ls.setSim('2026-11-20', 9 * 60)); await c(w >= 900 ? '.side [data-v=heute]' : '.bottom [data-v=heute]');
    console.log(w, 'Heute 20.11.', (await p.textContent('#main')).includes('ganztägig'), '| Woche-Termin-Form ganztägig');
    await c(w >= 900 ? '.side [data-v=woche]' : '.bottom [data-v=woche]'); await c('[data-a=tfOpen]'); await p.fill('#tf-titel', 'Sprechstunde'); await c('[data-a=tGanz][data-k=tfGanz]'); await c('[data-a=tfSave]');
    console.log(w, 'Woche ganztägig', JSON.stringify((await term()).filter((x) => x[0] === 'Sprechstunde')));
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    if (sw[0] > sw[1]) errs.push(w + ' HSCROLL ' + sw);
    await c(w >= 900 ? '.side [data-v=kalender]' : '.bottom [data-v=kalender]');
    const sw2 = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    if (sw2[0] > sw2[1]) errs.push(w + ' HSCROLL kal ' + sw2);
    if (w < 900) await p.screenshot({ path: __dirname + '/out/kterm-' + w + '.png', fullPage: true });
    await p.close();
  }
  console.log('ERR', errs); await b.close();
})();
