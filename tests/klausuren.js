// Klausuren: eintragen (Kalender, Woche), Lernblöcke weichen aus, Heute, Punkte und Schnitt in der Statistik, Fehler in die Wiederholung
const L = require('./lib');

const THEMEN = { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' }, sr: { name: 'Strafrecht', eltern: null, zustand: 'aktiv' } };
const klausur = (titel, datum, gebiet, extra) => Object.assign({ titel, datum, von: '09:00', bis: '14:00', ganztags: false, art: 'klausur', gebiet }, extra || {});
const klausuren = async (p) => Object.entries((await L.store(p)).termine).filter(([, t]) => t.art === 'klausur');

L.run(async () => {
  // 1) Eintragen im Kalender
  let p = await L.open({ themen: THEMEN }, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'kalender');
  await L.click(p, '[data-a=kNew][data-kl="1"]');
  L.expect('Klausur-Schalter ist an', await p.getAttribute('[data-a=kKlausur]', 'aria-checked'), 'true');
  L.expect('Beginn vorbelegt', await p.inputValue('#k-t-von'), '09:00');
  L.expect('Ende vorbelegt', await p.inputValue('#k-t-bis'), '14:00');
  await L.fill(p, '#k-name', 'Zivilrecht Probeklausur'); await L.fill(p, '#k-datum', '2026-11-20');
  await L.click(p, '[data-a=kGeb][data-g=zr]'); await L.click(p, '[data-a=kSave]');
  let kl = await klausuren(p);
  L.expect('eine Klausur gespeichert', kl.length, 1);
  const k = kl[0] ? kl[0][1] : {};
  L.expect('Klausur: Art, Gebiet, Tag, Zeit', [k.titel, k.art, k.gebiet, k.datum, k.von, k.bis], ['Zivilrecht Probeklausur', 'klausur', 'zr', '2026-11-20', '09:00', '14:00']);
  L.has('Liste zeigt das Schildchen „Klausur“', await L.text(p, '#k-termine'), 'Klausur');
  L.has('Liste zeigt den Titel', await L.text(p, '#k-termine'), 'Zivilrecht Probeklausur');
  await p.context().close();

  // 2) Lernblöcke weichen aus, die Klausur verrutscht nicht
  const wo = { '2026-11-09': { status: 'uebergeben', wdhMin: 0, wdhVerteilung: {} } };
  p = await L.open({ themen: THEMEN, wochen: wo, bloecke: { b1: { titel: 'Vorhaben', woche: '2026-11-09', tag: '2026-11-12', status: 'offen', quelle: 'claude', std: 4 } } }, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'kalender');
  await L.click(p, '[data-a=kNew][data-kl="1"]');
  await L.fill(p, '#k-name', 'Strafrecht Klausur'); await L.fill(p, '#k-datum', '2026-11-12'); await L.click(p, '[data-a=kSave]');
  let s = await L.store(p);
  L.ok('Lernblock weicht vom Klausurtag aus', s.bloecke.b1.tag !== '2026-11-12', s.bloecke.b1.tag);
  kl = await klausuren(p);
  L.expect('Klausur bleibt am 12.11. 09:00–14:00', kl.map(([, t]) => [t.datum, t.von, t.bis]), [['2026-11-12', '09:00', '14:00']]);
  // 3) Heute am Klausurtag
  await L.sim(p, '2026-11-12', 8 * 60); await L.go(p, 'heute');
  const heute = await L.text(p);
  L.has('Heute zeigt den Klausurtitel', heute, 'Strafrecht Klausur');
  L.has('Heute zeigt „Klausur“', heute, 'Klausur');
  await p.context().close();

  // 4) Aus der Woche eintragen, Rückgängig
  p = await L.open({}, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'woche'); await L.click(p, '[data-a=wAdd]'); await L.click(p, '[data-a=tfOpen]');
  await L.fill(p, '#tf-titel', 'Öffentliches Recht'); await L.fill(p, '#tf-von', '10:00');
  await L.click(p, '[data-a=tGanz][data-k=tfKlausur]'); await L.click(p, '[data-a=tfSave]');
  kl = await klausuren(p);
  L.expect('Klausur aus der Woche gespeichert', kl.map(([, t]) => t.titel), ['Öffentliches Recht']);
  await L.click(p, '.toast [data-a=undo]');
  L.expect('Rückgängig entfernt die Klausur', (await klausuren(p)).length, 0);
  await p.context().close();

  // 5) Statistik ohne und mit Klausuren
  p = await L.open({}, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'kalender'); await L.click(p, '[data-a=kTab][data-v=zahlen]');
  L.has('Ohne Klausuren: Hinweis', await L.text(p, '[aria-label=Klausuren]'), 'Trag Klausuren im Kalender');
  await p.context().close();

  p = await L.open({ themen: THEMEN, termine: { k1: klausur('Klausur Zivilrecht', '2026-11-03', 'zr'), kz: klausur('Klausur kommende', '2026-11-25', 'zr') } }, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'kalender'); await L.click(p, '[data-a=kTab][data-v=zahlen]');
  let t = await L.text(p, '[aria-label=Klausuren]');
  L.has('Ohne Ergebnis: Korrektur steht aus', t, 'Korrektur steht aus');
  L.has('Knopf „Punkte eintragen“', await L.text(p, '[data-a=klOpen][data-id=k1]'), 'Punkte eintragen');
  L.hasNot('Zukünftige Klausur erscheint nicht', t, 'Klausur kommende');
  const vorher = await L.store(p);
  // ungültige Punkte
  await L.click(p, '[data-a=klOpen][data-id=k1]');
  for (const v of ['19', '7.5', '-1']) {
    await L.fill(p, '#kl-punkte', v); await L.click(p, '[data-a=klSave][data-id=k1]');
    L.has('Fehlermeldung bei ' + v, await L.text(p, '[aria-label=Klausuren]'), 'Punkte bitte als ganze Zahl von 0 bis 18.');
    L.expect('bei ' + v + ' nichts gespeichert', (await L.store(p)).termine.k1.ergebnis, vorher.termine.k1.ergebnis);
  }
  // gültige Punkte
  await L.fill(p, '#kl-punkte', '9'); await L.click(p, '[data-a=klSave][data-id=k1]');
  L.expect('Punkte gespeichert', (await L.store(p)).termine.k1.ergebnis.punkte, 9);
  t = await L.text(p, '[aria-label=Klausuren]');
  L.has('Liste zeigt „9 P.“', t, '9 P.');
  const sch = await L.text(p, '[data-k=kl-schnitt]');
  L.has('Schnitt-Zeile: Gebiet und Anzahl', sch, 'Zivilrecht · 1 Klausur');
  L.has('Schnitt-Zeile: Schnitt', sch, 'Schnitt 9 P.');
  L.expect('bei nur einer Wertung kein Verlauf', await p.locator('[data-k=kl-verlauf]').count(), 0);
  // Rückgängig stellt den alten Stand her
  await L.click(p, '.toast [data-a=undo]');
  L.expect('Rückgängig stellt Stand vor dem Speichern her', (await L.store(p)).termine.k1.ergebnis, vorher.termine.k1.ergebnis);
  // ohne Korrektur
  await L.click(p, '[data-a=klOpen][data-id=k1]'); await L.click(p, '[data-a=tGanz][data-k=klOhne]'); await L.click(p, '[data-a=klSave][data-id=k1]');
  const erg = (await L.store(p)).termine.k1.ergebnis;
  L.expect('ohne Korrektur gespeichert', [erg.punkte, erg.ohne], [null, true]);
  L.has('Liste zeigt „ohne Korrektur“', await L.text(p, '[aria-label=Klausuren]'), 'ohne Korrektur');
  await p.context().close();

  // Schnitt mit mehreren Klausuren, Verlauf
  p = await L.open({ themen: THEMEN, termine: {
    a: klausur('Zivil A', '2026-10-05', 'zr', { ergebnis: { punkte: 6, ohne: false, am: '2026-10-20' } }),
    b: klausur('Zivil B', '2026-10-12', 'zr', { ergebnis: { punkte: 9, ohne: false, am: '2026-10-25' } }),
    c: klausur('Straf C', '2026-10-19', 'sr', { ergebnis: { punkte: 12, ohne: false, am: '2026-11-01' } }) } }, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'kalender'); await L.click(p, '[data-a=kTab][data-v=zahlen]');
  const sc = await L.text(p, '[data-k=kl-schnitt]');
  L.has('Zivilrecht: Schnitt mit Komma', sc, 'Schnitt 7,5 P.');
  L.has('Zivilrecht: 2 Klausuren', sc, 'Zivilrecht · 2 Klausuren');
  L.has('Strafrecht: Schnitt', sc, 'Schnitt 12 P.');
  L.expect('Verlauf vorhanden', await p.locator('svg[data-k=kl-verlauf]').count(), 1);
  L.expect('Verlauf hat 3 Punkte', await p.locator('[data-k=kl-verlauf] circle').count(), 3);
  const svg = await p.innerHTML('[data-k=kl-verlauf]');
  L.ok('Verlauf ohne rote Farbe', !/red|#f00|#e00|rgb\(\s*2\d\d,\s*\d{1,2},/i.test(svg), svg.slice(0, 120));
  await p.context().close();

  // 6) Fehler notieren und in die Wiederholung legen
  p = await L.open({ themen: THEMEN, termine: { k1: klausur('Klausur Zivilrecht', '2026-11-03', 'zr') } }, 'sim-2026-11-10-1000', 1280);
  await L.go(p, 'kalender'); await L.click(p, '[data-a=kTab][data-v=zahlen]');
  await L.click(p, '[data-a=klOpen][data-id=k1]');
  await L.fill(p, '#kl-fehler', 'Anspruchsgrundlage übersehen'); await L.click(p, '[data-a=klFAdd][data-id=k1]');
  L.expect('Fehlerzeile gespeichert', (await L.store(p)).termine.k1.fehler, [{ text: 'Anspruchsgrundlage übersehen', block: null }]);
  await L.fill(p, '#kl-fehler', 'Frist falsch'); await L.click(p, '[data-a=klFAdd][data-id=k1]');
  await L.click(p, '[data-a=klWdh][data-id=k1][data-i="0"]');
  s = await L.store(p);
  const bid = s.termine.k1.fehler[0].block;
  const b = s.bloecke[bid] || {};
  L.ok('Fehler zeigt auf einen Block', !!bid && !!s.bloecke[bid], bid);
  L.expect('Block: Titel, Status, Tag, Quelle', [b.titel, b.status, b.tag, b.quelle], ['Klausur Zivilrecht: Anspruchsgrundlage übersehen', 'erledigt', null, 'klausur']);
  L.expect('Block: Stufe 1, fällig morgen', [b.sr && b.sr.stufe, b.sr && b.sr.faellig], [1, '2026-11-11']);
  L.has('Zeile zeigt „in der Wiederholung“', await L.text(p, '[data-k=klf-0]'), 'in der Wiederholung');
  L.ok('Wiederholungsliste enthält den Block', await p.evaluate((r) => window.__ls.srItems().some((i) => i.ref === r), 'e:' + bid));
  // Rückgängig
  await L.click(p, '.toast [data-a=undo]');
  s = await L.store(p);
  L.expect('Rückgängig: Block weg', Object.keys(s.bloecke).length, 0);
  L.expect('Rückgängig: Verknüpfung weg', s.termine.k1.fehler[0].block, null);
  // Zeile entfernen
  await L.click(p, '[data-a=klFDel][data-id=k1][data-i="1"]');
  L.expect('Fehlerzeile entfernt', (await L.store(p)).termine.k1.fehler.map((f) => f.text), ['Anspruchsgrundlage übersehen']);
  await p.context().close();
});
