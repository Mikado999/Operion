const CACHE_NAME = 'operion-v2'; // Change v2 to v3 to force an update
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

// 1. Install - Save core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activate - Clean up old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch - The "Network-First" Logic
// This ensures your buttons/logic stay updated from GitHub
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If network works, put a copy in cache and return it
        if (event.request.method === 'GET') {
          const clnd = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clnd));
        }
        return response;
      })
      .catch(() => {
        // If network fails (offline), use the cache
        return caches.match(event.request);
      })
  );
});

// 4. Update Logic
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
