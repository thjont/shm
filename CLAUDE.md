# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A Hugo static site (Blowfish theme) for the Shiny Hoppy Meeple board-game community, deployed to
Cloudflare Pages. Most content is generated at build time from **Google Sheets, Google Calendar,
and BoardGameGeek** — not hand-edited. Understanding that pipeline is the key to working here.

## Commands

All Hugo/wrangler commands run from inside `shiny-hoppy-meeple/`. A `justfile` at the repo root
wraps the common ones (`just serve`, `just build`, `just dev`, `just lint`, `just check`, KV
helpers — see `just --list`).

```bash
cd shiny-hoppy-meeple
hugo server                  # local dev with live reload at :1313
hugo --minify                # production build → public/
wrangler pages dev public    # serve build + Functions + KV locally (test /p/, /api/plays)

# from repo root:
npm install                  # dev tooling (eslint, markdownlint-cli2, wrangler) — pinned in package.json
npm run lint:js              # eslint . — blocking in CI
npm run lint:md              # markdownlint-cli2 "**/*.md" — non-blocking in CI (vendored theme content)
```

The BGG cache is gitignored — pull it before local dev (defaults to an empty cache if this is a
fresh clone with no network access, which is fine for testing template changes):

```bash
scripts/cache-pull.sh prod    # or stage / dev
```

Regenerate game/collection data from BGG (writes into `shiny-hoppy-meeple/data/bgg-cache/`):

```bash
BGG_API_TOKEN=<token> node scripts/bgg-export.js --library main-library     # a library definition
BGG_API_TOKEN=<token> BGG_USERNAME=<user> node scripts/bgg-export.js        # a user collection
BGG_API_TOKEN=<token> node scripts/bgg-export.js --geeklist <id>            # a geeklist
node scripts/bgg-export-members.js                                          # every member definition
```

Clone requires submodules (Blowfish theme): `git submodule update --init --recursive`.

## Architecture

### Content management

Content comes from four sources, three of them synced at the start of every build:

- **Google Sheets** — members, shadow libraries, and game overrides. `scripts/sheets-sync.js` reads the
  spreadsheet and writes definition JSON files into `data/definitions/`. Removing a row from the sheet
  removes the definition on the next build. Stage has its own spreadsheet and calendar
  (`GOOGLE_SHEETS_SPREADSHEET_ID_STAGE`, `GOOGLE_CALENDAR_ID_STAGE`), sharing the same service account
  as prod — see `GOOGLE-SETUP.md`. `data/definitions/libraries/main-library.json` is committed and
  shared by every environment, so only members/shadow-libraries/overrides differ by stage.
- **Google Calendar** — `scripts/calendar-sync.js` writes upcoming events to `data/calendar.json`
  (rendered by `layouts/_default/events.html`) and creates stub pages under `content/events/` for
  events that don't have one. Both are build-time artifacts, not committed.
- **BGG data pipeline** — `scripts/bgg-export.js` reads those definitions and fetches game data from
  BoardGameGeek via `bgg-xml-api-client`. Runs daily via `update-bgg-cache.yml`.
- **Direct commits** — blog posts are Markdown files under `content/posts/`, committed by
  maintainers.

Workflows: `deploy-prod.yml` (push to `main` touching `shiny-hoppy-meeple/**`, hourly cron 08–23 UTC
to pick up sheet/calendar edits, or manual dispatch), `deploy-stage.yml` (manual dispatch),
`deploy-dev.yml` (push to `dev`), `update-bgg-cache.yml` (daily 04:00 full refresh), `ci.yml`
(lint on PRs — `lint:js` blocking, `lint:md` non-blocking). A Google Apps Script deploy button
(`google-apps-script/deploy-button/`, see `DEPLOY-BUTTON.md`) lets allowlisted non-GitHub
maintainers trigger the prod/stage deploy workflows via `.github/actions/check-permission`.

### BGG data pipeline

`scripts/bgg-export.js` is the generator that turns BoardGameGeek collections/geeklists into the JSON
Hugo renders. `scripts/bgg-export-members.js` loops it over every member definition, and
`scripts/cleanup-stale-cache.js` (run by `update-bgg-cache.yml`) deletes cache entries no longer
referenced by any definition. The data directory has two tiers:

- `data/definitions/` — small **input** configs that drive page creation. Generated at build time
  by `scripts/sheets-sync.js` from the Google Sheets spreadsheet (not committed to repo, except
  `libraries/main-library.json`):
  - `members/<slug>.json` — `{ slug, display_name, description?, geeklist|username }`
  - `libraries/main-library.json` — main library definition (static, committed)
  - `libraries/<slug>.json` — shadow/supplementary library definitions
  - `games-bgg-override/<id>.json` — editorial overrides (`description`, `learn_to_play_video`)
  - Member/library definitions use `username` (BGG username) or `geeklist` (integer ID), never both.
- `data/bgg-cache/` — large **generated** outputs from running `scripts/bgg-export.js`:
  - `collections/<slug>.json` — collection summary (main library and per-member/library)
  - `games/<id>.json` — full game detail for every game in any collection
  - Images are downloaded to `static/images/games/`; JSON is rewritten to local paths (originals kept in `*_source` fields).
  - Both directories are gitignored. Each environment has its own cache, held on an orphan branch
    (`bgg-cache-prod`, `bgg-cache-stage`, `bgg-cache-dev`) so BGG data updates never touch `main`'s
    history. `scripts/cache-pull.sh <stage>` restores a branch's cache into the working tree before
    export/build; `scripts/cache-push.sh <stage>` commits local changes back to that branch. Both
    operate via a throwaway git worktree and don't disturb the current checkout. The generated
    `static/qr-codes.pdf` (from `scripts/generate-qr-pdf.js`) also lives on the cache branches, not
    on `main` — `update-bgg-cache.yml` regenerates it when the main library changes.

### Page generation and custom layouts (`shiny-hoppy-meeple/layouts/`)

Game and member pages are created by **content adapters**, not Markdown files:
`content/games/_content.gotmpl` builds a page per cached game (path = `anchorize`d game name →
`/games/<slug>/`), merging any `games-bgg-override` data and assigning `categories`/`mechanics`/
`complexity` taxonomy terms only for games in the main library; `content/members/_content.gotmpl`
builds `/members/<slug>/` pages from the member definitions. The games section lists at `/library/`
(set by `url` in `content/games/_index.md`).

Blowfish theme with overrides: `games/` (game list + detail, which computes owners/in-library
across member collections), `members/`, taxonomy layouts for `categories`/`mechanics`/`complexity`,
`_default/stats.html`, `_default/events.html` (calendar), and `index.scanslugs.json` — a custom
output format emitting `/scan-slugs.json`, the allowlist of valid game slugs consumed by the
Functions below.

**Thumbnail fallback pattern:** both `games/list.html` and `members/single.html` fall back to
`(index hugo.Data "bgg-cache" "games" id).thumbnail` when the collection item has no thumbnail.
This is necessary for geeklist-sourced collections, where the geeklist XML API provides no
thumbnail and the field is `null` in the collection JSON. Keep this fallback in place when editing
either template.

### Cloudflare Pages Functions + KV

`shiny-hoppy-meeple/functions/` adds server-side logic on top of the static site, backed by a
Workers KV namespace bound as `SCANS` (see `wrangler.toml`; `wrangler-stage.toml` /
`wrangler-dev.toml` are copied over it when deploying those environments). QR stickers on physical
games hit `/p/<slug>`, `/lets-play/<slug>`, or `/learn-to-play/<slug>` →
`functions/_lib/play-handler.js` increments the play count in KV (only for slugs in
`/scan-slugs.json`, to keep junk out of KV; fails closed if the allowlist is unreadable) and
302-redirects to `/games/<slug>/`. `api/plays.js` serves the counts; `api/member-plays.js` stores a
separate member-recorded counter under `member:<slug>` keys (GET counts, POST increments).
`static/js/plays.js` fetches both client-side via `data-*-slug` attributes so counts never block
static rendering. `_middleware.js` gates everything except those routes behind basic auth when
`BASIC_AUTH_PASSWORD` is set (used on dev/stage previews).

**Deploy must run from `shiny-hoppy-meeple/`** so wrangler discovers `functions/` and reads
`wrangler.toml` (project name, output dir, KV binding). `functions/` and `wrangler.toml` sit at the
Hugo root but Hugo ignores them.

## Deployment

Every deploy workflow follows the same shape: pull the environment's BGG cache branch → sync
calendar + sheets → export from BGG (`--skip-existing-games` on the deploy workflows; full refresh
only in `update-bgg-cache.yml`) → `hugo --minify` → `wrangler pages deploy`. Prod pushes cache
changes back to `bgg-cache-prod`; `update-bgg-cache.yml` refreshes prod, dev, and stage caches and
only builds/deploys when something changed. Requires secrets `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `BGG_API_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_KEY`, and the per-environment
spreadsheet/calendar IDs.

## Dependency pinning

Everything is version-pinned for reproducible builds: `package.json` + `package-lock.json`
(including `bgg-xml-api-client`), all GitHub Actions pinned to commit SHAs, Hugo to a fixed
version, and the devcontainer Hugo feature. When bumping a tool, update it in **all** of these
(workflows, `.devcontainer/devcontainer.json`, and `package-lock.json`).

## Caveats

- `DEVELOPMENT.md` and `CONTRIBUTING.md` are partly stale: they reference the PaperMod theme (now
  Blowfish), a Python `bgg_export.py` + `requirements.txt` (now `scripts/bgg-export.js`), and
  content generated "from GitHub Issues" (now Sheets/Calendar). Trust the code over those docs.
- Play-count slug = the anchorized game **name**. Renaming a game changes its slug and orphans the
  printed-sticker count — finalise names before generating QR codes.
