// Fetches scan counts and fills elements with data-scan-slug or data-rank-slug attributes.
// Runs after the page renders so it never blocks the static content.
//   <span data-scan-slug="catan"></span>        → "5 scans"
//   <span data-scan-slug="catan" data-scan-plain></span> → "5"
//   <span data-rank-slug="catan"></span>         → "#3" (skip rank across the full library)

// Build a skip-rank map from a slug→count object.
// Games with 0 scans all receive the same last rank.
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
  const scanEls = document.querySelectorAll("[data-scan-slug]");
  const rankEls = document.querySelectorAll("[data-rank-slug]");
  if (!scanEls.length && !rankEls.length) return;

  try {
    const res = await fetch("/api/scans");
    if (!res.ok) return;
    const counts = await res.json();

    scanEls.forEach((el) => {
      const n = counts[el.dataset.scanSlug] || 0;
      el.textContent = el.hasAttribute("data-scan-plain")
        ? String(n)
        : `${n} scan${n === 1 ? "" : "s"}`;
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
