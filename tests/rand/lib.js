const { chromium } = require('playwright');
const FILE = require('path').join(__dirname, '../../app/index.html');
const errs = [];
let browser;
async function init() { browser = await chromium.launch(); return browser; }
async function open(seed, hash, w, h) {
  const p = await browser.newPage({ viewport: { width: w || 1280, height: h || 900 } });
  const tag = hash + '@' + (w || 1280);
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(tag + ' console: ' + m.text()); });
  p.on('pageerror', (e) => errs.push(tag + ' pageerror: ' + e.message));
  await p.addInitScript('window.__seed = ' + JSON.stringify(seed || {}));
  await p.addInitScript({ path: __dirname + '/../mock-app.js' });
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await p.goto('file://' + FILE + '#' + hash);
  await p.waitForTimeout(350);
  p.tag = tag;
  return p;
}
const click = async (p, sel) => { await p.click(sel); await p.waitForTimeout(150); };
const nav = async (p, v) => { await p.evaluate((v) => { __ls.S.view = v; }, v); await p.evaluate(() => { document.querySelector('[data-a=nav][data-v=heute]').click(); }); };
async function go(p, v) { const sel = (await p.viewportSize()).width >= 900 ? '.side [data-v=' + v + ']' : (v === 'einstellungen' ? '.gear' : '.bottom [data-v=' + v + ']'); await click(p, sel); }
async function check(p, label) {
  const r = await p.evaluate(() => ({ t: document.querySelector('#main') ? document.querySelector('#main').innerText : '', sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (/konnte nicht angezeigt/.test(r.t)) errs.push(p.tag + ' ' + label + ' VIEW ERROR: ' + r.t.slice(0, 300));
  if (r.sw > r.cw) errs.push(p.tag + ' ' + label + ' HSCROLL ' + r.sw + '>' + r.cw);
  return r;
}
const shot = (p, n, full) => p.screenshot({ path: __dirname + '/out/' + n + '.png', fullPage: full !== false });
const store = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
module.exports = { init, open, click, go, check, shot, store, errs, get browser() { return browser; } };
