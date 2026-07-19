# Developer guide

Technical reference for working on the Shiny Hoppy Meeple website itself — running it locally,
understanding the architecture, and deploying. If you only want to **submit content** (posts,
members, libraries, events), you don't need any of this — see the
[contributor guide](CONTRIBUTING.md).

- **Site:** [shiny-hoppy-meeple.pages.dev](https://shiny-hoppy-meeple.pages.dev)
- **Stack:** [Hugo](https://gohugo.io/) static site ([Blowfish](https://blowfish.page/) theme) +
  [Cloudflare Pages](https://pages.cloudflare.com/) Functions backed by Workers KV.
- **Content model:** most content is generated at build time from **Google Sheets, Google
  Calendar, and BoardGameGeek** — not hand-edited. Only blog posts are committed directly.

## Repository layout

```text
.
├── justfile                   # task runner: just serve / build / dev / lint / …
├── package.json               # pinned tooling (eslint, markdownlint-cli2, wrangler) + script deps
├── scripts/
│   ├── bgg-export.js          # BoardGameGeek → JSON generator (the data pipeline)
│   ├── bgg-export-members.js  # runs bgg-export.js for every member definition
│   ├── sheets-sync.js         # Google Sheets → data/definitions/ (members, libraries, overrides)
│   ├── calendar-sync.js       # Google Calendar → data/calendar.json + event page stubs
│   ├── cleanup-stale-cache.js # deletes cache entries no longer referenced by any definition
│   ├── cache-pull.sh          # restore the BGG cache from its orphan branch
│   ├── cache-push.sh          # commit BGG cache changes back to its orphan branch
│   └── generate-qr-pdf.js     # print-ready QR sticker PDF (see scripts/README.md)
├── google-apps-script/        # manual deploy button for non-GitHub maintainers (DEPLOY-BUTTON.md)
├── .github/
│   └── workflows/*.yml        # CI + deploys + daily BGG cache update
└── shiny-hoppy-meeple/        # the Hugo site (all Hugo/wrangler commands run from here)
    ├── hugo.toml              # site config
    ├── content/               # pages & posts (Markdown) + content adapters (_content.gotmpl)
    ├── layouts/               # Blowfish overrides (game/member pages, custom outputs)
    ├── data/                  # generated + source JSON (see "BGG data pipeline")
    ├── static/                # css, JS; images/games/ and qr-codes.pdf are generated
    ├── functions/             # Cloudflare Pages Functions (play counting, preview auth)
    ├── wrangler.toml          # Cloudflare project name, output dir, KV binding (prod)
    ├── wrangler-{stage,dev}.toml  # per-environment variants, copied over wrangler.toml at deploy
    └── themes/blowfish        # git submodule
```

## Prerequisites

- **Hugo** (extended), pinned — match the version used by the deploy workflows and the
  `.devcontainer` (currently 0.163.1).
- **Node.js** + npm (scripts and dev tooling).
- [`just`](https://just.systems/) (optional) — wraps the common commands; run `just` to list them.
- A devcontainer is provided (`.devcontainer/`) with Hugo, Node, and Claude Code preinstalled —
  the simplest way to get a matching environment. On start it raises a **default-deny egress
  firewall** (`init-firewall.sh`) allowing only GitHub, npm, Anthropic, VS Code, and the pipeline's
  hosts (BGG, Google APIs, Cloudflare), so agents can run sandboxed inside it. Host IPs are
  resolved once at start; if a CDN-fronted host stops resolving in a long-lived container, re-run
  `sudo bash .devcontainer/init-firewall.sh`.

## Setup

```bash
# Clone WITH submodules — the Blowfish theme is a submodule
git clone --recurse-submodules https://github.com/thjont/shm.git
# or, if already cloned:
git submodule update --init --recursive

npm install                  # tooling + script deps, pinned
scripts/cache-pull.sh prod   # restore the BGG cache (or stage / dev) — see "BGG data pipeline"
```

Without a cache pull the site builds with an empty library, which is fine for testing template
changes.

## Local development

All Hugo and wrangler commands run from **inside `shiny-hoppy-meeple/`** (or use the `justfile`
recipes from the repo root).

```bash
cd shiny-hoppy-meeple

hugo server                 # dev server with live reload → http://localhost:1313
hugo --minify               # production build → public/
wrangler pages dev public   # serve the build + Functions + KV locally (test /p/, /api/plays)
```

From the repo root:

```bash
npm run lint                # lint:md + lint:js
npm run lint:md             # markdownlint-cli2 "**/*.md"
npm run lint:js             # eslint .
```

> [!IMPORTANT]
> Use `wrangler pages dev` (not just `hugo server`) when testing anything under `functions/` —
> the play-count redirects (`/p/`, `/lets-play/`, `/learn-to-play/`) and the `/api/` endpoints only
> run under wrangler, which provides the KV binding.

## Architecture

### 1. Content management

Content on the site comes from four sources:

**Google Sheets** — members, shadow libraries, and game overrides are rows in the
[site data spreadsheet](GOOGLE-SETUP.md). `scripts/sheets-sync.js` reads the sheet at the start of
every build and writes the definition JSON files into `data/definitions/`. Deleting a row from the
sheet removes the corresponding definition on the next build. See [GOOGLE-SETUP.md](GOOGLE-SETUP.md)
for spreadsheet setup and column reference.

**Google Calendar** — `scripts/calendar-sync.js` runs at the start of every build, writing upcoming
events to `data/calendar.json` (rendered by `layouts/_default/events.html`) and creating stub pages
under `content/events/` for events that don't have one. Both are build-time artifacts, not
committed.

**BGG data pipeline** — `scripts/bgg-export.js` reads the definition files and fetches the actual
game data from BoardGameGeek. This runs on a daily schedule (see Deployment below).

**Direct commits** — blog posts are Markdown files under `content/posts/`, committed directly to
the repo by maintainers.

### 2. BGG data pipeline (`scripts/bgg-export.js`)

`bgg-export.js` turns BoardGameGeek collections / geeklists into the JSON that Hugo renders
(`scripts/bgg-export-members.js` loops it over every member definition). The `data/` directory has
a clean two-tier split:

```mermaid
erDiagram
    MEMBER {
        string slug
        string display_name
        string username "BGG account (optional)"
        int geeklist "BGG GeekList ID (optional)"
    }
    LIBRARY {
        string slug
        string display_name
        string username "BGG account (optional)"
        int geeklist "BGG GeekList ID (optional)"
    }
    COLLECTION {
        string slug
    }
    GAME {
        int id
        string title
        string description
        string thumbnail
    }
    GAME_OVERRIDE {
        int bgg_id
        string description "replaces BGG text"
        string learn_to_play_video "YouTube ID"
    }

    MEMBER ||--|| COLLECTION : "bgg-export generates"
    LIBRARY ||--|| COLLECTION : "bgg-export generates"
    COLLECTION }o--o{ GAME : contains
    GAME ||--o| GAME_OVERRIDE : "may have"
```

**Definitions — `data/definitions/`** — small editorial configs that drive page creation.
Generated at build time by `sheets-sync.js` from the site data spreadsheet; not committed to the
repo (except `libraries/main-library.json`, which is static).

| File | Purpose |
| --- | --- |
| `members/<slug>.json` | `slug`, `display_name`, optional `description`, `username` (BGG account) or `geeklist` (ID) |
| `libraries/main-library.json` | Main library definition (static, committed) |
| `libraries/<slug>.json` | Shadow / supplementary library definition (generated from sheet) |
| `games-bgg-override/<id>.json` | Override `description` and/or `learn_to_play_video` for a game |

Each definition specifies exactly one BGG source — `username` *or* `geeklist`, never both.

**Cache — `data/bgg-cache/`** — large generated outputs produced by running `bgg-export.js`.

| File | Purpose |
| --- | --- |
| `collections/<slug>.json` | Collection summary: count + items (main library, members, shadow libraries) |
| `games/<id>.json` | Full game detail for every game that appears in any collection |

Images are downloaded to `static/images/games/`; the JSON is rewritten to local paths while
originals are kept in `*_source` fields.

**Cache branches** — the cache is gitignored on `main`. Each environment's cache lives on an
**orphan branch** (`bgg-cache-prod`, `bgg-cache-stage`, `bgg-cache-dev`) so daily BGG data updates
never touch `main`'s history. `scripts/cache-pull.sh <stage>` restores a branch's cache into the
working tree before an export or build; `scripts/cache-push.sh <stage>` commits local cache changes
back to the branch. Both operate via a throwaway git worktree and don't disturb the current
checkout. The generated `static/qr-codes.pdf` travels with the cache too — it's derived from the
main library (see [scripts/README.md](scripts/README.md)).

Regenerating data (writes into `shiny-hoppy-meeple/data/bgg-cache/`):

```bash
BGG_API_TOKEN=<token> node scripts/bgg-export.js --library main-library    # a library definition
BGG_API_TOKEN=<token> BGG_USERNAME=<user> node scripts/bgg-export.js       # a user collection
BGG_API_TOKEN=<token> node scripts/bgg-export.js --geeklist <id>           # a public geeklist
BGG_API_TOKEN=<token> node scripts/bgg-export-members.js                   # every member definition
```

> [!NOTE]
> `sheets-sync.js` writes the **definition** files; running `bgg-export.js` produces the large
> generated JSON and images. New members/libraries don't fully appear until the export runs.

### 3. Page generation and custom layouts (`shiny-hoppy-meeple/layouts/`)

Game and member pages are created by **content adapters**, not Markdown files:

- `content/games/_content.gotmpl` — builds a page per cached game at `/games/<slug>/` (slug =
  `anchorize`d game name), merging any `games-bgg-override` data and assigning
  `categories`/`mechanics`/`complexity` taxonomy terms for games in the main library. The games
  section lists at `/library/` (set by `url` in `content/games/_index.md`).
  Complexity (`Light`/`Medium`/`Heavy`) is **relative to the main library**, not BGG's absolute
  scale: `partials/shm/complexity-cuts.html` splits the library's BGG weights into terciles at
  build time, so buckets stay evenly filled but a game near a cut can change bucket when the
  library or BGG weights change. `partials/shm/complexity-bucket.html` maps a weight to its
  bucket and is the single source of truth (used by the content adapter and by the game-finder's
  `data-complexity` attributes in `games/list.html`).
- `content/members/_content.gotmpl` — builds `/members/<slug>/` pages from the member definitions.

Blowfish theme with overrides:

- `games/single.html` — game pages; merges override data and computes owners / in-library across members.
- `games/list.html`, `members/` — the library list and member pages.
- `categories/`, `mechanics/`, `complexity/` — taxonomy list pages.
- `_default/stats.html` — the stats page (play counts, ranks, the members' +1 button).
- `_default/events.html` — the calendar page rendered from `data/calendar.json`.
- `index.scanslugs.json` — a custom Hugo output format emitting `/scan-slugs.json`, the **allowlist
  of valid game slugs** consumed by the Functions below.

> [!NOTE]
> **Thumbnail fallback:** `games/list.html` and `members/single.html` fall back to the game-detail
> thumbnail when a collection item has none — geeklist-sourced collections never have one. Keep
> that fallback when editing either template.

### 4. Cloudflare Pages Functions + KV

`shiny-hoppy-meeple/functions/` adds server-side logic on top of the static site, backed by a
Workers KV namespace bound as `SCANS` (see `wrangler.toml`):

- QR stickers on physical games hit `/p/<slug>`, `/lets-play/<slug>`, or `/learn-to-play/<slug>` →
  `functions/_lib/play-handler.js` increments the play count in KV (**only** for slugs present in
  `/scan-slugs.json`, to keep junk out of KV; it fails closed if the allowlist is unreadable) and
  302-redirects to `/games/<slug>/`.
- `api/plays.js` serves the QR-scan counts.
- `api/member-plays.js` serves and records member-logged plays (stored under `member:<slug>` keys;
  the POST is deliberately unauthenticated — accepted risk for a small community site).
- `static/js/plays.js` fetches counts client-side via `data-*-slug` attributes, so counts never
  block static rendering.
- `_middleware.js` gates everything except the routes above behind basic auth when the
  `BASIC_AUTH_PASSWORD` environment variable is set on the Pages project (used for dev/stage
  previews; prod doesn't set it).

> [!IMPORTANT]
> **Deploy and `wrangler pages dev` must run from `shiny-hoppy-meeple/`** so wrangler discovers
> `functions/` and reads `wrangler.toml` (project name, output dir, KV binding). `functions/` and
> `wrangler.toml` sit at the Hugo root, but Hugo ignores them.

## Continuous integration

`ci.yml` runs on every pull request (and pushes to `main`/`dev`): `lint:js` is a blocking check —
a failure fails the workflow. `lint:md` runs with `continue-on-error`, so Markdown issues are
visible in the workflow log but never block a PR or deploy (the vendored `blowfish` theme content
fails several Markdown rules and isn't ours to fix).

## Deployment

Every deploy workflow follows the same shape: pull the environment's cache branch → sync calendar +
sheets → export from BGG → `hugo --minify` → `wrangler pages deploy`.

| Workflow | Trigger | Action |
| --- | --- | --- |
| `deploy-prod.yml` | Push to `main` touching `shiny-hoppy-meeple/**`, hourly 8 am–11 pm, or manual | Full sync + export (`--skip-existing-games`) → push cache → **production** deploy |
| `deploy-stage.yml` | Manual dispatch only | Full sync + export against the stage sheet/calendar/cache → `--buildFuture` → **stage** deploy |
| `deploy-dev.yml` | Push to `dev` touching `shiny-hoppy-meeple/**`, or manual | Sync only (no BGG export) → `--buildFuture` → **dev** deploy |
| `update-bgg-cache.yml` | Daily at 4 am, or manual | **Full** BGG refresh for prod and stage → stale-cache cleanup → regenerate `qr-codes.pdf` if the main library changed → push caches (prod, dev, stage) → deploy prod + stage if anything changed |

Non-GitHub maintainers can trigger the prod/stage deploys through a Google-authenticated web
button — see [DEPLOY-BUTTON.md](DEPLOY-BUTTON.md).

Required repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `BGG_API_TOKEN`,
`GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SHEETS_SPREADSHEET_ID`, and the stage
variants `GOOGLE_CALENDAR_ID_STAGE`, `GOOGLE_SHEETS_SPREADSHEET_ID_STAGE`
(see [GOOGLE-SETUP.md](GOOGLE-SETUP.md)).

## Dependency pinning

Everything is version-pinned for reproducible builds:

- `package.json` + `package-lock.json` (exact versions, no ranges)
- all GitHub Actions pinned to commit SHAs
- Hugo pinned to a fixed version
- the devcontainer Hugo feature

When bumping a tool, update it in **all** of these — workflows, `.devcontainer/devcontainer.json`,
and `package-lock.json`. Dependabot is configured (`.github/dependabot.yml`) for version updates.

## Gotchas

- **Play-count slug = the anchorized game *name*.** Renaming a game changes its slug and orphans the
  play count tied to any printed QR sticker. **Finalise game names before generating QR codes.**
  See [PLAYS.md](PLAYS.md).
- **Submodule.** A fresh clone without `--recurse-submodules` is missing the Blowfish theme and Hugo
  builds will fail; run `git submodule update --init --recursive`.
- **Test Functions under wrangler, not `hugo server`** — see local development above.
- **Don't commit cache output to `main`.** `data/bgg-cache/`, `static/images/games/`, and
  `static/qr-codes.pdf` belong to the `bgg-cache-*` branches; they're gitignored for a reason.

## See also

- [`CLAUDE.md`](CLAUDE.md) — condensed architecture notes for AI assistants.
- [Contributor guide](CONTRIBUTING.md) — the sheet/calendar content workflow for non-developers.
- [PLAYS.md](PLAYS.md) — how play counting and QR stickers work.
- [scripts/README.md](scripts/README.md) — the pipeline scripts, including the QR-PDF generator.
