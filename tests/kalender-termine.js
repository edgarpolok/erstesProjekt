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
