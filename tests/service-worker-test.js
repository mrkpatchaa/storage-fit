// Runs sw.js against an in-memory Cache Storage and a switchable network.
// Usage: node tests/service-worker-test.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const ORIGIN = "https://storage-fit.test";
let failures = 0, total = 0;
function result(ok, name, detail = "") {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail && !ok ? ` — ${detail}` : ""}`);
}

function loadWorker({ online = true, existingCaches = {} } = {}) {
  const listeners = {};
  const stores = new Map(Object.entries(existingCaches).map(([name, entries]) => [name, new Map(entries)]));
  const network = { online, deploy: "v1", requests: [] };
  const key = url => new URL(url, ORIGIN + "/").href;
  const withoutSearch = url => { const u = new URL(url, ORIGIN + "/"); u.search = ""; return u.href; };
  const cacheFor = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      put: async (request, response) => { store.set(key(request.url || request), await response.text()); },
      addAll: async urls => {
        for (const url of urls) {
          const response = await fakeFetch(new Request(key(url)));
          if (!response.ok) throw new TypeError(`precache failed for ${url}`);
          store.set(key(url), await response.text());
        }
      },
      match: async (request, options = {}) => {
        const wanted = options.ignoreSearch ? withoutSearch(request.url || request) : key(request.url || request);
        for (const [url, body] of store) {
          if ((options.ignoreSearch ? withoutSearch(url) : url) === wanted) return new Response(body);
        }
        return undefined;
      }
    };
  };
  async function fakeFetch(request) {
    const url = request.url || request;
    network.requests.push(url);
    if (!network.online) throw new TypeError("Failed to fetch");
    const file = path.join(root, new URL(url).pathname.replace(/^\/$/, "/index.html"));
    if (!fs.existsSync(file)) return new Response("missing", { status: 404 });
    return new Response(`${network.deploy}:${new URL(url).pathname}`, { status: 200 });
  }
  const self = {
    location: { origin: ORIGIN, href: ORIGIN + "/sw.js" },
    addEventListener: (type, handler) => { listeners[type] = handler; },
    skipWaiting: async () => {},
    clients: { claim: async () => {} }
  };
  const caches = {
    open: async name => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async (request, options) => {
      for (const name of stores.keys()) {
        const hit = await cacheFor(name).match(request, options);
        if (hit) return hit;
      }
      return undefined;
    }
  };
  const context = { self, caches, fetch: fakeFetch, Request, Response, URL, Promise, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "sw.js"), "utf8"), context, { filename: "sw.js" });

  async function lifecycle(type) {
    let pending = Promise.resolve();
    listeners[type]({ waitUntil: p => { pending = p; } });
    await pending;
  }
  async function request(url, { mode = "cors", method = "GET" } = {}) {
    let responded = null;
    const event = { request: { url: new URL(url, ORIGIN + "/").href, mode, method }, respondWith: r => { responded = r; } };
    listeners.fetch(event);
    if (!responded) return null;
    const response = await responded;
    return { status: response.status, body: await response.text() };
  }
  return { lifecycle, request, network, stores };
}

(async () => {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const share = fs.readFileSync(path.join(root, "share.html"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const referenced = new Set();
  for (const html of [index, share]) {
    for (const m of html.matchAll(/(?:src|href)="([^"#:?]+)"/g)) referenced.add(m[1]);
  }
  for (const icon of manifest.icons) referenced.add(icon.src);

  const worker = loadWorker();
  await worker.lifecycle("install");
  const cached = [...(worker.stores.values().next().value || new Map()).keys()].map(u => new URL(u).pathname.replace(/^\//, ""));
  const missing = [...referenced].filter(file => !cached.includes(file));
  result(missing.length === 0, "installing the service worker caches every file the planner and share viewer load", missing.join(", "));
  result(cached.includes("") && cached.includes("index.html") && cached.includes("share.html") && cached.includes("manifest.webmanifest"), "the app shell, share viewer and manifest are cached for offline use", cached.join(", "));
  const absent = cached.filter(file => file && !fs.existsSync(path.join(root, file)));
  result(absent.length === 0, "every cached file exists in the repository", absent.join(", "));

  worker.network.deploy = "v2";
  const fresh = await worker.request("app.js?v=2");
  result(fresh && fresh.body === "v2:/app.js", "online, files come from the network so a new deploy is picked up immediately", JSON.stringify(fresh));
  worker.network.online = false;
  const offlineScript = await worker.request("app.js?v=3");
  result(offlineScript && offlineScript.body === "v2:/app.js", "offline, the most recently fetched copy is served from the cache, even with a different query string", JSON.stringify(offlineScript));
  const offlineShare = await worker.request("share.html", { mode: "navigate" });
  result(offlineShare && offlineShare.body === "v1:/share.html", "offline, opening a shared-plan link still loads the share viewer", JSON.stringify(offlineShare));
  const offlineUnknown = await worker.request("rooms/kitchen", { mode: "navigate" });
  result(offlineUnknown && offlineUnknown.body === "v1:/index.html", "offline, any other page navigation falls back to the planner", JSON.stringify(offlineUnknown));
  worker.network.online = true;

  const before = worker.network.requests.length;
  const external = await worker.request("https://www.ikea.com/ma/en/p/sockerbit-storage-box-40522088/");
  const posted = await worker.request("app.js", { method: "POST" });
  result(external === null && posted === null && worker.network.requests.length === before, "product imports and other cross-origin or non-GET requests bypass the service worker");

  const upgraded = loadWorker({ existingCaches: { "storage-fit-old": [[ORIGIN + "/app.js", "old"]], "another-app": [[ORIGIN + "/x", "keep"]] } });
  await upgraded.lifecycle("install");
  await upgraded.lifecycle("activate");
  const names = [...upgraded.stores.keys()];
  result(!names.includes("storage-fit-old") && names.includes("another-app") && names.some(n => n.startsWith("storage-fit-")), "activating a new version deletes older Storage Fit caches and leaves other caches alone", names.join(", "));

  result(manifest.start_url && manifest.display === "standalone" && manifest.icons.some(i => i.sizes === "512x512") && manifest.icons.some(i => i.sizes === "192x192"), "the manifest makes the planner installable as a standalone app with 192 and 512 px icons");

  console.log(`Service worker tests passed: ${total - failures}/${total}`);
  process.exit(failures ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
