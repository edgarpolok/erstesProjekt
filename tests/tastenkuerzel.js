// Tastenkürzel: gelten nur, wenn der Fokus nicht in einem Eingabefeld liegt
const L = require('./lib');
const HASH = 'sim-2026-11-04-1000';
const view = (p) => p.evaluate(() => window.__ls.S.view);
const aktiv = (p) => p.evaluate(() => document.activeElement && document.activeElement.id);
const taste = async (p, k) => { await p.keyboard.press(k); await p.waitForTimeout(200); };
const frei = (p) => p.click('h1').catch(() => {});

L.run(async () => {
  // 1) Ziffern wechseln die Ansicht
  let p = await L.open({}, HASH, 1280);
  await frei(p);
  for (const [k, v] of [['2', 'woche'], ['3', 'kalender'], ['4', 'themen'], ['1', 'heute']]) {
    await taste(p, k);
    L.expect('Taste ' + k + ' öffnet ' + v, await view(p), v);
  }

  // 2) ? öffnet die Übersicht, Esc und Knopf schließen sie
  const dlg = '[role=dialog][aria-label="Tastenkürzel"]';
  L.expect('Übersicht anfangs zu', await p.$(dlg), null);
  await taste(p, '?');
  L.ok('? öffnet die Übersicht', (await p.$(dlg)) !== null);
  L.has('Übersicht nennt „Themen durchsuchen“', await L.text(p, dlg), 'Themen durchsuchen');
  await taste(p, 'Escape');
  L.expect('Esc schließt die Übersicht', await p.$(dlg), null);
  await taste(p, '?');
  await L.click(p, '[data-a=keysClose]');
  L.expect('Knopf „Schließen“ schließt die Übersicht', await p.$(dlg), null);
  L.expect('kein Knopf „? Tastenkürzel“ in der Seitenleiste', await p.locator('.side [data-a=keysOpen]').count(), 0);
  await p.context().close();

  // 3) n: neuer Eintrag in Heute mit Fokus im Feld
  p = await L.open({}, HASH, 1280);
  await L.go(p, 'themen');
  await frei(p);
  await taste(p, 'n');
  L.expect('n wechselt zu Heute', await view(p), 'heute');
  L.expect('n setzt den Fokus ins Eingabefeld', await aktiv(p), 'neu-eintrag');
  await p.keyboard.type('Sachenrecht Einführung');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  const titel = Object.values((await L.store(p)).bloecke).map((b) => b.titel);
  L.expect('Enter legt den Block an', titel, ['Sachenrecht Einführung']);
  await p.context().close();

  // 4) t: freier Timer starten und stoppen
  p = await L.open({}, HASH, 1280);
  await frei(p);
  await taste(p, 't');
  let s = await L.store(p);
  L.expect('t startet den Timer', s.meta.timer && s.meta.timer.laeuft, true);
  L.expect('Timer ist ein freier Timer', s.meta.timer && s.meta.timer.art, 'f');
  await L.sim(p, '2026-11-04', 10 * 60 + 20);
  await frei(p);
  await taste(p, 't');
  s = await L.store(p);
  L.ok('zweites t stoppt den Timer', !(s.meta.timer && s.meta.timer.laeuft), s.meta.timer);
  const frei20 = Object.values(s.bloecke).filter((b) => b.titel === 'Freie Lernzeit');
  L.expect('Block „Freie Lernzeit“ mit 20 min', frei20.map((b) => b.zeit), [20]);
  await p.context().close();

  // 5) /: Themen durchsuchen
  p = await L.open({}, HASH, 1280);
  await frei(p);
  await taste(p, '/');
  L.expect('/ öffnet Themen', await view(p), 'themen');
  L.expect('/ setzt den Fokus in die Suche', await aktiv(p), 'th-q');
  await p.context().close();

  // 6) Cmd+Z macht die letzte Aktion rückgängig
  p = await L.open({}, HASH, 1280);
  await L.go(p, 'themen');
  await L.click(p, '[data-a=thNew]');
  await L.fill(p, '#th-new', 'Strafrecht');
  await L.click(p, '[data-a=thNewSave]');
  L.expect('Thema angelegt', Object.values((await L.store(p)).themen).map((t) => t.name || t.titel), ['Strafrecht']);
  await frei(p);
  await taste(p, 'Meta+z');
  L.expect('Cmd+Z nimmt das Thema zurück', Object.keys((await L.store(p)).themen || {}).length, 0);
  await p.context().close();

  // 7) Beim Tippen in ein Feld lösen Tasten nichts aus
  p = await L.open({}, HASH, 1280);
  await L.click(p, '[data-a=startAdd]');
  await p.click('#neu-eintrag');
  await p.keyboard.type('2t');
  await p.waitForTimeout(200);
  L.expect('Ansicht bleibt Heute', await view(p), 'heute');
  L.expect('kein Timer gestartet', !!((await L.store(p)).meta || {}).timer && (await L.store(p)).meta.timer.laeuft === true, false);
  L.expect('Feldinhalt „2t“', await p.inputValue('#neu-eintrag'), '2t');
  await p.context().close();

  // 8) Einstellungen zeigen alle Kürzel
  p = await L.open({}, HASH, 1280);
  await L.go(p, 'einstellungen');
  const t = await L.text(p, '[aria-label="Tastenkürzel"]');
  for (const x of ['Neuer Eintrag in Heute', 'Themen durchsuchen', '⌘ Z', 'Timer starten', 'Diese Übersicht öffnen']) L.has('Einstellungen nennen: ' + x, t, x);
  await p.context().close();
});
