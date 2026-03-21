/* ═══════════════════════════════════════════════════════════════
   OPERION SERVICE WORKER
   by Marc-Arthur Samuel Dalus
   
   Strategy: Network-First for HTML/JS/CSS (always fresh UI)
              Cache-First for fonts/images/CDN assets (fast load)
   ─────────────────────────────────────────────────────────────
   To force an update: bump CACHE_VERSION below, then redeploy.
═══════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'operion-v4';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

/* Core app shell — cached at install */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
];

/* CDN assets — cached on first fetch, served from cache after */
const CDN_ORIGINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
];

/* API origins — NEVER cache these */
const NEVER_CACHE = [
  'api.groq.com',
  'openrouter.ai',
  'openai.com',
  'anthropic.com',
];

/* ── INSTALL ───────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(APP_SHELL).catch(err => {
        // Don't block install if some optional assets fail
        console.warn('[SW] Shell cache partial fail:', err);
      });
    })
  );
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting();
});

/* ── ACTIVATE ──────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      // Claim all open tabs immediately
      return self.clients.claim();
    })
  );
});

/* ── FETCH ─────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache API calls — always go to network
  if (NEVER_CACHE.some(origin => url.hostname.includes(origin))) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Non-GET requests — always network
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // 3. CDN assets — Cache-First (fonts, highlight.js, etc.)
  if (CDN_ORIGINS.some(origin => url.hostname.includes(origin))) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // 4. App shell (HTML, JS, CSS, icons) — Network-First
  //    Falls back to cache when offline
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

/* ── STRATEGIES ────────────────────────────────────────────── */

/** Network-First: try network, cache on success, fallback to cache */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok || networkResponse.type === 'opaque') {
      const cache = await caches.open(cacheName);
      // Clone before consuming — response body can only be read once
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;

    // If even the cache misses and it's a navigation, return the shell
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html') || await caches.match('./');
      if (shell) return shell;
    }

    // Absolute last resort: return a minimal offline response
    return new Response(
      '<html><body style="background:#000;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px"><h2>Operion</h2><p style="opacity:.5;font-size:.9rem">You are offline. Please reconnect.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

/** Cache-First: serve from cache, fetch & update in background */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok || networkResponse.type === 'opaque') {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_) {
    return new Response('', { status: 503 });
  }
}

/* ── MESSAGES ──────────────────────────────────────────────── */
self.addEventListener('message', event => {
  // skipWaiting: triggered by the update prompt in the app
  if (event.data?.action === 'skipWaiting') {
    self.skipWaiting();
  }
  // ping: used to check if SW is alive
  if (event.data?.action === 'ping') {
    event.ports[0]?.postMessage({ status: 'alive', version: CACHE_VERSION });
  }
});
