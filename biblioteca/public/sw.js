/* Service worker do PWA.
 * - Navegações: rede primeiro, cache como reserva (o app abre offline).
 * - Assets versionados do Expo (/_expo/static) e ícones: cache primeiro.
 * - Capas de livros: stale-while-revalidate.
 * - Chamadas ao Supabase não passam por aqui (outra origem, com autenticação).
 * Suba CACHE_VERSION quando mudar esta estratégia.
 */
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const COVERS_CACHE = `covers-${CACHE_VERSION}`;
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL_CACHE, STATIC_CACHE, COVERS_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isCover(url) {
  return (
    url.pathname.includes('/storage/v1/object/public/covers/') ||
    url.hostname.endsWith('books.google.com') ||
    url.hostname.endsWith('googleusercontent.com') ||
    url.hostname === 'covers.openlibrary.org'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/'))),
    );
    return;
  }

  if (url.origin === self.location.origin && (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.destination === 'image' && isCover(url)) {
    event.respondWith(
      caches.open(COVERS_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
