const { chromium } = require('playwright');
const fs = require('fs');
const file = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const errs = [];
  async function page(hash, w) {
    const p = await b.newPage({ viewport: { width: w || 420, height: 900 } });
    p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(hash + ' ' + m.type() + ': ' + m.text()); });
    p.on('pageerror', (e) => errs.push(hash + ' pageerror: ' + e.message));
    await p.addInitScript({ path: __dirname + '/mock-app.js' });
    await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
    await p.goto('file://' + file + '#' + hash);
    await p.waitForTimeout(300);
    return p;
  }
  const click = async (p, sel) => { await p.click(sel); await p.waitForTimeout(150); };
  const viewErr = async (p, tag) => { const t = await p.textContent('#main'); if (/konnte nicht angezeigt/.test(t)) errs.push(tag + ' VIEW ERROR: ' + t.slice(0, 300)); };
  const shot = async (p, n) => p.screenshot({ path: __dirname + '/out/' + n + '.png', fullPage: true });

  // Szenario 1: leer, Mittwoch
  let p = await page('sim-2026-10-28-1000');
  await viewErr(p, 'heute-leer'); await shot(p, 'heute-leer');
  // Block hinzufügen + abhaken
  await click(p, '[data-a=startAdd]');
  await p.fill('#neu-eintrag', 'Schuldrecht AT – Unmöglichkeit');
  await click(p, '[data-a=doAdd]');
  await click(p, '[data-a=tBlock]');
  await viewErr(p, 'heute-done'); await shot(p, 'heute-done');
  // Zeit eintragen
  await click(p, '[data-a=openT]'); await p.fill('[data-in=zeit]', '1:15'); await click(p, '[data-a=saveT]');
  // Timer frei
  await click(p, '[data-a=startT][data-art=f]'); await p.waitForTimeout(200); await click(p, '[data-a=stopT]');
  await viewErr(p, 'heute-timer');
  // Woche
  await click(p, '.bottom [data-v=woche]'); await viewErr(p, 'woche'); await shot(p, 'woche');
  await click(p, '[data-a=planShow]'); await viewErr(p, 'plan');
  await click(p, '[data-a=vAdd]'); await p.fill('.vrow input.inp', 'Sachenrecht – Eigentümer-Besitzer'); await p.press('.vrow input.inp', 'Tab'); await p.waitForTimeout(150);
  await click(p, '[data-a=vStd][data-h="6"]');
  await click(p, '[data-a=vAdd]'); await p.locator('.vrow input.inp').nth(1).fill('Klausur ZPO'); await p.locator('.vrow input.inp').nth(1).press('Tab'); await p.waitForTimeout(150);
  await shot(p, 'plan');
  await click(p, '[data-a=planClaude]'); await p.waitForTimeout(400); await viewErr(p, 'plan-claude'); await shot(p, 'plan-done');
  // Termin
  await click(p, '[data-a=tfOpen]'); await p.fill('#tf-titel', 'Sprechstunde'); await p.fill('#tf-von', '10:00'); await p.fill('#tf-bis', '15:00'); await click(p, '[data-a=tfSave]');
  await viewErr(p, 'termin');
  await click(p, '[data-a=wkNext]'); await viewErr(p, 'next'); await click(p, '[data-a=wkPrev]'); await click(p, '[data-a=wkPrev]'); await viewErr(p, 'prev');
  // Kalender
  await click(p, '.bottom [data-v=kalender]'); await viewErr(p, 'kal'); await shot(p, 'kal');
  await click(p, '[data-a=kNew][data-v=pause]'); await p.fill('#k-name', 'Urlaub'); await p.fill('#k-von', '2026-11-09'); await p.fill('#k-bis', '2026-11-15'); await click(p, '[data-a=kSave]');
  await click(p, '[data-a=kNew][data-v=etappe]'); await p.fill('#k-name', 'Examensvorbereitung'); await p.fill('#k-von', '2026-10-01'); await p.fill('#k-bis', '2026-10-25'); await click(p, '[data-a=kSave]');
  await viewErr(p, 'kal2'); await shot(p, 'kal2');
  await click(p, '[data-a=kTab][data-v=zahlen]'); await viewErr(p, 'zahlen'); await shot(p, 'zahlen');
  await click(p, '.bottom [data-v=themen]'); await viewErr(p, 'themen');
  const store = await p.evaluate(() => JSON.stringify(window.__store));
  fs.writeFileSync(__dirname + '/store.json', store);
  // Szenario 2: gleiche Daten, Tage später (Heute = Fr nächste Woche, Wiederholung fällig)
  for (const h of ['sim-2026-10-29-0800', 'sim-2026-10-31-1900', 'sim-2026-11-02-0900', 'sim-2026-11-11-0900', 'sim-2026-11-16-0900']) {
    const q = await b.newPage({ viewport: { width: 1280, height: 900 } });
    q.on('pageerror', (e) => errs.push(h + ' pageerror: ' + e.message));
    q.on('console', (m) => { if (m.type() === 'error') errs.push(h + ' console: ' + m.text()); });
    await q.addInitScript('window.__seed = ' + store);
    await q.addInitScript({ path: __dirname + '/mock-app.js' });
    await q.route('**/fonts.googleapis.com/**', (r) => r.abort());
    await q.goto('file://' + file + '#' + h); await q.waitForTimeout(400);
    await viewErr(q, h + ' heute'); await shot(q, h + '-heute');
    for (const v of ['woche', 'kalender']) { await q.click('.side [data-v=' + v + ']'); await q.waitForTimeout(200); await viewErr(q, h + ' ' + v); }
    await shot(q, h + '-kal');
    await q.click('.side [data-v=woche]'); await q.waitForTimeout(200); await shot(q, h + '-woche');
    console.log(h, 'writes', await q.evaluate(() => window.__writes));
    await q.close();
  }
  console.log('ERRORS:\n' + errs.join('\n'));
  await b.close();
})();
