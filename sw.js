// Offline support. Same-origin GET requests go to the network first, so a new
// deploy is picked up as soon as you are online, and every response refreshes
// the cache. Offline, or when the network has not answered within a few
// seconds, the cached copy is served; an unknown page falls back to the
// planner. Product imports and other cross-origin requests are not touched.
const CACHE = "storage-fit-v4";
const SHELL = [
  "./", "index.html", "share.html", "styles.css", "app.js", "share.js", "view3d.js", "qr.js", "theme.js",
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

// A connection that answers slowly is not waited on forever when a cached copy exists.
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  // One entry per file: a cache-busting query must not leave an older copy behind.
  const key = new URL(request.url);
  key.search = "";
  let stored = Promise.resolve();
  const network = fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      stored = caches.open(CACHE).then(cache => cache.put(key.href, copy));
    }
    return response;
  });
  // Keep the worker alive until the refreshed copy is in the cache.
  event.waitUntil(network.then(() => stored, () => {}));
  const cached = () => caches.match(request, { ignoreSearch: true })
    .then(hit => hit || (request.mode === "navigate" ? caches.match("index.html") : undefined));
  event.respondWith(new Promise(resolve => {
    let done = false;
    const finish = response => { if (!done && response) { done = true; resolve(response); } };
    const timer = setTimeout(() => cached().then(finish), NETWORK_TIMEOUT_MS);
    network.then(
      response => { clearTimeout(timer); finish(response); },
      () => { clearTimeout(timer); cached().then(hit => finish(hit || Response.error())); }
    );
  }));
});
