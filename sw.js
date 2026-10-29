/*
 * Offline support for the gym (where reception is often poor).
 * Network first, so an update to the program always shows up when online;
 * falls back to the saved copy when offline. Videos are never cached.
 * Bump VERSION when files are added or renamed.
 */
const VERSION = 'ruth-fitness-v4';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-512.png',
  'js/program.js', 'js/logic.js', 'js/store.js', 'js/ui.js', 'js/controls.js', 'js/workout.js', 'js/screens.js', 'js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Network first, so edits reach her phone. no-cache = always ask the
  // server whether the file changed (a cheap 304 if not).
  const network = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      return caches.open(VERSION).then((c) => c.put(req, copy)).then(() => res);
    }
    return res;
  });
  // Keep the service worker alive until the cache refresh is written.
  event.waitUntil(network.catch(() => {}));

  const cached = () => caches.match(req, { ignoreSearch: true });
  // Weak gym signal: after 3 seconds, use the saved copy if there is one
  // (the network answer still refreshes the cache in the background).
  const slow = new Promise((resolve) => setTimeout(resolve, 3000)).then(cached);

  event.respondWith(
    Promise.race([network.catch(() => null), slow.then((hit) => hit || network)])
      .then((res) => res || cached())
      .then((res) => res || caches.match('index.html')),
  );
});
