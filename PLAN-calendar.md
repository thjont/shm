# Google Calendar Integration Plan

## Context

Shiny Hoppy Meeple runs weekly Thursday meetups and occasional Saturday sessions. Currently the site only mentions these
in static text (about-us.md). The goal is a live `/events/` calendar page that pulls events from a Google Calendar and
renders them in a month-grid view, so the community can see upcoming sessions at a glance.

The approach follows a forum post pattern: a Node.js script syncs Google Calendar events to a Hugo data file, and a Hugo
template renders the calendar grid with events overlaid on matching dates.

---

## Implementation

### 1. Node.js sync script — `shiny-hoppy-meeple/calendar-sync.js`

New file. Uses `googleapis` npm package with **service account** auth (JSON key stored as GitHub secret
`GOOGLE_SERVICE_ACCOUNT_KEY`). Fetches events for the rolling 3-month window (current month + next 2), writes to
`shiny-hoppy-meeple/data/calendar.json`.

Key logic:

- Start date: first day of current month
- End date: last day of month+2
- `singleEvents: true`, `orderBy: 'startTime'`
- Calendar ID configured via env var `GOOGLE_CALENDAR_ID`
- Output: array of `{ summary, start: { date }, end: { date }, location?, description? }` — same shape as the forum post

### 2. Hugo content page — `shiny-hoppy-meeple/content/events.md`

New file. Minimal front matter:

```toml
+++
title = "Events"
layout = "events"
+++
```

### 3. Hugo template — `shiny-hoppy-meeple/layouts/_default/events.html`

New file. Renders a month-by-month calendar grid (3 months). For each day cell, iterates `site.Data.calendar` to find
matching events and renders them inline.

Structure:

- `define "main"` wrapper (blowfish theme convention)
- 3-month loop using Hugo's `time` and `seq` functions (adapted from the forum post)
- Event overlay inside each `<td>` using `$eventStartDate` / `$eventEndDate` comparisons
- `{{ with site.Data.calendar }}` guard for graceful degradation when data file is absent

### 4. Add menu entry — `shiny-hoppy-meeple/hugo.toml`

Add `Events` to `[menu.main]` between Posts (weight 6) and About Us (weight 7), at weight 65.

### 5. Dependencies — `package.json`

Add `googleapis` (pinned version). No need for `@google-cloud/local-auth` — service account auth is handled directly via
the `googleapis` package.

### 6. CI/CD — `.github/workflows/deploy-prod.yml` and `deploy-dev.yml`

Add two steps before the Hugo build step:

1. **Restore service account key** — write `GOOGLE_SERVICE_ACCOUNT_KEY` secret to a temp file
2. **Run calendar sync** — `node shiny-hoppy-meeple/calendar-sync.js`

Required GitHub secrets:

- `GOOGLE_SERVICE_ACCOUNT_KEY` — full service account JSON key content
- `GOOGLE_CALENDAR_ID` — calendar ID (e.g. `abc123@group.calendar.google.com`)

### 7. CSS — `shiny-hoppy-meeple/static/css/calendar.css`

New file. Styles for calendar table grid, event badges, and month headers. Consistent with blowfish theme colour scheme.

Load it conditionally via `shiny-hoppy-meeple/layouts/partials/extend-head.html`.

---

## Files to create/modify

| File | Action |
| ------ | -------- |
| `shiny-hoppy-meeple/calendar-sync.js` | Create |
| `shiny-hoppy-meeple/content/events.md` | Create |
| `shiny-hoppy-meeple/layouts/_default/events.html` | Create |
| `shiny-hoppy-meeple/static/css/calendar.css` | Create |
| `shiny-hoppy-meeple/layouts/partials/extend-head.html` | Edit — add calendar.css on events page |
| `shiny-hoppy-meeple/hugo.toml` | Edit — add Events menu item |
| `package.json` | Edit — add googleapis |
| `.github/workflows/deploy-prod.yml` | Edit — add sync steps |
| `.github/workflows/deploy-dev.yml` | Edit — add sync steps |

---

## Graceful degradation

If `data/calendar.json` is absent (secret not yet configured), the template renders the calendar grid with no events
rather than crashing.

---

## Verification

1. **Local sync test**: Set `GOOGLE_SERVICE_ACCOUNT_KEY` and `GOOGLE_CALENDAR_ID` env vars, run `node calendar-sync.js`
from `shiny-hoppy-meeple/`, confirm `data/calendar.json` is written with expected shape.
2. **Hugo render**: `hugo server` from `shiny-hoppy-meeple/`, visit `http://localhost:1313/events/` — confirm calendar
grid renders with events on correct dates.
3. **CI dry-run**: Push to dev branch, confirm workflow runs the sync step before the Hugo build without error.
4. **No-data fallback**: Temporarily rename `data/calendar.json`, confirm `hugo server` still builds cleanly.

---

## Google Cloud setup (prerequisite — done by user)

1. Create a Google Cloud project, enable the Calendar API, create a service account, download its JSON key.
2. Share the target Google Calendar with the service account's email address (read-only viewer).
3. Add `GOOGLE_SERVICE_ACCOUNT_KEY` and `GOOGLE_CALENDAR_ID` as GitHub Actions secrets on the repo.
