const PREFIX = 'kukie-reader-';
const CORE_CACHE = `${PREFIX}core-${VERSION}`;
const PAGE_CACHE = `${PREFIX}pages-${VERSION}`;
const MEDIA_CACHE = `${PREFIX}media-${VERSION}`;

async function store(cacheName, key, response, limit) {
  if (!response.ok || response.type !== 'basic') return;
  const cache = await caches.open(cacheName);
  await cache.put(key, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map(request => cache.delete(request)));
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CORE_CACHE).then(cache => cache.addAll(CORE)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const active = new Set([CORE_CACHE, PAGE_CACHE, MEDIA_CACHE]);
    await Promise.all((await caches.keys()).filter(name => name.startsWith(PREFIX) && !active.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function readPage(request, key) {
  const cache = await caches.open(PAGE_CACHE);
  const cached = await cache.match(key);
  if (cached) return cached;
  const fallback = await (await caches.open(CORE_CACHE)).match('/offline/');
  return new Response(fallback ? await fallback.text() : '当前离线，请联网后重试。', {
    status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.headers.has('authorization') || [...url.searchParams.keys()].some(key => !['q', 'category'].includes(key))) return;
  if ((request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) && PAGES.has(url.pathname)) {
    const key = url.pathname;
    const network = fetch(request);
    event.waitUntil(network.then(response => store(PAGE_CACHE, key, response.clone(), 60)).catch(() => {}));
    event.respondWith((async () => {
      let timer;
      try {
        const response = await Promise.race([network, new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('Offline timeout')), 4000); })]);
        if (response.status >= 500) return readPage(request, key);
        return response;
      } catch { return readPage(request, key); }
      finally { clearTimeout(timer); }
    })());
    return;
  }
  const coreAsset = CORE.includes(url.pathname) && url.pathname !== '/offline/';
  const readingAsset = /^\/(hero|img|fonts)\/.+\.(?:png|jpe?g|webp|avif|woff2?|css)$/.test(url.pathname) || url.pathname === '/favicon.png';
  if (url.search || (!coreAsset && !readingAsset)) return;
  event.respondWith((async () => {
    const cacheName = coreAsset ? CORE_CACHE : MEDIA_CACHE;
    const cache = await caches.open(cacheName);
    const cached = await cache.match(url.pathname);
    if (cached) return cached;
    const response = await fetch(request);
    event.waitUntil(store(cacheName, url.pathname, response.clone(), coreAsset ? CORE.length + 5 : 180).catch(() => {}));
    return response;
  })());
});
