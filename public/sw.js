const CACHE_NAME = "kitchenmind-public-v5";
const STATIC_SHELL = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192.svg",
  "/icon-512.svg"
];
const PRIVATE_PREFIXES = ["/app", "/platform", "/api/customer", "/api/platform", "/api/auth", "/aceptar-invitacion", "/login", "/recuperar", "/restablecer", "/logout"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
    return;
  }
  if (!STATIC_SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "PURGE_USER_DATA") event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
});
