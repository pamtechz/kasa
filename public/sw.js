const CACHE_NAME = 'kasa-pwa-static-v3';
const PUBLIC_STATIC_FILES = [
  '/manifest.json',
  '/kasa-logo-white.png',
  '/icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PUBLIC_STATIC_FILES).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Remove all old versions, which may have cached private portal HTML.
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(name => name.startsWith('kasa-pwa-') && name !== CACHE_NAME)
        .map(name => caches.delete(name)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Cache only the public SSR shell of Marathon routes; the secure client
  // fetches identity and operational data separately and never caches API data.
  const nav = new URL(event.request.url);
  if (event.request.mode === 'navigate' && nav.origin === self.location.origin &&
      (nav.pathname === '/marthon' || nav.pathname.startsWith('/marthon/'))) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const live = await fetch(event.request);
        if (live.ok && live.headers.get('content-type')?.includes('text/html')) {
          await cache.put(event.request, live.clone()).catch(() => {});
        }
        return live;
      } catch {
        const stored = await cache.match(event.request);
        if (stored) return stored;
        const root = await cache.match('/marthon');
        if (root) return root;
        return Response.error();
      }
    })());
    return;
  }
  if (event.request.mode === 'navigate') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.search) return;
  if (url.pathname.startsWith('/api/')) return;

  // Cache only immutable Next.js build assets and explicitly public images.
  // NEVER cache personalized routes, dashboard HTML, RSC payloads or PDFs.
  const allowed = PUBLIC_STATIC_FILES.includes(url.pathname)
    || url.pathname.startsWith('/_next/static/');
  if (!allowed) return;

  event.respondWith(
    caches.match(event.request).then(async cached => {
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.status === 200 && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    })
  );
});
