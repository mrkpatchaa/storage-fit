// Offline support. Same-origin GET requests go to the network first, so a new
// deploy is picked up as soon as you are online, and every response refreshes
// the cache. Offline, the cached copy is served; an unknown page falls back to
// the planner. Product imports and other cross-origin requests are not touched.
const CACHE = "storage-fit-v1";
const SHELL = [
  "./", "index.html", "share.html", "styles.css", "app.js", "share.js", "view3d.js",
  "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name.startsWith("storage-fit-") && name !== CACHE).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          // One entry per file: a cache-busting query must not leave an older copy behind.
          const copy = response.clone(), key = new URL(request.url);
          key.search = "";
          caches.open(CACHE).then(cache => cache.put(key.href, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then(hit => hit || (request.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
