// Wiederholung: Abstände 1, 3, 7, 14, 30, 60, 90, 120 Tage ab der letzten Wiederholung; Verteilung über die Woche
// nach Fälligkeit, Überfälliges über die restlichen Tage; Neues und seine Folgewiederholungen bekommen in geplanten Wochen Zeit dazu
const L = require('./lib');
const WOCHE = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
const leer = () => WOCHE.reduce((o, d) => { o[d] = 0; return o; }, {});
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
  await L.click(p, '[data-a=wdhOpen]');
  L.has('fällige Einheit steht in der Wiederholung', await L.text(p, '.wdh'), 'Rom I');
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
  await L.click(p, '[data-a=wdhOpen]'); await L.click(p, '[data-a=rateW][data-r=nicht]'); await L.click(p, '[data-a=rateW][data-r=nicht]');
  const altSr = await sr();
  L.known('Zurücknehmen bei Daten ohne „letzte“ entfernt auch das Bewertungsdatum', !altSr.letzte && !altSr.bewertung, altSr);
  await p.context().close();

  // 3) Ungeplante Woche: Zeit liegt erst ab dem Fälligkeitstag (fällig Fr), nichts davor
  p = await L.open({ bloecke: { a: einheit('A', '2026-11-06', 2), b: einheit('B', '2026-11-06', 2) } }, 'sim-2026-11-02-0900');
  let v = await p.evaluate(() => window.__ls.weekWdh('2026-11-02').split);
  L.expect('vor dem Fälligkeitstag keine Wiederholungszeit', WOCHE.slice(0, 4).map((d) => v[d]), [0, 0, 0, 0]);
  L.expect('am Fälligkeitstag 2 × 15 min', v['2026-11-06'], 30);
  await p.context().close();

  // 4) Überfälliges verteilt sich über die restliche Woche, nicht alles auf heute
  const due = {}; ['a', 'b', 'c', 'd'].forEach((k, i) => { due[k] = { titel: 'Einheit ' + k, woche: '2026-10-26', tag: '2026-10-2' + (6 + i), status: 'erledigt', erledigtAm: '2026-10-2' + (6 + i), wiederholen: true, sr: { stufe: 1, faellig: i < 3 ? '2026-11-03' : '2026-11-04' } }; });
  p = await L.open({ bloecke: due }, 'sim-2026-11-04-0900', 1280);
  await L.go(p, 'woche'); await L.click(p, '[data-a=planShow]'); await L.click(p, '[data-a=planFertig]');
  v = (await L.store(p)).wochen['2026-11-02'].wdhVerteilung;
  const sum = WOCHE.reduce((a, d) => a + v[d], 0);
  L.expect('vergangene Tage bekommen nichts', [v['2026-11-02'], v['2026-11-03']], [0, 0]);
  L.ok('mindestens 4 × 15 min verteilt', sum >= 60, v);
  L.ok('heute höchstens ein Drittel (nicht alles auf heute)', v['2026-11-04'] <= sum / 3, v);
  L.ok('verteilt auf mindestens 3 Tage ab heute', WOCHE.slice(2).filter((d) => v[d] > 0).length >= 3, v);
  await p.context().close();

  // 5) Neue Einheit in geplanter Woche: morgen bekommt 15 min dazu; Haken weg nimmt sie wieder heraus
  p = await L.open({ wochen: { '2026-11-02': { status: 'fertig', wdhMin: 0, wdhVerteilung: leer() } } }, 'sim-2026-11-04-1800');
  await L.click(p, '[data-a=startAdd]'); await L.fill(p, '#neu-eintrag', 'IPR Vorlesung 3'); await L.click(p, '[data-a=addDone]'); await L.click(p, '[data-a=doAdd]');
  let s = await L.store(p);
  L.expect('Neues: morgen 15 min dazu, Woche gesamt 15', [s.wochen['2026-11-02'].wdhVerteilung['2026-11-05'], s.wochen['2026-11-02'].wdhMin], [15, 15]);
  const q = await L.open(s, 'sim-2026-11-05-0800');
  L.has('morgen steht die Einheit in der Wiederholung', await L.text(q), 'IPR Vorlesung 3');
  await q.context().close();
  await L.click(p, '[data-a=tBlock]');
  s = await L.store(p);
  L.expect('Haken weg: Zeit wieder heraus', [s.wochen['2026-11-02'].wdhVerteilung['2026-11-05'], s.wochen['2026-11-02'].wdhMin], [0, 0]);
  await p.context().close();

  // 6) Folgewiederholung von Neuem: Mo gelernt, Di „sicher“ -> Fr (Abstand 3) bekommt Zeit; Zurücknehmen nimmt sie heraus
  p = await L.open({ wochen: { '2026-11-02': { status: 'fertig', wdhMin: 0, wdhVerteilung: leer() } } }, 'sim-2026-11-02-1800');
  await L.click(p, '[data-a=startAdd]'); await L.fill(p, '#neu-eintrag', 'Rom I neu'); await L.click(p, '[data-a=addDone]'); await L.click(p, '[data-a=doAdd]');
  s = await L.store(p); await p.context().close();
  p = await L.open(s, 'sim-2026-11-03-1000');
  await L.click(p, '[data-a=wdhOpen]'); await L.click(p, '[data-a=rateW][data-r=sicher]');
  s = await L.store(p);
  L.expect('nach „sicher“ am Di: fällig Fr', Object.values(s.bloecke)[0].sr.faellig, '2026-11-06');
  L.expect('Freitag bekommt 15 min', s.wochen['2026-11-02'].wdhVerteilung['2026-11-06'], 15);
  await L.click(p, '[data-a=rateW][data-r=sicher]');
  L.expect('Zurücknehmen: Freitag wieder 0', (await L.store(p)).wochen['2026-11-02'].wdhVerteilung['2026-11-06'], 0);
  await L.click(p, '[data-a=rateW][data-r=sicher]');
  s = await L.store(p); await p.context().close();
  p = await L.open(s, 'sim-2026-11-06-0900');
  L.has('Freitag: Einheit in der Wiederholung', await L.text(p), 'Rom I neu');
});
