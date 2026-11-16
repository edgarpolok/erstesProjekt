// App-Version: Daten liegen in localStorage. Seed beim ersten Laden hineinschreiben (Merker ebenfalls in localStorage,
// jeder Test hat einen eigenen Browser-Kontext), nicht bei jedem Neuladen, sonst startet ein Test nach reload() wieder mit den Anfangsdaten.
// __store liest den gespeicherten Stand.
(function () {
  const KEY = 'lernsystem-daten-v1';
  if (window.__seed && !localStorage.getItem('__seeded')) { localStorage.setItem(KEY, JSON.stringify(window.__seed)); localStorage.setItem('__seeded', '1'); }

  // Woche: Tests laufen in der Liste, außer sie verlangen die Spalten (L.open(..., { spalten: true }))
  if (!window.__spalten && localStorage.getItem('lernsystem-woche-spalten') == null) localStorage.setItem('lernsystem-woche-spalten', '0');

  Object.defineProperty(window, '__store', { get: () => { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); ['meta','themen','bloecke','vorhaben','wochen','tage','termine','routinen','etappen','pausen','module'].forEach((c) => { s[c] = s[c] || {}; }); return s; } });
})();
