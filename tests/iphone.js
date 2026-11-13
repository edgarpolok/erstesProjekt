// iPhone-Breite (390 × 844): keine waagerechte Scrollleiste in allen Ansichten und Zuständen, wichtige Tippziele mindestens 40 × 40 px
const L = require('./lib');

const TAG = '2026-11-10';
const seed = {
  bloecke: {
    b1: { titel: 'Sachenrecht lesen', woche: '2026-11-09', tag: TAG, status: 'offen', quelle: 'frei', erstellt: 1 },
    b2: { titel: 'BGB AT: Willenserklärung, Anfechtung und Stellvertretung im Überblick', woche: '2026-11-09', tag: TAG, status: 'offen', quelle: 'frei', erstellt: 2 }
  },
  themen: { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' } },
  termine: { t1: { titel: 'Vorlesung', wochentage: [1], von: '10:00', bis: '12:00', zustand: 'aktiv' } }
};

L.run(async () => {
  const p = await L.open(seed, 'sim-' + TAG + '-1000', { w: 390, h: 844 });
  // Maße eines Tippziels: mindestens 40 × 40
  const ziel = async (name, sel, nur) => {
    const el = p.locator(sel + (nur ? '' : '')).first();
    if (!(await el.count())) { L.ok('Tippziel „' + name + '“ ist da', false, sel); return; }
    const b = await el.boundingBox();
    L.ok('Tippziel „' + name + '“ mindestens 40 × 40 px', b && b.width >= 40 && b.height >= 40, b && Math.round(b.width) + ' × ' + Math.round(b.height));
  };

  await L.noHScroll(p, 'Heute');
  await ziel('Haken an einer Zeile', '[data-a=tBlock][data-id=b1]');
  await ziel('Timer-Knopf', '[data-a=startT][data-art=b][data-id=b1]');
  await ziel('Hinzufügen', '[data-a=startAdd]');
  await ziel('Zahnrad', '.gear[data-v=einstellungen]');
  for (const v of ['heute', 'woche', 'kalender', 'themen']) await ziel('Leiste unten: ' + v, '.bottom [data-v=' + v + ']');

  await L.click(p, '[data-a=startAdd]');
  await L.noHScroll(p, 'Heute, Hinzufügen offen');
  await ziel('„Hinzufügen“-Knopf im Formular', '[data-a=doAdd]');
  await L.fill(p, '#neu-eintrag', 'Ein sehr langer Eintrag über Verjährung, Hemmung, Neubeginn und Ablaufhemmung im Allgemeinen Schuldrecht');
  await L.noHScroll(p, 'Heute, Hinzufügen mit langem Text');
  await L.click(p, '[data-a=doAdd]');

  await L.click(p, '[data-a=tBlock][data-id=b1]');
  L.expect('Abhaken am iPhone', (await L.store(p)).bloecke.b1.status, 'erledigt');
  await L.noHScroll(p, 'Heute, abgehakt');

  await L.click(p, '[data-a=startT][data-art=b][data-id=b2]');
  L.ok('Timer läuft', await p.locator('#timer-el').isVisible());
  await L.noHScroll(p, 'Heute, Timer läuft');
  await ziel('Stopp-Knopf der Timerleiste', '[data-a=stopT]');
  await ziel('Leiste unten bei laufendem Timer: heute', '.bottom [data-v=heute]');

  for (const v of ['woche', 'kalender', 'themen']) { await L.go(p, v); await L.noHScroll(p, v); }
  await L.go(p, 'woche');
  await L.noHScroll(p, 'Woche');
  await L.go(p, 'heute');
  await L.go(p, 'einstellungen');
  await L.noHScroll(p, 'Einstellungen');
  const klein = await p.evaluate(() => Array.from(document.querySelectorAll('#main button, #main [data-a]')).filter((b) => b.offsetParent !== null).map((b) => ({ t: (b.textContent || b.getAttribute('aria-label') || b.getAttribute('data-a')).trim().slice(0, 30), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })).filter((x) => x.h < 40));
  L.ok('Einstellungen: alle Knöpfe mindestens 40 px hoch', klein.length === 0, JSON.stringify(klein.slice(0, 6)));
});
