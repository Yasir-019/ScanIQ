/**
 * ScanIQ Service Worker — Production-ready with cache-first strategy
 * Version: 1.0.0
 */

const CACHE_VERSION = "scaniq-v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const FONT_CACHE = `fonts-${CACHE_VERSION}`;

// App shell files to pre-cache
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/offline.html",
];

// Maximum items in dynamic cache
const MAX_DYNAMIC_ITEMS = 50;

// Install event — pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn("[SW] Failed to pre-cache some resources:", err);
      });
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== FONT_CACHE
            );
          })
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all open clients
  self.clients.claim();
});

// Fetch event — serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests that aren't CDN assets
  if (url.origin !== location.origin) {
    // Cache fonts from CDNs
    if (url.hostname.includes("fonts.gstatic.com")) {
      event.respondWith(cacheFonts(request));
      return;
    }
    // Let other cross-origin requests pass through
    return;
  }

  // Navigation requests — network-first with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets — cache-first with network fallback
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Other requests — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Cache-first strategy (for static assets)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return offline page for navigation, empty response otherwise
    if (request.mode === "navigate") {
      return getOfflineResponse();
    }
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

// Network-first strategy (for HTML/navigation)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return getOfflineResponse();
  }
}

// Stale-while-revalidate (for API calls and dynamic content)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
        trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ITEMS);
      }
      return response;
    })
    .catch(() => cached || new Response("Offline", { status: 503 }));

  return cached || fetchPromise;
}

// Font caching strategy
async function cacheFonts(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response("Offline", { status: 503 });
  }
}

// Get offline fallback response
async function getOfflineResponse() {
  const offlinePage = await caches.match("/offline.html");
  if (offlinePage) {
    return offlinePage;
  }
  return new Response(
    `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ScanIQ — Offline</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #0a1014;
          color: #e2e8f0;
          text-align: center;
          padding: 1rem;
        }
        .container { max-width: 400px; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #94a3b8; line-height: 1.6; }
        button {
          margin-top: 1.5rem;
          padding: 0.75rem 1.5rem;
          background: #06b6d4;
          color: #0a1014;
          border: none;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
        }
        button:hover { background: #22d3ee; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>You're offline</h1>
        <p>ScanIQ requires an internet connection for some features. Please check your connection and try again.</p>
        <button onclick="window.location.reload()">Try Again</button>
      </div>
    </body>
    </html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }
  );
}

// Check if request is for a static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".ttf") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".json")
  );
}

// Trim cache to maximum size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    trimCache(cacheName, maxItems);
  }
}

// Handle messages from the app
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data === "CLEAR_CACHE") {
    event.waitUntil(
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      }).then(() => {
        event.source.postMessage("CACHE_CLEARED");
      })
    );
  }
});
