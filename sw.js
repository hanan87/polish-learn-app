// The app moved from /polish-learn-app/ to /learn/. Phones that installed the old address still run
// its service worker, which keeps serving the cached old app. When the browser checks this file for
// an update it gets this replacement: it removes the old app's caches, unregisters itself and sends
// open windows to the new address. Caches shared with the new app (voice clips) are kept.
const NEW_URL = 'https://hanan87.github.io/learn/';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.includes('/polish-learn-app/')).map((k) => caches.delete(k)));
      await self.clients.claim();
      const windows = await self.clients.matchAll({ type: 'window' });
      await self.registration.unregister();
      for (const w of windows) w.navigate(NEW_URL + new URL(w.url).hash).catch(() => {});
    })(),
  );
});
