 
const CACHE_NAME = "snapspace-v1";

// Update these to include your repository name
const ASSETS_TO_CACHE = [
  "/SnapSpace/",
  "/SnapSpace/index.html",
  "/SnapSpace/style.css",
  "/SnapSpace/app.js",
  "/SnapSpace/manifest.json"
];

// 1. Install Event: Caches static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching static assets");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// 2. Activate Event: Cleans up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  // Ensure that the service worker takes control of the page immediately
  self.clients.claim();
});

// 3. Fetch Event: Serves files from the cache if available, otherwise fetches from the network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
