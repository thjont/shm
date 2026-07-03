# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A Hugo static site for the Shiny Hoppy Meeple board-game community, deployed to Cloudflare
Pages. Most content is created and edited **through GitHub Issues**, not by hand — understanding
that pipeline is the key to working here.

## Commands

All Hugo/wrangler commands run from inside `shiny-hoppy-meeple/`.

```bash
cd shiny-hoppy-meeple
hugo server                  # local dev with live reload at :1313
hugo --minify                # production build → public/
wrangler pages dev public    # serve build + Functions + KV locally (test /p/, /api/plays)

# from repo root:
npm install                  # dev tooling (markdownlint-cli2, wrangler) — pinned in package.json
npm run lint                 # markdownlint-cli2 "**/*.md"
```

Regenerate game/collection data from BGG (writes into `shiny-hoppy-meeple/data/bgg-cache/`):

```bash
BGG_API_TOKEN=<token> BGG_USERNAME=<user> node scripts/bgg-export.js          # a user collection
BGG_API_TOKEN=<token> node scripts/bgg-export.js --geeklist <id>              # a geeklist
node scripts/bgg-export.js --geeklist <id> --collection-file data/bgg-cache/collections/<slug>.json
```

Clone requires submodules (PaperMod theme): `git submodule update --init --recursive`.

## Architecture

### Content management

Content comes from three sources:

- **Google Sheets** — members, shadow libraries, and game overrides. `scripts/sheets-sync.js` reads the
  spreadsheet at the start of every build and writes definition JSON files into `data/definitions/`.
  Removing a row from the sheet removes the definition on the next build.
- **BGG data pipeline** — `scripts/bgg-export.js` reads those definitions and fetches game data from
  BoardGameGeek via `bgg-xml-api-client`. Runs daily via `update-bgg-cache.yml`.
- **Direct commits** — blog posts are Markdown files under `content/posts/`, committed by
  maintainers.

Workflows: `deploy-prod.yml`, `deploy-stage.yml`, `deploy-dev.yml`, `update-bgg-cache.yml`.

### BGG data pipeline

`scripts/bgg-export.js` is the generator that turns BoardGameGeek collections/geeklists into the JSON
Hugo renders. The data directory has two tiers:

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

### Custom layouts (`shiny-hoppy-meeple/layouts/`)

PaperMod theme with overrides: `g/` = game pages (`single.html` merges override data and computes
owners/in-library across members), `m/` = member pages, `_default/stats.html`, and
`index.scanslugs.json` — a custom output format emitting `/scan-slugs.json`, the allowlist of valid
game slugs consumed by the Functions below.

**Thumbnail fallback pattern:** both `g/list.html` and `m/single.html` fall back to
`(index hugo.Data "bgg-cache" "games" id).thumbnail` when the collection item has no thumbnail.
This is necessary for geeklist-sourced collections, where the geeklist XML API provides no
thumbnail and the field is `null` in the collection JSON. Keep this fallback in place when editing
either template.

### Cloudflare Pages Functions + KV

`shiny-hoppy-meeple/functions/` adds server-side logic on top of the static site, backed by a
Workers KV namespace bound as `SCANS` (see `wrangler.toml`). QR stickers on physical games hit
`/p/<slug>` or `/lets-play/<slug>` → `functions/_lib/play-handler.js` increments the play count in
KV (only for slugs in `/scan-slugs.json`, to keep junk out of KV) and 302-redirects to `/g/<slug>/`.
`api/plays.js` serves the counts; `static/js/` fetches them client-side via `data-*-slug` attributes
so counts never block static rendering.

**Deploy must run from `shiny-hoppy-meeple/`** so wrangler discovers `functions/` and reads
`wrangler.toml` (project name, output dir, KV binding). `functions/` and `wrangler.toml` sit at the
Hugo root but Hugo ignores them.

## Deployment

- `deploy.yml` — push to `main` touching `shiny-hoppy-meeple/**` → `hugo --minify` → production
  deploy. Requires secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- `publish-from-issue.yml` — per-post preview deploys to `post-<slug>.shiny-hoppy-meeple.pages.dev`.

## Dependency pinning

Everything is version-pinned for reproducible builds: `package.json` + `package-lock.json`
(including `bgg-xml-api-client`), all GitHub Actions pinned to commit SHAs, Hugo to a fixed
version, and the devcontainer Hugo feature. When bumping a tool, update it in **all** of these
(workflows, `.devcontainer/devcontainer.json`, and `package-lock.json`).

## Caveats

- `DEPLOY.md` and `CONTRIBUTING.md` are partly stale: they reference the old `collection.json`
  (now `main-library.json`), `/go/` + `/api/scans` (now `/p/`, `/lets-play/`, `/api/plays`), and
  `/our-library/` (now `/g/`). Trust the code over those docs.
- Play-count slug = the anchorized game **name**. Renaming a game changes its slug and orphans the
  printed-sticker count — finalise names before generating QR codes.
