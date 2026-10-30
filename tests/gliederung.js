// Gliederung einfügen (Themen): Einrückung, Nummern, vorhandene Themen, vier Ebenen, Sprünge, Doppelte, Rückgängig
const L = require('./lib');
const HASH = 'sim-2026-11-04-1000';
const sel = '[data-k=thglied]';
const byName = (s, name) => Object.keys(s.themen).filter((k) => s.themen[k].name === name);
const eltern = (s, name) => { const k = byName(s, name)[0]; return k ? s.themen[k].eltern : undefined; };
const tiefe = (s, k) => { let n = 0; while (s.themen[k].eltern) { k = s.themen[k].eltern; n++; } return n; };

// Formular öffnen, Text eintragen, Unterthema wählen
async function oeffne(p, text, unter) {
  await L.go(p, 'themen');
  await L.click(p, '[data-a=thGlied]');
  if (unter !== undefined) await p.selectOption('#th-glied-unter', unter);
  if (text !== null) await L.fill(p, '#th-glied', text);
}
async function vorschau(p) { await L.click(p, '[data-a=thGliedVorschau]'); return L.text(p, '[data-k=thglied-vorschau]'); }

L.run(async () => {
  // 1) Einrückung bestimmt die Ebene; leere Zeilen und Aufzählungszeichen
  let p = await L.open({}, HASH, 1280);
  await oeffne(p, '');
  L.ok('Formular ist offen', (await p.locator(sel).count()) === 1);
  L.expect('Auswahl steht auf „Oberste Ebene“', await p.inputValue('#th-glied-unter'), '');
  await L.click(p, '[data-a=thGliedVorschau]');
  L.has('ohne Text: Hinweis', await L.toast(p), 'Füge zuerst eine Gliederung ein.');
  L.expect('ohne Text: keine Vorschau', await p.locator('[data-k=thglied-vorschau]').count(), 0);
  L.expect('ohne Vorschau: kein Anlegen-Knopf', await p.locator('[data-a=thGliedSave]').count(), 0);
  await L.fill(p, '#th-glied', 'Schuldrecht AT\n  Unmöglichkeit\n\n  Verzug\nSchuldrecht BT\n\tKaufrecht');
  const v1 = await vorschau(p);
  L.has('Vorschau: fünf neue Themen', v1, 'Vorschau: 5 neue Themen');
  L.hasNot('Vorschau: nichts vorhanden', v1, '(vorhanden)');
  L.expect('Anlegen erscheint erst nach der Vorschau', await p.locator('[data-a=thGliedSave]').count(), 1);
  await L.click(p, '[data-a=thGliedSave]');
  let s = await L.store(p);
  L.expect('5 Themen angelegt', Object.keys(s.themen).length, 5);
  const sat = byName(s, 'Schuldrecht AT')[0]; const sbt = byName(s, 'Schuldrecht BT')[0];
  L.expect('Schuldrecht AT oben', s.themen[sat].eltern, null);
  L.expect('Schuldrecht BT oben', s.themen[sbt].eltern, null);
  L.expect('Unmöglichkeit unter Schuldrecht AT', eltern(s, 'Unmöglichkeit'), sat);
  L.expect('Verzug unter Schuldrecht AT', eltern(s, 'Verzug'), sat);
  L.expect('Kaufrecht (Tab) unter Schuldrecht BT', eltern(s, 'Kaufrecht'), sbt);
  L.expect('neue Themen sind aktiv', Object.values(s.themen).every((t) => t.zustand === 'aktiv'), true);
  L.has('Hinweis nach dem Anlegen', await L.toast(p), 'Themen angelegt');
  L.expect('Formular nach dem Anlegen zu', await p.locator(sel).count(), 0);
  // Rückgängig
  await L.click(p, '.toast [data-a=undo]');
  L.expect('rückgängig: alle neuen Themen weg', Object.keys((await L.store(p)).themen).length, 0);
  await p.context().close();

  // 2) Aufzählungszeichen, Abbrechen
  p = await L.open({}, HASH, 1280);
  await oeffne(p, '- Strafrecht AT\n  • Vorsatz\n  - Fahrlässigkeit');
  await L.click(p, '[data-a=thGliedCancel]');
  L.expect('Abbrechen schließt das Formular', await p.locator(sel).count(), 0);
  L.expect('Abbrechen legt nichts an', Object.keys((await L.store(p)).themen).length, 0);
  await oeffne(p, '- Strafrecht AT\n  • Vorsatz\n  - Fahrlässigkeit');
  await vorschau(p); await L.click(p, '[data-a=thGliedSave]');
  s = await L.store(p);
  L.expect('Aufzählungszeichen entfernt', Object.values(s.themen).map((t) => t.name).sort(), ['Fahrlässigkeit', 'Strafrecht AT', 'Vorsatz']);
  L.expect('Vorsatz unter Strafrecht AT', eltern(s, 'Vorsatz'), byName(s, 'Strafrecht AT')[0]);
  await p.context().close();

  // 3) Nummern ohne Einrückung: A. > I. > 1.
  p = await L.open({}, HASH, 1280);
  await oeffne(p, 'A. Schuldrecht AT\nI. Unmöglichkeit\n1. Anfängliche\n2. Nachträgliche\nII. Verzug\nB. Schuldrecht BT\nI. Kaufrecht');
  L.has('Nummern: Vorschau 7 Themen', await vorschau(p), 'Vorschau: 7 neue Themen');
  await L.click(p, '[data-a=thGliedSave]');
  s = await L.store(p);
  const a = byName(s, 'Schuldrecht AT')[0]; const b = byName(s, 'Schuldrecht BT')[0]; const um = byName(s, 'Unmöglichkeit')[0];
  L.expect('Nummern aus dem Namen entfernt', Object.values(s.themen).map((t) => t.name).sort(), ['Anfängliche', 'Kaufrecht', 'Nachträgliche', 'Schuldrecht AT', 'Schuldrecht BT', 'Unmöglichkeit', 'Verzug']);
  L.expect('A. und B. oben', [s.themen[a].eltern, s.themen[b].eltern], [null, null]);
  L.expect('I. Unmöglichkeit unter A.', s.themen[um].eltern, a);
  L.expect('II. Verzug unter A.', eltern(s, 'Verzug'), a);
  L.expect('1. Anfängliche unter Unmöglichkeit', eltern(s, 'Anfängliche'), um);
  L.expect('2. Nachträgliche unter Unmöglichkeit', eltern(s, 'Nachträgliche'), um);
  L.expect('I. Kaufrecht unter B.', eltern(s, 'Kaufrecht'), b);
  await p.context().close();

  // 4) Unter einem vorhandenen Thema; Gleichnamiges wird weiterverwendet
  const th = { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' }, sat: { name: 'Schuldrecht AT', eltern: 'zr', zustand: 'aktiv' } };
  p = await L.open({ themen: th }, HASH, 1280);
  await oeffne(p, 'schuldrecht at\n  Verzug\nSachenrecht', 'zr');
  const v4 = await vorschau(p);
  L.has('Vorschau: zwei neue', v4, 'Vorschau: 2 neue Themen');
  L.has('Vorschau: eines vorhanden', v4, '1 schon vorhanden');
  L.has('Vorschau kennzeichnet Vorhandenes', v4, '(vorhanden)');
  await L.click(p, '[data-a=thGliedSave]');
  s = await L.store(p);
  L.expect('kein Duplikat von Schuldrecht AT (Groß/klein egal)', byName(s, 'Schuldrecht AT').length + byName(s, 'schuldrecht at').length, 1);
  L.expect('Verzug hängt unter dem vorhandenen Schuldrecht AT', eltern(s, 'Verzug'), 'sat');
  L.expect('Sachenrecht hängt unter Zivilrecht', eltern(s, 'Sachenrecht'), 'zr');
  L.expect('insgesamt 4 Themen', Object.keys(s.themen).length, 4);
  // Nur Vorhandenes: nichts zum Anlegen
  await oeffne(p, 'Schuldrecht AT', 'zr');
  L.has('nur Vorhandenes: Vorschau 0 neue', await vorschau(p), '0 neue Themen');
  L.expect('nur Vorhandenes: kein Anlegen-Knopf', await p.locator('[data-a=thGliedSave]').count(), 0);
  await p.context().close();

  // 5) Vier Ebenen: zu tiefe Zeilen eine Ebene höher
  p = await L.open({}, HASH, 1280);
  await oeffne(p, 'E1\n  E2\n    E3\n      E4\n        E5\n          E6');
  const v5 = await vorschau(p);
  L.has('Vorschau nennt die Kappung', v5, 'tiefer als vier Ebenen');
  await L.click(p, '[data-a=thGliedSave]');
  s = await L.store(p);
  L.ok('kein Thema hat mehr als 3 Vorfahren', Object.keys(s.themen).every((k) => tiefe(s, k) <= 3), Object.keys(s.themen).map((k) => tiefe(s, k)));
  L.expect('E4 ist auf der vierten Ebene', tiefe(s, byName(s, 'E4')[0]), 3);
  L.expect('E5 steht eine Ebene höher (unter E3)', eltern(s, 'E5'), byName(s, 'E3')[0]);
  await p.context().close();

  // 6) Unter einem Thema der dritten Ebene: ebenfalls höchstens vier Ebenen
  const th6 = { a: { name: 'A', eltern: null, zustand: 'aktiv' }, b: { name: 'B', eltern: 'a', zustand: 'aktiv' }, c: { name: 'C', eltern: 'b', zustand: 'aktiv' } };
  p = await L.open({ themen: th6 }, HASH, 1280);
  await oeffne(p, 'D\n  Zu tief', 'c');
  L.has('unter C: Vorschau nennt die Kappung', await vorschau(p), 'tiefer als vier Ebenen');
  await L.click(p, '[data-a=thGliedSave]');
  s = await L.store(p);
  L.ok('unter C: höchstens 3 Vorfahren', Object.keys(s.themen).every((k) => tiefe(s, k) <= 3));
  await p.context().close();

  // 7) Sprünge werden geglättet
  p = await L.open({}, HASH, 1280);
  await oeffne(p, 'Oben\n      Weit eingerückt\nZweites');
  await vorschau(p); await L.click(p, '[data-a=thGliedSave]');
  s = await L.store(p);
  L.expect('Sprung: Weit eingerückt direkt unter Oben', eltern(s, 'Weit eingerückt'), byName(s, 'Oben')[0]);
  L.expect('Zweites bleibt oben', eltern(s, 'Zweites'), null);
  await p.context().close();

  p = await L.open({}, HASH, 1280);
  await oeffne(p, 'A\n  B\n      C\n  D');
  await vorschau(p); await L.click(p, '[data-a=thGliedSave]');
  s = await L.store(p);
  L.expect('Sprung zwei Ebenen: C unter B', eltern(s, 'C'), byName(s, 'B')[0]);
  L.expect('danach D wieder unter A', eltern(s, 'D'), byName(s, 'A')[0]);
  await p.context().close();

  // 8) Doppelte Zeilen im selben Eltern-Thema
  p = await L.open({}, HASH, 1280);
  await oeffne(p, 'Recht\n  Verzug\n  Verzug\n  verzug\nRecht');
  L.has('Doppelte: Vorschau zählt einmal', await vorschau(p), 'Vorschau: 2 neue Themen');
  await L.click(p, '[data-a=thGliedSave]');
  s = await L.store(p);
  L.expect('Doppelte: nur zwei Themen', Object.keys(s.themen).length, 2);
  L.expect('Doppelte: ein Verzug unter Recht', byName(s, 'Verzug').length, 1);
  await p.context().close();
});
