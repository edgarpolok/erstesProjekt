const { chromium } = require('playwright');
const file = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  // Heute = Do 5.11.; gestern Mi 4.11. (offen), Mo 2.11. (zu)
  const seed = {
    bloecke: { b1: { titel: 'Block Mi offen', woche: '2026-11-02', tag: '2026-11-04', status: 'offen', quelle: 'frei', erstellt: 1 },
               b2: { titel: 'Block Mo offen', woche: '2026-11-02', tag: '2026-11-02', status: 'offen', quelle: 'frei', erstellt: 2 },
               b3: { titel: 'Block Mo erledigt', woche: '2026-11-02', tag: '2026-11-02', status: 'erledigt', erledigtAm: '2026-11-02', zeit: 60, wiederholen: true, sr: { stufe: 1, faellig: '2026-11-03' }, quelle: 'frei', erstellt: 3 } },
    routinen: { r1: { titel: 'Sport', haeufigkeit: { art: 'taeglich' }, zustand: 'aktiv' } },
    termine: { t1: { titel: 'Vorlesung', wochentage: [0, 2], von: '10:00', bis: '12:00', zustand: 'aktiv' } } };
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript('window.__seed = ' + JSON.stringify(seed)); await p.addInitScript({ path: __dirname + '/mock-app.js' });
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await p.goto('file://' + file + '#sim-2026-11-05-1000'); await p.waitForTimeout(400);
  const c = async (s) => { await p.click(s); await p.waitForTimeout(200); };
  const st = () => p.evaluate(() => JSON.stringify({ b: __store.bloecke, t: __store.tage }));
  const ve = async (tag) => { const t = await p.textContent('#main'); if (/konnte nicht angezeigt/.test(t)) errs.push(tag + ' VIEW ERROR ' + t.slice(0, 200)); };
  await c('.bottom [data-v=woche]');
  console.log('Links', await p.locator('[data-a=editDay]').allTextContents());
  // Gestern: offen
  await c('[data-a=editDay][data-d="2026-11-04"]'); await ve('mi');
  await p.screenshot({ path: __dirname + '/out/nach-mi.png', fullPage: true });
  await c('[data-a=tBlock][data-id=b1]'); await c('[data-a=tRoutine]'); await c('[data-a=tTermin]');
  await c('[data-a=startAdd]'); await p.fill('#neu-eintrag', 'Abendzeile vergessen'); await c('[data-a=doAdd]');
  let s = JSON.parse(await st());
  console.log('Mi b1', s.b.b1.status, s.b.b1.erledigtAm, 'nach?', !!s.b.b1.nachgetragen, '| neu', JSON.stringify(Object.values(s.b).filter(x => x.titel === 'Abendzeile vergessen').map(x => [x.tag, x.status, !!x.nachgetragen])), '| tage', JSON.stringify(s.t['2026-11-04']));
  console.log('Timer-Knöpfe im Nachtrag', await p.locator('[data-a=startT]').count());
  // Montag: zu
  await c('[data-a=dayBack]'); await c('[data-a=editDay][data-d="2026-11-02"]'); await ve('mo');
  await p.screenshot({ path: __dirname + '/out/nach-mo.png', fullPage: true });
  await c('[data-a=tBlock][data-id=b2]');
  console.log('Mo gesperrt toast', await p.textContent('.toast').catch(() => '-'), '| b2', JSON.parse(await st()).b.b2.status);
  await c('[data-a=tBlock][data-id=b3]'); console.log('Mo Haken weg erlaubt', JSON.parse(await st()).b.b3.status);
  await c('[data-a=tBlock][data-id=b3]'); console.log('Mo Haken wieder setzen gesperrt', JSON.parse(await st()).b.b3.status);
  // Zeit verringern erlaubt? b3 ist jetzt offen -> keine Zeit. Notausgang:
  await c('[data-a=korrAsk]'); await p.screenshot({ path: __dirname + '/out/nach-korr.png', fullPage: true });
  await c('[data-a=korrYes]');
  await c('[data-a=tBlock][data-id=b2]'); await c('[data-a=tBlock][data-id=b3]');
  await c('[data-a=openT][data-ref="b:b3"]'); await p.fill('[data-in=zeit]', '1:30'); await c('[data-a=saveT]');
  s = JSON.parse(await st());
  console.log('Korr b2', s.b.b2.status, !!s.b.b2.nachgetragen, '| b3', s.b.b3.status, s.b.b3.zeit, !!s.b.b3.nachgetragen);
  await c('[data-a=dayBack]'); await ve('woche');
  console.log('Woche Mo Text', (await p.textContent('[data-k="d-2026-11-02"]')).replace(/\s+/g, ' '));
  await p.screenshot({ path: __dirname + '/out/nach-woche.png', fullPage: true });
  // Navigation Heute -> wieder heutiger Tag
  await c('.bottom [data-v=heute]'); console.log('Heute h1', await p.textContent('h1'));
  console.log('ERR', errs); await b.close();
})();
