// Fetches play counts and fills elements with data-* attributes.
// Runs after the page renders so it never blocks the static content.
//
//   data-play-slug="catan"              → boundary (QR-scan) play count, e.g. "5 plays"
//   data-play-slug="catan" data-play-plain → plain number, e.g. "5"
//   data-member-play-slug="catan"       → member play count, e.g. "5 plays"
//   data-member-play-slug="catan" data-play-plain → plain number

// The theme sets `scroll-smooth` on <html> globally. When a bfcache page is restored
// (e.g. via the back button), the browser's automatic scroll-position restore then
// animates instead of snapping — and can visibly stall partway. Suspend smooth
// scrolling for the instant of the restore so it snaps back like a normal page load.
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;

  document.documentElement.classList.remove("scroll-smooth");
  requestAnimationFrame(() => {
    document.documentElement.classList.add("scroll-smooth");
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const playEls       = document.querySelectorAll("[data-play-slug]");
  const memberPlayEls = document.querySelectorAll("[data-member-play-slug]");

  if (!playEls.length && !memberPlayEls.length) return;

  try {
    // Each endpoint is only asked for when something on the page needs it: the
    // stats page and game pages carry both, but a page with only member counts
    // was still paying for /api/plays (a KV listing behind it).
    const [playsRes, memberRes] = await Promise.all([
      playEls.length ? fetch("/api/plays") : Promise.resolve(null),
      memberPlayEls.length ? fetch("/api/member-plays") : Promise.resolve(null),
    ]);

    const counts       = playsRes?.ok  ? await playsRes.json()  : {};
    const memberCounts = memberRes?.ok ? await memberRes.json() : {};

    playEls.forEach(el => {
      const n = counts[el.dataset.playSlug] || 0;
      el.textContent = el.hasAttribute("data-play-plain")
        ? String(n)
        : `${n} play${n === 1 ? "" : "s"}`;
    });

    memberPlayEls.forEach(el => {
      const n = memberCounts[el.dataset.memberPlaySlug] || 0;
      el.textContent = el.hasAttribute("data-play-plain")
        ? String(n)
        : `${n} play${n === 1 ? "" : "s"}`;
    });
  } catch {
    // Network/API failure — leave placeholders as-is.
  }
});
