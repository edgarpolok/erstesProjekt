const { chromium } = require('playwright');
const fs = require('fs');
const file = process.argv[2];
const store = fs.readFileSync(__dirname + '/store.json', 'utf8');
(async () => {
  const b = await chromium.launch();
  const errs = []; const log = (...a) => console.log(...a);
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
  const q = await ctx.newPage();
  q.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  q.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push('console: ' + m.text()); });
  await q.addInitScript('if (!window.__seed) window.__seed = ' + store);
  await q.addInitScript({ path: __dirname + '/mock-app.js' });
  await q.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await q.goto('file://' + file + '#sim-2026-10-29-1800'); await q.waitForTimeout(400);
  const c = async (s) => { await q.click(s); await q.waitForTimeout(150); };
  const ve = async (tag) => { const t = await q.textContent('#main'); if (/konnte nicht angezeigt/.test(t)) errs.push(tag + ' VIEW ERROR ' + t.slice(0, 200)); };
  await c('.bottom [data-v=themen]'); await ve('themen-leer'); await q.screenshot({ path: __dirname + '/out/th1.png', fullPage: true });
  // Gebiet + Unterthemen
  await c('[data-a=thNew]'); await q.fill('#th-new', 'Zivilrecht'); await q.press('#th-new', 'Enter'); await q.waitForTimeout(150);
  await c('[data-a=thSel]'); await ve('detail');
  await q.fill('#th-sub', 'Schuldrecht AT'); await c('[data-a=thSubAdd]');
  await c('[data-a=thBack]');
  await c('[data-a=thNew]'); await q.fill('#th-new', 'Sachenrecht'); await c('[data-a=thNewSave]');
  // Eingang zuordnen
  const n0 = await q.locator('[data-a=thAssign]').count(); log('eingang', n0);
  const sid = await q.evaluate(() => Object.keys(__store.themen).find(k => __store.themen[k].name === 'Schuldrecht AT'));
  await q.locator('select[data-in^=zu_]').first().selectOption(sid); await q.waitForTimeout(100);
  await c('[data-a=thAssign]');
  log('nach zuordnen eingang', await q.locator('[data-a=thAssign]').count(), 'sr', JSON.stringify(await q.evaluate((id) => __store.themen[id].sr, sid)));
  log('srItems', await q.evaluate(() => JSON.stringify(__ls.srItems().map(x => x.ref + ' ' + x.titel))));
  await q.screenshot({ path: __dirname + '/out/th2.png', fullPage: true });
  // Detail Schuldrecht
  await q.click('[data-a=thSel][data-id="' + sid + '"]'); await q.waitForTimeout(150); await ve('detail2');
  await q.screenshot({ path: __dirname + '/out/th3.png', fullPage: true });
  // Verschieben unter Sachenrecht, dann zurück, dann pausieren
  const sach = await q.evaluate(() => Object.keys(__store.themen).find(k => __store.themen[k].name === 'Sachenrecht'));
  await q.selectOption('#th-move', sach); await q.waitForTimeout(100); await c('[data-a=thMove]');
  log('eltern', await q.evaluate((id) => __store.themen[id].eltern, sid), '==', sach);
  await c('[data-a=thZ][data-v=pausiert]');
  log('srItems pausiert', await q.evaluate(() => __ls.srItems().length));
  await c('[data-a=thZ][data-v=abgeschlossen]');
  await c('[data-a=thZ][data-v=aktiv]');
  log('reaktiviert sr', JSON.stringify(await q.evaluate((id) => __store.themen[id].sr, sid)));
  await c('[data-a=thW]'); log('wdh aus srItems', await q.evaluate(() => __ls.srItems().length)); await c('[data-a=thW]');
  // Zusammenlegen in Zivilrecht
  const ziv = await q.evaluate(() => Object.keys(__store.themen).find(k => __store.themen[k].name === 'Zivilrecht'));
  await q.selectOption('#th-merge', ziv); await q.waitForTimeout(100); await c('[data-a=thMerge]');
  log('nach merge themen', await q.evaluate(() => Object.values(__store.themen).map(t => t.name).join(',')), 'bloecke mit ziv', await q.evaluate((id) => Object.values(__store.bloecke).filter(b => b.thema === id).length, ziv));
  await c('.toast [data-a=undo]'); await q.waitForTimeout(200);
  log('nach undo themen', await q.evaluate(() => Object.values(__store.themen).map(t => t.name).join(',')));
  // Suche
  await c('[data-a=thBack]').catch(() => {});
  await q.fill('#th-q', 'unmögl'); await q.waitForTimeout(200); await ve('suche');
  await q.screenshot({ path: __dirname + '/out/th4.png', fullPage: true });
  await q.fill('#th-q', '');
  // Reload: Ansicht bleibt Themen
  await q.reload(); await q.waitForTimeout(400);
  log('nach reload view', await q.evaluate(() => __ls.S.view));
  // Einstellungen
  await c('.gear[data-v=einstellungen]'); await ve('einst');
  await q.screenshot({ path: __dirname + '/out/es1.png', fullPage: true });
  await c('[data-a=esOpen][data-v=plan]'); await c('[data-a=esSet][data-k=planungstag][data-n="6"]');
  await c('[data-a=esOpen][data-v=abst]'); await q.fill('#es-abst', '1, 2, 5, 10'); await c('[data-a=esAbst]');
  await c('[data-a=esOpen][data-v=abst]'); await q.fill('#es-abst', '3, 1'); await c('[data-a=esAbst]');
  log('toast', await q.textContent('.toast').catch(() => '-'));
  await c('[data-a=esOpen][data-v=ober]'); await c('[data-a=esStep][data-d="0.5"]');
  await c('[data-a=esOpen][data-v=umf]'); await c('[data-a=esUmf][data-i="6"][data-v=halb]');
  log('config', JSON.stringify(await q.evaluate(() => __store.meta.config)));
  await c('[data-a=esRNew]'); await q.fill('#r-titel', '10-Finger'); await c('[data-a=esRArt][data-v=alle]'); await q.fill('#r-n', '2'); await c('[data-a=esRSave]');
  await c('[data-a=esTNew]'); await q.fill('#t-titel', 'Vorlesung IPR'); await c('[data-a=esTTag][data-i="1"]'); await q.fill('#t-von', '10:00'); await q.fill('#t-bis', '12:00'); await c('[data-a=esTSave]');
  log('routinen', JSON.stringify(await q.evaluate(() => Object.values(__store.routinen))));
  log('termine', JSON.stringify(await q.evaluate(() => Object.values(__store.termine).filter(t => !t.datum))));
  await q.screenshot({ path: __dirname + '/out/es2.png', fullPage: true });
  await c('[data-a=esRZ][data-v=pausiert]');
  await c('[data-a=esModZ][data-id=suche][data-v=pausiert]');
  await c('.bottom [data-v=themen]'); log('suche sichtbar', await q.locator('#th-q').count());
  // Neuer Tab = neue Sitzung -> Heute
  const q2 = await ctx.newPage(); await q2.addInitScript({ path: __dirname + '/mock-app.js' }); await q2.goto('file://' + file); await q2.waitForTimeout(300);
  log('neue sitzung view', await q2.evaluate(() => __ls.S.view));
  // Desktop + dunkel
  const d = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  d.on('pageerror', (e) => errs.push('dark pageerror: ' + e.message));
  const st = await q.evaluate(() => JSON.stringify(__store));
  await d.addInitScript('window.__seed = ' + st); await d.addInitScript({ path: __dirname + '/mock-app.js' });
  await d.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await d.goto('file://' + file + '#sim-2026-11-03-1000'); await d.waitForTimeout(400);
  await d.click('.side [data-v=themen]'); await d.waitForTimeout(300); console.log('DARK', (await d.textContent('#main')).slice(0,400)); await d.click('[data-a=thNew]'); await d.fill('#th-new','Zivilrecht'); await d.press('#th-new','Enter'); await d.waitForTimeout(150); await d.click('.tname >> nth=0'); await d.waitForTimeout(150); await d.fill('#th-sub','Schuldrecht AT'); await d.click('[data-a=thSubAdd]'); await d.waitForTimeout(150); await d.locator('select[data-in^=zu_]').first().selectOption({index:2}); await d.click('[data-a=thAssign]'); await d.waitForTimeout(150);
  await d.screenshot({ path: __dirname + '/out/dark-th.png', fullPage: true });
  await d.click('.side [data-v=einstellungen]'); await d.waitForTimeout(150); await d.click('[data-a=esOpen][data-v=umf]'); await d.waitForTimeout(150);
  await d.screenshot({ path: __dirname + '/out/dark-es.png', fullPage: true });
  await d.click('.side [data-v=heute]'); await d.waitForTimeout(200); await d.screenshot({ path: __dirname + '/out/dark-heute.png', fullPage: true });
  log('ERR', errs.join('\n'));
  await b.close();
})();
