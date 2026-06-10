// QR-code target: /p/<slug>
// Increments the scan counter for <slug> in KV, then redirects to the game page.
// Only slugs in the build-time allowlist (/scan-slugs.json) are counted, so random
// or abusive requests can't pollute KV with junk keys or burn the write quota.
// The KV namespace is bound as `SCANS` (see wrangler.toml).

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

// Load the set of valid slugs emitted by Hugo. The file is a small, edge-cached
// static asset, so this subrequest is cheap. Returns null if it can't be read,
// in which case we fall back to a format-only check.
async function knownSlugs(request) {
  try {
    const res = await fetch(new URL("/scan-slugs.json", request.url));
    if (res.ok) return new Set(await res.json());
  } catch (e) {
    // allowlist unavailable — caller falls back to SLUG_RE
  }
  return null;
}

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const slug = params.slug;

  const allow = await knownSlugs(request);
  const counts = allow ? allow.has(slug) : SLUG_RE.test(slug);

  if (counts && env.SCANS) {
    // KV is eventually consistent, so this read-modify-write can rarely lose a
    // simultaneous increment. Acceptable for low-volume venue scans.
    const current = parseInt(await env.SCANS.get(slug), 10) || 0;
    await env.SCANS.put(slug, String(current + 1));
  }


  // Only build a same-origin redirect for well-formed slugs (defence against
  // path/header injection); Pages serves a 404 if the page doesn't exist.
  const safe = SLUG_RE.test(slug) ? slug : "";
  const target = new URL(`/g/${safe}/`, request.url);
  return Response.redirect(target.toString(), 302);
}
