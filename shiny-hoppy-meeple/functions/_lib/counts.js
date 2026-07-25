// Reading and writing play counts in the SCANS KV namespace.
//
// Two keyspaces share the namespace: QR-sticker scans under `scan:<slug>` and
// member-logged plays under `member:<slug>`. Scans used to be stored under a
// bare `<slug>`, which made the two APIs asymmetric — one could list by prefix,
// the other had to list everything. Legacy bare keys are still read here and
// are migrated on the next scan of that game (see play-handler.js).

export const SCAN_PREFIX = "scan:";
export const MEMBER_PREFIX = "member:";

// Every count is written to its key's metadata as well as its value, so a
// listing alone answers the whole request — one list() instead of a list() plus
// one get() per game. Values stay authoritative; metadata is the fast path.
export function countMetadata(count) {
  return { metadata: { count } };
}

// KV list() returns at most 1,000 keys per call. Reading only the first page
// meant that past 1,000 keys everything beyond it silently counted as 0 — and
// both keyspaces share this namespace, so that ceiling arrives twice as fast.
async function listAll(kv, options = {}) {
  const keys = [];
  let cursor;
  do {
    const page = await kv.list({ ...options, cursor });
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

// Turns { slug → key } into { slug → count }, taking the count from metadata
// where it's present and falling back to a get() for keys written before this
// (cacheTtl lets the edge serve those without a central KV read).
async function resolveCounts(kv, keysBySlug) {
  const counts = {};
  const pending = [];

  for (const [slug, key] of keysBySlug) {
    const fromMetadata = Number(key.metadata?.count);
    if (Number.isFinite(fromMetadata)) {
      counts[slug] = fromMetadata;
    } else {
      pending.push([slug, key.name]);
    }
  }

  const values = await Promise.all(
    pending.map(([, name]) => kv.get(name, { cacheTtl: 60 }))
  );
  pending.forEach(([slug], i) => {
    counts[slug] = parseInt(values[i], 10) || 0;
  });

  return counts;
}

// QR-scan counts for every allowlisted slug. A single unprefixed listing covers
// both the new `scan:` keys and any legacy bare ones. Once no bare keys are left
// this can become a `{ prefix: SCAN_PREFIX }` listing, which would also stop it
// paging through the `member:` keys it currently skips.
export async function readScanCounts(kv, allow) {
  const bare = new Map();
  const prefixed = new Map();

  for (const key of await listAll(kv)) {
    if (key.name.startsWith(MEMBER_PREFIX)) continue; // the other keyspace
    if (key.name.startsWith(SCAN_PREFIX)) {
      const slug = key.name.slice(SCAN_PREFIX.length);
      if (allow.has(slug)) prefixed.set(slug, key);
    } else if (allow.has(key.name)) {
      bare.set(key.name, key);
    }
  }

  // Prefixed last, so a migrated key wins over the bare key it replaced.
  return resolveCounts(kv, new Map([...bare, ...prefixed]));
}

// Member-logged counts. Symmetrical with the above now that scans are prefixed.
export async function readMemberCounts(kv, allow) {
  const keysBySlug = new Map();

  for (const key of await listAll(kv, { prefix: MEMBER_PREFIX })) {
    const slug = key.name.slice(MEMBER_PREFIX.length);
    if (allow.has(slug)) keysBySlug.set(slug, key);
  }

  return resolveCounts(kv, keysBySlug);
}
