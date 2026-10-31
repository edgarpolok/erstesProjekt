// Langzeit-Nutzung: ein Jurastudent benutzt die App ~26 Monate (8 Monate Schwerpunktbereich, 18 Monate Examensvorbereitung).
// Die Simulation läuft Tag für Tag mit simulierter Uhr und prüft unterwegs, dass nichts kaputtgeht:
//  - gespeicherter Stand = Stand im Speicher (täglich), kein Skript-/Konsolenfehler, kein „Speichern hat nicht geklappt“
//  - Daten heil (wöchentlich): keine NaN/undefined, Datumsfelder, Verweise, Baum ohne Zyklen, Ids, keine negativen Zeiten
//  - alle Ansichten zeichnen ohne „konnte nicht angezeigt“ und ohne waagerechte Scrollleiste (echte Klicks, wöchentlich)
//  - Wiederholung plausibel (Liste an Lerntagen, späteres „fällig“ nach der Bewertung, nichts uralt überfällig)
//  - Sichern und Laden über die echte Datei-Eingabe (monatlich), Endstand in frischem Browser-Kontext
//  - Speichergröße (< 4 000 000 Zeichen) und Geschwindigkeit der Ansichten (< 1500 ms)
// Aufruf: node tests/rand/langzeit.js [pfad/zur/index.html]
// Umgebung: MONATE (Standard 26, zum Abkürzen), P2MONAT (Monat, in dem die Examensvorbereitung beginnt, Standard 9), TAGLOG=1 (Zeit je Woche).
// Zufall nur mit festem Seed (mulberry32), damit jeder Lauf gleich verläuft.
const L = require('../lib');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MONATE = Math.max(1, parseInt(process.env.MONATE || '26', 10));
const P2MONAT = Math.max(1, parseInt(process.env.P2MONAT || '9', 10));
const SEED = 20261102;
const START_TAG = '2026-11-01'; // Sonntag; Planung der ersten Woche, Mo 2026-11-02 ist der erste Lerntag
const monatsEnde = (n) => { // letzter Tag des n-ten Monats ab November 2026
  const m0 = 9 + n; // 0-basierter Monat ab Januar 2026: Nov 2026 = 10 → n = 1
  return new Date(Date.UTC(2026 + Math.floor(m0 / 12), (m0 % 12) + 1, 0, 12)).toISOString().slice(0, 10);
};
const P2 = (() => { const m0 = 10 + (P2MONAT - 1); const y = 2026 + Math.floor(m0 / 12); const m = (m0 % 12) + 1; return y + '-' + String(m).padStart(2, '0') + '-01'; })();
const ENDE = process.env.STOPTAG && process.env.STOPTAG < monatsEnde(MONATE) ? process.env.STOPTAG : monatsEnde(MONATE); // STOPTAG: nur beim Entwickeln
const STICHTAGE = [8, 12, 18, 26].filter((n) => n <= MONATE);
if (!STICHTAGE.includes(MONATE)) STICHTAGE.push(MONATE);
const wdOf = (d) => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
const lastOfMonth = (d) => L.addDays(d, 1).slice(8) === '01';
const stichtagAn = {}; STICHTAGE.forEach((n) => { stichtagAn[monatsEnde(n)] = n; });

/* ================================================================================================================
   Der Student im Browser. Alles läuft in der Seite: Aktionen über runAct (derselbe Weg wie ein Klick), Eingabefelder
   über F[...], Änderungsfelder über CHANGE[...]. Pro Tag ein evaluate, damit es schnell bleibt.
   ================================================================================================================ */
function browser(CFG) {
  /* ---------- Zufall und Hilfen ---------- */
  let seed = CFG.seed >>> 0;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = rnd; // damit auch die Ids der App bei jedem Lauf gleich ausfallen
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const chance = (p) => rnd() < p;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => { o[key] = x[key]; return o; }, {}) : x));
  const KEY = 'lernsystem-daten-v1';

  const errs = []; const errSeen = {};
  const err = (m) => { const k = String(m).slice(0, 90); errSeen[k] = (errSeen[k] || 0) + 1; if (errSeen[k] === 1) errs.push(String(m).slice(0, 300)); };
  const toasts = {};
  const origToast = window.toast;
  window.toast = function (text, snap) { // jede Meldung zählen; „Speichern hat nicht geklappt“ ist immer ein Fehler
    const k = String(text).replace(/[0-9]+/g, 'N').slice(0, 60); toasts[k] = (toasts[k] || 0) + 1;
    if (/Speichern hat nicht geklappt/.test(text)) err('Meldung „' + text + '“ am ' + today());
    return origToast.apply(this, arguments);
  };
  const act = (a, d) => {
    try { runAct({ dataset: Object.assign({ a: a }, d || {}), getAttribute: () => null }); } catch (e) { err('Aktion ' + a + ' am ' + today() + ': ' + (e && e.message)); }
  };
  const chg = (name, dataset, value) => { try { CHANGE[name]({ dataset: dataset, value: value }); scheduleRender(); } catch (e) { err('Änderung ' + name + ' am ' + today() + ': ' + (e && e.message)); } };
  const step = (name, fn) => { try { return fn(); } catch (e) { err(name + ' am ' + today() + ': ' + (e && e.message)); } };
  const astep = async (name, fn) => { try { return await fn(); } catch (e) { err(name + ' am ' + today() + ': ' + (e && e.message)); } };

  /* ---------- Inhalte ---------- */
  const T = (name, kids) => ({ name: name, kids: kids || [] });
  const lines = (n, lv, out) => { out.push('  '.repeat(lv) + n.name); n.kids.forEach((k) => lines(k, lv + 1, out)); return out; };
  const text = (nodes) => nodes.reduce((o, n) => lines(n, 0, o), []).join('\n');
  // Themen mit Unterthemen (jedes dritte): „X: Voraussetzungen“, „X: Rechtsfolgen“ (+ ggf. „Klausurprobleme“)
  const mitSub = (names) => names.split('|').map((n, i) => T(n, i % 3 === 1 ? ['Voraussetzungen', 'Rechtsfolgen'].concat(i % 2 ? ['Klausurprobleme'] : []).map((s) => T(n + ': ' + s)) : []));
  const IPR = [T('Internationales Privatrecht', [
    T('Allgemeiner Teil', [T('Qualifikation'), T('Renvoi und Weiterverweisung'), T('Vorfrage'), T('Ordre public', [T('Art. 6 EGBGB'), T('Ordre public bei Rom I')]), T('Anpassung und Substitution')]),
    T('Vertragsrecht (Rom I)', [T('Rechtswahl', [T('Ausdrückliche Rechtswahl'), T('Stillschweigende Rechtswahl')]), T('Objektive Anknüpfung'), T('Verbraucherverträge'), T('Eingriffsnormen', [T('Inländische Eingriffsnormen'), T('Ausländische Eingriffsnormen')])]),
    T('Außervertragliche Schuldverhältnisse (Rom II)', [T('Deliktsrecht', [T('Tatortregel'), T('Produkthaftung')]), T('Bereicherungsrecht'), T('Geschäftsführung ohne Auftrag')]),
    T('Familien- und Erbrecht', [T('Eheschließung'), T('Scheidung (Rom III)'), T('Unterhalt'), T('Erbstatut (EuErbVO)', [T('Gewöhnlicher Aufenthalt'), T('Nachlassspaltung')])]),
    T('Internationales Zivilverfahrensrecht', [T('Brüssel Ia', [T('Zuständigkeit'), T('Anerkennung und Vollstreckung')]), T('Internationale Zuständigkeit nach ZPO'), T('Schiedsgerichtsbarkeit')])
  ])];
  const iprChunks = () => { const r = IPR[0].kids; return [[T('Internationales Privatrecht', r.slice(0, 2))], [T('Internationales Privatrecht', r.slice(2, 4))], [T('Internationales Privatrecht', r.slice(4))]].map((c) => text(c)); };
  const GEB = {
    'Zivilrecht': {
      'Allgemeiner Teil': 'Rechts- und Geschäftsfähigkeit|Willenserklärung|Stellvertretung|Willensmängel und Anfechtung|Verjährung|Einwendungen und Einreden',
      'Schuldrecht AT': 'Vertragsschluss|AGB-Recht|Unmöglichkeit|Schuldnerverzug|Schadensersatz statt der Leistung|Rücktritt|Gläubigerwechsel',
      'Schuldrecht BT': 'Kaufrecht|Mietrecht|Werkvertrag|Darlehen und Bürgschaft|Schenkung|Auftrag',
      'Gesetzliche Schuldverhältnisse': 'Deliktsrecht §§ 823 ff.|Gefährdungshaftung|Ungerechtfertigte Bereicherung|Geschäftsführung ohne Auftrag|Schadensrecht',
      'Sachenrecht': 'Besitz|Eigentumserwerb an beweglichen Sachen|Gutgläubiger Erwerb|Eigentümer-Besitzer-Verhältnis|Grundschuld und Hypothek|Sicherungsübereignung|Pfandrechte',
      'Familien- und Erbrecht': 'Güterrecht|Verwandtschaft|Gesetzliche Erbfolge|Testament|Pflichtteil|Erbengemeinschaft',
      'Zivilprozessrecht': 'Klagearten|Zulässigkeit der Klage|Beweisrecht|Rechtskraft|Zwangsvollstreckung|Rechtsmittel'
    },
    'Strafrecht': {
      'Allgemeiner Teil': 'Tatbestand|Rechtswidrigkeit|Schuld|Versuch|Täterschaft und Teilnahme|Unterlassen|Konkurrenzen',
      'Vermögensdelikte': 'Diebstahl|Raub und räuberische Erpressung|Betrug|Untreue|Hehlerei|Sachbeschädigung',
      'Delikte gegen die Person': 'Körperverletzungsdelikte|Tötungsdelikte|Freiheitsdelikte|Beleidigungsdelikte',
      'Sonstige Delikte': 'Urkundendelikte|Straßenverkehrsdelikte|Aussagedelikte|Strafprozessrecht Grundlagen'
    },
    'Öffentliches Recht': {
      'Staatsorganisationsrecht': 'Staatsstrukturprinzipien|Bundestag und Gesetzgebung|Bundesregierung|Bundesverfassungsgericht|Föderalismus',
      'Grundrechte': 'Allgemeine Grundrechtslehren|Freiheitsrechte|Gleichheitsrechte|Eigentumsgarantie|Verfassungsbeschwerde',
      'Verwaltungsrecht AT': 'Verwaltungsakt|Rechtmäßigkeit des Verwaltungsakts|Ermessen|Aufhebung von Verwaltungsakten|Öffentlich-rechtlicher Vertrag',
      'Verwaltungsprozessrecht': 'Verwaltungsrechtsweg|Anfechtungsklage|Verpflichtungsklage|Vorläufiger Rechtsschutz',
      'Besonderes Verwaltungsrecht': 'Baurecht|Polizei- und Ordnungsrecht|Kommunalrecht|Europarecht Grundlagen'
    }
  };
  // Stücke für die Examensvorbereitung: je Teilgebiet in zwei Hälften, reihum durch die drei Gebiete
  const stuecke = () => {
    const per = Object.keys(GEB).map((g) => { const out = []; Object.keys(GEB[g]).forEach((tg) => { const n = mitSub(GEB[g][tg]); const h = Math.ceil(n.length / 2); out.push({ g: g, text: text([T(tg, n.slice(0, h))]) }); out.push({ g: g, text: text([T(tg, n.slice(h))]) }); }); return out; });
    const out = []; for (let i = 0; per.some((x) => x.length > i); i++) per.forEach((x) => { if (x[i]) out.push(x[i]); });
    return out;
  };
  const SATZ = ['Fall zum Thema durchgearbeitet', 'Lehrbuch gelesen', 'Skript wiederholt', 'Karteikarten ergänzt', 'Aufbauschema geübt', 'Übungsfall gelöst'];
  const FEHLER = ['Anspruchsgrundlage übersehen', 'Frist falsch berechnet', 'Aufbau nicht sauber', 'Meinungsstreit nicht dargestellt', 'Obersatz fehlt', 'Zeitmanagement', 'Definition ungenau', 'Sachverhalt nicht ausgeschöpft'];

  /* ---------- Stand des Studenten ---------- */
  const st = {
    cur: 540, geplant: {}, vthema: {}, offen: [], chunks: [], iprChunks: iprChunks(), gid: {}, ipr: null, pass: 1, gi: 0,
    ev: {}, klausurTermin: null, repId: null, nextSicherung: '2026-11-08', stats: { tage: 0, aus: 0, bloecke: 0, wdh: 0, spaeter: 0, geholt: 0, undo: 0, undoOk: 0, nachtrag: 0, merge: 0, del: 0, ren: 0, mv: 0, noteN: 0 },
    maxUeber: 0, seen: {}, altRueck: 0, altMax: 0, tmpl: 0, weekN: 0, wdhOhneListe: 0
  };
  const ev = (date, fn) => { (st.ev[date] = st.ev[date] || []).push(fn); };
  const addD = addDays; // Seitenfunktion

  /* ---------- Eingaben wie am Bildschirm ---------- */
  const gliedern = (txt, unter) => { F.thGlied = txt; F.thGliedUnter = unter || ''; act('thGliedSave'); };
  const topId = (name) => Object.keys(D.themen).find((id) => !D.themen[id].eltern && D.themen[id].name === name) || null;
  const routine = (titel, art, tage) => { act('esRNew'); F.rTitel = titel; ES.rArt = art; ES.rTage = tage || []; act('esRSave'); };
  const wTermin = (titel, tage, von, bis, ab, endet) => { act('esTNew'); F.tTitel = titel; ES.tTage = tage; F.tVon = von; F.tBis = bis; F.tAb = ab || ''; F.tEnd = endet || ''; act('esTSave'); return Object.keys(D.termine).find((id) => D.termine[id].titel === titel); };
  const kForm = (kind, vals) => { act('kNew', { v: kind, kl: vals.kl ? '1' : '0', d: vals.d || '' }); Object.assign(F, vals.f || {}); act('kSave'); if (F.kErr) err('Formular ' + kind + ' am ' + today() + ': ' + F.kErr); };
  const pause = (name, von, bis, art) => kForm('pause', { f: { kName: name, kVon: von, kBis: bis, kArt: art || 'frei' } });
  const etappe = (name, von, bis, ziel, stoff, komplett) => kForm('etappe', { f: { kName: name, kVon: von, kBis: bis, kZiel: ziel, kStoff: stoff || [], kKomplett: !!komplett } });
  const ausfall = (tid, von, bis) => { act('esTEdit', { id: tid }); F.tAusVon = von; F.tAusBis = bis || von; act('esTAusAdd'); act('esTCancel'); };
  const leaves = () => Object.keys(D.themen).filter((id) => !thKids(id).length);
  const dfs = (id, out) => { out.push(id); thKids(id).forEach((k) => dfs(k, out)); return out; };
  const underTop = (id, gname) => { const t = topOf(id); return t && D.themen[t].name === gname; };

  /* ---------- Planung der Woche ---------- */
  function pickLeaves(n) {
    const order = []; thKids(null).forEach((r) => dfs(r, order));
    const ls = order.filter((id) => !thKids(id).length && effZustand(id) === 'aktiv');
    const p2 = today() >= CFG.p2;
    const gebs = p2 ? ['Zivilrecht', 'Strafrecht', 'Öffentliches Recht', 'Zivilrecht'] : ['Internationales Privatrecht'];
    const out = [];
    for (let i = 0; i < n; i++) {
      const g = gebs[st.gi++ % gebs.length];
      let c = ls.find((id) => !st.geplant[id] && underTop(id, g) && out.indexOf(id) < 0);
      if (!c) c = ls.find((id) => !st.geplant[id] && out.indexOf(id) < 0);
      if (!c) break;
      out.push(c);
    }
    return out;
  }
  async function planWoche(Tm) {
    if (D.wochen[Tm] && D.wochen[Tm].status === 'uebergeben') return;
    const vor = vorhabenFor(Tm).length;
    const neu = ri(3, 6) - vor;
    const lernen = pickLeaves(Math.max(1, Math.ceil(neu * 0.7)));
    const specs = lernen.map((id) => ({ name: D.themen[id].name, leaf: id }));
    if (st.klausurNach && chance(0.5)) specs.push({ name: 'Klausur nachbereiten' });
    const lern = Object.keys(st.geplant).filter((id) => D.themen[id] && validSr(D.themen[id].sr));
    while (specs.length < neu && lern.length) { const id = pick(lern); specs.push({ name: 'Wiederholen: ' + D.themen[id].name, wdh: id }); if (chance(0.3)) break; }
    while (specs.length < neu) specs.push({ name: pick(['Übungsfall', 'Fallbearbeitung', 'Skript durcharbeiten', 'Problemschwerpunkte']) + ' ' + ri(1, 99) });
    specs.forEach((s) => {
      const id = vorhabenAdd(Tm);
      chg('vName', { id: id }, s.name);
      act('vStd', { id: id, h: String(pick([2, 3, 4, 4, 6])) });
      if (s.leaf) { st.vthema[id] = s.leaf; st.geplant[s.leaf] = true; act('vGeb', { id: id, g: topOf(s.leaf) }); }
      if (s.wdh) chg('vWdh', { id: id }, s.wdh);
      if (chance(0.15)) act('vModus', { id: id, m: pick(['stueck', 'verteilt']) });
    });
    // Seminararbeit: ein Vorhaben über mehrere Wochen
    if (Tm === CFG.semAb) { const id = vorhabenAdd(Tm); chg('vName', { id: id }, 'Seminararbeit IPR'); act('vStd', { id: id, h: '6' }); chg('vWochen', { id: id, kmin: '1' }, '6'); }
    if (chance(0.06)) { const v = vorhabenFor(Tm).filter((x) => x.ab === Tm && x.wochen <= 1).pop(); if (v) act('vDel', { id: v.id, w: Tm }); }
    const t0 = nowMs();
    act('planClaude', { w: Tm });
    for (let i = 0; i < 60 && !(D.wochen[Tm] && D.wochen[Tm].status === 'uebergeben'); i++) await tick();
    if (!(D.wochen[Tm] && D.wochen[Tm].status === 'uebergeben')) err('Woche ' + Tm + ' wurde nicht übergeben');
    // verteilte Blöcke nie auf einen freien Tag (Pause) und nie außerhalb der Woche
    Object.keys(D.bloecke).forEach((id) => {
      const b = D.bloecke[id];
      if (b.woche !== Tm || b.quelle !== 'claude' || !b.tag || b.erstellt < t0 - 1000) return;
      if (pauseAt(b.tag).frei) err('Block „' + b.titel + '“ liegt am ' + b.tag + ' in einer freien Pause (Woche ' + Tm + ')');
      if (b.tag < Tm || b.tag > addD(Tm, 6)) err('Block „' + b.titel + '“ liegt außerhalb der Woche ' + Tm + ': ' + b.tag);
    });
    // ab und zu einen Block von Hand auf einen anderen Tag legen
    if (chance(0.3)) {
      const bl = Object.keys(D.bloecke).map((id) => Object.assign({ id: id }, D.bloecke[id])).filter((b) => b.woche === Tm && b.tag && b.status === 'offen' && b.tag > today());
      const d2 = weekDates(Tm).filter((d) => d > today() && !pauseAt(d).frei && wdOf(d) < 6);
      if (bl.length && d2.length) act('wMove', { id: pick(bl).id, d: pick(d2) });
    }
  }

  /* ---------- Themenpflege ---------- */
  function themenpflege() {
    const ls = leaves().filter((id) => D.themen[id].eltern);
    if (ls.length < 8) return;
    const r = rnd();
    const a = pick(ls);
    if (r < 0.25) { F.thName = D.themen[a].name + ' (neu gefasst)'; act('thRen', { id: a }); st.stats.ren++; }
    else if (r < 0.45) {
      const ziele = Object.keys(D.themen).filter((id) => D.themen[id].eltern === null ? false : thKids(id).length && id !== D.themen[a].eltern && thDepth(id) < 2);
      if (ziele.length) { F.thMoveTo = pick(ziele); act('thMove', { id: a }); st.stats.mv++; }
    } else if (r < 0.6) {
      const geschw = ls.filter((x) => x !== a && D.themen[x].eltern === D.themen[a].eltern);
      if (geschw.length) { F.thMergeTo = pick(geschw); act('thMerge', { id: a }); st.stats.merge++; }
    } else if (r < 0.68) { act('thDelAsk', { id: a }); act('thDel', { id: a }); st.stats.del++; }
    else if (r < 0.9) { chg('thNotiz', { id: a }, 'Notiz vom ' + today() + ': Streitstand beachten, BGH-Rechtsprechung nachlesen.'); st.stats.noteN++; }
    else if (!isDate(D.themen[a].durchAm)) { act('thDurch', { id: a }); }
  }

  /* ---------- Klausurergebnisse ---------- */
  function klausurErgebnis(kid) {
    act('klOpen', { id: kid });
    const pk = Math.max(0, Math.min(18, Math.round(7.5 + rnd() * 5 - 1.5 + (st.weekN / 40))));
    F.klPunkte = String(pk); F.klOhne = false;
    act('klSave', { id: kid });
    if (chance(0.6)) {
      act('klOpen', { id: kid });
      const n = ri(1, 3);
      for (let i = 0; i < n; i++) { F.klFehler = pick(FEHLER); act('klFAdd', { id: kid }); }
      for (let i = 0; i < n; i++) if (chance(0.6)) act('klWdh', { id: kid, i: String(i) });
      act('klClose');
    }
    st.klausurNach = true;
  }

  /* ---------- Ein Block des Tages ---------- */
  async function block(id, date) {
    const b = D.bloecke[id]; if (!b || b.status === 'erledigt') return;
    const r = rnd();
    if (r < 0.06) return; // liegen lassen
    const dur = Math.max(20, Math.round((b.std || 1.5) * 60 * (0.6 + rnd() * 0.8) / 5) * 5);
    if (r < 0.5) { act('startT', { art: 'b', id: id }); st.cur = Math.min(1380, st.cur + Math.min(dur, 240)); setSim(date, st.cur); act('stopT'); }
    else {
      const halb = r > 0.9 && num(b.std, 0) >= 1;
      const z = halb ? Math.max(15, Math.round(b.std * 60 * 0.35 / 5) * 5) : dur;
      S.editT = null; act('openT', { ref: 'b:' + id }); F.zeit = String(z); act('saveT', { ref: 'b:' + id });
      st.cur = Math.min(1380, st.cur + z);
    }
    if (chance(0.97)) act('tBlock', { id: id });
    const nb = D.bloecke[id]; if (!nb) return;
    st.stats.bloecke++;
    if (nb.status === 'erledigt') {
      if (nb.wdhVon) act('rateB', { id: id, r: pick(['sicher', 'sicher', 'sicher', 'teilweise', 'nicht']) });
      else if (!nb.thema && nb.wiederholen !== false) st.offen.push({ id: id, due: addD(date, chance(0.6) ? 0 : ri(1, 6)) });
    }
  }

  /* ---------- Zuordnung im Eingang ---------- */
  function eingangPass(date) {
    const stay = [];
    st.offen.forEach((o) => {
      if (o.due > date) { stay.push(o); return; }
      const b = D.bloecke[o.id]; if (!b || b.thema || b.status !== 'erledigt') return;
      let zt = b.vorhaben && st.vthema[b.vorhaben]; if (!zt || !D.themen[zt]) zt = null;
      if (!zt) { const l = leaves().filter((x) => D.themen[x].eltern); zt = l.length ? pick(l) : null; }
      if (!zt) { stay.push(o); return; }
      F['zu_' + o.id] = zt; act('thAssign', { id: o.id }); F['zu_' + o.id] = '';
      if (chance(0.4) && !isDate(D.themen[zt].durchAm)) act('thDurch', { id: zt });
    });
    st.offen = stay;
    // Rest im Eingang (Klausurfehler, freie Zeilen): ab und zu einsortieren
    eingang().slice(0, 12).forEach((b) => {
      if (!chance(0.15)) return;
      const l = leaves().filter((x) => D.themen[x].eltern); if (!l.length) return;
      F['zu_' + b.id] = pick(l); act('thAssign', { id: b.id }); F['zu_' + b.id] = '';
    });
  }

  /* ---------- Wiederholung eines Tages ---------- */
  async function wiederholung(date, extra) {
    const dayRows = () => wdhListe(date).filter((x) => !x.r);
    let rows = dayRows();
    if (extra) { // aus „Noch offen“ dazuholen: ältestes zuerst, bis der Zusatz voll ist
      const over = wdhUeberhang(date); let m = 0; let n = 0;
      for (const it of over) { if (m >= extra || n >= 12) break; act('pullW', { ref: it.ref }); m += minFor(wdhStufe(it.sr)); n++; st.stats.geholt++; }
      rows = dayRows();
    }
    for (const row of rows) {
      const ref = row.ref;
      if (!srByRef(ref)) continue;
      const rr = rnd();
      if (rr < 0.06) { // später
        const vorher = chance(0.3) && st.stats.undo % 2 === 0 ? stable(D) : null;
        act('laterW', { ref: ref }); st.stats.spaeter++;
        if (vorher) { act('undo'); st.stats.undo++; if (stable(D) === vorher) st.stats.undoOk++; else err('Rückgängig nach „später“ stellt den Stand am ' + date + ' nicht wieder her'); }
        else if (chance(0.2)) { act('undo'); st.stats.undo++; }
        continue;
      }
      const key = wKey(date, ref);
      const zr = rnd();
      if (zr < 0.15) { act('startT', { art: 'w', id: key }); st.cur = Math.min(1380, st.cur + row.min); setSim(date, st.cur); act('stopT'); }
      else if (zr < 0.4) { S.editT = null; act('openT', { ref: 'w:' + key }); F.zeit = String(Math.max(5, row.min + ri(-5, 10))); act('saveT', { ref: 'w:' + key }); }
      const q = rnd();
      const r = q < 0.8 ? 'sicher' : q < 0.93 ? 'teilweise' : 'nicht';
      const vorherSr = srByRef(ref).sr;
      act('rateW', { ref: ref, r: r }); st.stats.wdh++;
      const nsr = srByRef(ref) && srByRef(ref).sr;
      if (!(nsr && nsr.faellig > date && nsr.letzte === date)) err('Bewertung ' + r + ' am ' + date + ' für „' + row.titel + '“ setzt kein späteres „fällig“ (' + JSON.stringify(vorherSr) + ' → ' + JSON.stringify(nsr) + ')');
    }
  }

  /* ---------- Ein Tag ---------- */
  async function persistCheck(label) {
    for (let i = 0; i < 20 && persistQueued; i++) await tick();
    if (persistQueued) { err('Speichern bleibt hängen (' + label + ')'); return; }
    const a = localStorage.getItem(KEY); const out = {}; COLS.forEach((c) => { out[c] = D[c]; });
    const b = JSON.stringify(out);
    if (a !== b) {
      let wo = '?'; try { const j = JSON.parse(a || '{}'); wo = COLS.filter((c) => stable(j[c] || {}) !== stable(D[c])).join(', ') || 'Reihenfolge'; } catch (e) { wo = 'unlesbar'; }
      err('Gespeicherter Stand ≠ Stand im Speicher (' + label + '): ' + wo + ' (' + (a ? a.length : 0) + ' / ' + b.length + ' Zeichen)');
    }
  }
  const setzeUhr = (date, min) => { st.cur = min; setSim(date, min); };

  async function tagLauf(date, o) {
    const wd = wdOf(date);
    st.stats.tage++;
    setzeUhr(date, ri(7 * 60 + 15, 10 * 60));
    S.korr = {};
    const pz0 = pauseAt(date);
    // nicht geöffnet (etwa 5 % der Tage; nie am Planungstag davor, wenn die Woche noch fehlt)
    if (o.aus) {
      st.stats.aus++;
      if (st.ev[date]) { st.ev[date].forEach((f) => astep('Ereignis', f)); delete st.ev[date]; }
      await persistCheck('aus ' + date);
      return { geoeffnet: false };
    }
    act('nav', { v: 'heute' }); doRender(); await frame();
    // Ereignisse des Tages (Anlegen von Terminen, Pausen, Etappen ...)
    if (st.ev[date]) { for (const f of st.ev[date]) await astep('Ereignis', f); delete st.ev[date]; await frame(); }

    // Timer vom Vorabend, vergessen oder noch laufend
    const tm = timerDoc();
    if (tm) {
      const bid = tm.art === 'b' ? tm.id : null;
      setzeUhr(date, st.cur + 30);
      const b = bid && D.bloecke[bid];
      if (b && b.status === 'offen' && b.tag && b.tag < date && chance(0.5)) { act('stopT'); act('pull', { id: bid }); act('tBlock', { id: bid }); }
      else if (b && b.status === 'offen') { act('stopT'); act('tBlock', { id: bid }); }
      else act('stopT');
    }
    const pz = pauseAt(date);
    let leer = false;
    if (pz.frei) { await frame(); await persistCheck('Pause ' + date); return { geoeffnet: true, pause: true }; }

    // Wochenanfang: Liegengebliebenes mitnehmen oder streichen
    if (wd === 0 || carryOf(mondayOf(date)).length) {
      carryOf(mondayOf(date)).forEach((c) => act(chance(0.55) ? 'carryKeep' : 'carryDrop', { id: c.id }));
    }
    // Kein Plan für diese Woche (Sonntag verpasst): jetzt planen
    if (wd === 0 && !(D.wochen[date] && D.wochen[date].status === 'uebergeben')) await astep('Planung am Montag', () => planWoche(date));

    // Routinen
    routinenAt(date).forEach((r) => { const q = rnd(); if (q < 0.78) act('tRoutine', { id: r.id }); else if (q < 0.84) act('skipR', { id: r.id, t: r.titel }); });
    // Termine
    termineAt(date).forEach((t) => {
      const q = rnd();
      if (q < 0.03) act('cancelTermin', { id: t.id, t: t.titel });
      else if (q < 0.85) act('tTermin', { id: t.id });
    });
    setzeUhr(date, st.cur + 20);

    // Wiederholung: Zeilen des Tages, dazu ein Teil des Überhangs aus „Noch offen“
    const base = wdhRichtwert(date);
    let extra = 0;
    if (wd < 5 && chance(0.85)) extra = CFG.zusatz; else if (wd === 5 && chance(0.5)) extra = Math.round(CFG.zusatz / 2);
    if (wdhListe(date).length === 0 && srItems().some((it) => it.sr.faellig <= date) && base > 0 && !pz.wdh) { st.wdhOhneListe++; leer = true; }
    if (!pz.wdh) await astep('Wiederholung', () => wiederholung(date, extra));

    // „Noch offen“-Blöcke dazuholen
    poolOf(mondayOf(date)).filter((b) => !b.tag || b.tag < date).forEach((b) => { if (wd < 6 && chance(0.3)) act('pull', { id: b.id }); });
    // Blöcke des Tages
    const ids = blocksAt(date).map((b) => b.id);
    for (const id of ids) await astep('Block', () => block(id, date));
    // spontan etwas hinzufügen
    if (chance(0.12)) { act('startAdd'); F.addText = pick(SATZ) + ' ' + ri(1, 40); S.addDone = chance(0.6); S.addMore = false; act('doAdd'); const nb = Object.keys(D.bloecke).pop(); if (nb && D.bloecke[nb].status === 'erledigt' && !D.bloecke[nb].thema) st.offen.push({ id: nb, due: addD(date, ri(0, 5)) }); }
    if (chance(0.03)) { const l = Object.keys(st.geplant).filter((x) => D.themen[x]); if (l.length) { act('startAdd'); F.addText = 'Wiederholt: ' + pick(SATZ); S.addMore = true; F.addWdh = pick(l); S.addDone = true; act('doAdd'); } }
    if (chance(0.02)) { act('tfHeute'); F.tfTitel = 'Probeklausur'; F.tfVon = '16:00'; F.tfBis = '18:00'; F.tfKlausur = true; act('tfSave', { d: date }); if (S.tfOpen) act('tfClose'); }
    if (chance(0.05)) { act('startT', { art: 'f' }); setzeUhr(date, Math.min(1380, st.cur + ri(20, 70))); act('stopT'); }
    if (chance(0.04)) { // Block löschen (sofort, mit Rückgängig)
      const bl = blocksAt(date).filter((b) => b.status === 'offen'); if (bl.length) { const vorher = stable(D); act('delB', { id: pick(bl).id }); if (chance(0.5)) { act('undo'); st.stats.undo++; if (stable(D) === vorher) st.stats.undoOk++; else err('Rückgängig nach Löschen stellt den Stand am ' + date + ' nicht wieder her'); } }
    }
    eingangPass(date);
    // nachträglich: gestern noch etwas korrigieren; ab und zu ein älterer Tag über „Fehler korrigieren“
    if (chance(0.06)) {
      const g = addD(date, -1);
      act('editDay', { d: g });
      blocksAt(g).filter((b) => b.status === 'offen').slice(0, 2).forEach((b) => { act('tBlock', { id: b.id }); });
      wdhListe(g).filter((x) => !x.r).slice(0, 2).forEach((x) => act('rateW', { ref: x.ref, r: 'sicher' }));
      act('dayBack'); st.stats.nachtrag++;
    }
    if (chance(0.025)) {
      const g = addD(date, -ri(3, 6));
      act('editDay', { d: g });
      const bl = blocksAt(g).filter((b) => b.status === 'erledigt');
      if (bl.length && chance(0.5)) { const b = pick(bl); act('tBlock', { id: b.id }); } // Haken weg: nach unten korrigieren
      act('korrAsk'); act('korrYes');
      act('startAdd'); F.addText = 'Nachgetragen: ' + pick(SATZ); act('doAdd');
      if (!(D.tage[g] && D.tage[g].wdh && Array.isArray(D.tage[g].wdh.liste))) { act('wdhNach'); wdhListe(g).filter((x) => !x.r).slice(0, 3).forEach((x) => act('rateW', { ref: x.ref, r: 'sicher' })); }
      act('korrEnd'); act('dayBack'); st.stats.nachtrag++;
    }
    if (chance(0.03)) { // Haken weg und wieder dran (nochmaliges Tippen nimmt zurück)
      const bl = blocksAt(date).filter((b) => b.status === 'erledigt' && !b.thema && !b.wdhVon); if (bl.length) { const id = pick(bl).id; act('tBlock', { id: id }); act('tBlock', { id: id }); }
    }
    act('nav', { v: 'heute' });

    // Sonntag (oder Planungstag): Woche planen, Themen pflegen, sichern
    if (wd === 6) {
      st.weekN++;
      const nxt = addD(date, 1);
      if (st.chunks.length) { const c = st.chunks.shift(); step('Gliederung', () => gliedern(c.text, c.g ? topId(c.g) : '')); }
      else if (st.iprChunks.length && date < CFG.p2) { const c = st.iprChunks.shift(); gliedern(c, ''); }
      if (date >= CFG.p2 && chance(0.4)) themenpflege();
      else if (chance(0.15)) themenpflege();
      await astep('Planung', () => planWoche(nxt));
      if (date >= st.nextSicherung) { const j = exportData(); if (!j || j.format !== 'lernsystem') err('exportData liefert kein Sicherungsformat'); patch('meta', 'sicherung', { am: date }); st.nextSicherung = addD(date, chance(0.5) ? 7 : 14); }
    }
    act('nav', { v: 'heute' }); doRender(); await frame();
    // Abend: Timer vergessen (über Mitternacht)
    if (chance(0.01)) {
      const bl = blocksAt(date).filter((b) => b.status === 'offen');
      if (bl.length) { setzeUhr(date, 22 * 60 + ri(0, 40)); act('startT', { art: 'b', id: pick(bl).id }); setzeUhr(date, 23 * 60 + 40); }
    }
    await persistCheck('Tag ' + date);
    return { geoeffnet: true, leer: leer };
  }

  /* ---------- Prüfungen an den Daten ---------- */
  function integritaet() {
    const out = []; const add = (m) => { if (out.length < 40) out.push(m); };
    const dok = (v) => v == null || (isDate(v) && addDays(v, 0) === v);
    const DATEF = {
      bloecke: ['tag', 'woche', 'erledigtAm', 'gestrichenAm', 'ausWoche', 'sr.faellig', 'sr.letzte', 'bewertung.datum'],
      themen: ['durchAm', 'abgeschlossenAm', 'sr.faellig', 'sr.letzte'],
      vorhaben: ['ab'], wochen: ['geplantAm', 'einschaetzung.am'], termine: ['datum', 'ab', 'endet', 'ergebnis.am'], etappen: ['von', 'bis'], pausen: ['von', 'bis']
    };
    if (D.meta.sicherung && !dok(D.meta.sicherung.am)) add('meta/sicherung.am kaputt: ' + D.meta.sicherung.am);
    const get = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
    const NEG = /^(zeit|min|std|zeitKurz|zeitMittel|zeitLang)$/;
    const walk = (v, p, k) => {
      if (v === undefined) { add('undefined-Wert: ' + p); return; }
      if (typeof v === 'number') { if (!isFinite(v)) add('NaN/Infinity: ' + p); else if (v < 0 && (NEG.test(k) || /\.(zeiten|zeitFrueher)\./.test(p))) add('negative Zeit: ' + p + ' = ' + v); return; }
      if (typeof v === 'string') { if (/^(NaN|undefined|Infinity|null)$/.test(v) || /\bundefined\b|\[object |\bNaN\b/.test(v)) add('Text mit undefined/NaN: ' + p + ' = ' + v.slice(0, 40)); if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v) && !dok(v)) add('Datum kaputt: ' + p + ' = ' + v); return; }
      if (Array.isArray(v)) { v.forEach((x, i) => walk(x, p + '[' + i + ']', k)); return; }
      if (v && typeof v === 'object') Object.keys(v).forEach((kk) => walk(v[kk], p + '.' + kk, kk));
    };
    COLS.forEach((col) => Object.keys(D[col]).forEach((id) => {
      if (!/^[A-Za-z0-9_.:\-]+$/.test(id)) add('Id unzulässig: ' + col + '/' + id);
      const doc = D[col][id];
      walk(doc, col + '/' + id, id);
      (DATEF[col] || []).forEach((f) => { const v = get(doc, f); if (v != null && !dok(v)) add('Datumsfeld ' + col + '/' + id + '.' + f + ' = ' + JSON.stringify(v)); });
    }));
    Object.keys(D.tage).forEach((d) => { if (!dok(d)) add('tage-Schlüssel kein Datum: ' + d); });
    Object.keys(D.wochen).forEach((d) => { if (!dok(d) || mondayOf(d) !== d) add('wochen-Schlüssel kein Montag: ' + d); });
    Object.keys(D.bloecke).forEach((id) => {
      const b = D.bloecke[id];
      if (isDate(b.woche) && mondayOf(b.woche) !== b.woche) add('Block ' + id + ': woche ist kein Montag: ' + b.woche);
      if (b.thema && !D.themen[b.thema]) add('Block ' + id + ' verweist auf fehlendes Thema ' + b.thema);
      if (b.wdhVon && !D.themen[b.wdhVon]) add('Block ' + id + ' verweist mit wdhVon auf fehlendes Thema ' + b.wdhVon);
      if (b.vorhaben && !D.vorhaben[b.vorhaben]) add('Block ' + id + ' verweist auf fehlendes Vorhaben ' + b.vorhaben);
      if (b.status === 'erledigt' && !isDate(b.erledigtAm)) add('Block ' + id + ' erledigt ohne erledigtAm');
      if (b.zeitFrueher) Object.keys(b.zeitFrueher).forEach((d) => { if (!dok(d)) add('zeitFrueher-Schlüssel kein Datum: ' + id + ' ' + d); });
    });
    Object.keys(D.themen).forEach((id) => {
      const t = D.themen[id]; let c = t.eltern; let g = 0;
      if (t.eltern && !D.themen[t.eltern]) add('Thema ' + id + ' hat fehlendes Eltern-Thema ' + t.eltern);
      while (c && D.themen[c] && g++ < 12) { if (c === id) { add('Zyklus im Themenbaum bei ' + id); break; } c = D.themen[c].eltern; }
      if (g >= 12) add('Themenbaum tiefer als 11 Ebenen bei ' + id);
      if (thDepth(id) > 3) add('Thema ' + id + ' liegt tiefer als vier Ebenen');
      if (Array.isArray(t.frueher)) t.frueher.forEach((d) => { if (!dok(d)) add('frueher kaputt bei ' + id + ': ' + d); });
    });
    Object.keys(D.vorhaben).forEach((id) => { const v = D.vorhaben[id]; (v.ohne || []).forEach((d) => { if (!dok(d)) add('vorhaben.ohne kaputt: ' + id); }); });
    Object.keys(D.termine).forEach((id) => {
      const t = D.termine[id];
      (t.ausfall || []).forEach((a) => { if (!a || !dok(a.von) || !dok(a.bis)) add('ausfall kaputt: ' + id + ' ' + JSON.stringify(a)); });
      Object.keys(t.ergebnisse || {}).forEach((d) => { if (!dok(d)) add('ergebnisse-Schlüssel kein Datum: ' + id + ' ' + d); });
    });
    const soft = { etappeStoff: 0, vorhabenWdh: 0, gebiet: 0, terminGebiet: 0, rest: 0 };
    Object.keys(D.etappen).forEach((id) => (D.etappen[id].stoff || []).forEach((x) => { if (!D.themen[x]) soft.etappeStoff++; }));
    Object.keys(D.vorhaben).forEach((id) => { const w = D.vorhaben[id].wdhVon; if (w && !D.themen[w]) soft.vorhabenWdh++; });
    Object.keys(D.bloecke).forEach((id) => { const b = D.bloecke[id]; if (b.gebiet && !D.themen[b.gebiet]) soft.gebiet++; if (b.restVon && !D.bloecke[b.restVon]) soft.rest++; });
    Object.keys(D.termine).forEach((id) => { const g = D.termine[id].gebiet; if (g && !D.themen[g]) soft.terminGebiet++; });
    // Wiederholung: überfällig. Gemessen ab dem Tag, an dem eine Einheit im Plan steht (wöchentliche Stichprobe):
    // Löschen oder „Zurück in den Eingang“ gibt Einheiten mit dem alten Datum zurück (Fälligkeit = erledigt + 1 Tag),
    // die schon bei der Rückkehr uralt überfällig sind. Das zählt als eigene Beobachtung, nicht als Vernachlässigung.
    const t = today(); let maxUe = 0; let wer = '';
    const jetzt = {};
    srItems().forEach((it) => {
      jetzt[it.ref] = true;
      if (!st.seen[it.ref]) { st.seen[it.ref] = t; const alt = dayDiff(t, it.sr.faellig); if (alt > 200) { st.altRueck++; st.altMax = Math.max(st.altMax, alt); } }
      const d = dayDiff(t, it.sr.faellig < st.seen[it.ref] ? st.seen[it.ref] : it.sr.faellig);
      if (d > maxUe) { maxUe = d; wer = it.titel + ' ' + it.ref + ' ' + JSON.stringify(it.sr) + ' seit ' + st.seen[it.ref]; }
    });
    Object.keys(st.seen).forEach((r) => { if (!jetzt[r]) delete st.seen[r]; });
    st.maxUeber = Math.max(st.maxUeber, maxUe);
    return { probleme: out, weich: soft, maxUeberfaellig: maxUe, wer: wer };
  }

  function ansichtenZeit() {
    const res = {}; const t0all = performance.now();
    const alt = { v: S.view, tab: K.tab, thTab: TH.tab, day: S.day, wk: S.wk };
    const misst = (name, fn) => {
      const z = [];
      for (let i = 0; i < 3; i++) { fn(); const t0 = performance.now(); doRender(); void document.body.offsetHeight; z.push(performance.now() - t0); }
      z.sort((a, b) => a - b); res[name] = Math.round(z[1]);
    };
    S.day = null; TH.sel = null;
    misst('Heute', () => { S.view = 'heute'; S.wk = null; });
    misst('Woche', () => { S.view = 'woche'; S.wk = null; });
    misst('Woche nächste', () => { S.view = 'woche'; S.wk = addDays(mondayOf(today()), 7); });
    misst('Kalender', () => { S.view = 'kalender'; K.tab = 'kalender'; });
    misst('Zeitstrahl', () => { S.view = 'kalender'; K.tab = 'zeit'; });
    misst('Statistik', () => { S.view = 'kalender'; K.tab = 'zahlen'; });
    misst('Themen Baum', () => { S.view = 'themen'; TH.tab = 'baum'; });
    misst('Themen Stand', () => { S.view = 'themen'; TH.tab = 'stand'; });
    misst('Einstellungen', () => { S.view = 'einstellungen'; });
    S.view = alt.v; K.tab = alt.tab; TH.tab = alt.thTab; S.day = alt.day; S.wk = alt.wk; doRender();
    return res;
  }

  function bericht() {
    const s = localStorage.getItem(KEY) || '';
    const kl = klausurenListe().map(klausurPunkte).filter((x) => x != null);
    return {
      kb: Math.round(s.length / 1000), zeichen: s.length, themen: Object.keys(D.themen).length, bloecke: Object.keys(D.bloecke).length, tage: Object.keys(D.tage).length,
      termine: Object.keys(D.termine).length, vorhaben: Object.keys(D.vorhaben).length, wochen: Object.keys(D.wochen).length,
      faellig: srItems().filter((it) => it.sr.faellig <= today()).length, srGesamt: srItems().length, klausuren: kl.length, schnitt: kl.length ? Math.round(kl.reduce((a, b) => a + b, 0) / kl.length * 10) / 10 : null,
      durchgaenge: Object.keys(D.themen).filter((id) => Array.isArray(D.themen[id].frueher) && D.themen[id].frueher.length).length,
      maxUeber: st.maxUeber, altRueck: st.altRueck, altMax: st.altMax, stats: st.stats
    };
  }

  /* ---------- Einrichten: Ereignisse über die Zeit ---------- */
  function einrichten() {
    const sd = '2026-11-01';
    const D0 = (n) => addD(CFG.p2, n);
    const wochentagAb = (d, wd) => { let x = d; while (wdOf(x) !== wd) x = addD(x, 1); return x; };
    ev(sd, () => {
      gliedern(st.iprChunks.shift(), '');
      st.ipr = topId('Internationales Privatrecht');
      routine('Sport', 'tage', [0, 2, 4]); routine('Anki', 'taeglich', []);
      wTermin('Vorlesung IPR', [1], '10:00', '12:00', '2026-11-03', '2027-02-05');
      wTermin('Vorlesung Europäisches Kollisionsrecht', [3], '14:00', '16:00', '2026-11-05', '2027-02-05');
      pause('Weihnachten', '2026-12-24', '2027-01-02');
      if (st.ipr) etappe('Vorlesungszeit IPR', '2026-11-02', '2027-02-05', 'IPR-Grundlagen durcharbeiten', dfs(st.ipr, []).filter((id) => !thKids(id).length).slice(0, 6), false);
      act('kNew', { v: 'termin', kl: '1', d: '2027-02-09' }); F.kName = 'Schwerpunktklausur IPR'; F.kGeb = st.ipr; F.kTVon = '09:00'; F.kTBis = '12:00'; act('kSave');
      st.klausurTermin = Object.keys(D.termine).find((id) => D.termine[id].titel === 'Schwerpunktklausur IPR');
    });
    ev('2027-01-01', () => { if (st.ipr) etappe('Seminararbeit IPR', '2027-01-04', '2027-02-15', 'Abgabe der Seminararbeit', dfs(st.ipr, []).filter((id) => !thKids(id).length).slice(6, 10), true); });
    ev('2027-03-03', () => { if (st.klausurTermin && D.termine[st.klausurTermin]) { klausurErgebnis(st.klausurTermin); const k = D.termine[st.klausurTermin]; if (!(k.fehler && k.fehler.length)) { F.klFehler = 'Rechtswahl falsch geprüft'; act('klOpen', { id: st.klausurTermin }); act('klFAdd', { id: st.klausurTermin }); act('klWdh', { id: st.klausurTermin, i: '0' }); act('klClose'); } } });
    ev('2026-11-17', () => pause('Krank', '2026-11-17', '2026-11-18'));
    ev('2027-03-23', () => pause('Krank', '2027-03-23', '2027-03-23'));
    ev('2027-04-12', () => { act('esSet', { k: 'wdhProTag', n: '75' }); });
    ev('2027-05-03', () => act('esUmf', { i: '5', v: 'voll' }));
    // Examensvorbereitung
    ev(D0(0), () => {
      act('esSet', { k: 'wdhProTag', n: '90' });
      st.chunks = stuecke();
      Object.keys(GEB).forEach((g) => { gliedern(g, ''); });
      Object.keys(GEB).forEach((g) => { st.gid[g] = topId(g); });
      for (let i = 0; i < 3; i++) { const c = st.chunks.shift(); gliedern(c.text, topId(c.g)); }
      st.repId = wTermin('Repetitorium', [0, 2, 3], '09:00', '12:00', wochentagAb(D0(0), 0), '');
      act('kNew', { v: 'termin', kl: '1', d: wochentagAb(D0(1), 5) }); F.kName = 'Klausurenkurs'; F.kWdh = true; F.kTEnd = ''; F.kTVon = '09:00'; F.kTBis = '14:00'; act('kSave');
      st.kurs = Object.keys(D.termine).find((id) => D.termine[id].titel === 'Klausurenkurs');
    });
    ev(D0(14), () => {
      const von = (g) => leaves().filter((id) => underTop(id, g));
      etappe('1. Durchgang Zivilrecht', D0(14), D0(200), 'Alle Themen einmal durcharbeiten', von('Zivilrecht').slice(0, 30), false);
      etappe('1. Durchgang Strafrecht', D0(14), D0(240), 'Alle Themen einmal durcharbeiten', von('Strafrecht').slice(0, 20), false);
      etappe('1. Durchgang Öffentliches Recht', D0(14), D0(280), 'Alle Themen einmal durcharbeiten', von('Öffentliches Recht').slice(0, 20), true);
    });
    ev(D0(40), () => { pause('Urlaub', D0(40), D0(53)); if (st.repId) ausfall(st.repId, D0(40), D0(53)); });
    ev(D0(60), () => { const hs = wochentagAb(D0(60), 3); if (st.repId) ausfall(st.repId, hs); });
    ev('2027-12-24', () => { pause('Weihnachten', '2027-12-24', '2028-01-02'); if (st.repId) ausfall(st.repId, '2027-12-24', '2028-01-09'); });
    ev(D0(120), () => act('esSet', { k: 'wdhProTag', n: '120' }));
    ev(D0(200), () => act('esUmf', { i: '6', v: 'halb' }));
    ev(D0(230), () => { const h = wochentagAb(D0(230), 1); if (st.repId) ausfall(st.repId, h, addD(h, 11)); });
    ev(D0(270), () => { // neuer Durchgang auf Gebietsebene
      Object.keys(GEB).forEach((g) => { const id = topId(g); if (id) act('thNeuDurch', { id: id }); });
      st.geplant = {}; st.pass = 2; st.gi = 0;
      etappe('2. Durchgang Zivilrecht', D0(280), D0(400), 'Zweiter Durchgang', leaves().filter((id) => underTop(id, 'Zivilrecht')).slice(0, 25), false);
    });
    ev(D0(330), () => pause('Wiederholungspause', D0(330), D0(336), 'wdh'));
    ev(D0(400), () => { pause('Urlaub', D0(400), D0(413)); if (st.repId) ausfall(st.repId, D0(400), D0(413)); });
    ev('2028-12-24', () => pause('Weihnachten', '2028-12-24', '2028-12-31'));
    [25, 90, 170, 260, 360, 500].forEach((n) => ev(D0(n), () => { const d = today(); if (!pauseAt(d).frei) pause('Krank', d, n % 2 ? d : addD(d, 1)); }));
    // Klausurergebnisse des Klausurenkurses: mittwochs für den Samstag davor
    for (let n = 5; n < 560; n++) { const d = D0(n); if (wdOf(d) === 2) ev(d, () => { const sat = addD(d, -4); if (!st.kurs || !D.termine[st.kurs] || sat < wochentagAb(D0(1), 5)) return; if (!chance(0.85)) return; if (pauseAt(sat).frei || (D.termine[st.kurs].ausfall || []).length && ausfallAm(D.termine[st.kurs], sat)) return; klausurErgebnis(st.kurs + '@' + sat); }); }
    // Seminararbeit-Woche und Ausfälle
    CFG.semAb = '2027-01-04';
  }

  window.SIM = { tag: tagLauf, einrichten: einrichten, integritaet: integritaet, zeit: ansichtenZeit, bericht: bericht, errs: () => errs.splice(0), toasts: toasts, st: st, stable: stable, persistCheck: persistCheck, setzeUhr: setzeUhr, frame: frame, tick: tick, errSeen: errSeen };
}

/* ================================================================================================================
   Node-Seite: Tage durchlaufen, wöchentlich echte Klicks, monatlich Sichern und Laden, am Ende frischer Kontext
   ================================================================================================================ */
const gemeldet = new Map();
function chk(key, cond, detail) {
  if (cond) { L.ok(key, true); return; }
  if (gemeldet.has(key)) { gemeldet.set(key, gemeldet.get(key) + 1); return; }
  gemeldet.set(key, 1);
  L.ok(key, false, detail);
}
const melde = (arr, wo) => (arr || []).forEach((m) => chk('App/Test: ' + String(m).replace(/\d+/g, 'N').replace(/[a-z]+_[0-9a-z]{6,}/g, 'ID').slice(0, 110), false, wo + ': ' + m));

async function ansichten(p, wo, n) {
  n = n || 0;
  const tx = (t, label) => { chk('Ansicht ohne NaN/undefined: ' + label, !/\bNaN\b|undefined|\[object |Infinity/.test(t), t.match(/.{0,40}(\bNaN\b|undefined|\[object |Infinity).{0,40}/)); };
  const klick = async (sel, label) => {
    await p.click(sel, { timeout: 5000 });
    await p.waitForTimeout(40);
    await L.viewOk(p, wo + ' ' + label);
    const t = await L.text(p);
    tx(t, label);
    const r = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    chk('Ansicht ' + label + ': keine waagerechte Scrollleiste', r[0] <= r[1], wo + ' ' + r[0] + ' > ' + r[1]);
  };
  await klick('.side [data-v=heute]', 'Heute');
  await klick('.side [data-v=woche]', 'Woche');
  if (n % 3 !== 2) { await klick('[data-a=wkNext]', 'Woche nächste'); await klick('[data-a=wkCur]', 'Woche aktuell'); }
  await klick('.side [data-v=kalender]', 'Kalender');
  if (n % 3 === 0) await klick('[data-a=kTab][data-v=zeit]', 'Zeitstrahl');
  await klick('[data-a=kTab][data-v=zahlen]', 'Statistik');
  await klick('[data-a=kTab][data-v=kalender]', 'Kalender (zurück)');
  await klick('.side [data-v=themen]', 'Themen');
  if (n % 3 !== 1) await klick('[data-a=thTab][data-v=stand]', 'Themen Stand');
  await klick('[data-a=thTab][data-v=baum]', 'Themen Baum');
  await klick('.side [data-v=einstellungen]', 'Einstellungen');
  await klick('.side [data-v=heute]', 'Heute (zurück)');
}

async function sichernLaden(p, wo, tmp) {
  // Vergleich gegen den echten Stand D (nicht gegen exportData), sonst fiele ein Fehler beim Sichern selbst nicht auf.
  // Erst nach dem Sichern festhalten: das Sichern schreibt meta.sicherung. Der laufende Timer gehört absichtlich nicht in die Sicherung.
  const SIM_SNAP = () => { const o = {}; COLS.forEach((c) => { o[c] = JSON.parse(JSON.stringify(D[c])); }); delete o.meta.timer; return o; };
  await p.click('.side [data-v=einstellungen]'); await p.waitForTimeout(80);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('[data-a=esExport]')]);
  await p.waitForTimeout(50);
  await p.evaluate('SIM.snapVor = (' + SIM_SNAP + ')()');
  const datei = path.join(tmp, 'sicherung.json'); await dl.saveAs(datei);
  const buf = fs.readFileSync(datei);
  // Danach den Stand verändern (je Sammlung ein Eintrag weg, einer geändert, ein fremder dazu), damit das Laden wirklich etwas zurückholen muss
  await p.evaluate(() => {
    COLS.forEach((col) => {
      if (col === 'meta') return;
      const ids = Object.keys(D[col]);
      if (ids.length) del(col, ids[0]);
      if (ids.length > 1) patch(col, ids[1], { zzTest: true });
      if (!/^(routinen|termine|etappen|pausen)$/.test(col)) put(col, 'zz_extra', { zz: true });
    });
    patch('meta', 'zz_meta', { x: 1 });
  });
  const j = JSON.parse(buf.toString('utf8'));
  chk('Sicherungsdatei: Format', j.format === 'lernsystem' && j.version === 1 && j.daten && typeof j.exportiert === 'string', Object.keys(j));
  chk('Sicherungsdatei: alle Sammlungen', ['themen', 'bloecke', 'vorhaben', 'wochen', 'tage', 'termine', 'routinen', 'etappen', 'pausen', 'meta', 'module'].every((k) => j.daten[k] && typeof j.daten[k] === 'object'), Object.keys(j.daten));
  await p.setInputFiles('input[data-ch=esImport]', { name: 'sicherung.json', mimeType: 'application/json', buffer: buf });
  await p.waitForSelector('[data-a=esImportYes]', { timeout: 15000 });
  const t0 = Date.now();
  await p.click('[data-a=esImportYes]');
  await p.waitForFunction(() => !document.querySelector('[data-a=esImportYes]'), null, { timeout: 30000 });
  const ms = Date.now() - t0;
  await p.waitForTimeout(100);
  const vgl = await p.evaluate(() => {
    const nach = {}; COLS.forEach((c) => { nach[c] = JSON.parse(JSON.stringify(D[c])); }); delete nach.meta.timer; const vor = SIM.snapVor; const diff = [];
    Object.keys(Object.assign({}, vor, nach)).forEach((col) => { const a = vor[col] || {}; const b = nach[col] || {}; Object.keys(Object.assign({}, a, b)).forEach((id) => { if (SIM.stable(a[id]) !== SIM.stable(b[id])) diff.push(col + '/' + id); }); });
    SIM.snapVor = null;
    return { diff: diff.slice(0, 8), n: diff.length };
  });
  chk('Sichern und Laden: Stand danach identisch (' + wo + ')', vgl.n === 0, vgl.n + ' Unterschiede, z. B. ' + vgl.diff.join(', '));
  await p.evaluate(() => SIM.persistCheck('nach Laden'));
  await p.click('.side [data-v=heute]'); await p.waitForTimeout(80);
  fs.rmSync(datei, { force: true });
  return { ms: ms, kb: Math.round(buf.length / 1000) };
}

L.run(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'langzeit-'));
  const t00 = Date.now();
  const p = await L.open({}, 'sim-' + START_TAG + '-1000', 1280);
  const CFG = { seed: SEED, p2: P2, zusatz: 50, semAb: '2027-01-04' };
  await p.evaluate(browser, CFG);
  await p.evaluate(() => SIM.einrichten());
  const rng = (() => { let s = SEED ^ 0x9e3779b9; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  let ut = Date.now(); let wochen = 0; let gesamtZeit = { tag: 0, woche: 0, monat: 0 };
  const berichte = [];
  let maxMs = { name: '', ms: 0 };
  for (let d = START_TAG; d <= ENDE; d = L.addDays(d, 1)) {
    const wd = wdOf(d);
    const aus = rng() < 0.05 && !(wd === 6) && d !== START_TAG;
    const t0 = Date.now();
    const r = await p.evaluate(([x, o]) => SIM.tag(x, o), [d, { aus: aus }]);
    melde(await p.evaluate(() => SIM.errs()), d);
    gesamtZeit.tag += Date.now() - t0;
    chk('Gespeicherter Stand = Stand im Speicher (täglich)', true);
    chk('Wiederholung: Tagesliste hat Zeilen, wenn etwas fällig ist', !r.leer, d + ': fällig, Richtwert > 0, aber keine Zeile');

    if (wd === 6 || d === ENDE) { // Wochenende: Daten heil, Plausibilität, echte Klicks
      wochen++;
      const t1 = Date.now();
      const ig = await p.evaluate(() => SIM.integritaet());
      ig.probleme.forEach((m) => chk('Daten heil: ' + m.replace(/[a-z]+_[0-9a-z]{6,}/g, 'ID').replace(/\d{4}-\d{2}-\d{2}/g, 'JJJJ-MM-TT').slice(0, 90), false, d + ': ' + m));
      chk('Daten heil (wöchentlich)', ig.probleme.length === 0, ig.probleme.slice(0, 3));
      chk('Wiederholung: nichts länger als 200 Tage überfällig (ab Eintritt in den Plan)', ig.maxUeberfaellig <= 200, d + ': ' + ig.maxUeberfaellig + ' Tage („' + ig.wer + '“)');
      await p.evaluate(() => SIM.setzeUhr(today(), 12 * 60));
      await ansichten(p, d, wochen);
      gesamtZeit.woche += Date.now() - t1;
      if (process.env.TAGLOG) console.log('Woche ' + wochen + ' (' + d + '): ' + Math.round((Date.now() - ut) / 1000) + ' s, Tage ' + Math.round(gesamtZeit.tag / 1000) + ' s, Ansichten ' + Math.round(gesamtZeit.woche / 1000) + ' s');
      if (wochen === 1 || process.env.TAGLOG) ut = Date.now();
    }
    if (lastOfMonth(d)) { // Monatsende: Sichern und Laden, Speicher, Geschwindigkeit
      const t2 = Date.now();
      const sl = await sichernLaden(p, d, tmp);
      melde(await p.evaluate(() => SIM.errs()), d);
      const b = await p.evaluate(() => SIM.bericht());
      chk('Speichergröße unter 4 000 000 Zeichen', b.zeichen <= 4000000, d + ': ' + b.zeichen + ' Zeichen');
      const z = await p.evaluate(() => SIM.zeit());
      const langsam = Object.keys(z).sort((a, c) => z[c] - z[a])[0];
      chk('Geschwindigkeit: keine Ansicht über 1500 ms', z[langsam] <= 1500, d + ': ' + langsam + ' ' + z[langsam] + ' ms');
      if (z[langsam] > maxMs.ms) maxMs = { name: langsam + ' (' + d + ')', ms: z[langsam] };
      if (stichtagAn[d]) berichte.push({ monat: stichtagAn[d], d: d, b: b, z: z, langsam: langsam, sl: sl });
      console.log('MONAT ' + d + ': ' + b.kb + ' KB, ' + b.themen + ' Themen, ' + b.bloecke + ' Blöcke, ' + b.tage + ' Tage, fällig ' + b.faellig + '/' + b.srGesamt + ', langsamste Ansicht ' + langsam + ' ' + z[langsam] + ' ms, Laden ' + sl.ms + ' ms');
      gesamtZeit.monat += Date.now() - t2;
    }
  }

  if (process.env.DEBUGJS) console.log('DEBUGJS: ' + JSON.stringify(await p.evaluate(process.env.DEBUGJS)));
  // Ende: Auswertung, Daten heil, Speicher, dann frischer Kontext mit dem Endstand
  melde(await p.evaluate(() => SIM.errs()), 'Ende');
  const ig = await p.evaluate(() => SIM.integritaet());
  chk('Daten heil (Ende)', ig.probleme.length === 0, ig.probleme.slice(0, 5));
  const weich = ig.weich;
  const st = await p.evaluate(() => SIM.st.stats);
  const toasts = await p.evaluate(() => SIM.toasts);
  const fin = await p.evaluate(() => SIM.bericht());
  if (ENDE > L.addDays(P2, 271)) L.ok('Neuer Durchgang auf Gebietsebene hat frühere Durchgänge gemerkt', fin.durchgaenge > 0, fin.durchgaenge);
  const sl = await sichernLaden(p, 'Ende', tmp);
  const seed = await p.evaluate(() => JSON.parse(JSON.stringify(exportData().daten)));
  if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(seed));
  const vergleich = (pg) => pg.evaluate(() => {
    const out = {}; const alt = { v: S.view, tab: K.tab };
    S.day = null; TH.sel = null; TH.q = ''; S.wk = null;
    const ans = (n, v, f) => { S.view = v; f && f(); doRender(); out[n] = document.getElementById('main').textContent.replace(/\s+/g, ' '); };
    ans('Statistik', 'kalender', () => { K.tab = 'zahlen'; });
    ans('Stand', 'themen', () => { TH.tab = 'stand'; });
    out.themen = Object.keys(D.themen).length; out.bloecke = Object.keys(D.bloecke).length; out.faellig = srItems().filter((it) => it.sr.faellig <= today()).length;
    out.klausuren = klausurenListe().map(klausurPunkte).filter((x) => x != null).join(',');
    S.view = alt.v; K.tab = alt.tab; TH.tab = 'baum'; doRender();
    return out;
  });
  await p.evaluate(() => SIM.setzeUhr(today(), 12 * 60));
  const va = await vergleich(p);
  const q = await L.open(seed, 'sim-' + ENDE + '-1200', 1280);
  const vb = await vergleich(q);
  L.expect('Endstand im frischen Kontext: Themenzahl', vb.themen, va.themen);
  L.expect('Endstand im frischen Kontext: Blöcke', vb.bloecke, va.bloecke);
  L.expect('Endstand im frischen Kontext: fällige Wiederholungen', vb.faellig, va.faellig);
  L.expect('Endstand im frischen Kontext: Klausurpunkte', vb.klausuren, va.klausuren);
  L.ok('Endstand im frischen Kontext: Statistik gleich', vb.Statistik === va.Statistik, (vb.Statistik || '').slice(0, 120) + ' | ' + (va.Statistik || '').slice(0, 120));
  L.ok('Endstand im frischen Kontext: Themen-Stand gleich', vb.Stand === va.Stand, (vb.Stand || '').slice(0, 120) + ' | ' + (va.Stand || '').slice(0, 120));
  await ansichten(q, 'frischer Kontext');
  const qz = await q.evaluate(() => { S.day = null; return [Object.keys(D.themen).length, document.getElementById('main').textContent.length]; });
  L.ok('frischer Kontext: Daten geladen', qz[0] === va.themen, qz);
  await q.context().close();

  // Berichte
  console.log('--- BERICHT ---');
  berichte.forEach((r) => {
    const b = r.b;
    console.log('BERICHT: Monat ' + r.monat + ' (' + r.d + '): Speicher ' + b.kb + ' KB; Themen ' + b.themen + ', Blöcke ' + b.bloecke + ', Tage ' + b.tage + ', Termine ' + b.termine + ', Vorhaben ' + b.vorhaben + '; langsamste Ansicht ' + r.langsam + ' ' + r.z[r.langsam] + ' ms; fällige Wiederholungen ' + b.faellig + ' (von ' + b.srGesamt + '); Klausuren ' + b.klausuren + ', Schnitt ' + b.schnitt + '; Laden ' + r.sl.ms + ' ms (Datei ' + r.sl.kb + ' KB)');
  });
  console.log('BERICHT: langsamste Ansicht insgesamt: ' + maxMs.name + ' ' + maxMs.ms + ' ms; größter Rückstand der Wiederholung: ' + fin.maxUeber + ' Tage');
  console.log('BERICHT: simuliert ' + st.tage + ' Tage (' + st.aus + ' ohne App), ' + st.bloecke + ' Blöcke bearbeitet, ' + st.wdh + ' Wiederholungen bewertet, ' + st.spaeter + ' auf „später“, ' + st.geholt + ' aus „Noch offen“ geholt, ' + st.nachtrag + ' Nachträge, Rückgängig ' + st.undoOk + '/' + st.undo + ' geprüft, Themen umbenannt/verschoben/zusammengelegt/gelöscht ' + st.ren + '/' + st.mv + '/' + st.merge + '/' + st.del + ', Notizen ' + st.noteN);
  console.log('BERICHT: Einheiten, die mit uraltem Fälligkeitsdatum (über 200 Tage) ins Wiederholen zurückkamen (Thema gelöscht): ' + fin.altRueck + ', ältestes ' + fin.altMax + ' Tage');
  console.log('BERICHT: Verweise ohne Ziel (weich, von der App toleriert): Etappen-Stoff ' + weich.etappeStoff + ', Vorhaben-Wiederholung ' + weich.vorhabenWdh + ', Block-Gebiet ' + weich.gebiet + ', Termin-Gebiet ' + weich.terminGebiet + ', Rest-Verweis ' + weich.rest);
  console.log('BERICHT: Laufzeit ' + Math.round((Date.now() - t00) / 1000) + ' s (Tage ' + Math.round(gesamtZeit.tag / 1000) + ' s, wöchentliche Klicks ' + Math.round(gesamtZeit.woche / 1000) + ' s, Monatsprüfungen ' + Math.round(gesamtZeit.monat / 1000) + ' s)');
  const top = Object.keys(toasts).sort((a, b) => toasts[b] - toasts[a]).slice(0, 8).map((k) => k + ' ×' + toasts[k]);
  console.log('BERICHT: häufigste Meldungen: ' + top.join('; '));
  if (gemeldet.size) console.log('BERICHT: wiederholte Fehler: ' + Array.from(gemeldet.entries()).filter((e) => e[1] > 1).map((e) => e[0].slice(0, 60) + ' ×' + e[1]).join('; '));
  fs.rmSync(tmp, { recursive: true, force: true });
});
