// Response caching for the read-only API routes.
//
// A `Cache-Control` header alone does NOT edge-cache a Pages Function response —
// the header reaches the browser, but every request still runs the Function, so
// each page view meant a KV listing plus a read per game. The Cache API is the
// part that actually keeps the work at the edge, so it has to be used explicitly.
//
// Caches are per-colo, so a write in one location doesn't purge another's copy;
// entries simply expire. Counts are allowed to be up to `maxAge` stale, and the
// +1 button updates its number from the POST response rather than from a re-read.

// Absent in some local dev setups, so every call site tolerates null.
function edgeCache() {
  return typeof caches !== "undefined" ? caches.default : null;
}

// Cache keys must be a request URL this Function actually owns; using the
// route's own path keeps one entry per endpoint regardless of query or method.
function cacheKey(request, path) {
  return new Request(new URL(path, request.url).toString(), { method: "GET" });
}

export async function cachedJson(context, path, build) {
  const cache = edgeCache();
  const key = cache ? cacheKey(context.request, path) : null;

  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit;
  }

  const response = await build();
  // Store after responding: the client shouldn't wait on the cache write.
  if (cache && response.ok) context.waitUntil(cache.put(key, response.clone()));
  return response;
}

// Best-effort invalidation after a write, so the next read in this colo is fresh.
export async function purgeCached(context, path) {
  const cache = edgeCache();
  if (!cache) return;
  await cache.delete(cacheKey(context.request, path));
}
