// QR-code target: /go/<slug>
// Increments the scan counter for <slug> in KV, then redirects to the game page.
// The KV namespace is bound as `SCANS` (see wrangler.toml).

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const slug = params.slug;

  // Only count well-formed slugs (lowercase letters, digits, hyphens) to avoid
  // polluting KV with junk keys from random/abusive requests.
  const valid = /^[a-z0-9-]{1,64}$/.test(slug);

  if (valid && env.SCANS) {
    // KV is eventually consistent, so this read-modify-write can rarely lose a
    // simultaneous increment. Acceptable for low-volume venue scans.
    const current = parseInt(await env.SCANS.get(slug), 10) || 0;
    await env.SCANS.put(slug, String(current + 1));
  }

  const target = new URL(`/our-library/${slug}/`, request.url);
  return Response.redirect(target.toString(), 302);
}
