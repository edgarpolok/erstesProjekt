// Wünsche aus der Nutzung (November): Termine in der erfassten Zeit, ausgefallene Termine ohne offenen Punkt,
// Themensuche beim Hinzufügen und im Eingang, Notizen mit Aufzählung, Themen sortieren, Offenes vorab in die nächste
// Woche mitnehmen, „Guten Abend“ ab 17 Uhr, Stand der App, liegengebliebene Wiederholungen kommen alle mit
const L = require('./lib');

const VL = { titel: 'Legal Tech', wochentage: [3], von: '18:00', bis: '19:30', zustand: 'aktiv' }; // donnerstags
const BES = { titel: 'Lehrstuhl', wochentage: [3], von: '11:00', bis: '13:00', zustand: 'aktiv', zeitZaehlt: false };
const THEMEN = {
  g: { name: 'Schwerpunkt', eltern: null, reihenfolge: 1 },
  i: { name: 'IPR I', eltern: 'g', reihenfolge: 1 },
  e1: { name: 'Einheit 1', eltern: 'i', reihenfolge: 1, sr: { stufe: 1, faellig: '2026-11-11', letzte: '2026-11-10', bewertung: 'sicher' } },
  e2: { name: 'Einheit 2', eltern: 'i', reihenfolge: 2, sr: { stufe: 1, faellig: '2026-11-11', letzte: '2026-11-10', bewertung: 'sicher' } },
  e3: { name: 'Einheit 3', eltern: 'i', reihenfolge: 3 }
};
const EINHEITEN = {
  u1: { titel: 'Grundlagen', woche: '2026-11-09', tag: '2026-11-10', status: 'erledigt', erledigtAm: '2026-11-10', wiederholen: true, thema: 'e1', gebiet: 'g' },
  u2: { titel: 'Rechtsquellen', woche: '2026-11-09', tag: '2026-11-10', status: 'erledigt', erledigtAm: '2026-11-10', wiederholen: true, thema: 'e2', gebiet: 'g' }
};

L.run(async () => {
  // 1) Abgehakte Termine zählen zur erfassten Zeit, außer sie sind auf „zählt nicht“ gestellt
  let p = await L.open({ termine: { t1: VL, t2: BES } }, 'sim-2026-11-12-2000', 1280);
  await L.click(p, '[data-a=tTermin][data-id=t1]');
  await L.click(p, '[data-a=tTermin][data-id=t2]');
  L.expect('nur Legal Tech zählt (1:30 h)', await p.evaluate(() => window.__ls.erfasstAt('2026-11-12')), 90);
  L.has('„heute erfasst“ zeigt die Termine', await L.text(p), 'heute erfasst: 1:30');
  await L.click(p, '[data-a=menu][data-m=tt1]');
  L.expect('Schalter am Termin standardmäßig an', await p.getAttribute('[data-a=tZeitZaehlt][data-id=t1]', 'aria-checked'), 'true');
  await L.click(p, '[data-a=tZeitZaehlt][data-id=t1]');
  L.expect('ausgeschaltet gespeichert', (await L.store(p)).termine.t1.zeitZaehlt, false);
  L.expect('dann zählt nichts', await p.evaluate(() => window.__ls.erfasstAt('2026-11-12')), 0);
  await L.click(p, '.toast [data-a=undo]');
  L.expect('Rückgängig: zählt wieder', await p.evaluate(() => window.__ls.erfasstAt('2026-11-12')), 90);
  await L.click(p, '[data-a=tTermin][data-id=t1]');
  L.expect('nicht abgehakt zählt nicht', await p.evaluate(() => window.__ls.erfasstAt('2026-11-12')), 0);
  await L.go(p, 'einstellungen');
  await L.click(p, '[data-a=esTEdit][data-id=t2]');
  L.expect('Einstellungen: Schalter zeigt „aus“', await p.getAttribute('[data-a=esTZeit][data-id=t2]', 'aria-checked'), 'false');
  await L.click(p, '[data-a=esTZeit][data-id=t2]');
  L.expect('Einstellungen: eingeschaltet gespeichert', (await L.store(p)).termine.t2.zeitZaehlt, true);
  L.has('Stand der App unten in den Einstellungen', await L.text(p), 'Stand der App:');
  await p.context().close();

  // 2) Ausgefallener Termin: in der Woche kein offener Kreis, im Kalender kein Punkt
  p = await L.open({ termine: { t1: VL } }, 'sim-2026-11-12-1000', 1280);
  await L.click(p, '[data-a=menu][data-m=tt1]');
  await L.click(p, '[data-a=cancelTermin][data-id=t1]');
  await L.go(p, 'woche');
  L.expect('Woche: ausgefallener Termin ohne Kreis', await p.locator('.day.today .mk.aus').count(), 1);
  await L.go(p, 'kalender');
  L.expect('Kalender: kein Punkt am 12.11.', await p.locator('.kal [data-d="2026-11-12"] .tdots i').count(), 0);
  L.expect('Kalender: Punkt am 19.11.', await p.locator('.kal [data-d="2026-11-19"] .tdots i').count(), 1);
  await p.context().close();

  // 3) Begrüßung ab 17 Uhr
  p = await L.open({}, 'sim-2026-11-12-1659', 1280);
  L.has('16:59 noch Mittag', await L.text(p, 'h1'), 'Guten Mittag');
  await L.sim(p, '2026-11-12', 17 * 60);
  L.has('17:00 Abend', await L.text(p, 'h1'), 'Guten Abend');
  await p.context().close();

  // 4) Liegengebliebene Wiederholungen kommen am nächsten Tag alle mit (Richtwert 90 min)
  p = await L.open({ themen: THEMEN, bloecke: EINHEITEN, meta: { config: { wdhProTag: 90 } } }, 'sim-2026-11-11-1000', 1280);
  L.expect('11.11.: zwei Zeilen', (await p.evaluate(() => window.__ls.wdhListe('2026-11-11').map((x) => x.titel))).length, 2);
  await L.sim(p, '2026-11-12', 600);
  const zeilen = await p.evaluate(() => window.__ls.wdhListe('2026-11-12').map((x) => x.titel));
  L.expect('12.11.: beide liegengebliebenen sind im Plan', zeilen.length, 2);
  L.expect('12.11.: nichts in „Noch offen“', await p.evaluate(() => window.__ls.wdhUeberhang('2026-11-12').length), 0);

  // 5) Hinzufügen mit Themensuche über alle Ebenen
  await L.click(p, '[data-a=startAdd]');
  await L.fill(p, '#neu-eintrag', 'Kollisionsnormen lesen');
  await p.type('#neu-thema-q', 'ipr einheit 3'); await p.waitForTimeout(200);
  L.expect('Suche findet die Einheit', await p.inputValue('#neu-thema'), 'e3');
  await L.click(p, '[data-a=doAdd]');
  let s = await L.store(p);
  const nb = Object.values(s.bloecke).find((b) => b.titel === 'Kollisionsnormen lesen');
  L.expect('Block hängt am Thema, Gebiet oben', [nb.thema, nb.gebiet], ['e3', 'g']);
  L.has('Zeile zeigt den Weg zum Thema', await L.text(p), 'IPR I › Einheit 3');
  await p.context().close();

  // 6) Eingang: zuordnen über die Suche
  p = await L.open({ themen: THEMEN, bloecke: { b1: { titel: 'Renvoi', woche: '2026-11-09', tag: '2026-11-10', status: 'erledigt', erledigtAm: '2026-11-10', wiederholen: true, sr: { stufe: 1, faellig: '2026-11-20', letzte: '2026-11-10' } } } }, 'sim-2026-11-12-1000', 1280);
  await L.go(p, 'themen');
  await p.type('#zu-b1-q', 'einheit 3'); await p.waitForTimeout(200);
  await L.click(p, '[data-a=thAssign][data-id=b1]');
  L.expect('Eingang: Einheit liegt in Einheit 3', (await L.store(p)).bloecke.b1.thema, 'e3');

  // 7) Themen mit Pfeilen sortieren
  if ((await p.getAttribute('[data-a=thTog][data-id=g]', 'aria-expanded')) !== 'true') await L.click(p, '[data-a=thTog][data-id=g]');
  await L.click(p, '[data-a=thTog][data-id=i]');
  await L.click(p, '[data-a=thSel][data-id=e3]');
  await L.click(p, '[data-a=thOrder][data-id=e3][data-dir="-1"]');
  s = await L.store(p);
  L.expect('Einheit 3 steht vor Einheit 2', [s.themen.e1.reihenfolge, s.themen.e3.reihenfolge, s.themen.e2.reihenfolge], [1, 2, 3]);
  L.ok('Pfeil nach unten an mittlerer Stelle frei', await p.isDisabled('[data-a=thOrder][data-id=e3][data-dir="1"]') === false);
  await L.click(p, '.toast [data-a=undo]');
  s = await L.store(p);
  L.expect('Rückgängig stellt die Reihenfolge her', [s.themen.e2.reihenfolge, s.themen.e3.reihenfolge], [2, 3]);

  // 8) Notizen: Enter wechselt die Zeile, „- “ wird zur Aufzählung
  await p.click('#th-notiz');
  await p.keyboard.type('- Rom I');
  await p.keyboard.press('Enter');
  await p.keyboard.type('Rom II');
  await p.keyboard.press('Enter'); await p.keyboard.press('Enter');
  await p.keyboard.type('Fazit');
  L.expect('Aufzählung läuft weiter, leerer Punkt beendet sie', await p.inputValue('#th-notiz'), '- Rom I\n- Rom II\nFazit');
  await p.click('h1'); await p.waitForTimeout(200);
  L.expect('Notiz gespeichert', (await L.store(p)).themen.e3.notiz, '- Rom I\n- Rom II\nFazit');
  const html = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = window.__ls.notizHtml('- a\n- b\nc'); return [d.querySelectorAll('li').length, d.querySelector('.nzeile').textContent]; });
  L.expect('Anzeige: zwei Punkte und eine Zeile', html, [2, 'c']);
  await p.context().close();

  // 9) Planen der nächsten Woche: Offenes aus dieser Woche schon mitnehmen und mit verteilen
  p = await L.open({ bloecke: { b1: { titel: 'Rom I Fälle', woche: '2026-11-09', tag: null, status: 'offen', std: 2, quelle: 'frei', erstellt: 1 } } }, 'sim-2026-11-13-1000', 1280);
  await L.go(p, 'woche');
  await L.click(p, '[data-a=wkNext]');
  L.has('nächste Woche zeigt das Offene', await L.text(p, '[data-k=carry-voraus]'), 'Rom I Fälle');
  await L.click(p, '[data-a=carryVoraus][data-id=b1]');
  s = await L.store(p);
  const v = Object.values(s.vorhaben).find((x) => x.name === 'Rom I Fälle');
  L.ok('als Vorhaben der nächsten Woche angelegt', v && v.ab === '2026-11-16' && v.std === 2, v);
  L.expect('alter Block ist weitergegeben', [s.bloecke.b1.status, s.bloecke.b1.weiterIn], ['gestrichen', '2026-11-16']);
  await L.click(p, '[data-a=planClaude]');
  await p.waitForTimeout(400);
  s = await L.store(p);
  const verteilt = Object.values(s.bloecke).filter((b) => b.woche === '2026-11-16' && b.titel.indexOf('Rom I Fälle') === 0 && b.tag);
  L.ok('beim Verteilen auf Tage gelegt', verteilt.length >= 1, verteilt);
  await L.click(p, '[data-a=wkPrev]');
  L.hasNot('diese Woche: nicht mehr in „Noch offen“', await L.text(p), 'Rom I Fälle');
  await p.context().close();
});
