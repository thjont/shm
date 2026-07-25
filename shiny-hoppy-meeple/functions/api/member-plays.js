// GET  /api/member-plays  → { "<slug>": <count>, ... }
// POST /api/member-plays  → { slug } increments by 1, returns { slug, count }
// Stored in SCANS KV as "member:<slug>" to avoid collision with QR-scan keys.

import { json } from "../_lib/json.js";

const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const PREFIX = "member:";

async function knownSlugs(request) {
  try {
    const res = await fetch(new URL("/scan-slugs.json", request.url));
    if (res.ok) return new Set(await res.json());
  } catch {
    // allowlist unavailable
  }
  return null;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const counts = {};

  const allow = env.SCANS ? await knownSlugs(request) : null;
  if (allow) {
    const list = await env.SCANS.list({ prefix: PREFIX });
    const keys = list.keys
      .map(k => k.name)
      .filter(name => allow.has(name.slice(PREFIX.length)));
    const values = await Promise.all(keys.map(name => env.SCANS.get(name)));
    keys.forEach((name, i) => {
      counts[name.slice(PREFIX.length)] = parseInt(values[i], 10) || 0;
    });
  }

  // Short cache to cut KV reads. The +1 UI updates from the POST response, so
  // it never depends on this being fresh.
  return json(counts, { cacheControl: "public, max-age=30" });
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

  const allow = await knownSlugs(request);
  if (!allow || !allow.has(slug)) {
    return json({ error: "unknown slug" }, { status: 404 });
  }

  const kvKey = `${PREFIX}${slug}`;
  const current = parseInt(await env.SCANS.get(kvKey), 10) || 0;
  const next = current + 1;
  await env.SCANS.put(kvKey, String(next));

  return json({ slug, count: next });
}
