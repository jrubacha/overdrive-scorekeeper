// Service Worker for Overdrive Scorekeeper
// =========================================
// Enables offline functionality and caching

const CACHE_NAME = "overdrive-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/scorer.html",
  "/scoreboard.html",
  "/admin.html",
  "/manifest.json",
  "/css/styles.css",
  "/js/firebase-config.js",
  "/js/scoring-rules.js",
  "/js/db.js",
  "/js/scorer.js",
  "/js/scoreboard.js",
  "/js/admin.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// External resources to cache
const EXTERNAL_ASSETS = [
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js"
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker: Caching static assets");
      // Cache static assets (don't fail if some are missing during development)
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.log(`Failed to cache ${url}:`, err))
        )
      ).then(() => {
        // Also try to cache external Firebase scripts
        return Promise.allSettled(
          EXTERNAL_ASSETS.map((url) =>
            cache.add(url).catch((err) => console.log(`Failed to cache ${url}:`, err))
          )
        );
      });
    })
  );

  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activated");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Service Worker: Clearing old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );

  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - serve from cache, fall back to network
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // Skip Firebase database requests (they need real-time data)
  if (url.hostname.includes("firebaseio.com") || url.hostname.includes("firebasedatabase.app")) {
    return;
  }

  // For Firebase SDK files and static assets, use cache-first strategy
  if (url.hostname === "www.gstatic.com" || url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version
          return cachedResponse;
        }

        // Not in cache, fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200) {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Add to cache
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return response;
          })
          .catch(() => {
            // Network failed and not in cache
            // Return a fallback for HTML pages
            if (event.request.headers.get("accept").includes("text/html")) {
              return caches.match("/index.html");
            }
            return new Response("Offline", { status: 503 });
          });
      })
    );
  }
});

// Handle messages from the main app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
