const CACHE_NAME = "smartbook-v3";

const urlsToCache = [
  "/",
  "/index.html",
  "/booking.html",
  "/dashboard.html",
  "/login.html",
  "/register.html",
  "/manifest.json"
];

// Install — skipWaiting so an updated SW takes over immediately
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate — remove old caches and take control of open pages
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch (offline support)
// Network-first with a cache fallback, so code updates always land
// and the app still works offline.
self.addEventListener("fetch", event => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept cross-origin traffic (Firebase/Firestore/FCM, CDNs)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache a copy of same-origin responses for offline use
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached => cached || caches.match("/index.html"))
      )
  );
});

// 🔔 Click handler for notifications shown from THIS service worker
// (foreground alerts). The FCM worker handles its own push clicks.
self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      // Focus an open SmartBook tab if one exists
      for (const client of windowClients) {
        if (client.url.includes("dashboard.html") && "focus" in client) {
          return client.focus();
        }
      }
      for (const client of windowClients) {
        if ("focus" in client) return client.focus();
      }
      // Otherwise open the dashboard
      return clients.openWindow("/dashboard.html");
    })
  );
});
