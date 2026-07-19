# Contributing content

This guide explains how four types of content are managed on the
[Shiny Hoppy Meeple website](https://shiny-hoppy-meeple.pages.dev): **member collections**,
**shadow libraries**, **game overrides**, and **events**.

Member collections, shadow libraries, and game overrides are stored in the **site data Google
Sheet**. Events are managed in **Google Calendar**. Community members can request changes from a
maintainer, or ask to be granted edit access directly.

---

## The four content types

### 👤 Member collections

A member collection gives a community member their own profile page at `/members/<slug>/` and pulls in
their board-game collection from BoardGameGeek. The site shows which games they own alongside the
main library, and their games appear on the relevant game detail pages.

### 📚 Shadow libraries

A shadow library imports a collection of games into the site's game pages **without** creating a
browsable list page. This is useful for supplementary collections — for example, a venue's house
games that you want to show as "available here" on game pages but don't need a dedicated member
profile for.

### 🎲 Game overrides

A game override lets you replace the default BoardGameGeek description for a specific game, or add
a "learn to play" video to its page. Use this to improve a game's page where the BGG text is poor,
or to link a good tutorial video.

### 📅 Events

Events appear on the `/events/` calendar page. They are pulled directly from the club's Google
Calendar, so anything added or changed there shows up on the site automatically after the next
deploy.

---

## Requesting a change (community members)

You don't need access to the sheet or calendar to make changes — just ask a maintainer.

| You want to… | What to provide |
| --- | --- |
| Add your collection as a member | Your display name, a slug (e.g. `alice`), an optional bio, and either your BGG username or a BGG GeekList ID |
| Add a shadow library | A display name, a slug, and either a BGG username or a BGG GeekList ID |
| Add or update a game override | The BGG game ID and the new description and/or YouTube video ID |
| Remove any of the above | The slug or game ID |
| Add, change, or cancel an event | The event details — title, date, time, location, and an optional description |

Member and library changes take effect on the next BGG data update (daily at 4 am). Game overrides
and events appear on the next site deploy (hourly, 8 am – 11 pm).

---

## Maintainer guide: editing the Google Sheet

The sheet has three tabs — one for each content type. Changes are picked up automatically at build
time; there is no manual sync step required. (Setting up the sheet, calendar, and service account
from scratch is covered in [GOOGLE-SETUP.md](GOOGLE-SETUP.md).)

> [!IMPORTANT]
> Leave the header row (row 1) of each tab untouched. The sync script reads the column names from
> that row to map data to the right fields.

### Members tab

| Column | Required | Description |
| --- | --- | --- |
| `slug` | Yes | Short unique identifier used in the URL (`/members/<slug>/`). Lowercase letters, numbers, and hyphens only. Must start with a letter or number. |
| `display_name` | Yes | The name shown on the site, e.g. `Alice`. |
| `description` | No | A short bio shown on their profile page. |
| `username` | One of these | The member's BoardGameGeek account name. Pulls in their full BGG collection. |
| `geeklist` | One of these | A numeric BGG GeekList ID. Use this instead of `username` if they'd rather curate a specific list. |

**To add a member** — add a new row. Fill in `slug`, `display_name`, and either `username` or
`geeklist`. Leave `description` blank if they don't want a bio.

**To remove a member** — delete their row. Their profile page and games disappear on the next BGG
cache update.

**To update a member** — edit the relevant cell. If you change the `slug`, the old URL stops
working, so only do this before their QR codes (if any) are printed.

> [!NOTE]
> `username` and `geeklist` are mutually exclusive — fill in one and leave the other blank.
> If both are filled, `geeklist` takes priority.

---

### Shadow Libraries tab

| Column | Required | Description |
| --- | --- | --- |
| `slug` | Yes | Short unique identifier. Lowercase letters, numbers, and hyphens only. Must start with a letter or number. |
| `display_name` | Yes | A short name used internally (e.g. on game detail pages to show where a game comes from). |
| `username` | One of these | BGG account name whose collection to import. |
| `geeklist` | One of these | Numeric BGG GeekList ID to import. |

**To add a shadow library** — add a new row with a unique `slug`, a `display_name`, and either
`username` or `geeklist`.

**To remove a shadow library** — delete the row. The library's games no longer show as owned by
that source on the next BGG cache update.

> [!NOTE]
> The same `username`/`geeklist` rule applies here: fill in one, leave the other blank.

---

### Game Overrides tab

| Column | Required | Description |
| --- | --- | --- |
| `game_id` | Yes | The numeric BGG game ID. Find it in the game's BGG URL, e.g. `13` from `boardgamegeek.com/boardgame/13/catan`. |
| `learn_to_play_video` | One of these | A YouTube video ID — the part after `?v=` in the URL (e.g. `oiQ6SgBzfqY`). Not the full URL. |
| `description` | One of these | Replacement description to show instead of the BGG text. Leave blank to keep the BGG description. |

**To add an override** — add a new row with the `game_id` and at least one of `learn_to_play_video`
or `description`.

**To remove an override** — delete the row. The game page reverts to its BGG description on the
next deploy.

**To update an override** — edit the relevant cell. The change appears on the next deploy.

> [!NOTE]
> At least one of `learn_to_play_video` or `description` must be filled — a row with only a
> `game_id` is skipped by the sync.

---

## Maintainer guide: managing events in Google Calendar

Events are fetched from the club's Google Calendar at every site deploy. The site displays events
falling within a **three-month rolling window** — the current month and the next two — so events
further in the future don't appear yet.

### What fields appear on the site

| Calendar field | Where it appears |
| --- | --- |
| Event title | Page heading, calendar badge, and browser tab title. Also becomes the URL slug (e.g. `Thursday Night Meetup` → `/events/thursday-night-meetup/`). |
| Date and time | Shown on the event detail page and calendar grid. All-day events are supported. |
| Location | Shown on the event detail page. |
| Description | Shown as the body of the event detail page. Plain text and basic line breaks are supported; HTML is stripped. |

### Adding an event

Create a new event in Google Calendar as normal. Set the title, date, time, location, and
description. The event will appear on the site after the next deploy (hourly).

> [!TIP]
> The event title becomes the URL slug, so keep titles consistent for recurring events. For example,
> always using `Thursday Night Meetup` means the event always lands at the same URL, and any content
> added to that page persists between occurrences.

### Editing an event

Edit the event in Google Calendar. The changes appear on the site after the next deploy.

> [!NOTE]
> If you change an event's **title**, its URL slug changes too. Any content added to the old event
> page in the repo will no longer be linked from the calendar — it becomes an orphaned page. Avoid
> renaming recurring events unless necessary.

### Cancelling or deleting an event

Delete the event from Google Calendar. It will disappear from the site's calendar grid on the next
deploy.

> [!NOTE]
> Deleting an event from Google Calendar does **not** automatically remove its content page from
> the repo (under `content/events/`). If you want the page gone entirely, a maintainer will need
> to delete that file from the repo manually.

---

## When do changes go live?

| Content type | When it appears |
| --- | --- |
| Member collections | Next BGG cache update (daily, 4 am) |
| Shadow libraries | Next BGG cache update (daily, 4 am) |
| Game overrides | Next site deploy (hourly, 8 am – 11 pm) |
| Events | Next site deploy (hourly, 8 am – 11 pm) |

You can also trigger the BGG cache update manually from the **Actions** tab in GitHub if you need
member or library changes to appear sooner. Maintainers without a GitHub account can trigger a
deploy through the web deploy button instead — see [DEPLOY-BUTTON.md](DEPLOY-BUTTON.md).

For how game plays are counted (QR sticker scans and member-logged plays), see
[PLAYS.md](PLAYS.md).

> [!WARNING]
> **Linking to a game page from an event, game override, or any other content will cause the site
> to fail to build if that game does not appear in at least one collection or library.** It may
> also break any external links pointing to that game. Games are removed from the site during the
> daily BGG update at 4 am, so a game dropped from all collections overnight will cause the next
> deploy to fail. Before linking to a game page, confirm the game currently appears in at least
> one active collection or library.
