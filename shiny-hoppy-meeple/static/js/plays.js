// Fetches play counts and fills elements with data-* attributes.
// Runs after the page renders so it never blocks the static content.
//
//   data-play-slug="catan"              → boundary (QR-scan) play count, e.g. "5 plays"
//   data-play-slug="catan" data-play-plain → plain number, e.g. "5"
//   data-rank-slug="catan"              → SHM rank by member plays, e.g. "#3"
//   data-member-play-slug="catan"       → member play count, e.g. "5 plays"
//   data-member-play-slug="catan" data-play-plain → plain number

function buildRanks(counts) {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const ranks = {};
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i][1] < sorted[i - 1][1]) rank = i + 1;
    ranks[sorted[i][0]] = rank;
  }
  return ranks;
}

// The theme sets `scroll-smooth` on <html> globally. When a bfcache page is restored
// (e.g. via the back button), the browser's automatic scroll-position restore then
// animates instead of snapping — and can visibly stall partway (an element left
// floating mid-scroll) until another interaction nudges it. Suspend smooth scrolling
// for the instant of the restore so it snaps back like a normal page load.
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  document.documentElement.classList.remove("scroll-smooth");
  requestAnimationFrame(() => {
    document.documentElement.classList.add("scroll-smooth");
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const playEls       = document.querySelectorAll("[data-play-slug]");
  const rankEls       = document.querySelectorAll("[data-rank-slug]");
  const memberPlayEls = document.querySelectorAll("[data-member-play-slug]");

  if (!playEls.length && !rankEls.length && !memberPlayEls.length) return;

  try {
    const needsMember = rankEls.length || memberPlayEls.length;
    const [playsRes, memberRes] = await Promise.all([
      fetch("/api/plays"),
      needsMember ? fetch("/api/member-plays") : Promise.resolve(null),
    ]);

    const counts       = playsRes.ok  ? await playsRes.json()  : {};
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

    if (rankEls.length) {
      const ranks = buildRanks(memberCounts);
      rankEls.forEach(el => {
        const r = ranks[el.dataset.rankSlug];
        el.textContent = r != null ? `#${r}` : "—";
      });
    }
  } catch {
    // Network/API failure — leave placeholders as-is.
  }
});
