// Extreme und kaputte Einstellungen: Verteilung bleibt in den Grenzen, nichts geht verloren, Ansichten bleiben heil
const L = require('../lib');
const AUFGREIFEN = / kurz aufgreifen$/;
const base = { bloecke: { y: { titel: 'Einheit', woche: '2026-10-19', tag: '2026-10-20', status: 'erledigt', erledigtAm: '2026-10-20', wiederholen: true, sr: { stufe: 5, faellig: '2026-10-29', letzte: '2026-10-20', bewertung: 'sicher' } } },
  termine: { t: { titel: 'Langer Termin', datum: '2026-10-29', von: '08:00', bis: '18:00' } }, vorhaben: { v: { name: 'V groß', std: 12, ab: '2026-11-02', wochen: 1 }, v2: { name: 'V klein', std: 1, ab: '2026-11-02', wochen: 1 } } };
const CFGS = {
  einAbstand: { abstaende: [5], maxAbstand: 5 },
  einBlockEineStunde: { bloeckeProTag: 1, obergrenze: 1 },
  alleTageFrei: { tagesumfang: ['frei', 'frei', 'frei', 'frei', 'frei', 'frei', 'frei'] },
  pufferSonntag: { pufferTag: 6 },
  nullStunden: { obergrenze: 0, zeitKurz: 0 },
  kaputt: { abstaende: 'x', tagesumfang: [1, 2], pufferTag: 99, bloeckeProTag: 'a', obergrenze: -5 }
};

L.run(async () => {
  for (const k of Object.keys(CFGS)) {
    const seed = JSON.parse(JSON.stringify(base)); seed.meta = { config: CFGS[k] };
    const p = await L.open(seed, 'sim-2026-10-31-1000', 1280);
    for (const v of ['heute', 'woche', 'kalender', 'themen', 'einstellungen']) await L.go(p, v);
    await L.go(p, 'woche'); await L.click(p, '[data-a=wkNext]');
    const cap = await p.evaluate(() => window.__ls.capacity2('2026-11-02'));
    const c = await p.evaluate(() => window.__ls.cfg());
    if (await p.$('[data-a=planClaude]')) { await L.click(p, '[data-a=planClaude]'); await p.waitForTimeout(300); }
    const plan = Object.values((await L.store(p)).bloecke).filter((b) => b.vorhaben);
    const proTag = {}; const anz = {};
    plan.forEach((b) => { if (b.tag) { proTag[b.tag] = (proTag[b.tag] || 0) + b.std; anz[b.tag] = (anz[b.tag] || 0) + 1; } });
    L.ok(k + ': kein Tag über seiner Kapazität', Object.keys(proTag).every((d) => proTag[d] <= (cap[d] || 0) + 0.5 + 1e-9), { proTag, cap });
    L.ok(k + ': höchstens so viele Blöcke pro Tag wie eingestellt (+ kurz aufgreifen)', Object.keys(anz).every((d) => anz[d] <= c.bloeckeProTag + 1), anz);
    for (const [name, std] of [['V groß', 12], ['V klein', 1]]) L.expect(k + ': „' + name + '“ vollständig (verteilt oder in „Noch offen“)', plan.filter((b) => b.titel === name).reduce((a, b) => a + b.std, 0), std);
    L.ok(k + ': kaputte Werte werden auf gültige gesetzt', Array.isArray(c.abstaende) && c.abstaende.length > 0 && c.tagesumfang.length === 7 && c.bloeckeProTag >= 1 && c.bloeckeProTag <= 10 && c.pufferTag >= 0 && c.pufferTag <= 6, c);
    if (k === 'alleTageFrei' || k === 'nullStunden') L.expect(k + ': ohne Kapazität kein Block an einem Tag', plan.filter((b) => b.tag && !AUFGREIFEN.test(b.titel)).length, 0);
    await p.context().close();
  }
  // Nur ein Abstand (5 Tage): „sicher“ bleibt auf Stufe 1 mit 5 Tagen
  let seed = JSON.parse(JSON.stringify(base)); delete seed.termine; seed.meta = { config: CFGS.einAbstand };
  let p = await L.open(seed, 'sim-2026-10-29-1000');
  await L.click(p, '[data-a=wdhOpen]'); await L.click(p, '[data-a=rateW][data-r=sicher]');
  L.expect('ein Abstand: sicher -> 5 Tage', (await L.store(p)).bloecke.y.sr, { stufe: 1, faellig: '2026-11-03', letzte: '2026-10-29', bewertung: 'sicher' });
  await p.context().close();
  // Ganze Woche Pause: alle Ansichten heil, Woche „ruht“
  seed = JSON.parse(JSON.stringify(base)); seed.pausen = { p: { name: 'Urlaub', art: 'frei', von: '2026-10-26', bis: '2026-11-08' } };
  p = await L.open(seed, 'sim-2026-10-29-1000', 360);
  for (const v of ['heute', 'woche', 'kalender']) { await L.go(p, v); await L.noHScroll(p, 'Pause ' + v); }
  await L.go(p, 'woche'); await L.click(p, '[data-a=wkNext]');
  L.has('Pausenwoche ruht', await L.text(p), 'Diese Woche ruht alles');
  await p.context().close();
  // Oberfläche: Abstand „2“ und Obergrenze an der unteren Grenze
  p = await L.open(base, 'sim-2026-10-29-1000', 1280);
  await L.go(p, 'einstellungen'); await L.click(p, '[data-a=esOpen][data-v=abst]'); await L.fill(p, '#es-abst', '2'); await L.click(p, '[data-a=esAbst]');
  L.expect('ein Abstand über die Oberfläche', (await L.store(p)).meta.config, { abstaende: [2], maxAbstand: 2 });
  await L.click(p, '[data-a=esOpen][data-v=ober]');
  for (let i = 0; i < 14; i++) await p.click('[data-a=esStep][data-d="-0.5"]');
  await p.waitForTimeout(200);
  L.expect('Obergrenze hält bei 1 h', (await L.store(p)).meta.config.obergrenze, 1);
  for (let i = 0; i < 30; i++) await p.click('[data-a=esStep][data-d="0.5"]');
  await p.waitForTimeout(200);
  L.expect('Obergrenze hält bei 12 h', (await L.store(p)).meta.config.obergrenze, 12);
});
