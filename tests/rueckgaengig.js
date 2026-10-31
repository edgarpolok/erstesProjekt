// Datenändernde Aktionen sind 5 Sekunden lang rückgängig zu machen; Abhaken und Bewerten nimmt man durch nochmaliges Tippen zurück.
// Nachfrage vor dem Löschen gibt es nur bei Themen (prüft themen.js); alles andere Löschen ist rückgängig zu machen.
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

// Aktionen mit „Rückgängig“; mit nochmal: statt Rückgängig durch nochmaliges Tippen zurückzunehmen
const AKTIONEN = [
  { name: 'Block löschen', schritte: async (p) => { await L.click(p, menu('bb1')); await L.click(p, '[data-a=delB][data-id=b1]'); } },
  { name: 'Block-Text ändern', schritte: async (p) => { await L.click(p, menu('bb1')); await L.click(p, '[data-a=editB][data-id=b1]'); await L.fill(p, '#name-b1', 'Neuer Text'); await L.click(p, '[data-a=saveB][data-id=b1]'); } },
  { name: 'Block zurück in die Woche', schritte: async (p) => { await L.click(p, menu('bb1')); await L.click(p, '[data-a=backWeek][data-id=b1]'); } },
  { name: 'Termin fällt heute aus', schritte: async (p) => { await L.click(p, menu('tt1')); await L.click(p, '[data-a=cancelTermin]'); } },
  { name: 'Routine heute auslassen', schritte: async (p) => { await L.click(p, menu('rr1')); await L.click(p, '[data-a=skipR]'); } },
  { name: 'Wiederholung später (zurück in „Noch offen“)', schritte: async (p) => { await L.click(p, '[data-a=menu][data-m="w2026-11-05~e.e1"]'); await L.click(p, '[data-a=laterW][data-ref="e:e1"]'); } },
  { name: 'Block in „Noch offen“ zurücklegen (Woche)', w: 1280, schritte: async (p) => { await L.go(p, 'woche'); await L.click(p, '[data-a=pushB][data-id=b1]'); } },
  { name: 'Pause löschen (Kalender)', w: 1280, schritte: async (p) => { await L.go(p, 'kalender'); await L.click(p, '[data-a=kEdit][data-id=pa]'); await L.click(p, '[data-a=kDel]'); } },
  { name: 'Routine entfernen (Einstellungen)', w: 1280, schritte: async (p) => { await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esREdit][data-id=r1]'); await L.click(p, '[data-a=esRDel]'); } },
  { name: 'Termin entfernen (Einstellungen)', w: 1280, schritte: async (p) => { await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esTEdit][data-id=t1]'); await L.click(p, '[data-a=esTDel]'); } },
  { name: 'Vorhaben entfernen (Planung)', w: 1280, schritte: async (p) => { await L.go(p, 'woche'); await L.click(p, '[data-a=wkNext]'); await L.click(p, '[data-a=vMore][data-id=v1]').catch(() => {}); await L.click(p, '[data-a=vDel][data-id=v1]'); } },
  { name: 'Thema pausieren', w: 1280, schritte: async (p) => { await L.go(p, 'themen'); await L.click(p, '[data-a=thSel][data-id=zr]'); await L.click(p, '[data-a=thZ][data-v=pausiert]'); } },
  { name: 'Termin im Kalender eintragen', w: 1280, schritte: async (p) => { await L.go(p, 'kalender'); await L.click(p, '.kal button.cell[data-d="2026-11-10"]'); await L.fill(p, '#k-name', 'Neu'); await L.fill(p, '#k-t-von', '09:00'); await L.click(p, '[data-a=kSave]'); } },
  { name: 'Termin aus der Woche eintragen', w: 1280, schritte: async (p) => { await L.go(p, 'woche'); await L.click(p, '[data-a=tfOpen]'); await L.fill(p, '#tf-titel', 'Neu'); await L.fill(p, '#tf-von', '15:00'); await L.click(p, '[data-a=tfSave]'); } },
  // Abhaken und Bewerten: nochmal tippen nimmt es zurück
  { name: 'Block abhaken', nochmal: '[data-a=tBlock][data-id=b1]', zurueck: (s) => s.bloecke.b1.status === 'offen' && !s.bloecke.b1.erledigtAm && !s.bloecke.b1.sr, schritte: async (p) => { await L.click(p, '[data-a=tBlock][data-id=b1]'); } },
  { name: 'Termin abhaken', nochmal: '[data-a=tTermin][data-id=t1]', zurueck: (s) => !s.tage['2026-11-05'].termine.t1.erledigt, schritte: async (p) => { await L.click(p, '[data-a=tTermin][data-id=t1]'); } },
  { name: 'Routine abhaken', nochmal: '[data-a=tRoutine][data-id=r1]', zurueck: (s) => !s.tage['2026-11-05'].routinen.r1.erledigt, schritte: async (p) => { await L.click(p, '[data-a=tRoutine][data-id=r1]'); } },
  { name: 'Wiederholung bewerten', nochmal: '[data-a=rateW][data-r=sicher]', zurueck: (s, v) => L.same(s.bloecke.e1.sr, v.bloecke.e1.sr) && !s.tage['2026-11-05'].wdh.bew['e:e1'].r, schritte: async (p) => { await L.click(p, '[data-a=rateW][data-r=sicher]'); } },
  { name: 'Stellschraube ändern', w: 1280, schritte: async (p) => { await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esOpen][data-v=ober]'); await L.click(p, '[data-a=esStep][data-d="0.5"]'); } }
];

L.run(async () => {
  for (const a of AKTIONEN) {
    const p = await L.open(seed, H, a.w || 420);
    const vor = await L.store(p);
    await a.schritte(p);
    const nach = await L.store(p);
    L.ok(a.name + ': ändert Daten', !L.same(vor, nach));
    if (a.nochmal) {
      await L.click(p, a.nochmal);
      const s = await L.store(p); // es bleiben leere Felder (null/false) zurück, wirksam ist es der alte Stand
      L.ok(a.name + ': nochmal tippen nimmt es zurück', a.zurueck(s, vor), L.diff(vor, s));
    } else {
      const hatUndo = (await p.locator('.toast [data-a=undo]').count()) === 1;
      L.ok(a.name + ': „Rückgängig“ wird angeboten', hatUndo, await L.toast(p));
      if (hatUndo) {
        await L.click(p, '.toast [data-a=undo]');
        L.ok(a.name + ': Rückgängig stellt den alten Stand her', L.same(await L.store(p), vor), L.diff(vor, await L.store(p)));
      }
    }
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
