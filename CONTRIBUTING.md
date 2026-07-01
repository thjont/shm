# Contributing content

This guide explains how three types of content are managed on the
[Shiny Hoppy Meeple website](https://shiny-hoppy-meeple.pages.dev): **member collections**,
**shadow libraries**, and **game overrides**.

All three are stored in the **site data Google Sheet**. Community members can request changes from
a maintainer, or ask to be granted edit access to the sheet directly.

---

## The three content types

### 👤 Member collections

A member collection gives a community member their own profile page at `/m/<slug>/` and pulls in
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

---

## Requesting a change (community members)

You don't need access to the sheet to make changes — just ask a maintainer.

| You want to… | What to provide |
| --- | --- |
| Add your collection as a member | Your display name, a slug (e.g. `alice`), an optional bio, and either your BGG username or a BGG GeekList ID |
| Add a shadow library | A display name, a slug, and either a BGG username or a BGG GeekList ID |
| Add or update a game override | The BGG game ID and the new description and/or YouTube video ID |
| Remove any of the above | The slug or game ID |

Changes take effect on the next scheduled BGG data update (runs daily at 4 am). Game overrides
appear on the next site deploy (runs hourly).

---

## Maintainer guide: editing the Google Sheet

The sheet has three tabs — one for each content type. Changes are picked up automatically at build
time; there is no manual sync step required.

> [!IMPORTANT]
> Leave the header row (row 1) of each tab untouched. The sync script reads the column names from
> that row to map data to the right fields.

### Members tab

| Column | Required | Description |
| --- | --- | --- |
| `slug` | Yes | Short unique identifier used in the URL (`/m/<slug>/`). Lowercase letters, numbers, and hyphens only. Must start with a letter or number. |
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

## When do changes go live?

| Content type | When it appears |
| --- | --- |
| Member collections | Next BGG cache update (daily, 4 am) |
| Shadow libraries | Next BGG cache update (daily, 4 am) |
| Game overrides | Next site deploy (hourly, 8 am – 11 pm) |

You can also trigger the BGG cache update manually from the **Actions** tab in GitHub if you need
changes to appear sooner.
