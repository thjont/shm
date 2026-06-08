// GET /api/scans
// Returns all scan counts as JSON: { "<slug>": <count>, ... }
// Consumed client-side by /js/scans.js to display counts on the site.

export async function onRequestGet(context) {
  const { env } = context;
  const counts = {};

  if (env.SCANS) {
    const list = await env.SCANS.list();
    for (const key of list.keys) {
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
