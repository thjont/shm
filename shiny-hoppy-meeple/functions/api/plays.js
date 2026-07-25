// GET /api/plays
// Returns QR-scan play counts as JSON: { "<slug>": <count>, ... }
// Restricted to slugs in the build-time allowlist (/scan-slugs.json) so any stray
// keys never surface or bloat the response. Consumed client-side by /js/plays.js.

import { json } from "../_lib/json.js";
import { cachedJson } from "../_lib/edge-cache.js";
import { knownSlugs } from "../_lib/slugs.js";
import { readScanCounts } from "../_lib/counts.js";

const MAX_AGE = 60;

export async function onRequestGet(context) {
  return cachedJson(context, "/api/plays", async () => {
    const { env } = context;

    // Fail closed: without the allowlist, return no counts rather than leaking
    // every stored key (consistent with the play-handler's write gate).
    const allow = env.SCANS ? await knownSlugs(context) : null;
    const counts = allow ? await readScanCounts(env.SCANS, allow) : {};

    return json(counts, { cacheControl: `public, max-age=${MAX_AGE}` });
  });
}
