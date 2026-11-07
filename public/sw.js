/* Koncha 0.6 app-shell cache. NEVER cache /api.php or chat content. */
const CACHE = 'koncha-shell-v0.7.0-alpha.1';
const SHELL = [
  '/', '/index.html', '/styles.css', '/app.js', '/crypto.js', '/db.js',
  '/i18n.js', '/identity.js', '/message-policy.js', '/notifications.js',
  '/romanize.js', '/rooms.js', '/translation.js', '/translation-capabilities.js',
  '/local-translation.js', '/push-client.js', '/pwa-diagnostics.js', '/icon.svg', '/icon-192.png',
  '/icon-512.png', '/manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('koncha-shell-') && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'KONCHA_SKIP_WAITING') void self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never store ciphertext API responses, credentials, invites, dynamic model downloads,
  // or user data in the SW. API requests always hit the network.
  if (url.pathname === '/api.php' || url.pathname.startsWith('/models/') || url.pathname.startsWith('/vendor/')) return;
  if (!SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request, { ignoreSearch: false });
      if (cached) return cached;
      // For navigation with tracking query string, use cached app shell.
      if (request.mode === 'navigate') {
        const app = await caches.match('/index.html');
        if (app) return app;
      }
      throw error;
    }
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = pages.find(page => new URL(page.url).origin === self.location.origin);
    if (open) { await open.focus(); return; }
    await self.clients.openWindow('/?resume=1');
  })());
});

// Server sends EMPTY push messages: never trust push data or put plaintext in a notice.
self.addEventListener('push', event => {
  event.waitUntil(self.registration.showNotification('Koncha', {
    body: 'New message. Open Koncha to read it.',
    icon: '/icon-192.png', badge: '/icon-192.png',
    tag: 'koncha-push', renotify: false,
    data: { url: '/?resume=1' }
  }));
});
