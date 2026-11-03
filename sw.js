const CACHE = "stacks-of-wax-v4";

const SCOPE = new URL(self.registration.scope).pathname;

function stripScope(pathname) {
  if (SCOPE === "/") return pathname;
  const prefix = SCOPE.endsWith("/") ? SCOPE.slice(0, -1) : SCOPE;
  if (pathname === prefix) return "/";
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  return pathname;
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const pathname = stripScope(url.pathname);
  if (pathname.startsWith("/api/") || pathname.startsWith("/_server")) return;

  // Bundled starter pack only. The full library is downloaded into IndexedDB
  // from another site and must not be precached here.
  if (pathname.startsWith("/reference/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStatic(pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

function isStatic(pathname) {
  return (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/__grok/") ||
    pathname === "/sw.js" ||
    pathname === "/favicon.svg" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|svg|png|jpe?g|webp|ico)$/.test(pathname)
  );
}

function shellRequest() {
  return new Request(new URL(SCOPE, self.location.origin).href);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const shell = shellRequest();
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(shell, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(shell)) || (await cache.match(request));
    if (cached) return cached;
    return new Response(
      "Stacks Of Wax is not on this device yet. Open it once while you have a signal.",
      {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      },
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}
