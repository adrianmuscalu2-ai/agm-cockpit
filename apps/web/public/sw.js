const CACHE_NAME = 'agm-cockpit-1.3.0-browser-recovery-20260826';
const APP_SHELL = ['/', '/manifest.webmanifest', '/images/images/logo1.png'];

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

  event.respondWith(
    fetch(event.request, event.request.mode === 'navigate' ? { cache: 'no-store' } : undefined)
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
