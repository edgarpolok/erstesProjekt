// Wöchentliche Termine fallen im Voraus aus (Kalender-Schalter, Einstellungen, Zeitraum teilen, Kapazität)
const L = require('./lib');

const REP = { titel: 'Rep', wochentage: [2], von: '09:00', bis: '13:00', zustand: 'aktiv' }; // jeden Mittwoch
const tag = (p, d) => p.evaluate((d) => window.__ls.termineAt(d).map((x) => x.titel), d);
const SCHALTER = '[data-a=kAusfall][data-id=t1]';

L.run(async () => {
  // 1) Kalender: einzelnen Mittwoch ausfallen lassen und zurücknehmen
  let p = await L.open({ termine: { t1: REP } }, 'sim-2026-11-03-1000', 1280);
  await L.go(p, 'kalender');
  await L.click(p, '.kal button.cell[data-d="2026-11-11"]');
  L.has('Formular zeigt Schalter mit Terminnamen', await L.text(p, '[data-k=k-ausfall]'), 'Rep');
  L.has('Schalter heißt „fällt aus“', await L.text(p, SCHALTER), 'fällt aus');
  L.expect('Schalter zunächst aus', await p.getAttribute(SCHALTER, 'aria-checked'), 'false');
  await L.click(p, SCHALTER);
  let s = await L.store(p);
  L.expect('Ausfall für 11.11. gespeichert', s.termine.t1.ausfall, [{ von: '2026-11-11', bis: '2026-11-11' }]);
  let t = await L.toast(p);
  L.has('Hinweis nennt den Ausfall', t, 'Rep fällt am 11.11. aus');
  L.has('Hinweis bietet Rückgängig an', t, 'Rückgängig');
  L.expect('11.11. hat keinen Termin mehr', await tag(p, '2026-11-11'), []);
  L.expect('18.11. hat den Termin noch', await tag(p, '2026-11-18'), ['Rep']);
  L.expect('Schalter jetzt an', await p.getAttribute(SCHALTER, 'aria-checked'), 'true');
  // Zurücknehmen
  await L.click(p, SCHALTER);
  s = await L.store(p);
  L.expect('Ausfall zurückgenommen', s.termine.t1.ausfall, []);
  L.has('Hinweis nennt das Stattfinden', await L.toast(p), 'findet am 11.11. statt');
  L.expect('11.11. hat den Termin wieder', await tag(p, '2026-11-11'), ['Rep']);
  // Rückgängig stellt den Ausfall wieder her
  await L.click(p, '.toast [data-a=undo]');
  s = await L.store(p);
  L.expect('Rückgängig stellt vorigen Stand her (Ausfall wieder da)', s.termine.t1.ausfall, [{ von: '2026-11-11', bis: '2026-11-11' }]);
  L.expect('11.11. nach Rückgängig wieder ausgefallen', await tag(p, '2026-11-11'), []);
  await p.context().close();

  // 2) Einstellungen: Zeitraum eintragen, anzeigen, entfernen, Eingabeprüfung
  p = await L.open({ termine: { t1: REP } }, 'sim-2026-11-03-1000', 1280);
  await L.go(p, 'einstellungen');
  await L.click(p, '[data-a=esTEdit][data-id=t1]');
  await L.click(p, '[data-a=esTAusAdd]');
  L.has('ohne von-Datum: Fehlermeldung', await L.text(p, '.err'), 'Bitte einen Tag (von) wählen.');
  await L.fill(p, '#t-aus-von', '2026-12-21'); await L.fill(p, '#t-aus-bis', '2026-12-10');
  await L.click(p, '[data-a=esTAusAdd]');
  L.has('bis vor von: Fehlermeldung', await L.text(p, '.err'), '„bis“ darf nicht vor „von“ liegen.');
  L.expect('bei Fehlern nichts gespeichert', ((await L.store(p)).termine.t1.ausfall || []).length, 0);
  await L.fill(p, '#t-aus-bis', '2027-01-08');
  await L.click(p, '[data-a=esTAusAdd]');
  s = await L.store(p);
  L.expect('Zeitraum gespeichert', s.termine.t1.ausfall, [{ von: '2026-12-21', bis: '2027-01-08' }]);
  L.expect('23.12. fällt aus', await tag(p, '2026-12-23'), []);
  L.expect('6.1.2027 fällt aus', await tag(p, '2027-01-06'), []);
  L.expect('13.1.2027 findet wieder statt', await tag(p, '2027-01-13'), ['Rep']);
  L.expect('16.12. davor findet statt', await tag(p, '2026-12-16'), ['Rep']);
  L.has('Liste zeigt den Zeitraum', await L.text(p), '21.12. – 8.1.');
  L.has('Liste hat „entfernen“', await L.text(p, '[data-a=esTAusDel][data-i="0"]'), 'entfernen');
  await L.click(p, '[data-a=esTAusDel][data-i="0"]');
  s = await L.store(p);
  L.expect('Liste nach Entfernen leer', s.termine.t1.ausfall, []);
  L.expect('23.12. findet wieder statt', await tag(p, '2026-12-23'), ['Rep']);
  L.hasNot('Zeitraum nicht mehr angezeigt', await L.text(p), '21.12. – 8.1.');
  await p.context().close();

  // 3) Einzeltag aus einem Zeitraum herausnehmen teilt den Zeitraum
  p = await L.open({ termine: { t1: Object.assign({}, REP, { ausfall: [{ von: '2026-11-04', bis: '2026-11-25' }] }) } }, 'sim-2026-11-03-1000', 1280);
  await L.go(p, 'kalender');
  await L.click(p, '.kal button.cell[data-d="2026-11-18"]');
  L.expect('18.11. im Zeitraum: Schalter an', await p.getAttribute(SCHALTER, 'aria-checked'), 'true');
  await L.click(p, SCHALTER);
  s = await L.store(p);
  L.expect('Zeitraum geteilt', s.termine.t1.ausfall, [{ von: '2026-11-04', bis: '2026-11-17' }, { von: '2026-11-19', bis: '2026-11-25' }]);
  L.expect('18.11. findet statt', await tag(p, '2026-11-18'), ['Rep']);
  L.expect('11.11. fällt weiter aus', await tag(p, '2026-11-11'), []);
  L.expect('25.11. fällt weiter aus', await tag(p, '2026-11-25'), []);
  await p.context().close();

  // 4) Ausgefallene Zeit steht für Lernblöcke zur Verfügung (4 h mehr am Mittwoch)
  const kap = async (seed) => {
    const q = await L.open(seed, 'sim-2026-11-07-1000', 1280);
    const c = await q.evaluate(() => window.__ls.capacity('2026-11-09', {}, '2026-11-09', true));
    await q.context().close();
    return c['2026-11-11'];
  };
  const ohne = await kap({ termine: { t1: REP } });
  const mit = await kap({ termine: { t1: Object.assign({}, REP, { ausfall: [{ von: '2026-11-11', bis: '2026-11-11' }] }) } });
  L.expect('Kapazität am Ausfalltag um 4 h größer', mit - ohne, 4);

  // 5) Einmaliger Termin taucht in der Ausfall-Liste nicht auf
  p = await L.open({ termine: { t1: REP, t2: { titel: 'Einmal', datum: '2026-11-11', von: '15:00', bis: '16:00', zustand: 'aktiv' } } }, 'sim-2026-11-03-1000', 1280);
  await L.go(p, 'kalender');
  await L.click(p, '.kal button.cell[data-d="2026-11-11"]');
  const liste = await L.text(p, '[data-k=k-ausfall]');
  L.has('wöchentlicher Termin steht in der Liste', liste, 'Rep');
  L.hasNot('einmaliger Termin steht nicht in der Liste', liste, 'Einmal');
  L.expect('kein Schalter für den einmaligen Termin', await p.locator('[data-a=kAusfall][data-id=t2]').count(), 0);
  await p.context().close();
});
