const { chromium } = require('playwright');
const file = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const seed = { bloecke: { b1: { titel: 'Block A', woche: '2026-11-02', tag: '2026-11-04', status: 'offen', quelle: 'frei', erstellt: 1 } } };
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript('window.__seed = ' + JSON.stringify(seed)); await p.addInitScript({ path: __dirname + '/mock-app.js' });
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await p.goto('file://' + file + '#sim-2026-11-04-2345'); await p.waitForTimeout(400);
  const sim = async (d, m) => { await p.evaluate(([d, m]) => __ls.setSim(d, m), [d, m]); await p.waitForTimeout(250); };
  const c = async (s) => { await p.click(s); await p.waitForTimeout(200); };
  const er = () => p.evaluate(() => ['2026-11-04', '2026-11-05'].map((d) => d + ': ' + (() => { let m = 0; Object.values(__store.bloecke).forEach((x) => { if (x.status === 'erledigt' && x.tag === d) m += x.zeit || 0; }); return m; })()).join(' | ')); const ea = () => p.evaluate(() => ['2026-11-04','2026-11-05'].map(d => d + ' erfasst ' + __ls.erfasstAt(d)).join(' | '));
  // A) Block-Timer
  await c('[data-a=startT][data-art=b]'); await sim('2026-11-05', 10); await c('[data-a=stopT]');
  console.log('A nach Stopp', JSON.stringify(await p.evaluate(() => __store.bloecke.b1)));
  // Block liegt jetzt in "Noch offen" -> + Heute, wieder starten 0:20–0:30, abhaken
  await sim('2026-11-05', 20); await c('[data-a=poolOpen]'); await c('[data-a=pull]');
  await c('[data-a=startT][data-art=b]'); await sim('2026-11-05', 30); await c('[data-a=stopT]'); await c('[data-a=tBlock]');
  console.log('A Ende', JSON.stringify(await p.evaluate(() => __store.bloecke.b1)));
  console.log('A erfasst', await p.evaluate(() => ['2026-11-04','2026-11-05'].map(d => d + ': ' + __ls.erfasstAt(d) + ' min').join(' | '))); console.log('A heute erfasst-Text', await p.textContent('.h2row .small').catch(() => '-'));
  // C) freier Timer
  await sim('2026-11-05', 23 * 60 + 45); await c('[data-a=startT][data-art=f]'); await sim('2026-11-06', 10); await c('[data-a=stopT]');
  await sim('2026-11-06', 20); await c('[data-a=startT][data-art=f]'); await sim('2026-11-06', 30); await c('[data-a=stopT]');
  console.log('C frei', JSON.stringify(Object.values(await p.evaluate(() => __store.bloecke)).filter((x) => x.titel === 'Freie Lernzeit').map((x) => [x.tag, x.zeit])));
  console.log('ERR', errs); await b.close();
})();
