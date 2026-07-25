// Shared handler for QR-code play-counting endpoints (/p/, /lets-play/ and
// /learn-to-play/). Redirects to the game page and counts the scan in KV.
// Only slugs in the build-time allowlist (/scan-slugs.json) are counted, so
// random or abusive requests can't pollute KV with junk keys or burn the write
// quota. The KV namespace is bound as `SCANS` (see wrangler.toml).

import { knownSlugs } from "./slugs.js";
import { SCAN_PREFIX, countMetadata } from "./counts.js";

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const slug = params.slug;

  // The person scanning is standing at a table waiting for a page, so the
  // counter doesn't get to hold up the redirect: waitUntil keeps the allowlist
  // check and the KV write running after the 302 has gone out.
  if (env.SCANS) context.waitUntil(countScan(context, slug));

  // Only build a same-origin redirect for well-formed slugs (defence against
  // path/header injection); Pages serves a 404 if the page doesn't exist.
  const safe = SLUG_RE.test(slug) ? slug : "";
  const target = new URL(`/games/${safe}/`, request.url);
  return Response.redirect(target.toString(), 302);
}

async function countScan(context, slug) {
  const { env } = context;
  try {
    // Fail closed: only count when the slug is on the allowlist. If the
    // allowlist is unavailable (null), don't write to KV at all.
    const allow = await knownSlugs(context);
    if (!allow || !allow.has(slug)) return;

    const key = `${SCAN_PREFIX}${slug}`;
    let current = parseInt(await env.SCANS.get(key), 10);
    let legacyKey = null;

    if (!Number.isFinite(current)) {
      // Scans used to be stored under a bare `<slug>`. Adopt that total and drop
      // the old key, so the keyspace migrates itself one game at a time and no
      // count is lost on the way.
      const legacy = parseInt(await env.SCANS.get(slug), 10);
      if (Number.isFinite(legacy)) {
        current = legacy;
        legacyKey = slug;
      } else {
        current = 0;
      }
    }

    // KV is eventually consistent and allows roughly one write per second per
    // key, so simultaneous scans of the same box lose an increment. Acceptable
    // for low-volume venue plays. The count also goes into the key's metadata,
    // so /api/plays can answer from a listing alone.
    const next = current + 1;
    await env.SCANS.put(key, String(next), countMetadata(next));
    if (legacyKey) await env.SCANS.delete(legacyKey);
  } catch (err) {
    // Never fail the scan over the counter. Since this runs after the response,
    // an uncaught throw would be an unhandled rejection rather than a 500 — but
    // it would still lose the log line. The KV free tier allows 1,000 writes/day
    // on these unauthenticated routes, so an exhausted quota is realistic, and
    // this soft failure is the whole mitigation: rate limiting isn't available on
    // a pages.dev host. See "an accepted risk" in DEVELOPMENT.md.
    console.error(`play count write failed for ${slug}: ${err.message}`);
  }
}
