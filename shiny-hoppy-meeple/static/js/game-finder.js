// Client-side filtering for the library grid (/library/).
//
// The #game-finder form is rendered hidden; this script reveals it and filters
// the .bgg-card grid on every input. Cards carry the data via attributes:
//
//   data-name          game name (substring match, case-insensitive)
//   data-min-players / data-max-players
//   data-time          playing time in minutes (0 = unknown)
//   data-min-age       publisher minimum age (0 = unknown)
//   data-complexity    library-relative bucket, computed at build time
//                      ("light" | "medium" | "heavy", empty = unknown)
//   data-play-style    derived from BGG mechanics at build time
//                      ("competitive" | "co-op" | "team-vs-team" |
//                      "semi-co-op", empty = unknown)
//   data-categories / data-mechanics
//                      space-separated anchorized BGG terms (card must carry
//                      every selected term, empty = unknown)
//   data-year / data-rating / data-weight
//                      sort keys only (year published, BGG bayes-average
//                      rating, BGG weight; empty = unknown)
//
// A card with unknown data is excluded once the corresponding filter is
// active — better to under-promise than suggest an unplayable game.
//
// Category/mechanic checkboxes that would yield zero results under the
// current filters are disabled and greyed out (checked ones never are, so
// they can always be un-checked).
//
// The "Sort by" control reorders the cards in the grid ("" = the order the
// collection was exported in); cards with an unknown sort key go last.
//
// Filter state mirrors into the URL query string (?players=4&complexity=heavy
// &min-time=30&max-time=90&name=pan&sort=rating), so any filtered view is
// linkable and pages elsewhere on the site can deep-link into it. Categories
// and mechanics are multi-select checkbox dropdowns; their params repeat, one
// per selected term (?mechanic=deduction&mechanic=memory).

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
    playStyle: control("play-style"),
    age: control("age"),
    name: control("name"),
    sort: control("sort"),
  };
  const multis = Array.from(finder.querySelectorAll("[data-finder-multi]"));
  const checkedValues = multi =>
    Array.from(multi.querySelectorAll("input:checked"), box => box.value);

  // Per-card term sets, precomputed once so the dead-option sweep in apply()
  // is just set lookups on every input event.
  const facetKeys = { category: "categories", mechanic: "mechanics" };
  const termSets = new Map(cards.map(card => [card, {
    categories: new Set(card.dataset.categories.split(" ")),
    mechanics: new Set(card.dataset.mechanics.split(" ")),
  }]));

  // Seed controls from the query string. Values are validated against the
  // rendered options/checkboxes, so junk params fall back to "Any".
  const params = new URLSearchParams(location.search);
  Object.entries(controls).forEach(([, el]) => {
    const value = params.get(el.dataset.finder);
    if (value === null) return;
    if (el.tagName !== "SELECT" || el.querySelector(`option[value="${CSS.escape(value)}"]`)) {
      el.value = value;
    }
  });
  multis.forEach(multi => {
    params.getAll(multi.dataset.finderMulti).forEach(value => {
      const box = multi.querySelector(`input[value="${CSS.escape(value)}"]`);
      if (box) box.checked = true;
    });
  });

  function syncUrl() {
    const query = new URLSearchParams();
    Object.values(controls).forEach(el => {
      const value = el.value.trim();
      if (value) query.set(el.dataset.finder, value);
    });
    multis.forEach(multi => {
      checkedValues(multi).forEach(value => query.append(multi.dataset.finderMulti, value));
    });
    const search = query.toString();
    history.replaceState(null, "", search ? `?${search}` : location.pathname);
  }

  // Grey out any unchecked term that would produce zero results if added to
  // the current filters (AND semantics: adding a term can only narrow the
  // shown set, so "some shown card carries it" is the exact liveness test).
  function updateDeadTerms(shownCards) {
    multis.forEach(multi => {
      const key = facetKeys[multi.dataset.finderMulti];
      multi.querySelectorAll("input").forEach(box => {
        const dead = !box.checked
          && !shownCards.some(card => termSets.get(card)[key].has(box.value));
        box.disabled = dead;
        box.parentElement.classList.toggle("bgg-finder-dead", dead);
      });
    });
  }

  // Descending for "bigger is better" keys, ascending for the rest. Unknown
  // (empty/zero) keys sort last either way; ties fall back to name order.
  const sortDirection = { rating: -1, year: -1, time: 1, weight: 1 };

  function sortCards() {
    const key = controls.sort.value;
    const byName = (a, b) => a.dataset.name.localeCompare(b.dataset.name);
    const ordered = !key ? cards
      : key === "name" ? cards.slice().sort(byName)
      : cards.slice().sort((a, b) => {
          const av = Number(a.dataset[key]) || 0;
          const bv = Number(b.dataset[key]) || 0;
          if (av === bv) return byName(a, b);
          if (!av) return 1;
          if (!bv) return -1;
          return (av - bv) * sortDirection[key];
        });
    ordered.forEach(card => card.parentElement.appendChild(card));
  }

  function updateSummary(multi) {
    const checked = multi.querySelectorAll("input:checked");
    multi.querySelector("summary").textContent =
      checked.length === 0 ? "Any"
      : checked.length === 1 ? checked[0].parentElement.textContent.trim()
      : `${checked.length} selected`;
  }

  function apply() {
    const players = Number(controls.players.value) || 0;
    const minTime = Number(controls.minTime.value) || 0;
    const maxTime = Number(controls.maxTime.value) || 0;
    const complexity = controls.complexity.value;
    const playStyle = controls.playStyle.value;
    const age = Number(controls.age.value) || 0;
    const name = controls.name.value.trim().toLowerCase();
    // Selected terms per card dataset key (params are singular, data attributes plural).
    const terms = {
      categories: checkedValues(finder.querySelector('[data-finder-multi="category"]')),
      mechanics: checkedValues(finder.querySelector('[data-finder-multi="mechanic"]')),
    };

    const shownCards = [];
    cards.forEach(card => {
      const d = card.dataset;
      let ok = true;

      if (players) {
        const min = Number(d.minPlayers);
        const max = Number(d.maxPlayers);
        ok = min > 0 && max > 0 && min <= players && players <= max;
      }
      // Inclusive comparisons: the labels say "min/max play time", so a
      // 30-minute game matches both "min 30" and "max 30".
      if (ok && (minTime || maxTime)) {
        const t = Number(d.time);
        ok = t > 0
          && (!minTime || t >= minTime)
          && (!maxTime || t <= maxTime);
      }
      if (ok && complexity) {
        ok = d.complexity === complexity;
      }
      if (ok && playStyle) {
        ok = d.playStyle === playStyle;
      }
      if (ok && age) {
        const a = Number(d.minAge);
        ok = a > 0 && a <= age;
      }
      // AND semantics: the card must carry every selected term.
      Object.entries(terms).forEach(([key, selected]) => {
        if (ok && selected.length) {
          const carried = d[key].split(" ");
          ok = selected.every(term => carried.includes(term));
        }
      });
      if (ok && name) {
        ok = d.name.toLowerCase().includes(name);
      }

      card.classList.toggle("bgg-card-hidden", !ok);
      if (ok) shownCards.push(card);
    });

    const shown = shownCards.length;
    countEl.textContent = shown === cards.length
      ? `${cards.length} game${cards.length === 1 ? "" : "s"}`
      : `${shown} of ${cards.length} games`;
    if (emptyEl) emptyEl.hidden = shown > 0;
    updateDeadTerms(shownCards);
    sortCards();
    multis.forEach(updateSummary);
    syncUrl();
  }

  finder.addEventListener("input", apply);
  // "reset" fires before the controls revert, so reapply on the next frame.
  finder.addEventListener("reset", () => requestAnimationFrame(apply));
  finder.addEventListener("submit", e => e.preventDefault());

  // Close an open dropdown on any click outside it (also swaps dropdowns
  // cleanly: opening one closes the other).
  document.addEventListener("click", e => {
    multis.forEach(multi => {
      if (multi.open && !multi.contains(e.target)) multi.open = false;
    });
  });

  finder.hidden = false;
  apply();
});
