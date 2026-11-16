// Fehler aus der Durchsicht vom November 2026: Bewertungen, erfasste Zeit, Neuplanen, Zusammenlegen, Rückgängig
const L = require('./lib');
const W = '2026-11-16'; // Montag
const ev = (p, fn, arg) => p.evaluate(fn, arg);

L.run(async () => {
  // 1) Eine ältere Bewertung zurücknehmen lässt die spätere unberührt
  let p = await L.open({
    themen: { zr: { name: 'Zivilrecht' }, t1: { name: 'Rom I', eltern: 'zr', sr: { stufe: 3, faellig: '2026-11-27', letzte: '2026-11-20', bewertung: 'sicher' } } },
    bloecke: { b1: { titel: 'Rom I lesen', woche: '2026-11-09', tag: '2026-11-13', status: 'erledigt', erledigtAm: '2026-11-13', thema: 't1', wiederholen: true, quelle: 'frei', erstellt: 1 } },
    tage: {
      '2026-11-17': { wdh: { min: 15, liste: [{ ref: 't:t1', min: 15 }], bew: { 't:t1': { r: 'sicher', vorher: { stufe: 1, faellig: '2026-11-17', letzte: null, bewertung: null } } } } },
      '2026-11-20': { wdh: { min: 15, liste: [{ ref: 't:t1', min: 15 }], bew: { 't:t1': { r: 'sicher', vorher: { stufe: 2, faellig: '2026-11-20', letzte: '2026-11-17', bewertung: 'sicher' } } } } }
    }
  }, 'sim-2026-11-21-1000');
  await ev(p, () => window.__ls.test.rateWdh('2026-11-17', 't:t1', 'sicher'));
  await p.waitForTimeout(150);
  L.expect('ältere Bewertung zurücknehmen: Stufe bleibt', await ev(p, () => window.__ls.D.themen.t1.sr), { stufe: 3, faellig: '2026-11-27', letzte: '2026-11-20', bewertung: 'sicher' });
  L.expect('ältere Bewertung bleibt stehen', await ev(p, () => window.__ls.D.tage['2026-11-17'].wdh.bew['t:t1'].r), 'sicher');
  L.has('Hinweis dazu', await L.toast(p), 'seitdem schon wieder bewertet');
  await ev(p, () => window.__ls.test.rateWdh('2026-11-20', 't:t1', 'sicher'));
  L.expect('die letzte Bewertung zurücknehmen geht weiterhin', await ev(p, () => window.__ls.D.themen.t1.sr), { stufe: 2, faellig: '2026-11-20', letzte: '2026-11-17', bewertung: 'sicher' });
  await p.context().close();

  // 2) Abhaken, zurücknehmen, später abhaken: die Wiederholung beginnt am neuen Tag
  p = await L.open({
    themen: { zr: { name: 'Zivilrecht' }, t1: { name: 'Kaufrecht', eltern: 'zr' } },
    bloecke: { b1: { titel: 'Kaufrecht', woche: W, tag: '2026-11-16', status: 'offen', thema: 't1', quelle: 'frei', erstellt: 1 } }
  }, 'sim-2026-11-16-1000');
  await ev(p, () => { const t = window.__ls.test; t.setBlockDone('b1', true); t.setBlockDone('b1', false); });
  await L.sim(p, '2026-11-18', 600);
  await ev(p, () => { const t = window.__ls.test; t.pullToday('b1'); t.setBlockDone('b1', true); });
  L.expect('fällig am Tag nach dem späteren Abhaken', await ev(p, () => window.__ls.D.themen.t1.sr.faellig), '2026-11-19');
  await p.context().close();

  // 3) Termin ändern oder beenden schreibt die Vergangenheit nicht um
  p = await L.open({ termine: { t1: { titel: 'Vorlesung', wochentage: [0], von: '10:00', bis: '12:00', zustand: 'aktiv' } } }, 'sim-2026-11-16-1300');
  const termin = () => ev(p, () => [window.__ls.erfasstAt('2026-11-16'), window.__ls.termineAt('2026-11-16').length, window.__ls.termineAt('2026-11-23').length]);
  await ev(p, () => window.__ls.test.toggleTermin('2026-11-16', 't1'));
  L.expect('abgehakt: 2 h erfasst', await termin(), [120, 1, 1]);
  await ev(p, () => window.__ls.test.patch('termine', 't1', { bis: '14:00' }));
  L.expect('Uhrzeit später geändert: der abgehakte Tag behält 2 h', await termin(), [120, 1, 1]);
  await ev(p, () => window.__ls.test.patch('termine', 't1', { zustand: 'abgeschlossen' }));
  L.expect('Termin beendet: der abgehakte Tag bleibt, künftige Tage sind leer', await termin(), [120, 1, 0]);
  await p.context().close();

  // 4) Neu planen: der Rest eines Vorhabens wird nicht doppelt abgezogen; Angefangenes bleibt mit seiner Zeit
  p = await L.open({
    vorhaben: { v1: { name: 'Sachenrecht', std: 6, ab: W, wochen: 1, ohne: [], reihenfolge: 1, erstellt: 1 } },
    wochen: { [W]: { status: 'uebergeben' } },
    bloecke: {
      a: { titel: 'Sachenrecht', woche: W, tag: '2026-11-16', status: 'erledigt', erledigtAm: '2026-11-16', vorhaben: 'v1', std: 3, zeit: 60, quelle: 'claude', wiederholen: false, erstellt: 1 },
      r: { titel: 'Sachenrecht', woche: W, tag: null, status: 'offen', vorhaben: 'v1', std: 2, quelle: 'claude', restVon: 'a', zurueckgelegt: true, erstellt: 2 },
      c: { titel: 'Sachenrecht', woche: W, tag: '2026-11-19', status: 'offen', vorhaben: 'v1', std: 3, quelle: 'claude', erstellt: 3 },
      x: { titel: 'Angefangen', woche: W, tag: '2026-11-17', status: 'offen', std: 1, zeit: 45, quelle: 'claude', erstellt: 4 },
      y: { titel: 'Nicht angefangen', woche: W, tag: '2026-11-17', status: 'offen', std: 1, quelle: 'claude', erstellt: 5 }
    }
  }, 'sim-2026-11-18-1000');
  L.expect('6 h Vorhaben, 3 h erledigt (davon 2 h als Rest offen): 3 h neu zu planen', await ev(p, (w) => window.__ls.test.planRows(w).map((x) => x.hours), W), [3]);
  L.expect('Zeit auf einem nicht abgehakten Block zählt am Tag', await ev(p, () => window.__ls.erfasstAt('2026-11-17')), 45);
  await ev(p, (w) => window.__ls.clearPlanBlocks(w), W);
  L.expect('Neuplanen: Angefangenes bleibt, Unberührtes wird neu verteilt', await ev(p, () => Object.keys(window.__ls.D.bloecke).sort()), ['a', 'r', 'x']);
  await p.context().close();

  // 5) Zurück in die Woche und später holen: die Zeit bleibt beim alten Tag; Rückblick und Statistik rechnen gleich
  p = await L.open({ bloecke: { m: { titel: 'Block', woche: W, tag: '2026-11-18', status: 'offen', zeit: 30, quelle: 'frei', erstellt: 1 } } }, 'sim-2026-11-18-1000');
  await ev(p, () => window.__ls.test.backToWeek('m'));
  await L.sim(p, '2026-11-19', 600);
  await ev(p, () => { const t = window.__ls.test; t.pullToday('m'); t.setBlockDone('m', true); });
  L.expect('erfasst Mi / Do', await ev(p, () => [window.__ls.erfasstAt('2026-11-18'), window.__ls.erfasstAt('2026-11-19')]), [30, 0]);
  L.expect('Wochenrückblick und Statistik: dieselbe Summe', await ev(p, (w) => [window.__ls.test.weekFacts(w).zeit, window.__ls.test.weekStats(w).zeit], W), [30, 30]);
  await p.context().close();

  // 6) Zeiteingabe: mit „h“ sind es Stunden
  p = await L.open({}, 'sim-2026-11-18-1000');
  L.expect('Zeiteingaben', await ev(p, () => ['2 h', '1h', '1,5 h', '45', '1:30', '20 min', '2', '1,5'].map(window.__ls.test.parseDur)), [120, 60, 90, 45, 90, 20, 2, 90]);
  await p.context().close();

  // 7) Zusammenlegen nimmt Etappen-Stoff, Klausur-Gebiet und Blöcke mit; Klausurfehler sind keine Lernblöcke
  p = await L.open({
    themen: { zr: { name: 'Zivilrecht' }, sr: { name: 'Strafrecht' }, sr1: { name: 'Diebstahl', eltern: 'sr', durchAm: '2026-11-17' } },
    etappen: { e1: { name: 'Schwerpunkt', datum: '2026-12-20', stoff: ['sr', 'sr1'] } },
    termine: { k1: { titel: 'Klausur', art: 'klausur', gebiet: 'sr', datum: '2026-11-21', von: '09:00', bis: '14:00' } },
    bloecke: {
      g: { titel: 'Strafrecht allgemein', woche: W, tag: '2026-11-16', status: 'erledigt', erledigtAm: '2026-11-16', gebiet: 'sr', wiederholen: false, quelle: 'frei', erstellt: 1 },
      kf: { titel: 'Klausur: AGL übersehen', woche: W, tag: null, status: 'erledigt', erledigtAm: '2026-11-17', gebiet: 'zr', quelle: 'klausur', wiederholen: true, sr: { stufe: 1, faellig: '2026-11-18' }, erstellt: 2 }
    }
  }, 'sim-2026-11-18-1000');
  L.expect('Klausurfehler zählt nicht als erledigter Block', await ev(p, (w) => window.__ls.test.weekStats(w).n, W), 1);
  const zs = await ev(p, (w) => window.__ls.test.zsDaten(w, '2026-11-22'), W);
  L.expect('Zeitstrahl: Klausurfehler ist nicht „neu gelernt“', zs.zr, undefined);
  L.expect('Zeitstrahl: „durchgearbeitet“ steht in der Woche', zs.sr[W].durch, ['Diebstahl']);
  await ev(p, () => window.__ls.test.thMerge('sr', 'zr'));
  L.expect('nach dem Zusammenlegen zeigt alles auf das Zielgebiet', await ev(p, () => { const D = window.__ls.D; return [D.etappen.e1.stoff, D.termine.k1.gebiet, D.bloecke.g.gebiet, !!D.themen.sr]; }), [['zr', 'sr1'], 'zr', 'zr', false]);
  await p.context().close();

  // 8) Rückgängig verfällt, wenn derselbe Eintrag danach geändert wird; Zeit ändern ist rückgängig zu machen
  p = await L.open({ bloecke: { u: { titel: 'Alt', woche: W, tag: '2026-11-18', status: 'offen', zeit: 9, quelle: 'frei', erstellt: 1 } } }, 'sim-2026-11-18-1000');
  await ev(p, () => { const t = window.__ls.test; t.undoable('Geändert', () => t.patch('bloecke', 'u', { titel: 'Neu' })); });
  await p.waitForTimeout(150);
  L.has('Rückgängig wird angeboten', await L.toast(p), 'Geändert');
  await L.click(p, '[data-a=tBlock][data-id=u]');
  L.expect('nach dem Abhaken gibt es das alte Rückgängig nicht mehr', await p.locator('[data-a=undo]').count(), 0);
  L.expect('Name und Haken bleiben', await ev(p, () => [window.__ls.D.bloecke.u.titel, window.__ls.D.bloecke.u.status]), ['Neu', 'erledigt']);
  await L.click(p, '[data-a=openT][data-ref="b:u"]'); await L.fill(p, '[data-in=zeit]', '90'); await L.click(p, '[data-a=saveT]');
  L.expect('Zeit gespeichert', await ev(p, () => window.__ls.D.bloecke.u.zeit), 90);
  await L.click(p, '[data-a=undo]');
  L.expect('Zeit ändern rückgängig gemacht', await ev(p, () => window.__ls.D.bloecke.u.zeit), 9);
  await p.context().close();

  // 10) Statistik und Zeitstrahl: Zeit nach Gebiet, Stoff auf einen Blick, bei nur einem Gebiet eine Ebene tiefer
  const bl = (id, tag, thema, zeit) => ({ [id]: { titel: 'Block ' + id, woche: L.addDays(tag, -((new Date(tag + 'T12:00:00Z').getUTCDay() + 6) % 7)), tag: tag, status: 'erledigt', erledigtAm: tag, thema: thema, gebiet: 'zr', zeit: zeit, wiederholen: false, quelle: 'frei', erstellt: 1 } });
  p = await L.open({
    themen: { zr: { name: 'Zivilrecht' }, at: { name: 'Allgemeiner Teil', eltern: 'zr', reihenfolge: 1, durchAm: '2026-11-03' }, sr: { name: 'Schuldrecht', eltern: 'zr', reihenfolge: 2 } },
    termine: { v: { titel: 'Vorlesung', wochentage: [1], von: '10:00', bis: '12:00', zustand: 'aktiv' } },
    tage: { '2026-11-03': { termine: { v: { erledigt: true, min: 120 } } } },
    bloecke: Object.assign({}, bl('a', '2026-11-03', 'at', 90), bl('b', '2026-11-04', 'sr', 60), bl('c', '2026-11-10', 'sr', 120), bl('d', '2026-11-11', 'at', 30))
  }, 'sim-2026-11-18-1000', 1280);
  const zg = await ev(p, () => window.__ls.test.zeitGruppen('2026-11-02', '2026-11-15', null));
  L.expect('Zeit je Woche und Gebiet (Termine eigens)', zg, { '2026-11-02': { zr: 150, '#t': 120 }, '2026-11-09': { zr: 150 } });
  L.expect('Summe wie die Tageswerte', await ev(p, () => ['2026-11-03', '2026-11-04', '2026-11-10', '2026-11-11'].reduce((a, d) => a + window.__ls.erfasstAt(d), 0)), 420);
  await L.go(p, 'kalender'); await L.click(p, '[data-a=kTab][data-v=zeit]');
  L.expect('nur ein Gebiet: Zeitstrahl zeigt dessen Teile', [await p.locator('[data-k=zs-at]').count(), await p.locator('[data-k=zs-sr]').count(), await p.locator('[data-k=zs-zr]').count()], [1, 1, 0]);
  await L.click(p, '[data-a=kTiefer][data-id=""]');
  L.expect('„Alle Gebiete“ zeigt wieder das Gebiet', [await p.locator('[data-k=zs-at]').count(), await p.locator('[data-k=zs-zr]').count()], [0, 1]);
  await L.click(p, '[data-a=kTab][data-v=zahlen]'); await L.click(p, '[data-a=kPeriod][data-v=gesamt]');
  L.expect('Grafik der Wochenzeit vorhanden', await p.locator('svg[data-k=zeit-wochen]').count(), 1);
  L.has('Stoff auf einen Blick zählt je Gebiet', await L.text(p, '[aria-label="Stoff auf einen Blick"]'), '1 von 2 durchgearbeitet');
  await L.click(p, '[data-a=kTiefer][data-id=zr]');
  L.has('eine Ebene tiefer: Verteilung nach Teilen', await L.text(p, '[aria-label="Verteilung auf die Gebiete"]'), 'Schuldrecht');
  await L.noHScroll(p, 'Statistik');
  await p.context().close();
  p = await L.open({ themen: { zr: { name: 'Zivilrecht' } } }, 'sim-2026-11-18-1000', 390);
  await L.go(p, 'kalender'); await L.click(p, '[data-a=kTab][data-v=zeit]'); await L.noHScroll(p, 'Zeitstrahl 390');
  await L.click(p, '[data-a=kTab][data-v=zahlen]'); await L.noHScroll(p, 'Statistik 390');
  await p.context().close();

  // 11) Klappt der Zugang zur Ablage nicht mehr, steht das auch in Heute (nicht nur in den Einstellungen)
  const A = L.ablage();
  p = await L.open({ themen: { zr: { name: 'Zivilrecht' } } }, 'sim-2026-11-18-1000');
  await A.an(p);
  L.hasNot('ohne Abgleich kein Hinweis', await L.text(p), 'Abgleich klappt gerade nicht');
  await ev(p, () => { localStorage.setItem('lernsystem-abgleich-v1', JSON.stringify({ an: true, token: 'abgelaufen', repo: 'edgarpolok/lernplan-daten' })); window.dispatchEvent(new StorageEvent('storage', { key: 'lernsystem-abgleich-v1' })); });
  await ev(p, () => window.__ls.abgleich.jetzt()); await p.waitForTimeout(200);
  L.expect('Zugang abgelehnt', await ev(p, () => window.__ls.abgleich.stand().status), 'zugang');
  L.has('Hinweis in Heute', await L.text(p), 'Der Abgleich klappt gerade nicht');
  await p.context().close();

  // 9) Freier Tag mit Offenem: der Text behauptet nicht „nichts offen“
  p = await L.open({ bloecke: { o: { titel: 'Offener Block', woche: W, tag: null, status: 'offen', quelle: 'liste', zurueckgelegt: true, erstellt: 1 } } }, 'sim-2026-11-22-1000');
  L.hasNot('Sonntag mit Offenem: kein „nichts offen“', await L.text(p), 'nichts offen');
  L.has('Sonntag mit Offenem: Hinweis auf die Liste', await L.text(p), 'Was diese Woche noch offen ist');
  await p.context().close();
});
