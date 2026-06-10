// Fetches scan counts and fills any element with a data-scan-slug attribute.
// Runs after the page renders so it never blocks the static content.
//   <span data-scan-slug="catan"></span>        → "5 scans"
//   <span data-scan-slug="catan" data-scan-plain></span> → "5"

document.addEventListener("DOMContentLoaded", async () => {
  const els = document.querySelectorAll("[data-scan-slug]");
  if (!els.length) return;

  try {
    const res = await fetch("/api/scans");
    if (!res.ok) return;
    const counts = await res.json();

    els.forEach((el) => {
      const n = counts[el.dataset.scanSlug] || 0;
      el.textContent = el.hasAttribute("data-scan-plain")
        ? String(n)
        : `${n} scan${n === 1 ? "" : "s"}`;
    });
  } catch (e) {
    // Network/API failure — leave placeholders as-is, no error shown to visitors.
  }
});
