// App-Version: Daten liegen in localStorage. Seed hineinschreiben, __store liest den gespeicherten Stand.
(function () {
  const KEY = 'lernsystem-daten-v1';
  if (window.__seed) localStorage.setItem(KEY, JSON.stringify(window.__seed));

  Object.defineProperty(window, '__store', { get: () => { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); ['meta','themen','bloecke','vorhaben','wochen','tage','termine','routinen','etappen','pausen','module'].forEach((c) => { s[c] = s[c] || {}; }); return s; } });
  window.__writes = 0;
})();
