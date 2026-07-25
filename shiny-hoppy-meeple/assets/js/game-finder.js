// Client-side filtering for the library grid (/library/).
//
// The #game-finder form sits inside a [data-finder-wrap] <details> rendered
// hidden; this script reveals the wrap and filters the .bgg-card grid on
// every input. The wrap starts collapsed — always, even on filtered deep
// links — and its summary bar carries the live game count plus an
// active-filter tally ("10 of 11 games · 2 filters") so a narrowed grid is
// never mysterious while collapsed. Cards carry the data via attributes:
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
//   data-owners        space-separated owner slugs: "main-library" and/or
//                      member slugs (the grid holds one card per game across
//                      all shelves; member-only cards render pre-hidden)
//
// The "Owned by" checkbox dropdown scopes the grid with UNION semantics:
// checked owners' shelves combine (?owner=main-library&owner=jt — member
// pages deep-link with a single ?owner=<slug>); nothing checked = the main
// library, no param written. An owner box greys out when its shelf would
// contribute no cards under the other filters. The card count denominator
// is the owner-scoped pool, so the default still reads "42 games".
//
// A card with unknown data is excluded once the corresponding filter is
// active — better to under-promise than suggest an unplayable game.
//
// Two dropdown flavours share the same details/summary look:
//   [data-finder-multi]  category/mechanic checkboxes (AND semantics; params
//                        repeat, ?mechanic=deduction&mechanic=memory)
//   [data-finder-single] radio dropdowns for players/min-time/max-time/
//                        complexity/play-style/age (one value; the "" radio
//                        is "Any")
// Options that would yield zero results are disabled and greyed out. Multis
// test against the shown set (adding a term only narrows it); singles test
// against the cards passing every *other* filter, since picking a new value
// replaces the old one. "Any" and the current selection never grey out.
//
// The "Sort by" control reorders the cards in the grid ("" = the order the
// collection was exported in); cards with an unknown sort key go last.
//
// The [data-view-toggle] buttons switch the grid between grid/list display
// modes by toggling bgg-collection-list on the container (grid's compact
// tile styling is always on via bgg-collection-compact in the markup; both
// modes restyle the same cards, so filtering and sorting are unaffected).
// The choice persists in localStorage ("libraryView"), following the
// Blowfish appearance.js convention: the default (grid) clears the key
// instead of storing it.
//
// Filter state mirrors into the URL query string (?players=4&complexity=heavy
// &min-time=30&max-time=90&name=pan&sort=rating), so any filtered view is
// linkable and pages elsewhere on the site can deep-link into it.

document.addEventListener("DOMContentLoaded", () => {
  const finder = document.getElementById("game-finder");
  if (!finder) return;

  const cards = Array.from(document.querySelectorAll(".bgg-collection .bgg-card"));
  const wrap = finder.closest("[data-finder-wrap]");
  const countEl = document.querySelector("[data-finder-count]");
  const activeEl = document.querySelector("[data-finder-active]");
  const emptyEl = document.querySelector("[data-finder-empty]");
  const control = name => finder.querySelector(`[data-finder="${name}"]`);
  const controls = {
    name: control("name"),
    sort: control("sort"),
  };
  const multis = Array.from(finder.querySelectorAll("[data-finder-multi]"));
  const ownerMulti = finder.querySelector('[data-finder-multi="owner"]');
  const singles = Array.from(finder.querySelectorAll("[data-finder-single]"));
  const single = {};
  singles.forEach(s => { single[s.dataset.finderSingle] = s; });
  const checkedValues = multi =>
    Array.from(multi.querySelectorAll("input:checked"), box => box.value);
  const singleValue = s => {
    const checked = s.querySelector("input:checked");
    return checked ? checked.value : "";
  };

  // Per-card term sets, precomputed once so the dead-option sweeps in apply()
  // are just set lookups on every input event.
  const facetKeys = { category: "categories", mechanic: "mechanics" };
  const termSets = new Map(cards.map(card => [card, {
    categories: new Set(card.dataset.categories.split(" ")),
    mechanics: new Set(card.dataset.mechanics.split(" ")),
    owners: new Set(card.dataset.owners.split(" ")),
  }]));

  // Whether a card matches value v of a single-select group. Shared between
  // filtering (current value) and the dead-option sweep (candidate values).
  // Unknown data (0/empty) never matches.
  const matches = {
    "players": (card, v) => {
      const p = Number(v);
      const min = Number(card.dataset.minPlayers);
      const max = Number(card.dataset.maxPlayers);
      return min > 0 && max > 0 && min <= p && p <= max;
    },
    // Inclusive: a 30-minute game matches both "min 30" and "max 30".
    "min-time": (card, v) => {
      const t = Number(card.dataset.time);
      return t > 0 && t >= Number(v);
    },
    "max-time": (card, v) => {
      const t = Number(card.dataset.time);
      return t > 0 && t <= Number(v);
    },
    "complexity": (card, v) => card.dataset.complexity === v,
    "play-style": (card, v) => card.dataset.playStyle === v,
    "age": (card, v) => {
      const a = Number(card.dataset.minAge);
      return a > 0 && a <= Number(v);
    },
  };

  // Seed controls from the query string. Values are validated against the
  // rendered options/radios/checkboxes, so junk params fall back to "Any".
  const params = new URLSearchParams(location.search);
  Object.values(controls).forEach(el => {
    const value = params.get(el.dataset.finder);
    if (value === null) return;
    if (el.tagName !== "SELECT" || el.querySelector(`option[value="${CSS.escape(value)}"]`)) {
      el.value = value;
    }
  });
  singles.forEach(s => {
    const value = params.get(s.dataset.finderSingle);
    if (value === null) return;
    const box = s.querySelector(`input[value="${CSS.escape(value)}"]`);
    if (box) box.checked = true;
  });
  multis.forEach(multi => {
    params.getAll(multi.dataset.finderMulti).forEach(value => {
      const box = multi.querySelector(`input[value="${CSS.escape(value)}"]`);
      if (box) box.checked = true;
    });
  });

  // Debounced: apply() runs on every keystroke in the search box, and Safari
  // throws "Attempt to use history.replaceState() more than 100 times per 30
  // seconds" — which would abort the rest of apply(). The URL only has to be
  // right once typing pauses, so trailing-edge is exactly the semantics we want.
  const URL_SYNC_DELAY_MS = 250;
  let urlSyncTimer = null;

  function syncUrl() {
    clearTimeout(urlSyncTimer);
    urlSyncTimer = setTimeout(writeUrl, URL_SYNC_DELAY_MS);
  }

  function writeUrl() {
    const query = new URLSearchParams();
    Object.values(controls).forEach(el => {
      const value = el.value.trim();
      if (value) query.set(el.dataset.finder, value);
    });
    singles.forEach(s => {
      const value = singleValue(s);
      if (value) query.set(s.dataset.finderSingle, value);
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
  // The owner facet is union-semantics and swept separately in apply().
  function updateDeadTerms(shownCards) {
    multis.forEach(multi => {
      const key = facetKeys[multi.dataset.finderMulti];
      if (!key) return;
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

  function updateMultiSummary(multi) {
    const checked = multi.querySelectorAll("input:checked");
    multi.querySelector("summary").textContent =
      checked.length === 0 ? (multi.dataset.summaryEmpty || "Any")
      : checked.length === 1 ? checked[0].parentElement.textContent.trim()
      : `${checked.length} selected`;
  }

  function updateSingleSummary(s) {
    const checked = s.querySelector("input:checked");
    s.querySelector("summary").textContent =
      checked && checked.value !== ""
        ? checked.parentElement.textContent.trim()
        : "Any";
  }

  function apply() {
    const owners = checkedValues(ownerMulti);
    const name = controls.name.value.trim().toLowerCase();
    const values = {};
    singles.forEach(s => { values[s.dataset.finderSingle] = singleValue(s); });
    // Selected terms per card dataset key (params are singular, data attributes plural).
    const terms = {
      categories: checkedValues(finder.querySelector('[data-finder-multi="category"]')),
      mechanics: checkedValues(finder.querySelector('[data-finder-multi="mechanic"]')),
    };

    // Each card's pass/fail per filter group, kept so the single-select sweep
    // can ask "would this card survive every group except mine?".
    const passes = new Map();
    const shownCards = [];
    let pool = 0;
    cards.forEach(card => {
      const sets = termSets.get(card);
      const pass = {
        // The owner scope defines the population the other filters narrow:
        // the union of checked shelves, or the main library by default.
        owner: owners.length
          ? owners.some(owner => sets.owners.has(owner))
          : sets.owners.has("main-library"),
        name: !name || card.dataset.name.toLowerCase().includes(name),
      };
      Object.keys(matches).forEach(key => {
        pass[key] = !values[key] || matches[key](card, values[key]);
      });
      // AND semantics: the card must carry every selected term.
      Object.entries(terms).forEach(([key, selected]) => {
        pass[key] = !selected.length || selected.every(term => sets[key].has(term));
      });
      passes.set(card, pass);
      if (pass.owner) pool++;
      const ok = Object.values(pass).every(Boolean);
      card.classList.toggle("bgg-card-hidden", !ok);
      if (ok) shownCards.push(card);
    });

    // Grey out single-select values that would produce zero results. Unlike
    // the term sweep this tests against the cards passing every *other*
    // group, because choosing a value replaces the current one rather than
    // adding to it. "Any" and the checked value stay enabled as escapes.
    singles.forEach(s => {
      const key = s.dataset.finderSingle;
      const others = cards.filter(card => {
        const pass = passes.get(card);
        return Object.keys(pass).every(k => k === key || pass[k]);
      });
      s.querySelectorAll("input").forEach(box => {
        const dead = box.value !== "" && !box.checked
          && !others.some(card => matches[key](card, box.value));
        box.disabled = dead;
        box.parentElement.classList.toggle("bgg-finder-dead", dead);
      });
    });

    // Owner boxes: union semantics, so checking one never narrows — but a
    // box is useless (greyed) when its shelf contributes no cards under the
    // other filters. Checked boxes stay enabled so they can be un-checked.
    {
      const others = cards.filter(card => {
        const pass = passes.get(card);
        return Object.keys(pass).every(k => k === "owner" || pass[k]);
      });
      ownerMulti.querySelectorAll("input").forEach(box => {
        const dead = !box.checked
          && !others.some(card => termSets.get(card).owners.has(box.value));
        box.disabled = dead;
        box.parentElement.classList.toggle("bgg-finder-dead", dead);
      });
    }

    const shown = shownCards.length;
    countEl.textContent = shown === pool
      ? `${pool} game${pool === 1 ? "" : "s"}`
      : `${shown} of ${pool} games`;
    // Everything narrowing the grid counts as a filter; sort only reorders.
    const active = (name ? 1 : 0)
      + singles.filter(s => singleValue(s) !== "").length
      + multis.reduce((n, multi) => n + checkedValues(multi).length, 0);
    activeEl.hidden = active === 0;
    activeEl.textContent = active ? `· ${active} filter${active === 1 ? "" : "s"}` : "";
    if (emptyEl) emptyEl.hidden = shown > 0;
    updateDeadTerms(shownCards);
    sortCards();
    multis.forEach(updateMultiSummary);
    singles.forEach(updateSingleSummary);
    syncUrl();
  }

  finder.addEventListener("input", e => {
    // Picking a value closes a single-select dropdown, like a native select.
    const s = e.target.closest("[data-finder-single]");
    if (s) s.open = false;
    apply();
  });
  // "reset" fires before the controls revert, so reapply on the next frame.
  finder.addEventListener("reset", () => requestAnimationFrame(apply));
  finder.addEventListener("submit", e => e.preventDefault());

  // Close an open dropdown on any click outside it (also swaps dropdowns
  // cleanly: opening one closes the other).
  const dropdowns = multis.concat(singles);
  document.addEventListener("click", e => {
    dropdowns.forEach(d => {
      if (d.open && !d.contains(e.target)) d.open = false;
    });
  });

  // ── Display-mode toggle (grid / list) ──
  const viewToggle = document.querySelector("[data-view-toggle]");
  const collection = document.querySelector(".bgg-collection");
  const VIEW_KEY = "libraryView";
  const VIEWS = ["grid", "list"];

  function setView(view) {
    collection.classList.toggle("bgg-collection-list", view === "list");
    viewToggle.querySelectorAll("[data-view]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    if (view === "grid") localStorage.removeItem(VIEW_KEY);
    else localStorage.setItem(VIEW_KEY, view);
  }

  const savedView = localStorage.getItem(VIEW_KEY);
  if (VIEWS.includes(savedView)) setView(savedView);
  viewToggle.addEventListener("click", e => {
    const button = e.target.closest("[data-view]");
    if (button) setView(button.dataset.view);
  });

  wrap.hidden = false;
  viewToggle.hidden = false;
  apply();
});
