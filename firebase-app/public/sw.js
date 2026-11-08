// Offline support for the station app: serve the last copy of the app when the network is down.
// Live data still comes from Firestore, which keeps its own offline copy on each device.
const CACHE = "unh-shell-v8";
const SHELL = ["/app.html", "/firebase-config.js", "/manifest.json", "/icon.svg", "/logo.png",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first, so staff always get the newest version when online; fall back to the cached copy offline.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const appFile = url.origin === location.origin && !url.pathname.startsWith("/__/");
  const lib = url.hostname === "www.gstatic.com" || url.hostname === "cdnjs.cloudflare.com" || url.hostname === "cdn.jsdelivr.net";
  if (!appFile && !lib) return; // Firestore, Auth and functions traffic go straight to the network
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && (appFile || lib)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: url.pathname === "/app.html" }))
  );
});
