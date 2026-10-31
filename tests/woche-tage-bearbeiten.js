// Woche: an heute und kommenden Tagen „+ Hinzufügen“ (Lernblock, „stattdessen Termin“),
// „⋯“-Menü an Lernblöcken (Umbenennen, Auf anderen Tag legen, Zurück in „Noch offen“, Löschen), alles rückgängig.
// Selbst hingelegte Blöcke bleiben liegen: beim Ausweichen vor neuen Terminen und beim erneuten Verteilen.
const L = require('./lib');
const DO = '2026-10-29'; const FR = '2026-10-30';
const seed = {
  bloecke: { v1: { titel: 'Verteilter Block', woche: '2026-10-26', tag: DO, status: 'offen', quelle: 'claude', std: 3, reihenfolge: 1 } },
  wochen: { '2026-10-26': { status: 'uebergeben' } },
};
const blockBy = (s, titel) => Object.keys(s.bloecke).map((id) => Object.assign({ id: id }, s.bloecke[id])).find((b) => b.titel === titel);
L.run(async () => {
  const p = await L.open(seed, 'sim-2026-10-28-1000', 1280);
  await L.go(p, 'woche');
  L.expect('vergangener Tag ohne „+ Hinzufügen“', await p.locator('.day[data-k="d-2026-10-27"] [data-a=wAdd]').count(), 0);
  L.expect('kein „+ Termin“ mehr oben', await p.locator('.h2row [data-a=tfOpen]').count(), 0);

  // Lernblock am Donnerstag eintragen
  await L.click(p, '.day[data-k="d-' + DO + '"] .lbl');
  await L.click(p, '[data-a=wAdd][data-d="' + DO + '"]');
  await L.fill(p, '#w-add', 'Eigener Block'); await p.press('#w-add', 'Enter'); await p.waitForTimeout(150);
  let s = await L.store(p);
  let b = blockBy(s, 'Eigener Block');
  L.expect('Block liegt am Donnerstag', b && [b.tag, b.woche, b.status], [DO, '2026-10-26', 'offen']);
  L.has('Hinweis mit Rückgängig', await L.toast(p), 'Eingetragen am Donnerstag');
  L.ok('Feld bleibt offen für den nächsten Eintrag', await p.locator('#w-add').count() === 1);
  await L.click(p, '[data-a=undo]');
  L.ok('Rückgängig entfernt den Block', !blockBy(await L.store(p), 'Eigener Block'));
  await L.fill(p, '#w-add', 'Eigener Block'); await L.click(p, '[data-a=wAddSave]');
  const eigen = blockBy(await L.store(p), 'Eigener Block').id;

  // stattdessen Termin
  await L.click(p, '[data-a=tfOpen][data-d="' + DO + '"]');
  L.has('Terminformular im Tag', await L.text(p, '.day[data-k="d-' + DO + '"]'), 'Einmaliger Termin am Donnerstag');
  await L.fill(p, '#tf-titel', 'Sprechstunde'); await L.fill(p, '#tf-von', '08:00'); await L.fill(p, '#tf-bis', '20:00'); await L.click(p, '[data-a=tfSave]');
  s = await L.store(p);
  L.expect('Termin am Donnerstag', Object.values(s.termine).map((t) => [t.titel, t.datum]), [['Sprechstunde', DO]]);
  L.expect('eigener Block bleibt trotz vollem Tag liegen', s.bloecke[eigen].tag, DO);
  L.ok('verteilter Block weicht aus', s.bloecke.v1.tag !== DO, s.bloecke.v1.tag);

  // Menü: umbenennen
  const sel = '.day[data-k="d-' + DO + '"] [data-a=wMenu][data-id="' + eigen + '"]';
  if (!(await p.locator('.day[data-k="d-' + DO + '"] .lbl[aria-expanded="true"]').count())) await L.click(p, '.day[data-k="d-' + DO + '"] .lbl');
  await L.click(p, sel);
  await L.click(p, '[data-a=wRen][data-id="' + eigen + '"]');
  await L.fill(p, '#w-ren', 'Umbenannt'); await p.press('#w-ren', 'Enter'); await p.waitForTimeout(150);
  L.expect('umbenannt', (await L.store(p)).bloecke[eigen].titel, 'Umbenannt');

  // Menü: auf Freitag legen, rückgängig
  await L.click(p, sel);
  await L.click(p, '[data-a=wMove][data-id="' + eigen + '"][data-d="' + FR + '"]');
  s = await L.store(p);
  L.expect('liegt am Freitag, fest', [s.bloecke[eigen].tag, s.bloecke[eigen].fest], [FR, true]);
  L.has('Hinweis', await L.toast(p), 'Liegt jetzt am Freitag');
  await L.click(p, '[data-a=undo]');
  L.expect('Rückgängig: wieder Donnerstag', (await L.store(p)).bloecke[eigen].tag, DO);

  // verteilten Block von Hand legen → bleibt beim erneuten Verteilen erhalten
  const v1Tag = (await L.store(p)).bloecke.v1.tag;
  if (v1Tag) {
    if (!(await p.locator('.day[data-k="d-' + v1Tag + '"] .lbl[aria-expanded="true"]').count())) await L.click(p, '.day[data-k="d-' + v1Tag + '"] .lbl');
    await L.click(p, '.day[data-k="d-' + v1Tag + '"] [data-a=wMenu][data-id="v1"]');
    await L.click(p, '[data-a=wMove][data-id="v1"][data-d="' + FR + '"]');
  } else await p.evaluate((fr) => window.__ls.moveBlock('v1', fr), FR);
  L.expect('verteilter Block jetzt fest am Freitag', ((await L.store(p)).bloecke.v1 || {}).fest, true);
  await p.evaluate(() => window.__ls.clearPlanBlocks('2026-10-26'));
  L.expect('fester Block übersteht erneutes Verteilen', ((await L.store(p)).bloecke.v1 || {}).tag, FR);

  // Menü: zurück in „Noch offen“ und Löschen
  await L.click(p, sel);
  await L.click(p, '[data-a=wPool][data-id="' + eigen + '"]');
  L.expect('in „Noch offen“', (await L.store(p)).bloecke[eigen].tag, null);
  await L.click(p, '[data-a=undo]');
  await L.click(p, sel);
  await L.click(p, '[data-a=wDel][data-id="' + eigen + '"]');
  L.ok('gelöscht', !(await L.store(p)).bloecke[eigen]);
  await L.click(p, '[data-a=undo]');
  L.ok('Löschen rückgängig', !!(await L.store(p)).bloecke[eigen]);
  await L.noHScroll(p, 'Woche mit Menü');
});
