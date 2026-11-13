// Abgleich zwischen Geräten (Mac und iPhone über die GitHub-Ablage): standardmäßig aus, erstes Einschalten, Zusammenführen
// Eintrag für Eintrag, Löschen, Offline, gleichzeitiges Schreiben, von selbst, Schlüssel nur lokal, Rückgängig, Timer, Sichern/Laden.
// Die Ablage ist ein Schein-Server (L.ablage()); „Mac“ und „iPhone“ sind zwei Browser-Kontexte mit derselben simulierten Uhr.
const L = require('./lib');
const fs = require('fs');
const path = require('path');

const TAG = '2026-11-10'; // Dienstag
const UHR = 'sim-' + TAG + '-1000';
const WOCHE = '2026-11-09';
const blockSeed = () => ({
  bloecke: {
    b1: { titel: 'Sachenrecht lesen', woche: WOCHE, tag: TAG, status: 'offen', quelle: 'frei', erstellt: 1 },
    b2: { titel: 'BGB AT', woche: WOCHE, tag: TAG, status: 'offen', quelle: 'frei', erstellt: 2 }
  }
});

// Gerät öffnen und an die Schein-Ablage hängen; Wartezeiten so lang, dass nichts von selbst abgleicht (außer in Abschnitt 9)
async function geraet(A, seed, tag, breite) {
  const p = await L.open(seed, UHR, breite);
  p.tag = tag;
  await A.an(p);
  await p.evaluate(() => { window.__ls.abgleich.T.nach = 1e7; window.__ls.abgleich.T.takt = 1e9; });
  return p;
}
async function zuEinstellungen(p) { if (!(await p.locator('[data-k=abgleich]').count())) await L.go(p, 'einstellungen'); }
async function einschalten(p, token) {
  await zuEinstellungen(p);
  await L.click(p, '[data-a=abgOpen]');
  await L.fill(p, '#abg-token', token || 'test-schluessel');
  await L.click(p, '[data-a=abgEin]');
  await p.waitForTimeout(600);
}
const ab = async (p) => { await p.evaluate(() => window.__ls.abgleich.jetzt()); await p.waitForTimeout(150); };
const stand = (p) => p.evaluate(() => window.__ls.abgleich.stand());
const zu = (...ps) => Promise.all(ps.map((p) => p.context().close()));
const bl = async (p) => (await L.store(p)).bloecke;
const ids = async (p) => Object.keys(await bl(p)).sort();
async function paar(seedMac, seedPhone) {
  const A = L.ablage();
  const mac = await geraet(A, seedMac, 'mac', 1280); await einschalten(mac);
  const ph = await geraet(A, seedPhone || {}, 'iphone', 390); await einschalten(ph);
  return { A, mac, ph };
}
// Bedienung
async function heute(p) { await L.go(p, 'heute'); }
async function abhaken(p, id) { await heute(p); await L.click(p, '[data-a=tBlock][data-id=' + id + ']'); }
async function umbenennen(p, id, name) { await heute(p); await L.click(p, '[data-a=menu][data-m=b' + id + ']'); await L.click(p, '[data-a=editB][data-id=' + id + ']'); await L.fill(p, '#name-' + id, name); await L.click(p, '[data-a=saveB][data-id=' + id + ']'); }
async function loeschen(p, id) { await heute(p); await L.click(p, '[data-a=menu][data-m=b' + id + ']'); await L.click(p, '[data-a=delB][data-id=' + id + ']'); }
async function hinzufuegen(p, text) { await heute(p); await L.click(p, '[data-a=startAdd]'); await L.fill(p, '#neu-eintrag', text); await L.click(p, '[data-a=doAdd]'); }
const warte = (p, ms) => p.waitForTimeout(ms);

// Rote Stellen innerhalb eines Bereichs (wie in kein-druck.js: Farbton bis 18° oder ab 340°, Sättigung über 35 %)
function roteStellenIn(sel) {
  const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return v[3] === 0 ? null : v.slice(0, 3); };
  const hsl = (c) => { const [r, g, b] = c.map((x) => x / 255); const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const d = mx - mn; const l = (mx + mn) / 2; if (!d) return [0, 0, l]; const s = d / (1 - Math.abs(2 * l - 1)); const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, s, l]; };
  const rot = (c) => { const [h, s] = hsl(c); return s > 0.35 && (h <= 18 || h >= 340); };
  const out = [];
  const root = document.querySelector(sel);
  if (!root) return ['Bereich fehlt'];
  [root].concat(Array.from(root.querySelectorAll('*'))).forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const props = ['color', 'backgroundColor', 'fill', 'stroke'];
    ['Top', 'Right', 'Bottom', 'Left'].forEach((s) => { if (parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none') props.push('border' + s + 'Color'); });
    props.forEach((pr) => {
      if (pr === 'color' && !Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) return;
      if ((pr === 'fill' || pr === 'stroke') && !(el instanceof SVGElement)) return;
      const c = rgb(cs[pr]); if (c && rot(c)) out.push(el.tagName.toLowerCase() + ' ' + pr + ' ' + cs[pr]);
    });
  });
  return out;
}

L.run(async () => {
  // 1) Abgleich aus: keine einzige Netzanfrage
  {
    const A = L.ablage();
    const p = await L.open(blockSeed(), UHR, 1280); p.tag = 'mac'; await A.an(p);
    const hosts = new Set();
    p.on('request', (r) => { const u = new URL(r.url()); if (!/^(blob|data):/.test(r.url())) hosts.add(u.protocol === 'file:' ? 'file' : u.hostname); });
    for (const v of ['woche', 'themen', 'einstellungen', 'heute']) await L.go(p, v);
    await L.click(p, '[data-a=tBlock][data-id=b1]');
    await warte(p, 1500);
    const frueh = await p.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name, location.href).hostname).filter((h) => h));
    L.expect('Abgleich aus: keine Anfrage an die Ablage', A.anfragen.length, 0);
    L.expect('Abgleich aus: nur Dateien und Schriften angefragt', Array.from(hosts).concat(frueh).filter((h) => h !== 'file' && !/^fonts\.(googleapis|gstatic)\.com$/.test(h)), []);
    L.expect('Abgleich aus: nichts im Speicher des Abgleichs', await p.evaluate(() => localStorage.getItem('lernsystem-abgleich-v1')), null);
    L.has('Abgleich aus: Bereich zeigt „Aus“ und „Einrichten“', await L.text(await (async () => { await zuEinstellungen(p); return p; })(), '[data-k=abgleich]'), 'Aus.');
    L.expect('Abgleich aus: „Einrichten“ ist da', await p.locator('[data-a=abgOpen]').count(), 1);
    await zu(p);
  }

  // 2) Erstes Einschalten
  { // (a) Mac voll, Ablage leer: hochgeladen
    const A = L.ablage();
    const mac = await geraet(A, blockSeed(), 'mac', 1280);
    await einschalten(mac);
    const f = A.inhalt();
    L.expect('(a) Ablage: Format und Version', f && [f.format, f.version], ['lernsystem-abgleich', 1]);
    L.expect('(a) Ablage enthält die Blöcke des Mac', f && Object.keys(f.daten.bloecke).sort(), ['b1', 'b2']);
    L.expect('(a) Inhalt der Blöcke stimmt', f && f.daten.bloecke.b1.titel, 'Sachenrecht lesen');
    L.has('(a) Mac zeigt Statuszeile', await L.text(mac, '#abg-zeile'), 'Abgeglichen um');
    L.expect('(a) eingeschaltet', (await stand(mac)).an, true);
    // (b) iPhone leer, Ablage voll: übernimmt ohne Frage
    const ph = await geraet(A, {}, 'iphone', 390);
    await einschalten(ph);
    L.expect('(b) keine Frage', await ph.locator('[data-a=abgLokal]').count(), 0);
    L.expect('(b) iPhone hat die Blöcke aus der Ablage', await ids(ph), ['b1', 'b2']);
    L.expect('(b) eingeschaltet', (await stand(ph)).an, true);
    L.expect('(b) Ablage blieb unverändert', A.inhalt().daten.bloecke, f.daten.bloecke);
    await zu(mac, ph);
  }
  { // (c) beide voll: Frage; „Stand aus der Ablage“
    const A = L.ablage();
    const mac = await geraet(A, blockSeed(), 'mac', 1280); await einschalten(mac);
    const vorher = JSON.stringify(A.inhalt());
    const ph = await geraet(A, { bloecke: { x1: { titel: 'Eigener Block am iPhone', woche: WOCHE, tag: TAG, status: 'offen', quelle: 'frei', erstellt: 9 } } }, 'iphone', 390);
    await einschalten(ph);
    L.expect('(c) Frage erscheint', await ph.locator('[data-a=abgFern]').count(), 1);
    L.has('(c) Frage empfiehlt den Mac', await L.text(ph, '[data-k=abgleich]'), 'Mac');
    L.expect('(c) vor der Antwort nicht eingeschaltet', (await stand(ph)).an, false);
    L.expect('(c) vor der Antwort nichts geschrieben', JSON.stringify(A.inhalt()), vorher);
    await L.click(ph, '[data-a=abgNo]');
    L.expect('(c) „Abbrechen“: kein Abgleich, eigener Block bleibt', [(await stand(ph)).an, await ids(ph)], [false, ['x1']]);
    L.expect('(c) „Abbrechen“: Frage und Formular weg, „Einrichten“ da', [await ph.locator('[data-a=abgFern]').count(), await ph.locator('[data-a=abgOpen]').count()], [0, 1]);
    L.expect('(c) „Abbrechen“: Ablage unverändert', JSON.stringify(A.inhalt()), vorher);
    await einschalten(ph);
    await L.click(ph, '[data-a=abgFern]'); await warte(ph, 600);
    L.expect('(c) „Stand aus der Ablage“: iPhone hat genau den Stand der Ablage', await ids(ph), ['b1', 'b2']);
    L.expect('(c) eingeschaltet', (await stand(ph)).an, true);
    L.expect('(c) Ablage nicht verändert', A.inhalt().daten.bloecke, JSON.parse(vorher).daten.bloecke);
    await zu(mac, ph);
  }
  { // (c2) „Stand dieses Geräts“: Ablage bekommt genau diesen Stand, ein verbundenes Gerät verliert die anderen Einträge
    const A = L.ablage();
    const mac = await geraet(A, blockSeed(), 'mac', 1280); await einschalten(mac);
    const dritt = await geraet(A, {}, 'dritt', 390); await einschalten(dritt);
    L.expect('(c2) drittes Gerät übernimmt zunächst alles', await ids(dritt), ['b1', 'b2']);
    const neu = await geraet(A, { bloecke: { x1: { titel: 'Stand dieses Geräts', woche: WOCHE, tag: TAG, status: 'offen', quelle: 'frei', erstellt: 9 } } }, 'neu', 390);
    await einschalten(neu);
    L.expect('(c2) Frage erscheint', await neu.locator('[data-a=abgLokal]').count(), 1);
    await L.click(neu, '[data-a=abgLokal]'); await warte(neu, 600);
    L.expect('(c2) Ablage hat genau den Stand des Geräts', Object.keys(A.inhalt().daten.bloecke), ['x1']);
    L.expect('(c2) Ablage vermerkt das Gelöschte', ['bloecke/b1', 'bloecke/b2'].every((k) => k in A.inhalt().weg), true);
    L.expect('(c2) Gerät selbst unverändert', await ids(neu), ['x1']);
    await ab(dritt);
    L.expect('(c2) bereits verbundenes Gerät verliert die anderen Einträge', await ids(dritt), ['x1']);
    await ab(mac);
    L.expect('(c2) auch der Mac', await ids(mac), ['x1']);
    await zu(mac, dritt, neu);
  }
  { // falscher Schlüssel
    const A = L.ablage();
    const p = await geraet(A, blockSeed(), 'mac', 1280);
    await einschalten(p, 'falscher-schluessel');
    L.has('falscher Schlüssel: Hinweis', await L.toast(p), 'Prüf Repository und Schlüssel');
    L.expect('falscher Schlüssel: bleibt aus', (await stand(p)).an, false);
    L.expect('falscher Schlüssel: nichts in der Ablage', A.inhalt(), null);
    L.expect('falscher Schlüssel: Anfragen scheiterten mit 401', A.anfragen.every((a) => a.status === 401), true);
    L.expect('falscher Schlüssel: Daten unverändert', await ids(p), ['b1', 'b2']);
    await zu(p);
  }

  // 3) Nacheinander arbeiten: am iPhone abhaken, am Mac sehen
  {
    const { mac, ph } = await paar(blockSeed());
    await abhaken(ph, 'b1');
    L.expect('3) iPhone: b1 erledigt', (await bl(ph)).b1.status, 'erledigt');
    await ab(ph); await ab(mac);
    L.expect('3) Mac: b1 erledigt (Speicher)', (await bl(mac)).b1.status, 'erledigt');
    L.expect('3) Mac: b2 weiter offen', (await bl(mac)).b2.status, 'offen');
    await heute(mac);
    L.expect('3) Mac: Haken sichtbar', await mac.getAttribute('[data-a=tBlock][data-id=b1]', 'aria-pressed').catch(() => 'kein aria-pressed'), 'true');
    L.expect('3) iPhone und Mac gleich', L.diff(await L.store(mac), await L.store(ph)), []);
    await zu(mac, ph);
  }

  // 4) Verschiedene Einträge gleichzeitig geändert: beide Änderungen bleiben
  for (const art of ['umbenennen', 'hinzufügen']) {
    const { mac, ph } = await paar(blockSeed());
    await abhaken(ph, 'b1');
    if (art === 'umbenennen') await umbenennen(mac, 'b2', 'BGB AT neu'); else await hinzufuegen(mac, 'Neuer Block am Mac');
    await ab(ph); await ab(mac); await ab(ph);
    const sm = await L.store(mac); const sp = await L.store(ph);
    L.expect('4) ' + art + ': Mac hat das Abhaken vom iPhone', sm.bloecke.b1.status, 'erledigt');
    L.expect('4) ' + art + ': iPhone hat die Änderung vom Mac', art === 'umbenennen' ? sp.bloecke.b2.titel : Object.values(sp.bloecke).some((b) => b.titel === 'Neuer Block am Mac'), art === 'umbenennen' ? 'BGB AT neu' : true);
    L.expect('4) ' + art + ': Mac und iPhone gleich', L.diff(sm, sp), []);
    await zu(mac, ph);
  }

  // 5) Derselbe Eintrag auf beiden geändert: die spätere Änderung gewinnt, auch wenn das ältere Gerät zuletzt abgleicht
  for (const fall of [{ erst: 'mac', ab: ['ph', 'mac'], text: 'älteres Gerät (Mac) gleicht zuletzt ab' }, { erst: 'iphone', ab: ['mac', 'ph'], text: 'älteres Gerät (iPhone) gleicht zuletzt ab' }]) {
    const g = await paar(blockSeed());
    const dev = { mac: g.mac, iphone: g.ph };
    const spaet = fall.erst === 'mac' ? 'iphone' : 'mac';
    await umbenennen(dev[fall.erst], 'b1', 'Titel von ' + fall.erst);
    await warte(g.mac, 30);
    await umbenennen(dev[spaet], 'b1', 'Titel von ' + spaet);
    for (const w of fall.ab) await ab(w === 'mac' ? g.mac : g.ph);
    await ab(g.ph); await ab(g.mac);
    L.expect('5) ' + fall.text + ': Mac hat die spätere Änderung', (await bl(g.mac)).b1.titel, 'Titel von ' + spaet);
    L.expect('5) ' + fall.text + ': iPhone hat die spätere Änderung', (await bl(g.ph)).b1.titel, 'Titel von ' + spaet);
    L.expect('5) ' + fall.text + ': Ablage ebenso', g.A.inhalt().daten.bloecke.b1.titel, 'Titel von ' + spaet);
    await zu(g.mac, g.ph);
  }

  // 6) Löschen kommt an und wird nicht wiederbelebt
  {
    const { A, mac, ph } = await paar(blockSeed());
    await loeschen(mac, 'b1');
    L.expect('6) Mac: b1 gelöscht', await ids(mac), ['b2']);
    await ab(mac); await ab(ph);
    L.expect('6) iPhone: b1 weg', await ids(ph), ['b2']);
    L.ok('6) Ablage vermerkt das Löschen', 'bloecke/b1' in A.inhalt().weg, Object.keys(A.inhalt().weg));
    L.expect('6) Ablage: b1 nicht mehr in den Daten', Object.keys(A.inhalt().daten.bloecke), ['b2']);
    await ab(mac); await ab(ph);
    L.expect('6) bleibt weg (Mac)', await ids(mac), ['b2']);
    L.expect('6) bleibt weg (iPhone)', await ids(ph), ['b2']);
    L.expect('6) bleibt weg (Ablage)', Object.keys(A.inhalt().daten.bloecke), ['b2']);
    await zu(mac, ph);
  }
  { // ältere Änderung am iPhone, Löschen am Mac später, iPhone gleicht erst danach ab
    const { A, mac, ph } = await paar(blockSeed());
    await umbenennen(ph, 'b1', 'Am iPhone geändert, aber früher');
    await warte(mac, 30);
    await loeschen(mac, 'b1');
    await ab(mac); await ab(ph);
    L.expect('6) spätere Löschung gewinnt: iPhone', await ids(ph), ['b2']);
    L.expect('6) spätere Löschung gewinnt: Ablage', Object.keys(A.inhalt().daten.bloecke), ['b2']);
    await ab(mac);
    L.expect('6) spätere Löschung gewinnt: Mac', await ids(mac), ['b2']);
    // umgekehrt: Änderung später als das Löschen: der Block bleibt (die spätere Änderung gewinnt)
    await zu(mac, ph);
  }
  { // umgekehrt: Änderung nach dem Löschen gewinnt
    const { A, mac, ph } = await paar(blockSeed());
    await loeschen(mac, 'b1');
    await warte(mac, 30);
    await umbenennen(ph, 'b1', 'Am iPhone später geändert');
    await ab(mac); await ab(ph); await ab(mac);
    L.expect('6) spätere Änderung gewinnt gegen das Löschen: Mac', (await bl(mac)).b1 && (await bl(mac)).b1.titel, 'Am iPhone später geändert');
    L.expect('6) spätere Änderung gewinnt gegen das Löschen: Ablage', A.inhalt().daten.bloecke.b1 && A.inhalt().daten.bloecke.b1.titel, 'Am iPhone später geändert');
    await zu(mac, ph);
  }
  { // Grabsteine: älter als 60 Tage werden aufgeräumt (direkt über merge)
    const p = await L.open({}, UHR, 1280);
    const J = 1e13; const TG = 864e5;
    const leer = { flat: {}, z: {}, weg: {} };
    const r = await p.evaluate(([J, TG]) => {
      const M = window.__ls.abgleich.merge; const leer = () => ({ flat: {}, z: {}, weg: {} });
      const mit = (weg) => ({ flat: {}, z: {}, weg: weg });
      return {
        alt: M(mit({ 'bloecke/a': J - 61 * TG }), leer(), J),
        jung: M(mit({ 'bloecke/a': J - 30 * TG }), leer(), J),
        ferngrab: M(leer(), mit({ 'bloecke/a': J - 61 * TG }), J),
        datenNeuer: M(mit({ 'bloecke/a': J - 61 * TG }), { flat: { 'bloecke/a': { titel: 'x' } }, z: { 'bloecke/a': J - TG }, weg: {} }, J),
        grabNeuer: M(mit({ 'bloecke/a': J - 5 * TG }), { flat: { 'bloecke/a': { titel: 'x' } }, z: { 'bloecke/a': J - 10 * TG }, weg: {} }, J)
      };
    }, [J, TG]);
    L.expect('Grabstein über 60 Tage wird aufgeräumt', r.alt.weg, {});
    L.expect('Grabstein über 60 Tage von der Ablage wird aufgeräumt', r.ferngrab.weg, {});
    L.expect('Grabstein unter 60 Tagen bleibt', r.jung.weg, { 'bloecke/a': J - 30 * TG });
    L.expect('neuere Daten gewinnen gegen alten Grabstein', [r.datenNeuer.flat['bloecke/a'], r.datenNeuer.weg], [{ titel: 'x' }, {}]);
    L.expect('neuerer Grabstein gewinnt gegen ältere Daten', [r.grabNeuer.flat, Object.keys(r.grabNeuer.weg)], [{}, ['bloecke/a']]);
    L.expect('merge meldet, wer etwas Neues hat', [r.jung.fernNeu, r.jung.lokalNeu, r.datenNeuer.lokalNeu], [true, false, true]);
    await p.context().close();
    // über die Ablage: ein alter Grabstein verschwindet beim nächsten Schreiben, ein junger bleibt
    const A = L.ablage();
    const mac = await geraet(A, blockSeed(), 'mac', 1280); await einschalten(mac);
    const f = A.inhalt(); f.weg = { 'bloecke/alt': Date.now() - 61 * TG, 'bloecke/jung': Date.now() - TG }; A.setze(f);
    await abhaken(mac, 'b1'); await ab(mac);
    L.expect('Ablage: alter Grabstein weg, junger bleibt', Object.keys(A.inhalt().weg), ['bloecke/jung']);
    await zu(mac);
  }

  // 7) Ohne Netz ändern, später abgleichen
  {
    const { A, mac, ph } = await paar(blockSeed());
    A.offline.add(ph);
    await abhaken(ph, 'b1');
    await ab(ph);
    await zuEinstellungen(ph);
    L.has('7) Zeile „Kein Netz“', await L.text(ph, '#abg-zeile'), 'Kein Netz – wird später abgeglichen');
    L.expect('7) Daten lokal da', (await bl(ph)).b1.status, 'erledigt');
    L.expect('7) merkt sich, dass noch etwas offen ist', (await stand(ph)).offen, true);
    const rot = await ph.evaluate(roteStellenIn, '[data-k=abgleich]');
    L.expect('18) „Kein Netz“: keine rote Farbe im Bereich', rot, []); // Kein Druck
    A.offline.delete(ph);
    await ab(ph); await ab(mac);
    L.expect('7) Mac sieht die Änderung', (await bl(mac)).b1.status, 'erledigt');
    L.expect('7) iPhone: nichts mehr offen', (await stand(ph)).offen, false);
    await zuEinstellungen(mac);
    L.ok('7) Mac: Zeile „Abgeglichen um HH:MM“', /Abgeglichen um \d\d:\d\d/.test(await L.text(mac, '#abg-zeile')), await L.text(mac, '#abg-zeile'));
    await zuEinstellungen(ph);
    L.ok('7) iPhone: Zeile „Abgeglichen um HH:MM“', /Abgeglichen um \d\d:\d\d/.test(await L.text(ph, '#abg-zeile')), await L.text(ph, '#abg-zeile'));
    L.expect('7) iPhone: nach Wiederkehr des Netzes bleibt kein Fehlerstatus', (await stand(ph)).status, 'ok');
    await zu(mac, ph);
  }

  // 8) sha-Konflikt: der Mac schreibt dazwischen, während das iPhone schreibt
  {
    const { A, mac, ph } = await paar(blockSeed());
    await abhaken(ph, 'b1');
    A.vorPut = async () => { await umbenennen(mac, 'b2', 'BGB AT vom Mac dazwischen'); await ab(mac); };
    const n = A.anfragen.length;
    await ab(ph);
    const f = A.inhalt();
    L.expect('8) beide Änderungen in der Ablage', [f.daten.bloecke.b1.status, f.daten.bloecke.b2.titel], ['erledigt', 'BGB AT vom Mac dazwischen']);
    const meine = A.anfragen.slice(n).filter((a) => a.seite === 'iphone').map((a) => a.m + ' ' + a.status);
    const i409 = meine.indexOf('PUT 409');
    L.ok('8) iPhone: PUT 409, danach GET und PUT 200', i409 >= 0 && /GET (200|304)/.test(meine[i409 + 1] || '') && meine[i409 + 2] === 'PUT 200', meine.join(', '));
    await ab(mac);
    L.expect('8) Mac hat am Ende auch beides', [(await bl(mac)).b1.status, (await bl(mac)).b2.titel], ['erledigt', 'BGB AT vom Mac dazwischen']);
    L.expect('8) iPhone hat beides', [(await bl(ph)).b1.status, (await bl(ph)).b2.titel], ['erledigt', 'BGB AT vom Mac dazwischen']);
    await zu(mac, ph);
  }

  // 9) Von selbst: nach einer Änderung, regelmäßig, 304 bei unveränderter Ablage
  {
    const { A, mac, ph } = await paar(blockSeed());
    await ph.evaluate(() => { window.__ls.abgleich.T.nach = 300; });
    await abhaken(ph, 'b1');
    await warte(ph, 1500);
    L.expect('9) Änderung gelangt von selbst in die Ablage', A.inhalt().daten.bloecke.b1.status, 'erledigt');
    // Mac holt es von selbst: Takt und Puls verkürzen (der laufende Pulsschlag liest den neuen Wert erst nach höchstens 5 s)
    await mac.evaluate(() => { window.__ls.abgleich.T.takt = 1500; window.__ls.abgleich.T.puls = 300; });
    let da = false;
    for (let i = 0; i < 40 && !da; i++) { await warte(mac, 300); da = (await bl(mac)).b1.status === 'erledigt'; }
    L.ok('9) Mac holt die fremde Änderung ohne Zutun (regelmäßiger Takt)', da);
    const n = A.anfragen.length;
    await warte(mac, 3500);
    const neu = A.anfragen.slice(n).filter((a) => a.seite === 'mac');
    L.ok('9) unveränderte Ablage: Anfragen laufen weiter', neu.length >= 1, neu.length);
    L.ok('9) unveränderte Ablage: Antwort 304', neu.some((a) => a.m === 'GET' && a.status === 304), neu.map((a) => a.m + ' ' + a.status).join(', '));
    L.expect('9) unveränderte Ablage: kein PUT', neu.filter((a) => a.m === 'PUT').length, 0);
    await mac.evaluate(() => { window.__ls.abgleich.T.takt = 1e9; });
    await zu(mac, ph);
  }

  // 10) Schlüssel nicht im Export und nicht in den Daten; 16) Gerätebezogenes bleibt lokal
  {
    const { A, mac, ph } = await paar(Object.assign(blockSeed(), { themen: { zr: { name: 'Zivilrecht', eltern: null, zustand: 'aktiv' } } }));
    await mac.evaluate(() => { window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b); }; });
    await zuEinstellungen(mac);
    await L.click(mac, '[data-a=esExport]');
    const export_ = await mac.evaluate(async () => (window.__blobs.length ? await window.__blobs[window.__blobs.length - 1].text() : ''));
    L.ok('10) Export wurde erzeugt', export_.length > 10, export_.length);
    L.hasNot('10) Export ohne Schlüssel', export_, 'test-schluessel');
    L.hasNot('10) Export ohne „abgleich“', export_.toLowerCase(), 'abgleich');
    const daten = await mac.evaluate(() => localStorage.getItem('lernsystem-daten-v1') + JSON.stringify(window.__store));
    L.hasNot('10) Daten ohne Schlüssel', daten, 'test-schluessel');
    L.hasNot('10) Daten ohne „abgleich“', daten, 'abgleich');
    L.has('10) Schlüssel liegt im eigenen Speicher', await mac.evaluate(() => localStorage.getItem('lernsystem-abgleich-v1')), 'test-schluessel');
    L.expect('10) stand() maskiert den Schlüssel', (await stand(mac)).token, '(gesetzt)');
    L.hasNot('10) Datei in der Ablage ohne Schlüssel', JSON.stringify(A.inhalt()), 'test-schluessel');
    // Gerätebezogenes: Darstellung und „nur Offenes“ bleiben auf dem Gerät
    await L.click(mac, '[data-a=esDesign][data-v=dunkel]');
    await L.go(mac, 'themen'); await L.click(mac, '[data-a=thNurOffen]');
    L.expect('16) Darstellung und „nur Offenes“ am Mac gemerkt', await mac.evaluate(() => [localStorage.getItem('lernsystem-design'), localStorage.getItem('lernsystem-nur-offen')]), ['dunkel', '1']);
    await abhaken(mac, 'b1'); await ab(mac); await ab(ph);
    const roh = JSON.stringify(A.inhalt());
    L.hasNot('16) Ablage ohne Darstellung', roh, 'lernsystem-design');
    L.hasNot('16) Ablage ohne „nur Offenes“', roh, 'lernsystem-nur-offen');
    L.expect('16) iPhone bekommt Darstellung und „nur Offenes“ nicht', await ph.evaluate(() => [localStorage.getItem('lernsystem-design'), localStorage.getItem('lernsystem-nur-offen')]), [null, null]);
    await zu(mac, ph);
  }

  // 11) Rückgängig nach Abgleich
  {
    const { mac, ph } = await paar(blockSeed());
    const vorher = (await bl(mac)).b1;
    await loeschen(mac, 'b1');
    L.expect('11) „Rückgängig“ wird angeboten', await mac.locator('.toast [data-a=undo]').count(), 1);
    await ab(mac); await ab(ph);
    L.expect('11) am iPhone weg', await ids(ph), ['b2']);
    L.expect('11) „Rückgängig“ noch da', await mac.locator('.toast [data-a=undo]').count(), 1);
    await L.click(mac, '.toast [data-a=undo]');
    L.expect('11) Mac: Block wieder da, gleich wie vorher', (await bl(mac)).b1, vorher);
    await ab(mac); await ab(ph);
    L.expect('11) iPhone: Block wieder da, gleich wie vorher', (await bl(ph)).b1, vorher);
    await ab(mac);
    L.expect('11) Mac und iPhone gleich', L.diff(await L.store(mac), await L.store(ph)), []);
    await zu(mac, ph);
  }

  // 12) Timer
  {
    const { mac, ph } = await paar(blockSeed());
    await heute(ph);
    await L.click(ph, '[data-a=startT][data-art=b][data-id=b1]');
    await ab(ph); await ab(mac);
    await heute(mac);
    const sm = await L.store(mac);
    L.expect('12) Mac: Timer läuft für b1', [sm.meta.timer && sm.meta.timer.laeuft, sm.meta.timer && sm.meta.timer.id], [true, 'b1']);
    L.ok('12) Mac: Timerleiste sichtbar', await mac.locator('#timer-el').isVisible());
    await L.sim(mac, TAG, 10 * 60 + 20); await L.sim(ph, TAG, 10 * 60 + 20);
    await L.click(mac, '[data-a=stopT]');
    L.expect('12) Mac: nach Stopp 20 min am Block, Timer aus', [(await bl(mac)).b1.zeit, (await L.store(mac)).meta.timer.laeuft], [20, false]);
    await ab(mac); await ab(ph);
    const sp = await L.store(ph);
    L.expect('12) iPhone: Timer aus, gleiche Zeit am Block', [sp.meta.timer.laeuft, sp.bloecke.b1.zeit], [false, 20]);
    L.expect('12) iPhone: keine Timerleiste mehr', await ph.locator('#timer-el').count(), 0);
    await zu(mac, ph);
  }

  // 13) Sichern/Laden: ein geladener Stand wird danach normal abgeglichen
  {
    const { mac, ph } = await paar(blockSeed());
    const s = await L.store(mac);
    s.bloecke = { n1: { titel: 'Aus der Sicherung 1', woche: WOCHE, tag: TAG, status: 'offen', quelle: 'frei', erstellt: 5 }, b2: Object.assign({}, s.bloecke.b2, { titel: 'BGB AT aus der Sicherung' }) };
    delete s.meta.timer;
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
    const datei = path.join(__dirname, 'out', 'abgleich-sicherung.json');
    fs.writeFileSync(datei, JSON.stringify({ format: 'lernsystem', version: 1, exportiert: TAG, daten: s }));
    try {
      await zuEinstellungen(mac);
      await mac.setInputFiles('input[data-ch=esImport]', datei); await warte(mac, 400);
      await L.click(mac, '[data-a=esImportYes]');
      L.expect('13) Mac: geladener Stand', await ids(mac), ['b2', 'n1']);
      await ab(mac); await ab(ph);
      L.expect('13) iPhone: genau der geladene Stand (Blöcke)', await ids(ph), ['b2', 'n1']);
      L.expect('13) iPhone: geänderter Text', (await bl(ph)).b2.titel, 'BGB AT aus der Sicherung');
      const sm = await L.store(mac); const sp = await L.store(ph);
      L.expect('13) Mac und iPhone gleich', L.diff(sm, sp), []);
    } finally { fs.rmSync(datei, { force: true }); }
    await zu(mac, ph);
  }

  // 14) Wiederholungsliste des Tages
  {
    const einheit = (titel, faellig, stufe) => ({ titel, woche: '2026-11-02', tag: '2026-11-03', status: 'erledigt', erledigtAm: '2026-11-03', wiederholen: true, sr: { stufe: stufe || 1, faellig, letzte: '2026-11-03', bewertung: 'sicher' } });
    const seed = { bloecke: { e1: einheit('Rom I', '2026-11-08', 2), e2: einheit('Sachmangel', '2026-11-09', 1), e3: einheit('Notwehr', TAG, 1) } };
    const A = L.ablage();
    const mac = await geraet(A, seed, 'mac', 1280);
    L.ok('14) Mac: Wiederholungsliste im Tag angelegt', !!(await L.store(mac)).tage[TAG] && !!(await L.store(mac)).tage[TAG].wdh, (await L.store(mac)).tage[TAG]);
    await einschalten(mac);
    const ph = await geraet(A, {}, 'iphone', 390); await einschalten(ph);
    await heute(ph);
    L.expect('14) iPhone: gleiche Liste wie der Mac', (await L.store(ph)).tage[TAG].wdh.liste, (await L.store(mac)).tage[TAG].wdh.liste);
    await L.click(ph, '[data-a=rateW][data-r=sicher]');
    const bew = (await L.store(ph)).tage[TAG].wdh.bew;
    L.expect('14) iPhone: eine Bewertung', Object.keys(bew).length, 1);
    await ab(ph);
    await L.go(mac, 'woche'); await ab(mac); await heute(mac);
    const wm = (await L.store(mac)).tage[TAG].wdh; const wp = (await L.store(ph)).tage[TAG].wdh;
    L.expect('14) Mac: gleiche Tagesliste mit Bewertung', wm, wp);
    L.expect('14) Mac: Bewertung angekommen', Object.keys(wm.bew), Object.keys(bew));
    L.expect('14) Mac und iPhone gleich', L.diff(await L.store(mac), await L.store(ph)), []);
    await zu(mac, ph);
  }

  // 15) Feingranular: verschiedene Stellschrauben auf beiden Geräten bleiben beide erhalten
  {
    const { mac, ph } = await paar(blockSeed());
    const cfg = (p) => p.evaluate(() => window.__ls.cfg());
    const vor = await cfg(mac);
    await zuEinstellungen(mac); await L.click(mac, '[data-a=esOpen][data-v=ober]'); await L.click(mac, '[data-a=esStep][data-d="0.5"]');
    const nachMac = await cfg(mac);
    const macKeys = Object.keys(nachMac).filter((k) => JSON.stringify(nachMac[k]) !== JSON.stringify(vor[k]));
    await zuEinstellungen(ph); await L.click(ph, '[data-a=esOpen][data-v=puf]'); await L.click(ph, '[data-a=esSet][data-k=pufferTag][data-n="-1"]');
    L.ok('15) Mac hat genau eine Stellschraube geändert', macKeys.length === 1, macKeys);
    L.expect('15) iPhone hat den Puffer geändert', (await cfg(ph)).pufferTag, -1);
    await ab(ph); await ab(mac); await ab(ph);
    const cm = await cfg(mac); const cp = await cfg(ph);
    L.expect('15) Mac hat beide Änderungen', [cm[macKeys[0]], cm.pufferTag], [nachMac[macKeys[0]], -1]);
    L.expect('15) iPhone hat beide Änderungen', [cp[macKeys[0]], cp.pufferTag], [nachMac[macKeys[0]], -1]);
    L.expect('15) Einstellungen gleich', cm, cp);
    await zu(mac, ph);
  }

  // 17) Große Datei (die API liefert den Inhalt dann nur über /git/blobs/)
  {
    const { A, mac, ph } = await paar(blockSeed());
    A.gross = true;
    const ph2 = await geraet(A, {}, 'iphone2', 390);
    await einschalten(ph2);
    L.expect('17) Gerät übernimmt den Stand trotzdem', await ids(ph2), ['b1', 'b2']);
    L.ok('17) Inhalt kam über /git/blobs/', A.anfragen.some((a) => a.seite === 'iphone2' && /\/git\/blobs\//.test(a.pfad) && a.status === 200), A.anfragen.filter((a) => a.seite === 'iphone2').map((a) => a.pfad));
    await abhaken(mac, 'b1'); await ab(mac); await ab(ph2);
    L.expect('17) spätere Änderung kommt auch bei großer Datei an', (await bl(ph2)).b1.status, 'erledigt');
    await zu(mac, ph, ph2);
  }

  // 19) iPhone-Breite 390: Einrichten, Frage, eingeschaltet
  {
    const A = L.ablage();
    const mac = await geraet(A, blockSeed(), 'mac', 1280); await einschalten(mac);
    const ph = await geraet(A, { bloecke: { x1: { titel: 'Eigener Block', woche: WOCHE, tag: TAG, status: 'offen', quelle: 'frei', erstellt: 9 } } }, 'iphone', 390);
    const knoepfe = async (wo) => {
      const gross = await ph.evaluate(() => Array.from(document.querySelectorAll('[data-k=abgleich] button')).filter((b) => b.offsetParent !== null).map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]));
      L.ok('19) ' + wo + ': Knöpfe vorhanden', gross.length > 0, gross);
      L.ok('19) ' + wo + ': alle Knöpfe mindestens 40 px hoch', gross.every((g) => g[1] >= 40), JSON.stringify(gross.filter((g) => g[1] < 40)));
    };
    await zuEinstellungen(ph); await L.noHScroll(ph, 'Einstellungen (Abgleich aus)'); await knoepfe('aus');
    await L.click(ph, '[data-a=abgOpen]'); await L.noHScroll(ph, 'Einstellungen (Formular offen)'); await knoepfe('Formular');
    await L.fill(ph, '#abg-token', 'test-schluessel'); await L.click(ph, '[data-a=abgEin]'); await warte(ph, 600);
    await L.noHScroll(ph, 'Einstellungen (Frage offen)'); await knoepfe('Frage');
    L.expect('18) Frage: keine rote Farbe', await ph.evaluate(roteStellenIn, '[data-k=abgleich]'), []);
    await L.click(ph, '[data-a=abgFern]'); await warte(ph, 600);
    await L.noHScroll(ph, 'Einstellungen (eingeschaltet)'); await knoepfe('eingeschaltet');
    L.expect('18) eingeschaltet: keine rote Farbe', await ph.evaluate(roteStellenIn, '[data-k=abgleich]'), []);
    await L.go(ph, 'heute'); await L.noHScroll(ph, 'Heute (eingeschaltet)');
    await zu(mac, ph);
  }
});
