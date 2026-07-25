// JSON responses for the API routes. static/_headers only covers assets Pages
// serves itself, so Function responses have to set their own nosniff header.

export function json(body, { status = 200, cacheControl = null } = {}) {
  const headers = {
    "content-type": "application/json",
    "x-content-type-options": "nosniff",
  };
  if (cacheControl) headers["cache-control"] = cacheControl;
  return new Response(JSON.stringify(body), { status, headers });
}
