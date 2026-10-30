// Jede datenändernde Aktion geht über undoable(...) und ist 5 Sekunden lang rückgängig zu machen; Löschen fragt vorher nach
const L = require('./lib');

const H = 'sim-2026-11-05-1000'; // Donnerstag
const seed = {
  bloecke: {
    b1: { titel: 'Block heute', woche: '2026-11-02', tag: '2026-11-05', status: 'offen', quelle: 'claude', std: 2, erstellt: 1 },
    b2: { titel: 'Block erledigt', woche: '2026-11-02', tag: '2026-11-05', status: 'erledigt', erledigtAm: '2026-11-05', zeit: 30, wiederholen: false, quelle: 'frei', erstellt: 2 },
    p1: { titel: 'Block noch offen', woche: '2026-11-02', tag: null, status: 'offen', quelle: 'liste', std: 1, erstellt: 3 },
    e1: { titel: 'Fällige Einheit', woche: '2026-10-26', tag: '2026-10-28', status: 'erledigt', erledigtAm: '2026-10-28', wiederholen: true, sr: { stufe: 2, faellig: '2026-11-05', letzte: '2026-11-02', bewertung: 'sicher' }, erstellt: 4 }
  },
  routinen: { r1: { titel: 'Sport', haeufigkeit: { art: 'taeglich' }, zustand: 'aktiv', reihenfolge: 1 } },
  termine: { t1: { titel: 'Vorlesung', wochentage: [3], von: '10:00', bis: '12:00', zustand: 'aktiv' } },
  pausen: { pa: { name: 'Urlaub', art: 'frei', von: '2026-12-21', bis: '2026-12-27' } },
  vorhaben: { v1: { name: 'Vorhaben nächste Woche', std: 6, ab: '2026-11-09', wochen: 1, reihenfolge: 1 } },
  themen: { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' } }
};
const menu = (k) => '[data-a=menu][data-m=' + k + ']';

// Aktionen, die laut Regel rückgängig zu machen sein müssen. bekannt: weicht in der App ab (gemeldet, noch nicht entschieden)
const AKTIONEN = [
  { name: 'Block löschen', del: true, schritte: async (p) => { await L.click(p, menu('bb1')); await L.click(p, '[data-a=delB][data-id=b1]'); } },
  { name: 'Block-Text ändern', schritte: async (p) => { await L.click(p, menu('bb1')); await L.click(p, '[data-a=editB][data-id=b1]'); await L.fill(p, '#name-b1', 'Neuer Text'); await L.click(p, '[data-a=saveB][data-id=b1]'); } },
  { name: 'Block zurück in die Woche', schritte: async (p) => { await L.click(p, menu('bb1')); await L.click(p, '[data-a=backWeek][data-id=b1]'); } },
  { name: 'Termin fällt heute aus', schritte: async (p) => { await L.click(p, menu('tt1')); await L.click(p, '[data-a=cancelTermin]'); } },
  { name: 'Routine heute auslassen', schritte: async (p) => { await L.click(p, menu('rr1')); await L.click(p, '[data-a=skipR]'); } },
  { name: 'Wiederholung heute auslassen', schritte: async (p) => { await L.click(p, '[data-a=wdhMenu]'); await L.click(p, '[data-a=dropWdh]'); } },
  { name: 'Block in „Noch offen“ zurücklegen (Woche)', w: 1280, schritte: async (p) => { await L.go(p, 'woche'); await L.click(p, '[data-a=pushB][data-id=b1]'); } },
  { name: 'Pause löschen (Kalender)', del: true, w: 1280, schritte: async (p) => { await L.go(p, 'kalender'); await L.click(p, '[data-a=kEdit][data-id=pa]'); await L.click(p, '[data-a=kDel]'); } },
  { name: 'Routine entfernen (Einstellungen)', del: true, w: 1280, schritte: async (p) => { await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esREdit][data-id=r1]'); await L.click(p, '[data-a=esRDel]'); } },
  { name: 'Termin entfernen (Einstellungen)', del: true, w: 1280, schritte: async (p) => { await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esTEdit][data-id=t1]'); await L.click(p, '[data-a=esTDel]'); } },
  { name: 'Vorhaben entfernen (Planung)', del: true, w: 1280, schritte: async (p) => { await L.go(p, 'woche'); await L.click(p, '[data-a=wkNext]'); await L.click(p, '[data-a=vMore][data-id=v1]').catch(() => {}); await L.click(p, '[data-a=vDel][data-id=v1]'); } },
  { name: 'Thema pausieren', w: 1280, schritte: async (p) => { await L.go(p, 'themen'); await L.click(p, '[data-a=thSel][data-id=zr]'); await L.click(p, '[data-a=thZ][data-v=pausiert]'); } },
  { name: 'Termin im Kalender eintragen', w: 1280, schritte: async (p) => { await L.go(p, 'kalender'); await L.click(p, '.kal button.cell[data-d="2026-11-10"]'); await L.fill(p, '#k-name', 'Neu'); await L.fill(p, '#k-t-von', '09:00'); await L.click(p, '[data-a=kSave]'); } },
  // Alltagsaktionen auf Heute ohne Rückgängig: Regel aus CLAUDE.md nicht erfüllt, Entscheidung beim Nutzer
  { name: 'Block abhaken', bekannt: true, schritte: async (p) => { await L.click(p, '[data-a=tBlock][data-id=b1]'); } },
  { name: 'Eintrag hinzufügen', bekannt: true, schritte: async (p) => { await L.click(p, '[data-a=startAdd]'); await L.fill(p, '#neu-eintrag', 'Neu'); await L.click(p, '[data-a=doAdd]'); } },
  { name: 'Zeit eintragen', bekannt: true, schritte: async (p) => { await L.click(p, '[data-a=openT][data-ref="b:b2"]'); await L.fill(p, '[data-in=zeit]', '0:45'); await L.click(p, '[data-a=saveT]'); } },
  { name: 'Termin abhaken', bekannt: true, schritte: async (p) => { await L.click(p, '[data-a=tTermin][data-id=t1]'); } },
  { name: 'Routine abhaken', bekannt: true, schritte: async (p) => { await L.click(p, '[data-a=tRoutine][data-id=r1]'); } },
  { name: 'Wiederholung bewerten', bekannt: true, schritte: async (p) => { await L.click(p, '[data-a=wdhOpen]'); await L.click(p, '[data-a=rateW][data-r=sicher]'); } },
  { name: '„+ Heute“ aus „Noch offen“', bekannt: true, schritte: async (p) => { await L.click(p, '[data-a=poolOpen]'); await L.click(p, '[data-a=pull][data-id=p1]'); } },
  { name: 'Termin aus der Woche eintragen', bekannt: true, w: 1280, schritte: async (p) => { await L.go(p, 'woche'); await L.click(p, '[data-a=tfOpen]'); await L.fill(p, '#tf-titel', 'Neu'); await L.fill(p, '#tf-von', '15:00'); await L.click(p, '[data-a=tfSave]'); } },
  { name: 'Stellschraube ändern', w: 1280, schritte: async (p) => { await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esOpen][data-v=ober]'); await L.click(p, '[data-a=esStep][data-d="0.5"]'); } }
];

L.run(async () => {
  for (const a of AKTIONEN) {
    const p = await L.open(seed, H, a.w || 420);
    const vor = await L.store(p);
    await a.schritte(p);
    const nach = await L.store(p);
    L.ok(a.name + ': ändert Daten', !L.same(vor, nach));
    const hatUndo = (await p.locator('.toast [data-a=undo]').count()) === 1;
    if (a.bekannt) L.known(a.name + ': „Rückgängig“ wird angeboten', hatUndo);
    else L.ok(a.name + ': „Rückgängig“ wird angeboten', hatUndo, await L.toast(p));
    if (hatUndo) {
      await L.click(p, '.toast [data-a=undo]');
      L.ok(a.name + ': Rückgängig stellt den alten Stand her', L.same(await L.store(p), vor), L.diff(vor, await L.store(p)));
    }
    if (a.del) L.known(a.name + ': fragt vor dem Löschen nach', L.same(nach, vor));
    await p.context().close();
  }

  // 5 Sekunden: bei 4,5 s noch da, bei 5,5 s weg
  const p = await L.open(seed, H);
  await L.click(p, menu('bb1')); await L.click(p, '[data-a=delB][data-id=b1]');
  await p.waitForTimeout(4300);
  L.expect('nach 4,5 s: Rückgängig noch da', await p.locator('.toast [data-a=undo]').count(), 1);
  await p.waitForTimeout(1000);
  L.expect('nach 5,5 s: Rückgängig weg', await p.locator('.toast [data-a=undo]').count(), 0);
  L.ok('Block bleibt gelöscht', !(await L.store(p)).bloecke.b1);
});
