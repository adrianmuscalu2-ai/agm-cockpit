const CACHE_NAME = 'agm-cockpit-1.4.0-mobile-data-production-v1-20260906';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/agm-app-icon-192.png'];

function isCacheableResponse(request, response) {
  if (!response.ok || response.type === 'opaque') return false;

  const contentType = response.headers.get('content-type') || '';
  if (request.mode === 'navigate') return contentType.includes('text/html');
  if (request.destination === 'script') return /javascript|ecmascript/i.test(contentType);
  if (request.destination === 'style') return contentType.includes('text/css');
  return true;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isOperationalProbe =
    requestUrl.searchParams.has('_agm_probe') ||
    requestUrl.pathname.includes('/health/') ||
    requestUrl.pathname.endsWith('/translation/health');

  if (requestUrl.origin !== self.location.origin || isOperationalProbe) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // Hashed scripts, styles and media are immutable release assets. Let the
  // browser load them directly so an unavailable worker fetch can never turn
  // a valid document into an unstyled or empty application shell.
  if (event.request.mode !== 'navigate') {
    return;
  }

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (isCacheableResponse(event.request, response)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('/');
        return undefined;
      }),
  );
});
