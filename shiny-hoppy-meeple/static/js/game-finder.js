// Client-side filtering for the library grid (/library/).
//
// The #game-finder form is rendered hidden; this script reveals it and filters
// the .bgg-card grid on every input. Cards carry the data via attributes:
//
//   data-name          game name (substring match, case-insensitive)
//   data-min-players / data-max-players
//   data-time          playing time in minutes (0 = unknown)
//   data-complexity    library-relative bucket, computed at build time
//                      ("light" | "medium" | "heavy", empty = unknown)
//
// A card with unknown data is excluded once the corresponding filter is
// active — better to under-promise than suggest an unplayable game.

document.addEventListener("DOMContentLoaded", () => {
  const finder = document.getElementById("game-finder");
  if (!finder) return;

  const cards = Array.from(document.querySelectorAll(".bgg-collection .bgg-card"));
  const countEl = finder.querySelector("[data-finder-count]");
  const emptyEl = document.querySelector("[data-finder-empty]");
  const control = name => finder.querySelector(`[data-finder="${name}"]`);
  const controls = {
    players: control("players"),
    minTime: control("min-time"),
    maxTime: control("max-time"),
    complexity: control("complexity"),
    name: control("name"),
  };

  function apply() {
    const players = Number(controls.players.value) || 0;
    const minTime = Number(controls.minTime.value) || 0;
    const maxTime = Number(controls.maxTime.value) || 0;
    const complexity = controls.complexity.value;
    const name = controls.name.value.trim().toLowerCase();

    let shown = 0;
    cards.forEach(card => {
      const d = card.dataset;
      let ok = true;

      if (players) {
        const min = Number(d.minPlayers);
        const max = Number(d.maxPlayers);
        ok = min > 0 && max > 0 && min <= players && players <= max;
      }
      // Strict comparisons: the labels say "longer/shorter than", so mean it.
      if (ok && (minTime || maxTime)) {
        const t = Number(d.time);
        ok = t > 0
          && (!minTime || t > minTime)
          && (!maxTime || t < maxTime);
      }
      if (ok && complexity) {
        ok = d.complexity === complexity;
      }
      if (ok && name) {
        ok = d.name.toLowerCase().includes(name);
      }

      card.classList.toggle("bgg-card-hidden", !ok);
      if (ok) shown++;
    });

    countEl.textContent = shown === cards.length
      ? `${cards.length} game${cards.length === 1 ? "" : "s"}`
      : `${shown} of ${cards.length} games`;
    if (emptyEl) emptyEl.hidden = shown > 0;
  }

  finder.addEventListener("input", apply);
  // "reset" fires before the controls revert, so reapply on the next frame.
  finder.addEventListener("reset", () => requestAnimationFrame(apply));
  finder.addEventListener("submit", e => e.preventDefault());

  finder.hidden = false;
  apply();
});
