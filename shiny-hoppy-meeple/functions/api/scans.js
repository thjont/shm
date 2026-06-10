// GET /api/scans
// Returns scan counts as JSON: { "<slug>": <count>, ... }
// Restricted to slugs in the build-time allowlist (/scan-slugs.json) so any stray
// keys never surface or bloat the response. Consumed client-side by /js/scans.js.

// Load the set of valid slugs emitted by Hugo. Returns null if unreadable, in
// which case all stored keys are returned (the pre-allowlist behaviour).
async function knownSlugs(request) {
  try {
    const res = await fetch(new URL("/scan-slugs.json", request.url));
    if (res.ok) return new Set(await res.json());
  } catch (e) {
    // allowlist unavailable — fall back to returning every key
  }
  return null;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const counts = {};

  if (env.SCANS) {
    const allow = await knownSlugs(request);
    const list = await env.SCANS.list();
    for (const key of list.keys) {
      if (allow && !allow.has(key.name)) continue;
      counts[key.name] = parseInt(await env.SCANS.get(key.name), 10) || 0;
    }
  }

  return new Response(JSON.stringify(counts), {
    headers: {
      "content-type": "application/json",
      // Cache at the edge for a minute to cut KV reads and speed up the page.
      "cache-control": "public, max-age=60",
    },
  });
}
