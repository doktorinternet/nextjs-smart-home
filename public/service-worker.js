const CACHE_NAME = "smart-home-kiosk-shell-v1"
const OFFLINE_URL = "/offline.html"
const SHELL_ASSETS = [OFFLINE_URL, "/icon-192.svg", "/icon-512.svg", "/apple-touch-icon.svg"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("smart-home-kiosk-shell-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Keep API calls and device-control traffic on the network path only.
  const isApiPath = url.pathname === "/api" || url.pathname.startsWith("/api/")
  if (request.method !== "GET" || url.origin !== self.location.origin || isApiPath) {
    return
  }

  // Only provide a cached shell for failed page navigations. No live response is cached.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        return (await cache.match(OFFLINE_URL)) || Response.error()
      }),
    )
  }
})
