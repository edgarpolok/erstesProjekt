const { chromium } = require('playwright');
const file = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const open = async (seed, hash, w) => {
    const p = await b.newPage({ viewport: { width: w || 420, height: 900 } });
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript('window.__seed = ' + seed); await p.addInitScript({ path: __dirname + '/mock-app.js' });
    await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
    await p.goto('file://' + file + '#' + hash); await p.waitForTimeout(400); return p;
  };
  let p = await open('{}', 'sim-2026-10-29-1000');
  await p.click('[data-a=startAdd]'); await p.fill('#neu-eintrag', 'Fälle Rom I'); await p.click('[data-a=doAdd]'); await p.waitForTimeout(150);
  await p.click('[data-a=startT][data-art=b]'); await p.waitForTimeout(150);
  const st = await p.evaluate(() => JSON.stringify(__store));
  await p.close();
  // „Neuladen“ 25 Minuten später, andere Breite
  p = await open(st, 'sim-2026-10-29-1025', 1280);
  console.log('timerbar', await p.textContent('.timerbar').catch(() => 'FEHLT'));
  await p.click('[data-a=stopT]'); await p.waitForTimeout(200);
  console.log('zeit', JSON.stringify(Object.values(await p.evaluate(() => __store.bloecke)).map(x => [x.titel, x.zeit])));
  console.log('ERR', errs);
  await b.close();
})();
