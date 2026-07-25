// The build-time allowlist of valid game slugs, emitted by Hugo as
// /scan-slugs.json (see layouts/index.scanslugs.json). Every KV read and write
// is gated on it, so junk or abusive requests can't create keys or surface
// stray ones.

// Returns a Set of slugs, or null if the allowlist can't be read — callers fail
// closed on null rather than trusting a format-only check.
export async function knownSlugs(context) {
  const { env, request } = context;
  const url = new URL("/scan-slugs.json", request.url);
  try {
    // env.ASSETS serves the static file from this deployment directly, instead
    // of a round trip back out to the public origin. It also means the file
    // needs no basic-auth exemption on the dev/stage previews, since the
    // middleware never sees the request.
    const res = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
    if (res.ok) return new Set(await res.json());
  } catch {
    // allowlist unavailable — caller fails closed
  }
  return null;
}
