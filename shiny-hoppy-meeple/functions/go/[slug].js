// QR-code target: /go/<slug>
// Redirects to the matching game page. No tracking.

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export async function onRequestGet(context) {
  const { params, request } = context;
  const slug = params.slug;

  // Only build a same-origin redirect for well-formed slugs (defence against
  // path/header injection); Pages serves a 404 if the page doesn't exist.
  const safe = SLUG_RE.test(slug) ? slug : "";
  const target = new URL(`/our-library/${safe}/`, request.url);
  return Response.redirect(target.toString(), 302);
}
