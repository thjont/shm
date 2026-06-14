// GET  /api/member-plays  → { "<slug>": <count>, ... }
// POST /api/member-plays  → { slug } increments by 1, returns { slug, count }
// Stored in SCANS KV as "member:<slug>" to avoid collision with QR-scan keys.

const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const PREFIX = "member:";

async function knownSlugs(request) {
  try {
    const headers = {};
    const auth = request.headers.get("Authorization");
    if (auth) headers["Authorization"] = auth;
    const res = await fetch(new URL("/scan-slugs.json", request.url), { headers });
    if (res.ok) return new Set(await res.json());
  } catch (e) {
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
    for (const key of list.keys) {
      const slug = key.name.slice(PREFIX.length);
      if (!allow.has(slug)) continue;
      counts[slug] = parseInt(await env.SCANS.get(key.name), 10) || 0;
    }
  }

  return new Response(JSON.stringify(counts), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;

  let slug;
  try {
    const body = await request.json();
    slug = body?.slug;
  } catch (e) {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!slug || !SLUG_RE.test(slug)) {
    return new Response(JSON.stringify({ error: "invalid slug" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!env.SCANS) {
    return new Response(JSON.stringify({ error: "KV unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const allow = await knownSlugs(request);
  if (!allow || !allow.has(slug)) {
    return new Response(JSON.stringify({ error: "unknown slug" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const kvKey = `${PREFIX}${slug}`;
  const current = parseInt(await env.SCANS.get(kvKey), 10) || 0;
  const next = current + 1;
  await env.SCANS.put(kvKey, String(next));

  return new Response(JSON.stringify({ slug, count: next }), {
    headers: { "content-type": "application/json" },
  });
}
