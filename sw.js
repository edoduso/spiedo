/**
 * SERVICE WORKER  ·  fa funzionare spiEDO anche senza rete.
 *
 * Strategia "stale-while-revalidate": risponde subito con la copia salvata
 * e intanto scarica la versione nuova per la volta dopo. Così gli
 * aggiornamenti arrivano da soli, senza numeri di versione da ricordare.
 */
const CACHE = 'spiedo-cache';
const FILE_BASE = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css',
  './js/app.js', './js/ricetta.js', './js/calcoli.js', './js/calendario.js',
  './js/stato.js', './js/utils.js', './js/illustrazioni.js',
  './fonts/archivo-black.woff2', './fonts/dm-sans.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE_BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET' || !richiesta.url.startsWith(self.location.origin)) return;
  evento.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const salvata = await cache.match(richiesta, { ignoreSearch: true });
      const rete = fetch(richiesta)
        .then((risposta) => {
          if (risposta.ok) cache.put(richiesta, risposta.clone());
          return risposta;
        })
        .catch(() => salvata ?? (richiesta.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return salvata ?? rete;
    })
  );
});
