// GET  /api/member-plays  → { "<slug>": <count>, ... }
// POST /api/member-plays  → { slug } increments by 1, returns { slug, count }
// Stored in SCANS KV as "member:<slug>" to avoid collision with QR-scan keys.

import { json } from "../_lib/json.js";
import { cachedJson, purgeCached } from "../_lib/edge-cache.js";
import { knownSlugs } from "../_lib/slugs.js";
import { MEMBER_PREFIX, countMetadata, readMemberCounts } from "../_lib/counts.js";

const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const PATH = "/api/member-plays";
const MAX_AGE = 30;

export async function onRequestGet(context) {
  return cachedJson(context, PATH, async () => {
    const { env } = context;

    const allow = env.SCANS ? await knownSlugs(context) : null;
    const counts = allow ? await readMemberCounts(env.SCANS, allow) : {};

    return json(counts, { cacheControl: `public, max-age=${MAX_AGE}` });
  });
}

// Deliberately unauthenticated: anyone can increment, which can inflate the
// member counts and SHM Rank. Accepted risk for a small community site —
// revisit (rate limit or auth) if it's ever abused.
export async function onRequestPost(context) {
  const { env, request } = context;

  let slug;
  try {
    const body = await request.json();
    slug = body?.slug;
  } catch {
    return json({ error: "invalid body" }, { status: 400 });
  }

  if (!slug || !SLUG_RE.test(slug)) {
    return json({ error: "invalid slug" }, { status: 400 });
  }

  if (!env.SCANS) {
    return json({ error: "KV unavailable" }, { status: 503 });
  }

  const allow = await knownSlugs(context);
  if (!allow || !allow.has(slug)) {
    return json({ error: "unknown slug" }, { status: 404 });
  }

  // KV allows roughly one write per second per key, so two members tapping +1
  // for the same game at the same moment will lose an increment. Acceptable for
  // a group logging plays at a table.
  const kvKey = `${MEMBER_PREFIX}${slug}`;
  const current = parseInt(await env.SCANS.get(kvKey), 10) || 0;
  const next = current + 1;
  await env.SCANS.put(kvKey, String(next), countMetadata(next));

  // The caller updates its own number from this response, but drop the cached
  // GET so anything else reading in this colo sees the new total right away.
  context.waitUntil(purgeCached(context, PATH));

  return json({ slug, count: next });
}
