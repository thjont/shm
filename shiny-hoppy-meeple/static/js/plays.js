// Fetches play counts and fills elements with data-play-slug or data-rank-slug attributes.
// Runs after the page renders so it never blocks the static content.
//   <span data-play-slug="catan"></span>        → "5 plays"
//   <span data-play-slug="catan" data-play-plain></span> → "5"
//   <span data-rank-slug="catan"></span>         → "#3" (skip rank across the full library)

// Build a skip-rank map from a slug→count object.
// Games with 0 plays all receive the same last rank.
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

document.addEventListener("DOMContentLoaded", async () => {
  const playEls = document.querySelectorAll("[data-play-slug]");
  const rankEls = document.querySelectorAll("[data-rank-slug]");
  if (!playEls.length && !rankEls.length) return;

  try {
    const res = await fetch("/api/plays");
    if (!res.ok) return;
    const counts = await res.json();

    playEls.forEach((el) => {
      const n = counts[el.dataset.playSlug] || 0;
      el.textContent = el.hasAttribute("data-play-plain")
        ? String(n)
        : `${n} play${n === 1 ? "" : "s"}`;
    });

    if (rankEls.length) {
      const ranks = buildRanks(counts);
      rankEls.forEach((el) => {
        const r = ranks[el.dataset.rankSlug];
        el.textContent = r != null ? `#${r}` : "—";
      });
    }
  } catch (e) {
    // Network/API failure — leave placeholders as-is, no error shown to visitors.
  }
});
