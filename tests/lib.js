// Gemeinsame Hilfen für alle Tests. Jede Testdatei ruft L.run(async () => { ... }) auf.
// Ein fehlgeschlagener Vergleich schreibt „FEHLER: …: erwartet X, ist Y“ und setzt den Exit-Code auf 1.
// Aufruf: node tests/<datei>.js [pfad/zur/index.html]  (ohne Pfad: app/index.html, oder Umgebungsvariable APP)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP = path.resolve(process.argv[2] || process.env.APP || path.join(__dirname, '../app/index.html'));
const OUT = path.join(__dirname, 'out');
let browser = null;
let pruefungen = 0;
const fehler = [];
const bekannt = [];

const zeige = (v) => { if (v === undefined) return 'undefined'; try { return JSON.stringify(v); } catch (e) { return String(v); } };
// Vergleich unabhängig von der Reihenfolge der Schlüssel in Objekten
const norm = (v) => (Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = norm(v[k]); return o; }, {}) : v);
const gleich = (a, b) => zeige(norm(a)) === zeige(norm(b));
// Unterschiede zweier Speicherstände, kurz: „sammlung/id“ der geänderten Einträge
const diff = (a, b) => Object.keys(Object.assign({}, a, b)).reduce((out, col) => { const x = a[col] || {}; const y = b[col] || {}; Object.keys(Object.assign({}, x, y)).forEach((id) => { if (!gleich(x[id], y[id])) out.push(col + '/' + id); }); return out; }, []);

function fail(label, text) { fehler.push(label); console.log('FEHLER: ' + label + (text ? ': ' + text : '')); }
function expect(label, ist, erwartet) { pruefungen++; if (!gleich(ist, erwartet)) fail(label, 'erwartet ' + zeige(erwartet) + ', ist ' + zeige(ist)); }
function ok(label, bedingung, ist) { pruefungen++; if (!bedingung) fail(label, ist === undefined ? 'Bedingung nicht erfüllt' : 'ist ' + zeige(ist)); }
function has(label, text, teil) { pruefungen++; if (!String(text).includes(teil)) fail(label, 'erwartet Text mit ' + zeige(teil) + ', ist ' + zeige(String(text).slice(0, 300))); }
function hasNot(label, text, teil) { pruefungen++; if (String(text).includes(teil)) fail(label, 'Text enthält ' + zeige(teil) + ', soll es aber nicht'); }
// Bekannte App-Abweichung von einer Regel: wird gemeldet, lässt den Lauf aber nicht scheitern, bis sie entschieden ist
function known(label, bedingung, ist) { pruefungen++; if (!bedingung) { bekannt.push(label); console.log('BEKANNT: ' + label + (ist === undefined ? '' : ': ist ' + zeige(ist))); } else console.log('BEHOBEN? ' + label + ' – Prüfung jetzt in expect() umwandeln'); }

// Seite öffnen: Testdaten (seed) liegen beim ersten Laden im Speicher; Uhr über #sim-JJJJ-MM-TT-HHMM
async function open(seed, hash, opt) {
  const o = Object.assign({ w: 420, h: 900 }, typeof opt === 'number' ? { w: opt } : opt || {});
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h }, colorScheme: o.dark ? 'dark' : 'light', timezoneId: 'Europe/Berlin', locale: 'de-DE' }); // wie auf dem MacBook des Nutzers
  const p = await ctx.newPage();
  p.tag = (hash || '') + '@' + o.w;
  p.on('pageerror', (e) => fail(p.tag + ' Skriptfehler in der App', e.message));
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ERR_FAILED|fonts\.g|net::ERR/.test(m.text())) fail(p.tag + ' Konsole (' + m.type() + ')', m.text()); });
  await p.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await p.route('**/fonts.gstatic.com/**', (r) => r.abort());
  if (seed !== null) await p.addInitScript('window.__seed = ' + JSON.stringify(seed || {}));
  await p.addInitScript({ path: path.join(__dirname, 'mock-app.js') });
  await p.goto('file://' + APP + (hash ? '#' + hash : ''));
  await p.waitForTimeout(350);
  await viewOk(p, 'nach dem Öffnen');
  return p;
}
async function viewOk(p, wo) {
  const t = await p.textContent('#main').catch(() => '');
  if (/konnte nicht angezeigt/.test(t)) fail(p.tag + ' Ansicht ' + wo, 'Fehlermeldung „konnte nicht angezeigt“: ' + t.slice(0, 200));
}
// Klicken und kurz auf das Neuzeichnen warten; danach prüfen, ob die Ansicht noch heil ist
async function click(p, sel) { await p.click(sel, { timeout: 4000 }); await p.waitForTimeout(150); await viewOk(p, 'nach Klick ' + sel); }
async function fill(p, sel, v) { await p.fill(sel, v, { timeout: 4000 }); }
// Zu einer Ansicht wechseln: breit über die Seitenleiste, schmal über die Leiste unten (Einstellungen: Zahnrad)
async function go(p, v) {
  const w = p.viewportSize().width;
  await click(p, w >= 900 ? '.side [data-v=' + v + ']' : v === 'einstellungen' ? '.gear[data-v=einstellungen]' : '.bottom [data-v=' + v + ']');
}
const store = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__store)));
const text = (p, sel) => p.textContent(sel || '#main', { timeout: 2000 }).then((t) => t.replace(/\s+/g, ' ')).catch(() => '');
const toast = (p) => text(p, '.toast');
const sim = async (p, d, min) => { await p.evaluate(([d, m]) => window.__ls.setSim(d, m), [d, min]); await p.waitForTimeout(250); };
// Breite: keine waagerechte Scrollleiste
async function noHScroll(p, label) {
  const r = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  ok(p.tag + ' ' + label + ': keine waagerechte Scrollleiste', r[0] <= r[1], r[0] + ' > ' + r[1]);
}
const shot = (p, n) => { fs.mkdirSync(OUT, { recursive: true }); return p.screenshot({ path: path.join(OUT, n + '.png'), fullPage: true }); };
// Datum rechnen wie die App (Mittag UTC, damit Zeitumstellung nichts verschiebt)
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const ids = (s, col, f) => Object.keys(s[col]).filter((k) => f(s[col][k], k));

async function run(fn) {
  const name = path.basename(process.argv[1]);
  try {
    browser = await chromium.launch();
    await fn();
  } catch (e) {
    fail('Test abgebrochen', e && e.message ? e.message.split('\n').filter((z) => z.trim() && !/^=+|Call log/.test(z)).slice(0, 2).join(' / ').replace(/\u001b\[[0-9;]*m/g, '').trim() : String(e));
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  if (!pruefungen) fail('keine einzige Prüfung gelaufen');
  console.log('ERGEBNIS ' + name + ': ' + pruefungen + ' Prüfungen, ' + fehler.length + ' Fehler' + (bekannt.length ? ', ' + bekannt.length + ' bekannt' : ''));
  process.exitCode = fehler.length ? 1 : 0;
}
process.on('unhandledRejection', (e) => { fail('unbehandelter Fehler im Test', e && e.message ? e.message.split('\n')[0] : String(e)); process.exitCode = 1; });

module.exports = { APP, run, same: gleich, diff, open, click, fill, go, store, text, toast, sim, noHScroll, shot, viewOk, expect, ok, has, hasNot, known, fail, addDays, ids, get browser() { return browser; } };
