// Terminkalender: ein Formular für alle Stellen, Tagesblatt im Kalender, private Termine,
// wöchentliche Termine nur an einem Tag oder ab einem Tag ändern
const L = require('./lib');

const REP = { titel: 'Rep', wochentage: [2], von: '09:00', bis: '13:00', zustand: 'aktiv', ab: '2026-10-07' }; // jeden Mittwoch
const titel = (p, d) => p.evaluate((d) => window.__ls.termineAt(d).map((x) => x.von + ' ' + x.titel), d);
const frei = (p, d) => p.evaluate((d) => window.__ls.freeH(d), d);
const erfasst = (p, d) => p.evaluate((d) => window.__ls.erfasstAt(d), d);
const ids = (s) => Object.keys(s.termine);

L.run(async () => {
  // 1) Privater Termin: eigener Platz in Heute, nimmt keinen Platz weg, zählt keine Zeit
  let p = await L.open({}, 'sim-2026-11-10-1000', 1280);
  const platz = await frei(p, '2026-11-10');
  await L.go(p, 'kalender');
  await L.click(p, '.kal button.cell[data-d="2026-11-10"]');
  await L.click(p, '.tagblatt [data-a=kNew]');
  await L.fill(p, '#tm-titel', 'Abendessen'); await L.click(p, '[data-a=tmArt][data-v=privat]');
  await L.fill(p, '#tm-von', '19:00'); await L.fill(p, '#tm-bis', '21:00');
  await L.click(p, '[data-a=tmMehr]'); await L.fill(p, '#tm-ort', 'Bei Anna'); await L.fill(p, '#tm-notiz', 'Wein mitbringen');
  await L.click(p, '[data-a=tmSave]');
  let s = await L.store(p);
  let id = ids(s)[0];
  L.expect('privat gespeichert', s.termine[id].art, 'privat');
  L.expect('Ort gespeichert', s.termine[id].ort, 'Bei Anna');
  L.expect('privater Termin nimmt keinen Platz weg', await frei(p, '2026-11-10'), platz);
  let tb = await L.text(p, '.tagblatt');
  L.has('Tagesblatt zeigt den Termin', tb, 'Abendessen');
  L.has('Tagesblatt zeigt „privat“', tb.toLowerCase(), 'privat');
  L.has('Tagesblatt zeigt den Ort', tb, 'Bei Anna');
  L.has('Tagesblatt zeigt die Notiz', tb, 'Wein mitbringen');
  await L.go(p, 'heute');
  const zeile = await L.text(p, '.ausserdem');
  L.has('Heute: abgesetzte Zeile', zeile, 'Heute außerdem');
  L.has('Heute: Zeile nennt den Termin', zeile, 'Abendessen');
  L.expect('Heute: privater Termin hat keinen Kreis zum Abhaken', await p.locator('[data-a=tTermin]').count(), 0);
  L.expect('privat zählt keine Zeit', await erfasst(p, '2026-11-10'), 0);
  await L.go(p, 'woche');
  L.has('Woche zeigt den privaten Termin', await L.text(p, '.day.today'), 'Abendessen');
  // Aus Heute ändern: wird ein gewöhnlicher Termin, dann nimmt er Platz weg und lässt sich abhaken
  await L.go(p, 'heute');
  await L.click(p, '.ausserdem button');
  L.expect('Formular öffnet mit dem Titel', await p.inputValue('#tm-titel'), 'Abendessen');
  await L.click(p, '[data-a=tmArt][data-v=termin]'); await L.click(p, '[data-a=tmSave]');
  L.expect('gewöhnlicher Termin nimmt Platz weg', await frei(p, '2026-11-10'), platz - 2);
  L.expect('gewöhnlicher Termin hat einen Kreis', await p.locator('[data-a=tTermin]').count(), 1);
  L.expect('keine abgesetzte Zeile mehr', await p.locator('.ausserdem').count(), 0);
  await p.context().close();

  // 2) Wöchentlicher Termin: nur an einem Tag ändern
  const seed = { termine: { t1: REP }, tage: { '2026-11-04': { termine: { t1: { erledigt: true, min: 240 } } } } };
  p = await L.open(seed, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'kalender');
  await L.click(p, '.kal button.cell[data-d="2026-11-11"]');
  L.has('Tagesblatt nennt „jede Woche“', await L.text(p, '[data-k=tb-termine]'), 'jede Woche');
  await L.click(p, '.tagblatt [data-a=kEdit][data-id=t1]');
  L.expect('Vorgabe: nur an diesem Tag', await p.getAttribute('[data-a=tmNur][data-v=tag]', 'aria-pressed'), 'true');
  await L.fill(p, '#tm-von', '10:00'); await L.fill(p, '#tm-bis', '12:00'); await L.click(p, '[data-a=tmSave]');
  s = await L.store(p);
  L.expect('Reihe fällt an dem Tag aus', s.termine.t1.ausfall, [{ von: '2026-11-11', bis: '2026-11-11' }]);
  L.expect('an dem Tag gilt die neue Uhrzeit', await titel(p, '2026-11-11'), ['10:00 Rep']);
  L.expect('eine Woche später gilt die alte', await titel(p, '2026-11-18'), ['09:00 Rep']);
  L.has('Rückgängig wird angeboten', await L.toast(p), 'Rückgängig');
  await L.click(p, '.toast [data-a=undo]');
  s = await L.store(p);
  L.expect('Rückgängig: nur noch die Reihe', ids(s), ['t1']);
  L.expect('Rückgängig: alte Uhrzeit', await titel(p, '2026-11-11'), ['09:00 Rep']);

  // 3) Ab einem Tag immer: die Reihe wird geteilt, die Vergangenheit bleibt
  await L.click(p, '.tagblatt [data-a=kEdit][data-id=t1]');
  await L.click(p, '[data-a=tmNur][data-v=immer]');
  await L.click(p, '[data-a=tmWt][data-i="2"]'); await L.click(p, '[data-a=tmWt][data-i="3"]');
  await L.click(p, '[data-a=tmSave]');
  s = await L.store(p);
  L.expect('alte Reihe endet am Vortag', s.termine.t1.endet, '2026-11-10');
  const neu = ids(s).find((x) => x !== 't1');
  L.expect('neue Reihe am Donnerstag', s.termine[neu].wochentage, [3]);
  L.expect('neue Reihe beginnt am gewählten Tag', s.termine[neu].ab, '2026-11-11');
  L.expect('vergangener Mittwoch bleibt', await titel(p, '2026-11-04'), ['09:00 Rep']);
  L.expect('erfasste Zeit des vergangenen Mittwochs bleibt', await erfasst(p, '2026-11-04'), 240);
  L.expect('Mittwoch ist jetzt leer', await titel(p, '2026-11-11'), []);
  L.expect('Donnerstag hat den Termin', await titel(p, '2026-11-12'), ['09:00 Rep']);

  // 4) Entfernen nur an einem Tag
  await L.click(p, '.kal button.cell[data-d="2026-11-12"]');
  await L.click(p, '.tagblatt [data-a=kEdit][data-id=' + neu + ']');
  L.has('Knopf sagt, was passiert', await L.text(p, '[data-a=tmDel]'), 'Fällt an dem Tag aus');
  await L.click(p, '[data-a=tmDel]');
  L.expect('an dem Tag fällt er aus', await titel(p, '2026-11-12'), []);
  L.expect('danach findet er statt', await titel(p, '2026-11-19'), ['09:00 Rep']);
  await L.sim(p, '2026-11-11', 600); // einen Tag später ist die alte Reihe vorbei
  await L.go(p, 'einstellungen');
  L.has('Einstellungen: beendete Reihe eingeklappt', await L.text(p), 'Beendete zeigen (1)');

  // 5) Einstellungen: dasselbe Formular, mehrere Wochentage
  await L.click(p, '[data-a=esTNew]');
  await L.fill(p, '#tm-titel', 'Vorlesung'); await L.click(p, '[data-a=tmWt][data-i="0"]'); await L.click(p, '[data-a=tmWt][data-i="3"]');
  await L.fill(p, '#tm-von', '08:00'); await L.click(p, '[data-a=tmSave]');
  s = await L.store(p);
  const vl = ids(s).find((x) => s.termine[x].titel === 'Vorlesung');
  L.expect('zwei Wochentage gespeichert', s.termine[vl].wochentage, [0, 3]);
  await L.click(p, '[data-a=esTNew]'); await L.fill(p, '#tm-titel', 'Ohne Tag'); await L.fill(p, '#tm-von', '08:00'); await L.click(p, '[data-a=tmSave]');
  L.has('ohne Wochentag: Hinweis', await L.text(p, '[data-k=tmform]'), 'mindestens einen Wochentag');
  await p.context().close();

  // 7) Terminliste: kommende Termine nach Tagen, Suche, Auswahl nach Art, Ändern aus der Liste
  const viele = { termine: { t1: REP,
    t2: { titel: 'Abendessen', datum: '2026-11-12', von: '19:00', bis: '21:00', art: 'privat', ort: 'Bei Anna' },
    t3: { titel: 'Probeklausur', datum: '2026-11-20', von: '09:00', bis: '14:00', art: 'klausur' },
    t4: { titel: 'Sprechstunde', datum: '2027-03-02', von: '10:00', bis: '11:00' },
    t5: { titel: 'Alt', datum: '2026-11-03', von: '10:00', bis: '11:00' } } };
  p = await L.open(viele, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'kalender');
  await L.click(p, '[data-a=kAnsicht][data-v=liste]');
  let li = await L.text(p, '.terminliste');
  L.has('Liste: wöchentlicher Termin', li, 'Rep');
  L.has('Liste: privater Termin mit Ort', li, 'Bei Anna');
  L.has('Liste: Klausur', li, 'Probeklausur');
  L.hasNot('Liste: Vergangenes steht nicht drin', li, 'Alt');
  L.hasNot('Liste: Termin in vier Monaten noch nicht', li, 'Sprechstunde');
  L.expect('Liste: Rep steht je Woche einmal (acht Wochen)', await p.locator('.terminliste [data-k=tb-t1]').count(), 8);
  L.has('Liste: „morgen“', await L.text(p, '[data-k="tl-2026-11-11"]'), 'morgen');
  await L.click(p, '[data-a=kLArt][data-v=privat]');
  li = await L.text(p, '[data-k=tl-liste]');
  L.has('Art „Privat“: privater Termin', li, 'Abendessen');
  L.hasNot('Art „Privat“: sonst nichts', li, 'Rep');
  await L.click(p, '[data-a=kLArt][data-v=alle]');
  const suche = async (q) => { await L.fill(p, '#k-suche', q); await p.waitForTimeout(250); };
  await suche('sprech');
  L.has('Suche findet den Termin in vier Monaten', await L.text(p, '[data-k=tl-liste]'), 'Sprechstunde');
  await suche('anna');
  L.has('Suche findet über den Ort', await L.text(p, '[data-k=tl-liste]'), 'Abendessen');
  await suche('rep');
  L.expect('Suche: wöchentlicher Termin nur mit dem nächsten Mal', await p.locator('.terminliste [data-k=tb-t1]').count(), 1);
  await suche('gibtsnicht');
  L.has('Suche ohne Treffer', await L.text(p, '.terminliste'), 'Nichts gefunden');
  await suche('alt');
  L.has('Suche findet auch Vergangenes', await L.text(p, '[data-k="tl-alt-t5"]'), 'Alt');
  L.has('Vergangenes steht unter eigener Überschrift', await L.text(p, '[data-k=tl-vergangen]'), 'Vergangen');
  await suche('');
  await L.click(p, '.terminliste [data-a=kEdit][data-id=t3]');
  await L.fill(p, '#tm-titel', 'Probeklausur ZR'); await L.click(p, '[data-a=tmSave]');
  L.expect('Ändern aus der Liste gespeichert', (await L.store(p)).termine.t3.titel, 'Probeklausur ZR');
  await L.click(p, '[data-a=kTagZeig][data-d="2026-11-20"]');
  L.has('Tag aus der Liste öffnet das Tagesblatt im Monat', await L.text(p, '.tagblatt'), 'Probeklausur ZR');
  await p.context().close();
  p = await L.open(viele, 'sim-2026-11-10-1000', 390);
  await L.go(p, 'kalender');
  await L.click(p, '[data-a=kAnsicht][data-v=liste]');
  await L.noHScroll(p, 'Terminliste (390 px)');
  await p.context().close();

  // 8) Termin über mehrere Tage
  p = await L.open({}, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'kalender');
  await L.click(p, '#k-termine [data-a=kNew]:not([data-kl])');
  await L.fill(p, '#tm-titel', 'Seminar'); await L.fill(p, '#tm-datum', '2026-11-18'); await L.fill(p, '#tm-bisd', '2026-11-20');
  await L.fill(p, '#tm-von', '09:00'); await L.fill(p, '#tm-bis', '12:00'); await L.click(p, '[data-a=tmSave]');
  s = await L.store(p);
  L.expect('mehrtägig: letzter Tag gespeichert', s.termine[ids(s)[0]].bisDatum, '2026-11-20');
  L.expect('mehrtägig: erster Tag', await titel(p, '2026-11-18'), ['09:00 Seminar']);
  L.expect('mehrtägig: mittlerer Tag', await titel(p, '2026-11-19'), ['09:00 Seminar']);
  L.expect('mehrtägig: letzter Tag', await titel(p, '2026-11-20'), ['09:00 Seminar']);
  L.expect('mehrtägig: Tag danach frei', await titel(p, '2026-11-21'), []);
  const voll = await frei(p, '2026-11-17');
  L.expect('mehrtägig: nimmt an jedem Tag Platz weg', await frei(p, '2026-11-19'), voll - 3);
  await L.click(p, '[data-a=kAnsicht][data-v=liste]');
  L.expect('mehrtägig: steht in der Terminliste einmal', await p.locator('.terminliste .tb-row').count(), 1);
  L.has('mehrtägig: Liste nennt den Zeitraum', await L.text(p, '.terminliste .tb-row'), '18.11. bis 20.11.');
  await L.click(p, '.terminliste [data-a=kNew]:not([data-kl])');
  await L.fill(p, '#tm-titel', 'Verkehrt'); await L.fill(p, '#tm-datum', '2026-11-18'); await L.fill(p, '#tm-bisd', '2026-11-17'); await L.fill(p, '#tm-von', '09:00'); await L.click(p, '[data-a=tmSave]');
  L.has('mehrtägig: Ende vor Beginn abgelehnt', await L.text(p, '[data-k=tmform] .err'), 'nicht vor dem Tag');
  await L.click(p, '[data-a=tmCancel]');

  // 9) Alle zwei Wochen und monatlich
  await L.click(p, '.terminliste [data-a=kNew]:not([data-kl])');
  await L.fill(p, '#tm-titel', 'Kolloquium'); await L.fill(p, '#tm-datum', '2026-11-11'); await L.fill(p, '#tm-von', '16:00');
  await L.click(p, '[data-a=tmWdh][data-v="2"]'); await L.click(p, '[data-a=tmSave]');
  L.has('zwei Wochen: Hinweis nennt den Rhythmus', await L.toast(p), 'alle zwei Wochen am Mittwoch');
  s = await L.store(p);
  const ko = ids(s).find((x) => s.termine[x].titel === 'Kolloquium');
  L.expect('zwei Wochen: Rhythmus gespeichert', s.termine[ko].rhythmus, 'zwei');
  L.expect('zwei Wochen: erster Mittwoch', await titel(p, '2026-11-11'), ['16:00 Kolloquium']);
  L.expect('zwei Wochen: eine Woche später nicht', await titel(p, '2026-11-18'), ['09:00 Seminar']);
  L.expect('zwei Wochen: zwei Wochen später wieder', await titel(p, '2026-11-25'), ['16:00 Kolloquium']);
  L.has('zwei Wochen: Liste nennt den Rhythmus', await L.text(p, '[data-k="tl-2026-11-11"]'), 'alle zwei Wochen');
  await L.click(p, '.terminliste [data-a=kNew]:not([data-kl])');
  await L.fill(p, '#tm-titel', 'Miete'); await L.fill(p, '#tm-datum', '2026-12-31'); await L.click(p, '[data-a=tmArt][data-v=privat]');
  await L.click(p, '[data-a=tmGanz][data-v="1"]'); await L.click(p, '[data-a=tmWdh][data-v=m]');
  L.has('monatlich: Formular nennt den Tag', await L.text(p, '[data-k=tmform]'), 'Jeden Monat am 31.');
  L.expect('monatlich: keine Wochentage zur Wahl', await p.locator('[data-a=tmWt]').count(), 0);
  await L.click(p, '[data-a=tmSave]');
  s = await L.store(p);
  const mi = ids(s).find((x) => s.termine[x].titel === 'Miete');
  L.expect('monatlich: Rhythmus gespeichert', s.termine[mi].rhythmus, 'monat');
  L.expect('monatlich: am 31.12.', await titel(p, '2026-12-31'), [' Miete']);
  L.expect('monatlich: am 31.1.', await titel(p, '2027-01-31'), [' Miete']);
  L.expect('monatlich: im Februar am letzten Tag', await titel(p, '2027-02-28'), [' Miete']);
  L.expect('monatlich: am 27.2. nicht', await titel(p, '2027-02-27'), []);
  await L.go(p, 'einstellungen');
  const es = await L.text(p, '[aria-label="Wiederkehrende Termine"]');
  L.has('Einstellungen nennen „alle zwei Wochen“', es, 'alle zwei Wochen Mi');
  L.has('Einstellungen nennen „jeden Monat am 31.“', es, 'jeden Monat am 31.');
  await p.context().close();

  // 6) iPhone: Tagesblatt steht unter der Woche, nichts ragt über den Rand
  p = await L.open(seed, 'sim-2026-11-10-1000', 390);
  await L.go(p, 'kalender');
  await L.click(p, '.kal button.cell[data-d="2026-11-11"]');
  L.expect('Tagesblatt steht in der Woche', await p.locator('.kal .week .tagblatt').count(), 1);
  await L.noHScroll(p, 'Kalender mit Tagesblatt (390 px)');
  await L.click(p, '.tagblatt [data-a=kNew]');
  await L.click(p, '[data-a=tmMehr]');
  await L.noHScroll(p, 'Kalender mit Terminformular (390 px)');
  await p.context().close();
});
