// Client-side filtering for the library grid (/library/).
//
// The #game-finder form is rendered hidden; this script reveals it and filters
// the .bgg-card grid on every input. Cards carry the data via attributes:
//
//   data-name          game name (substring match, case-insensitive)
//   data-min-players / data-max-players
//   data-time          playing time in minutes (0 = unknown)
//   data-weight        BGG average weight (0 = unknown)
//
// A card with unknown data (0) is excluded once the corresponding filter is
// active — better to under-promise than suggest an unplayable game.

// Weight buckets mirror content/games/_content.gotmpl — keep in sync.
function complexityBucket(weight) {
  if (!weight) return "";
  if (weight < 2) return "light";
  if (weight < 3) return "medium-light";
  if (weight < 4) return "medium";
  if (weight < 5) return "medium-heavy";
  return "heavy";
}

document.addEventListener("DOMContentLoaded", () => {
  const finder = document.getElementById("game-finder");
  if (!finder) return;

  const cards = Array.from(document.querySelectorAll(".bgg-collection .bgg-card"));
  const countEl = finder.querySelector("[data-finder-count]");
  const emptyEl = document.querySelector("[data-finder-empty]");
  const control = name => finder.querySelector(`[data-finder="${name}"]`);
  const controls = {
    players: control("players"),
    time: control("time"),
    weight: control("weight"),
    name: control("name"),
  };

  function apply() {
    const players = Number(controls.players.value) || 0;
    const maxTime = Number(controls.time.value) || 0;
    const weight = controls.weight.value;
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
      if (ok && maxTime) {
        const t = Number(d.time);
        ok = t > 0 && t <= maxTime;
      }
      if (ok && weight) {
        ok = complexityBucket(Number(d.weight)) === weight;
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
