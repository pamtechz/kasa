const CACHE_NAME = 'kasa-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/kasa-logo-white.png',
  '/icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for static assets or HTML pages
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Strictly bypass API routes, Firebase Auth, and external services
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('cloudinary')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache).catch(() => {});
        });

        return networkResponse;
      }).catch(() => {
        return cachedResponse || fetch(event.request);
      });
    })
  );
});
