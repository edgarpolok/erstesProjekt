// Kein Druck: keine roten Markierungen außer dem gedämpften X an Liegengebliebenem, keine Serien,
// Statistik nur unter Kalender → „Statistik“. Geprüft in allen Ansichten, hell und dunkel.
const L = require('./lib');

// Montag 2.11.: Vorwoche mit Liegengebliebenem, ausgefallenem Termin, nicht gemachter Routine, „nicht“ bewerteter Wiederholung
const seed = {
  bloecke: {
    o1: { titel: 'Liegengeblieben Fr', status: 'offen', woche: '2026-10-26', tag: '2026-10-30', quelle: 'claude', std: 2 },
    o2: { titel: 'Liegengeblieben ohne Tag', status: 'offen', woche: '2026-10-26', tag: null, quelle: 'liste', std: 1 },
    d1: { titel: 'Erledigt Di', status: 'erledigt', woche: '2026-10-26', tag: '2026-10-27', erledigtAm: '2026-10-27', zeit: 90, wiederholen: true, sr: { stufe: 1, faellig: '2026-10-28', letzte: '2026-10-28', bewertung: 'nicht' } },
    h1: { titel: 'Heute offen', status: 'offen', woche: '2026-11-02', tag: '2026-11-02', quelle: 'frei' }
  },
  routinen: { r1: { titel: 'Sport', haeufigkeit: { art: 'taeglich' }, zustand: 'aktiv' } },
  termine: { t1: { titel: 'Vorlesung', wochentage: [1], von: '10:00', bis: '12:00', zustand: 'aktiv' } },
  tage: { '2026-10-27': { termine: { t1: { faelltAus: true } }, routinen: { r1: { heuteNicht: true } } } },
  themen: { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' } }
};
const SERIE = /serie|streak|in folge|hintereinander|tage am stück|rekord/i;
const STATISTIK = /Wiederholungsstand|frisch: Abstand/;

// Alle sichtbaren Farben (Text, Hintergrund, Rand, SVG) prüfen; rot = Farbton bis 18° oder ab 340°, Sättigung über 35 %
function roteStellen() {
  const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return v[3] === 0 ? null : v.slice(0, 3); };
  const hsl = (c) => { const [r, g, b] = c.map((x) => x / 255); const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn; const l = (mx + mn) / 2; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; };
  const rot = (c) => { const [h, s] = hsl(c); return s > 0.35 && (h <= 18 || h >= 340); };
  const out = []; const x = [];
  document.querySelectorAll('#app *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const props = ['color', 'backgroundColor', 'fill', 'stroke'];
    ['Top', 'Right', 'Bottom', 'Left'].forEach((s) => { if (parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none') props.push('border' + s + 'Color'); });
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) props.push('outlineColor');
    props.forEach((pr) => {
      if (pr === 'color' && !Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return; // Textfarbe zählt nur bei Text
      if ((pr === 'fill' || pr === 'stroke') && !(el instanceof SVGElement)) return;
      const c = rgb(cs[pr]); if (!c || !rot(c)) return;
      if (el.closest('.mk.x')) x.push(hsl(c)); else out.push(el.tagName.toLowerCase() + '.' + String(el.className.baseVal != null ? el.className.baseVal : el.className).trim().replace(/\s+/g, '.') + ' ' + pr + ' ' + cs[pr]);
    });
  });
  return { rot: Array.from(new Set(out)).slice(0, 6), x: x };
}

L.run(async () => {
  for (const dark of [false, true]) {
    const p = await L.open(seed, 'sim-2026-11-02-1000', { w: 1280, dark });
    const hd = dark ? 'dunkel' : 'hell';
    const blicke = [];
    const schau = async (wo) => { const r = await p.evaluate(roteStellen); L.expect(hd + ', ' + wo + ': keine roten Markierungen', r.rot, []); blicke.push([wo, await L.text(p), r.x]); };
    await schau('Heute');
    await L.click(p, '[data-a=poolOpen]').catch(() => {}); await schau('Heute mit „Noch offen“');
    await L.go(p, 'woche'); await schau('Woche (Wochenwechsel)');
    await L.click(p, '[data-a=wkPrev]'); await schau('Vorwoche');
    await L.go(p, 'kalender'); await schau('Kalender');
    await L.click(p, '[data-a=kTab][data-v=zeit]'); await schau('Zeitstrahl');
    await L.click(p, '[data-a=kTab][data-v=zahlen]'); await schau('Statistik');
    await L.go(p, 'themen'); await schau('Themen');
    await L.click(p, '[data-a=thTab][data-v=stand]'); await schau('Stand');
    await L.go(p, 'einstellungen'); await schau('Einstellungen');

    const xe = blicke.filter((b) => b[0] === 'Woche (Wochenwechsel)' || b[0] === 'Vorwoche').reduce((a, b) => a.concat(b[2]), []);
    L.ok(hd + ': das X an Liegengebliebenem ist da', xe.length >= 2, xe.length);
    L.ok(hd + ': das X ist gedämpft (Sättigung höchstens 65 %)', xe.every((c) => c[1] <= 0.65), xe);
    blicke.forEach(([wo, t]) => {
      L.ok(hd + ', ' + wo + ': keine Serien', !SERIE.test(t), (t.match(SERIE) || [])[0]);
      if (wo !== 'Statistik') L.ok(hd + ', ' + wo + ': keine Statistik außerhalb von Kalender → Statistik', !STATISTIK.test(t), (t.match(STATISTIK) || [])[0]);
    });
    L.ok(hd + ': Statistik steht unter Kalender → Statistik', STATISTIK.test(blicke.find((b) => b[0] === 'Statistik')[1]));
    await p.context().close();
  }
  // Schmal: Reiter „Statistik“ nur im Kalender
  const p = await L.open(seed, 'sim-2026-11-02-1000', 390);
  L.expect('Hauptnavigation ohne Statistik', await p.locator('.bottom [data-v]').evaluateAll((els) => els.map((e) => e.getAttribute('data-v'))), ['heute', 'woche', 'kalender', 'themen']);
});
