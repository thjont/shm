// Shared handler for QR-code play-counting endpoints (/p/ and /lets-play/).
// Increments the play counter for <slug> in KV, then redirects to the game page.
// Only slugs in the build-time allowlist (/scan-slugs.json) are counted, so random
// or abusive requests can't pollute KV with junk keys or burn the write quota.
// The KV namespace is bound as `SCANS` (see wrangler.toml).

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

// Load the set of valid slugs emitted by Hugo. The file is a small, edge-cached
// static asset, so this subrequest is cheap. Returns null if it can't be read,
// in which case we fail closed (skip the KV write) rather than counting on a
// format-only check, so an allowlist outage can't be used to pollute KV.
async function knownSlugs(request) {
  try {
    const headers = {};
    const auth = request.headers.get("Authorization");
    if (auth) headers["Authorization"] = auth;
    const res = await fetch(new URL("/scan-slugs.json", request.url), { headers });
    if (res.ok) return new Set(await res.json());
  } catch (e) {
    // allowlist unavailable — caller falls back to SLUG_RE
  }
  return null;
}

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const slug = params.slug;

  // Fail closed: only count when the slug is on the allowlist. If the allowlist
  // is unavailable (null), don't write to KV at all.
  const allow = await knownSlugs(request);
  const counts = allow ? allow.has(slug) : false;

  if (counts && env.SCANS) {
    // KV is eventually consistent, so this read-modify-write can rarely lose a
    // simultaneous increment. Acceptable for low-volume venue plays.
    const current = parseInt(await env.SCANS.get(slug), 10) || 0;
    await env.SCANS.put(slug, String(current + 1));
  }

  // Only build a same-origin redirect for well-formed slugs (defence against
  // path/header injection); Pages serves a 404 if the page doesn't exist.
  const safe = SLUG_RE.test(slug) ? slug : "";
  const target = new URL(`/g/${safe}/`, request.url);
  return Response.redirect(target.toString(), 302);
}
