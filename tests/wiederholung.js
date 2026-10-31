// Wiederholung: Abstände 1, 3, 7, 14, 30, 60, 90, 120 Tage ab der letzten Wiederholung; jedes fällige Thema als eigene Zeile im Tag,
// bis zum Richtwert pro Tag (halber Tag: Hälfte, freier Tag: nichts), der Rest einzeln in „Noch offen“; Vorschau für die Woche; Zeit je Zeile
const L = require('./lib');
const einheit = (titel, faellig, stufe) => ({ titel, woche: '2026-10-19', tag: '2026-10-20', status: 'erledigt', erledigtAm: '2026-10-20', wiederholen: true, sr: { stufe: stufe || 1, faellig, letzte: '2026-10-20', bewertung: 'sicher' } });

L.run(async () => {
  // 1) Abstände: Voreinstellung und Folge beim jeweils „sicher“ Bewerten
  let p = await L.open({}, 'sim-2026-10-29-1000');
  L.expect('voreingestellte Abstände', await p.evaluate(() => window.__ls.cfg().abstaende), [1, 3, 7, 14, 30, 60, 90, 120]);
  const folge = await p.evaluate(() => {
    const diff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
    let sr = { stufe: 1, faellig: '2026-10-29' }; let d = '2026-10-29'; const out = [];
    for (let i = 0; i < 9; i++) { sr = window.__ls.srRate(sr, 'sicher', d); out.push(diff(d, sr.faellig)); d = sr.faellig; }
    return out;
  });
  L.expect('Abstände bei „sicher“ nacheinander (ab Stufe 1, oben gedeckelt)', folge, [3, 7, 14, 30, 60, 90, 120, 120, 120]);
  L.expect('„teilweise“ bleibt auf der Stufe', await p.evaluate(() => window.__ls.srRate({ stufe: 4, faellig: '2026-10-20' }, 'teilweise', '2026-10-29')), { stufe: 4, faellig: '2026-11-12', letzte: '2026-10-29', bewertung: 'teilweise' });
  L.expect('„nicht“ fällt auf Stufe 1 zurück', await p.evaluate(() => window.__ls.srRate({ stufe: 6, faellig: '2026-10-20' }, 'nicht', '2026-10-29')), { stufe: 1, faellig: '2026-10-30', letzte: '2026-10-29', bewertung: 'nicht' });
  await p.context().close();

  // 2) In der Oberfläche: überfällige Einheit (Stufe 2, fällig seit 25.10.) am 29.10. bewerten -> Abstand zählt ab dem 29.10.
  const vorher = { stufe: 2, faellig: '2026-10-25', letzte: '2026-10-20', bewertung: 'sicher' };
  p = await L.open({ bloecke: { e1: einheit('Rom I', '2026-10-25', 2) } }, 'sim-2026-10-29-1000');
  L.has('fällige Einheit steht als Zeile im Plan', await L.text(p, '.wrow'), 'Rom I');
  const sr = async () => (await L.store(p)).bloecke.e1.sr;
  await L.click(p, '[data-a=rateW][data-r=sicher]');
  L.expect('sicher: Stufe 3, 7 Tage ab heute', await sr(), { stufe: 3, faellig: '2026-11-05', letzte: '2026-10-29', bewertung: 'sicher' });
  await L.click(p, '[data-a=rateW][data-r=teilweise]');
  L.expect('am selben Tag umbewerten geht vom Stand vor der Bewertung aus', await sr(), { stufe: 2, faellig: '2026-11-01', letzte: '2026-10-29', bewertung: 'teilweise' });
  await L.click(p, '[data-a=rateW][data-r=nicht]');
  L.expect('nicht: Stufe 1, morgen', await sr(), { stufe: 1, faellig: '2026-10-30', letzte: '2026-10-29', bewertung: 'nicht' });
  await L.click(p, '[data-a=rateW][data-r=nicht]');
  L.expect('Bewertung zurücknehmen stellt den alten Stand her', await sr(), vorher);
  await p.context().close();
  // Daten ohne „letzte“/„bewertung“ (z. B. aus älteren Sicherungen): Zurücknehmen lässt die alte Bewertung stehen
  const alt = einheit('Alt', '2026-10-25', 2); alt.sr = { stufe: 2, faellig: '2026-10-25' };
  p = await L.open({ bloecke: { e1: alt } }, 'sim-2026-10-29-1000');
  await L.click(p, '[data-a=rateW][data-r=nicht]'); await L.click(p, '[data-a=rateW][data-r=nicht]');
  const altSr = await sr();
  L.known('Zurücknehmen bei Daten ohne „letzte“ entfernt auch das Bewertungsdatum', !altSr.letzte && !altSr.bewertung, altSr);
  await p.context().close();

  // 3) Richtwert 60 min am ganzen Tag: Ältestes zuerst in den Tag, der Rest einzeln in „Noch offen“
  const fuenf = {}; ['a', 'b', 'c', 'd', 'e'].forEach((k, i) => { fuenf[k] = einheit('Einheit ' + k.toUpperCase(), '2026-10-2' + (5 + i), 1); });
  p = await L.open({ bloecke: fuenf }, 'sim-2026-11-02-0900', 1280);
  const zeilen = async () => p.$$eval('.wrow .title', (els) => els.map((e) => e.textContent));
  L.expect('vier Zeilen à 15 min, älteste zuerst', await zeilen(), ['Einheit A', 'Einheit B', 'Einheit C', 'Einheit D']);
  L.expect('Tagesliste gespeichert, Richtwert 60', (await L.store(p)).tage['2026-11-02'].wdh.min, 60);
  await L.click(p, '[data-a=poolOpen]');
  L.has('Rest steht in „Noch offen“', await L.text(p, '.pool'), 'Einheit E');
  L.has('mit Fälligkeit', await L.text(p, '.pool'), 'fällig seit Do 29.10.');
  await L.click(p, '[data-a=pullW][data-ref="e:e"]');
  L.expect('„+ Heute“ holt die Einheit dazu', (await zeilen()).length, 5);
  L.hasNot('danach nicht mehr in „Noch offen“', await L.text(p, '.pool'), 'Einheit E');
  // Später: zurück in „Noch offen“, mit Rückgängig
  await L.click(p, '[data-a=menu][data-m="w2026-11-02~e.a"]'); await L.click(p, '[data-a=laterW][data-ref="e:a"]');
  L.ok('Später: Zeile weg', !(await zeilen()).includes('Einheit A'), await zeilen());
  L.has('Später: steht in „Noch offen“', await L.text(p, '.pool'), 'Einheit A');
  await L.click(p, '.toast [data-a=undo]');
  L.ok('Rückgängig: wieder im Tag', (await zeilen()).includes('Einheit A'), await zeilen());
  await p.context().close();

  // 4) Halber Tag (Samstag) 30 min, freier Tag (Sonntag) nichts automatisch, aber holbar
  p = await L.open({ bloecke: fuenf }, 'sim-2026-11-07-0900', 1280);
  L.expect('Samstag (halber Tag): zwei Zeilen', (await zeilen()).length, 2);
  await p.context().close();
  p = await L.open({ bloecke: fuenf }, 'sim-2026-11-08-0900', 1280);
  L.expect('Sonntag (frei): keine Zeile', (await zeilen()).length, 0);
  await L.click(p, '[data-a=poolOpen]');
  await L.click(p, '[data-a=pullW][data-ref="e:c"]');
  L.expect('Sonntag: geholte Einheit steht im Tag', await zeilen(), ['Einheit C']);
  await p.context().close();

  // 5) Richtwert in den Einstellungen: mehr Zeit füllt heute nach, Bewertetes bleibt
  p = await L.open({ bloecke: fuenf }, 'sim-2026-11-02-0900', 1280);
  await L.click(p, '[data-a=rateW][data-ref="e:a"][data-r=sicher]');
  await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esOpen][data-v=wdhtag]');
  await L.click(p, '[data-a=esSet][data-k=wdhProTag][data-n="30"]');
  L.expect('Richtwert gespeichert', await p.evaluate(() => window.__ls.cfg().wdhProTag), 30);
  await L.go(p, 'heute');
  L.expect('30 min: Bewertetes bleibt, dazu eine weitere', await zeilen(), ['Einheit A', 'Einheit B']);
  await p.context().close();

  // 6) Zeile zeigt Abstand (Ring) und Fälligkeit; nach der Bewertung die nächste Wiederholung
  p = await L.open({ bloecke: { k: einheit('Kaufrecht', '2026-10-30', 5) } }, 'sim-2026-11-02-0900', 1280);
  L.expect('Ring: 30-Tage-Wiederholung, Stufe 5 von 8', await p.getAttribute('.wrow .wring', 'aria-label'), '30-Tage-Wiederholung, Stufe 5 von 8');
  L.expect('Zahl im Ring', await L.text(p, '.wrow .wring'), '30');
  L.has('Fälligkeit', await L.text(p, '.wrow .meta'), 'Wiederholung · 30 min · fällig seit Fr 30.10.');
  await L.click(p, '[data-a=rateW][data-r=sicher]');
  L.has('nach „sicher“: nächste in 60 Tagen', await L.text(p, '.wrow .meta'), 'nächste Fr 1.1. (in 60 Tagen)');
  L.ok('erledigt: Ring wird zum Haken', !!(await p.$('.wrow .wring.on')));
  await p.context().close();

  // 7) Zeit je Zeile: Timer und Zeit eintragen, zählt für den Tag
  p = await L.open({ bloecke: { k: einheit('Kaufrecht', '2026-10-30', 5) } }, 'sim-2026-11-02-0900', 1280);
  await L.click(p, '.wrow [data-a=startT]');
  await L.sim(p, '2026-11-02', 9 * 60 + 25);
  await L.click(p, '[data-a=stopT]');
  let s = await L.store(p);
  L.expect('Timer: 25 min bei der Zeile', s.tage['2026-11-02'].wdh.zeiten['e:k'], 25);
  L.expect('zählt für den Tag', await p.evaluate(() => window.__ls.erfasstAt('2026-11-02')), 25);
  await L.click(p, '.wrow [data-a=openT]'); await L.fill(p, '.wrow input[data-in=zeit]', '40'); await L.click(p, '.wrow [data-a=saveT]');
  L.expect('Zeit ändern', (await L.store(p)).tage['2026-11-02'].wdh.zeiten['e:k'], 40);
  await p.context().close();

  // 8) Vorschau: Überhang kommt am nächsten Tag zuerst, Folgewiederholungen mit „sicher“ gerechnet
  p = await L.open({ bloecke: fuenf }, 'sim-2026-11-02-0900', 1280);
  const vor = await p.evaluate(() => ['2026-11-03', '2026-11-04', '2026-11-05'].map((d) => window.__ls.wdhListe(d).map((x) => x.titel + '/' + x.stufe)));
  L.expect('Di: Überhang zuerst, dann die heutigen mit Abstand 3 erst am Do', vor[0], ['Einheit E/1']);
  L.expect('Mi: nichts', vor[1], []);
  L.expect('Do: die vier von heute, Stufe 2', vor[2], ['Einheit A/2', 'Einheit B/2', 'Einheit C/2', 'Einheit D/2']);
  await L.go(p, 'woche');
  L.has('Woche heute: Themen, Minuten, Überhang', await L.text(p, '[data-k="d-2026-11-02"]'), '4 Themen · 60 min · 1 weitere in „Noch offen“');
  L.has('Woche Donnerstag zugeklappt: Wiederholung auf einen Blick', await L.text(p, '[data-k="d-2026-11-05"]'), 'Wiederholung: 4 Themen · 60 min · voraussichtlich');
  await L.click(p, '[data-k="d-2026-11-05"] .lbl');
  await L.click(p, '[data-a=wdhTag][data-d="2026-11-05"]');
  L.has('aufgeklappt: Namen', await L.text(p, '[data-k="wl-2026-11-05"]'), 'Einheit A');
  L.expect('aufgeklappt: Ring mit Abstand', await p.$$eval('[data-k="wl-2026-11-05"] .wring b', (els) => els.map((e) => e.textContent)), ['3', '3', '3', '3']);
  await L.click(p, '[data-a=planShow]');
  L.has('Planungskarte: Schätzung statt fester Wochenzeit', await L.text(p, '#planen'), 'Voraussichtlich etwa');
  L.ok('kein Regler für die Wochenzeit mehr', !(await p.$('[data-a=wMore]')));
  await p.context().close();

  // 9) Neues: heute erledigte Lerneinheit steht morgen von selbst in der Wiederholung
  p = await L.open({}, 'sim-2026-11-04-1800');
  await L.click(p, '[data-a=startAdd]'); await L.fill(p, '#neu-eintrag', 'IPR Vorlesung 3'); await L.click(p, '[data-a=addDone]'); await L.click(p, '[data-a=doAdd]');
  s = await L.store(p);
  L.expect('Vorschau morgen', await p.evaluate(() => window.__ls.wdhListe('2026-11-05').map((x) => x.titel)), ['IPR Vorlesung 3']);
  await p.context().close();
  p = await L.open(s, 'sim-2026-11-05-0800');
  L.has('morgen steht die Einheit als Zeile im Tag', await L.text(p, '.wrow'), 'IPR Vorlesung 3');
  await p.context().close();

  // 10) Wiederholungspause: keine Zeilen, nichts in „Noch offen“
  p = await L.open({ bloecke: fuenf, pausen: { p1: { name: 'Urlaub', art: 'wdh', von: '2026-11-01', bis: '2026-11-03' } } }, 'sim-2026-11-02-0900', 1280);
  L.expect('Pause: keine Zeile', (await zeilen()).length, 0);
  L.expect('Pause: kein Überhang', await p.evaluate(() => window.__ls.wdhUeberhang('2026-11-02').length), 0);
  await p.context().close();
});
