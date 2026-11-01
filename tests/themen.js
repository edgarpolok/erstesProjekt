// Themen: Baum anlegen, Eingang zuordnen, verschieben, Zustände, zusammenlegen, löschen (mit Nachfrage), Beispiele,
// Suche, Themenauswahl beim Hinzufügen, Notizen und Stand
const L = require('./lib');
const idOf = (s, name) => Object.keys(s.themen).find((k) => s.themen[k].name === name);
const baum = (s) => Object.keys(s.themen).sort().map((k) => k + '<' + s.themen[k].eltern);

L.run(async () => {
  // 1) Baum anlegen und Eingang zuordnen
  const unit = { u: { titel: 'Schuldrecht AT – Unmöglichkeit', woche: '2026-10-26', tag: '2026-10-28', status: 'erledigt', erledigtAm: '2026-10-28', wiederholen: true, sr: { stufe: 1, faellig: '2026-10-29', letzte: null, bewertung: null } } };
  let p = await L.open({ bloecke: unit }, 'sim-2026-10-29-1800');
  await L.go(p, 'themen');
  await L.click(p, '[data-a=thNew]'); await L.fill(p, '#th-new', 'Zivilrecht'); await p.press('#th-new', 'Enter'); await p.waitForTimeout(150);
  await L.click(p, '[data-a=thSel]');
  await L.fill(p, '#th-sub', 'Schuldrecht AT'); await L.click(p, '[data-a=thSubAdd]');
  await L.click(p, '[data-a=thBack]');
  await L.click(p, '[data-a=thNew]'); await L.fill(p, '#th-new', 'Sachenrecht'); await L.click(p, '[data-a=thNewSave]');
  let s = await L.store(p);
  const ziv = idOf(s, 'Zivilrecht'); const sid = idOf(s, 'Schuldrecht AT'); const sach = idOf(s, 'Sachenrecht');
  L.expect('Baum: Schuldrecht AT unter Zivilrecht, Sachenrecht oben', [s.themen[sid] && s.themen[sid].eltern, s.themen[sach] && s.themen[sach].eltern, s.themen[ziv] && s.themen[ziv].eltern], [ziv, null, null]);
  L.expect('Eingang: eine Einheit', await p.locator('[data-a=thAssign]').count(), 1);
  L.expect('vor Zuordnung: Einheit wird einzeln wiederholt', await p.evaluate(() => window.__ls.srItems().map((x) => x.ref)), ['e:u']);
  await p.locator('select[data-in^=zu_]').first().selectOption(sid); await p.waitForTimeout(100);
  await L.click(p, '[data-a=thAssign]');
  s = await L.store(p);
  L.expect('Eingang leer', await p.locator('[data-a=thAssign]').count(), 0);
  L.expect('Einheit hängt am Thema', s.bloecke.u.thema, sid);
  L.expect('Thema übernimmt den Wiederholungsstand der Einheit', s.themen[sid].sr, { stufe: 1, faellig: '2026-10-29', letzte: null, bewertung: null });
  L.expect('wiederholt wird jetzt das Thema', await p.evaluate(() => window.__ls.srItems().map((x) => x.ref + ' ' + x.titel)), ['t:' + sid + ' Schuldrecht AT']);

  // 2) Verschieben, Zustände, Wiederholen aus/an
  await L.click(p, '[data-a=thSel][data-id="' + sid + '"]');
  await p.selectOption('#th-move', sach); await p.waitForTimeout(100); await L.click(p, '[data-a=thMove]');
  L.expect('verschoben unter Sachenrecht', (await L.store(p)).themen[sid].eltern, sach);
  await L.click(p, '[data-a=thZ][data-v=pausiert]');
  L.expect('pausiert: nicht in der Wiederholung', await p.evaluate(() => window.__ls.srItems().length), 0);
  await L.click(p, '[data-a=thZ][data-v=abgeschlossen]');
  L.expect('abgeschlossen: Zustand', (await L.store(p)).themen[sid].zustand, 'abgeschlossen');
  await L.click(p, '[data-a=thZ][data-v=aktiv]');
  L.expect('reaktiviert: neu ab morgen', (await L.store(p)).themen[sid].sr, { stufe: 1, faellig: '2026-10-30', letzte: null, bewertung: null });
  await L.click(p, '[data-a=thW]');
  L.expect('Wiederholen aus', await p.evaluate(() => window.__ls.srItems().length), 0);
  await L.click(p, '[data-a=thW]');
  L.expect('Wiederholen wieder an', await p.evaluate(() => window.__ls.srItems().length), 1);

  // 3) Zusammenlegen in Zivilrecht und rückgängig
  await p.selectOption('#th-merge', ziv); await p.waitForTimeout(100); await L.click(p, '[data-a=thMerge]');
  s = await L.store(p);
  L.expect('nach Zusammenlegen: Themen', Object.values(s.themen).map((t) => t.name).sort(), ['Sachenrecht', 'Zivilrecht']);
  L.expect('Einheit hängt an Zivilrecht', s.bloecke.u.thema, ziv);
  await L.click(p, '.toast [data-a=undo]');
  s = await L.store(p);
  L.expect('rückgängig: Themen wieder da', Object.values(s.themen).map((t) => t.name).sort(), ['Sachenrecht', 'Schuldrecht AT', 'Zivilrecht']);
  L.expect('rückgängig: Einheit wieder an Schuldrecht AT', s.bloecke.u.thema, sid);

  // 4) Suche; neue Sitzung startet mit Heute (Neuladen prüft app-offline.js über http, unter file:// hält Chromium den Speicher nicht zuverlässig)
  await L.click(p, '[data-a=thBack]').catch(() => {});
  await L.fill(p, '#th-q', 'unmögl'); await p.waitForTimeout(200);
  L.has('Suche findet die Einheit (ohne Umlaut-Probleme)', await L.text(p), 'Schuldrecht AT – Unmöglichkeit');
  await L.fill(p, '#th-q', 'gibtsnicht'); await p.waitForTimeout(200);
  L.hasNot('Suche ohne Treffer zeigt die Einheit nicht', await L.text(p), 'Schuldrecht AT – Unmöglichkeit');
  await L.fill(p, '#th-q', '');
  const q2 = await p.context().newPage(); await q2.addInitScript({ path: __dirname + '/mock-app.js' }); await q2.goto('file://' + L.APP); await q2.waitForTimeout(300);
  L.expect('neue Sitzung startet mit Heute', await q2.evaluate(() => window.__ls.S.view), 'heute');
  await p.context().close();

  // 5) Löschen mit Nachfrage, Beispiele entfernen, jeweils rückgängig
  const th = { zr: { name: 'Zivilrecht', eltern: null, beispiel: true, zustand: 'aktiv' }, sat: { name: 'Schuldrecht AT', eltern: 'zr', beispiel: true, zustand: 'aktiv' }, sb: { name: 'Schadensberechnung', eltern: 'sat', beispiel: true, zustand: 'aktiv', sr: { stufe: 1, faellig: '2026-10-30' } },
    mine: { name: 'Mein Thema', eltern: 'sat', zustand: 'aktiv' }, sr: { name: 'Strafrecht', eltern: null, beispiel: true, zustand: 'aktiv' } };
  const bl = { b1: { titel: 'Beispiel-Einheit', thema: 'sb', status: 'erledigt', erledigtAm: '2026-10-20', beispiel: true, woche: '2026-10-19' }, b2: { titel: 'Meine Einheit', thema: 'sb', status: 'erledigt', erledigtAm: '2026-10-21', woche: '2026-10-19' } };
  p = await L.open({ themen: th, bloecke: bl }, 'sim-2026-10-29-1000', 1280);
  const alle = baum({ themen: th });
  await L.go(p, 'themen');
  await L.click(p, '[data-a=thSel][data-id=zr]'); await L.click(p, '[data-a=thDelAsk]');
  L.ok('Löschen fragt nach', (await p.locator('[data-a=thDel]').count()) === 1);
  L.expect('vor der Bestätigung ist nichts gelöscht', baum(await L.store(p)), alle);
  await L.click(p, '[data-a=thConfirmNo]');
  L.expect('Abbrechen löscht nichts', baum(await L.store(p)), alle);
  await L.click(p, '[data-a=thDelAsk]'); await L.click(p, '[data-a=thDel]');
  s = await L.store(p);
  L.expect('Zivilrecht samt Unterthemen gelöscht', baum(s), ['sr<null']);
  L.expect('eigene Einheit zurück im Eingang, Beispiel-Einheit weg', Object.values(s.bloecke).map((x) => [x.titel, x.thema]), [['Meine Einheit', null]]);
  L.expect('Wiederholung der Einheit läuft weiter wie beim gelöschten Thema', s.bloecke.b2.sr, { stufe: 1, faellig: '2026-10-30' });
  await L.click(p, '.toast [data-a=undo]');
  L.expect('Löschen rückgängig', baum(await L.store(p)), alle);
  await L.click(p, '[data-a=thBspAsk]'); await L.click(p, '[data-a=thDelBsp]');
  s = await L.store(p);
  L.expect('Beispiele weg, eigenes Thema rückt nach oben', baum(s), ['mine<null']);
  L.expect('eigene Einheit im Eingang mit eigener Wiederholung', Object.values(s.bloecke).map((x) => [x.titel, x.thema, !!x.sr]), [['Meine Einheit', null, true]]);
  await L.click(p, '.toast [data-a=undo]');
  L.expect('Beispiele entfernen rückgängig', baum(await L.store(p)), alle);
  await p.context().close();

  // 6) Themenauswahl beim Hinzufügen und im Block-Menü
  const themen = {}; let n = 0;
  const add = (name, eltern) => { const id = 'th' + (++n); themen[id] = { name, eltern: eltern || null, zustand: 'aktiv', reihenfolge: n }; return id; };
  const zr = add('Zivilrecht'); const sa = add('Schuldrecht AT', zr); add('Unmöglichkeit', sa); add('Schadensberechnung', sa);
  const sr = add('Sachenrecht', zr); add('Eigentümer-Besitzer-Verhältnis', sr); add('Grundschuld', sr);
  const oe = add('Öffentliches Recht'); add('Grundrechte', oe); add('Verwaltungsakt', oe);
  for (let i = 0; i < 40; i++) add('Füllthema ' + i, oe);
  p = await L.open({ themen }, 'sim-2026-10-29-1000');
  await L.click(p, '[data-a=startAdd]'); await L.fill(p, '#neu-eintrag', 'Schema Unmöglichkeit'); await L.click(p, '[data-a=addMore]');
  L.expect('alle 50 Themen + leere Wahl', await p.locator('#neu-wdh option').count(), 51);
  await p.type('#neu-wdh-q', 'schuld unmog'); await p.waitForTimeout(200);
  L.expect('Suche mit zwei Wörtern, ohne Umlaut', await p.locator('#neu-wdh option').allTextContents(), ['1 Treffer', 'Zivilrecht › Schuldrecht AT › Unmöglichkeit']);
  L.expect('einziger Treffer ist gewählt', await p.inputValue('#neu-wdh'), 'th3');
  await L.fill(p, '#neu-wdh-q', 'grund'); await p.waitForTimeout(200);
  L.expect('„grund“: zwei Treffer', await p.locator('#neu-wdh option').allTextContents(), ['2 Treffer', 'Zivilrecht › Sachenrecht › Grundschuld', 'Öffentliches Recht › Grundrechte']);
  await p.press('#neu-wdh-q', 'Enter'); await p.waitForTimeout(200);
  L.expect('Enter übernimmt den ersten Treffer und leert die Suche', [await p.locator('#neu-wdh option').count(), await p.inputValue('#neu-wdh')], [51, 'th7']);
  await p.selectOption('#neu-wdh', 'th3'); await p.waitForTimeout(100);
  await L.click(p, '[data-a=doAdd]');
  L.expect('Block ist Wiederholung von Unmöglichkeit', Object.values((await L.store(p)).bloecke).map((x) => [x.titel, x.wdhVon, x.wiederholen]), [['Schema Unmöglichkeit', 'th3', false]]);
  await L.click(p, '[data-a=menu]'); await L.click(p, '[data-a=wvonB]');
  await L.fill(p, '[id$="-q"]', 'verwalt'); await p.waitForTimeout(200);
  await L.click(p, '[data-a=saveWvon]');
  L.expect('im Menü umgestellt auf Verwaltungsakt', Object.values((await L.store(p)).bloecke).map((x) => x.wdhVon), ['th10']);
  await p.context().close();

  // 7) Notizen am Thema, beim Bewerten ergänzen; „durchgearbeitet“ und Stand
  const seed = { themen: { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' }, sat: { name: 'Schuldrecht AT', eltern: 'zr', zustand: 'aktiv', sr: { stufe: 3, faellig: '2026-11-04', letzte: '2026-10-28', bewertung: 'sicher' }, notiz: '§ 254 sitzt' }, sb: { name: 'Schadensberechnung', eltern: 'sat', zustand: 'aktiv' }, kr: { name: 'Kaufrecht', eltern: 'zr', zustand: 'aktiv' } },
    bloecke: { u1: { titel: 'Mitverschulden', thema: 'sat', status: 'erledigt', erledigtAm: '2026-10-20', woche: '2026-10-19', wiederholen: true } },
    tage: { '2026-10-28': { wdh: { liste: [{ ref: 't:sat', min: 15 }], min: 15, bew: { 't:sat': { r: 'sicher' } } } } } };
  p = await L.open(seed, 'sim-2026-11-04-1000', 1280);
  L.has('Notiz steht in der Wiederholung', await L.text(p, '.wrow'), '§ 254 sitzt');
  await L.click(p, '[data-a=rateW][data-r=teilweise]');
  await L.fill(p, '[data-in="wn_t_sat"]', 'Gehilfen nochmal'); await L.click(p, '[data-a=wNote]');
  L.expect('Notiz ergänzt mit Datum', (await L.store(p)).themen.sat.notiz, '§ 254 sitzt\n4.11.26: Gehilfen nochmal');
  await L.go(p, 'themen'); await L.click(p, '[data-a=thSel][data-id=sat]');
  await L.fill(p, '#th-notiz', 'Neu geschrieben'); await p.click('h1'); await p.waitForTimeout(250);
  L.expect('Notiz im Thema geändert', (await L.store(p)).themen.sat.notiz, 'Neu geschrieben');
  await L.click(p, '[data-a=thDurch]');
  L.expect('durchgearbeitet am heutigen Tag', (await L.store(p)).themen.sat.durchAm, '2026-11-04');
  const stand = await L.text(p);
  L.hasNot('keine Reiter Baum/Stand mehr', stand, 'BaumStand');
  L.ok('keine Reiter Baum/Stand mehr (Knöpfe)', (await p.locator('[data-a=thTab]').count()) === 0);
  L.has('Stand: Zivilrecht 1 von 3 durchgearbeitet', await L.text(p, '[aria-label="Stand Zivilrecht"]'), '1 von 3 durchgearbeitet');
  L.has('Stand: 2× wiederholt (28.10. und heute)', stand, '2× wiederholt');
  L.has('Stand: nächster Termin nach „teilweise“ (Stufe 3 = 7 Tage)', stand, 'wieder Mi 11.11.');
  await L.noHScroll(p, 'Stand');
  await p.context().close();
  p = await L.open(seed, 'sim-2026-11-04-1000', 390);
  await L.go(p, 'themen');
  L.expect('Notiz-Symbol am Thema', await p.locator('[aria-label="hat eine Notiz"]').count(), 1);
  await L.noHScroll(p, 'Stand schmal');

  // 8) Filter „nur Offenes“: blendet Durchgearbeitetes aus, Wege zu offenen Unterthemen bleiben
  p = await L.open({ themen: {
    zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' },
    sat: { name: 'Schuldrecht AT', eltern: 'zr', zustand: 'aktiv', durchAm: '2026-10-20' },
    u: { name: 'Unmöglichkeit', eltern: 'sat', zustand: 'aktiv', durchAm: '2026-10-21' },
    v: { name: 'Verzug', eltern: 'sat', zustand: 'aktiv' },
    kr: { name: 'Kaufrecht', eltern: 'zr', zustand: 'aktiv', durchAm: '2026-10-22' },
    st: { name: 'Strafrecht', eltern: null, zustand: 'aktiv' },
    at: { name: 'Strafrecht AT', eltern: 'st', zustand: 'aktiv', durchAm: '2026-10-23' } } }, 'sim-2026-11-04-1000', 1280);
  await L.go(p, 'themen');
  await L.click(p, '[data-a=thTog][data-id=sat]');
  L.expect('ohne Filter alle Zeilen', await p.locator('[data-k^=tr-]').count(), 7);
  await L.click(p, '[data-a=thNurOffen]');
  const zeilen = await p.$$eval('[data-k^=tr-]', (els) => els.map((e) => e.getAttribute('data-k')));
  L.expect('nur Offenes: Weg zu Verzug bleibt, Durchgearbeitetes und Strafrecht weg', zeilen, ['tr-zr', 'tr-sat', 'tr-v']);
  L.has('Zusammenfassung zählt weiter alles', await L.text(p, '[aria-label="Stand Zivilrecht"]'), '3 von 4 durchgearbeitet');
  L.expect('Filter ändert keine Daten', Object.keys((await L.store(p)).themen).length, 7);
  await L.click(p, '[data-a=thSel][data-id=v]'); await L.click(p, '[data-a=thDurch][data-id=v]');
  L.has('alles durchgearbeitet: Hinweis', await L.text(p, '[aria-label=Themenbaum]'), 'Alles ist durchgearbeitet.');
  await L.click(p, '[data-a=thNurOffen]');
  L.expect('Filter aus: wieder alle Zeilen', await p.locator('[data-k^=tr-]').count(), 7);
  await p.context().close();
});
