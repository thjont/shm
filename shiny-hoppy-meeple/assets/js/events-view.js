// Display-mode toggle for the events page (/events/): switches between the
// calendar grid and a flat chronological list of the same site.Data.calendar
// entries (layouts/_default/events.html renders both, one hidden at a time).
// The choice persists in localStorage ("eventsView"), following the same
// convention as the library's grid/list toggle (game-finder.js): the default
// (calendar) clears the key instead of storing it.

document.addEventListener("DOMContentLoaded", () => {
  const viewToggle = document.querySelector("[data-view-toggle]");
  if (!viewToggle) return;

  const calendarView = document.querySelector("[data-cal-calendar]");
  const listView = document.querySelector("[data-cal-list]");
  const VIEW_KEY = "eventsView";
  const VIEWS = ["calendar", "list"];

  function setView(view) {
    calendarView.hidden = view === "list";
    listView.hidden = view !== "list";
    viewToggle.querySelectorAll("[data-view]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    if (view === "calendar") localStorage.removeItem(VIEW_KEY);
    else localStorage.setItem(VIEW_KEY, view);
  }

  const savedView = localStorage.getItem(VIEW_KEY);
  if (VIEWS.includes(savedView)) setView(savedView);

  viewToggle.addEventListener("click", e => {
    const button = e.target.closest("[data-view]");
    if (button) setView(button.dataset.view);
  });

  viewToggle.hidden = false;
});
