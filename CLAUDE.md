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
pip install -r requirements.txt   # boardgamegeek2 + pinned deps for bgg_export.py
```

Regenerate game/collection data from BGG (writes into `shiny-hoppy-meeple/data/`):

```bash
BGG_API_TOKEN=<token> BGG_USERNAME=<user> python bgg_export.py        # a user collection
python bgg_export.py --geeklist <id>                                  # a public geeklist
python bgg_export.py --geeklist <id> --collection-file data/members/<slug>.json   # a member
```

Clone requires submodules (PaperMod theme): `git submodule update --init --recursive`.

## Architecture

### Issue-driven content (the core pattern)

Community members open a GitHub Issue from a template in `.github/ISSUE_TEMPLATE/`; a maintainer
applies the **`publish`** label; a matching workflow in `.github/workflows/*-from-issue.yml`
turns the issue into committed files via a **branch + PR**. Each workflow shares the same shape:

1. **Permission gate** — checks the *labeller's* collaborator permission (`write`/`admin`) via the
   GitHub API. Anyone can open an issue; only maintainers can trigger the action by labelling.
2. **Inline `python3` heredoc** — parses the issue body with an `extract(label)` regex helper,
   validates fields (slugs against `^[a-z0-9][a-z0-9-]*$`, IDs via `.isdigit()`), and writes or
   removes a file under `shiny-hoppy-meeple/data/` or `content/`.
3. **Branch + PR** to `main`.

Workflows: `new-/delete-member`, `new-/delete-shadow-library`, `new-/delete-game-override`,
`delete-post`, and `publish-from-issue` (posts — special: it downloads pasted images into
`static/images/posts/<slug>/`, builds a per-branch Cloudflare **preview** deploy, supports issue
*edits* to update the draft, and posts the preview URL back to the issue/PR).

> Security note: user-controlled issue fields must never be interpolated into a shell. These
> workflows use `subprocess.run([...], check=True)` (argument lists, no shell) for the `gh`
> calls — keep that pattern; do not switch to `os.system` / f-string shell commands.

### BGG data pipeline

`bgg_export.py` is the generator that turns BoardGameGeek collections/geeklists into the JSON
Hugo renders. The data directory has two tiers:

- `data/sources/` — small **input** configs keyed by slug (`members/<slug>.json`,
  `shadow-libraries/<slug>.json`, `main-library.json`). These are what the issue workflows
  create/delete. Each names a BGG `collection` (username) or `geeklist` id.
- `data/main-library.json`, `data/members/<slug>.json`, `data/games/<id>.json` — the large
  **generated** outputs (collection summaries + full per-game detail), produced by running
  `bgg_export.py` against a source. Images are downloaded to `static/images/games/` and the JSON
  is rewritten to local paths (originals kept in `*_source` fields).
- `data/games-overrides/<bgg_id>.json` — per-game editorial overrides (`description`,
  `learn_to_play_video`) merged into the game detail page at render time.

### Custom layouts (`shiny-hoppy-meeple/layouts/`)

PaperMod theme with overrides: `g/` = game pages (`single.html` merges override data and computes
owners/in-library across members), `m/` = member pages, `_default/stats.html`, and
`index.scanslugs.json` — a custom output format emitting `/scan-slugs.json`, the allowlist of valid
game slugs consumed by the Functions below.

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

Everything is version-pinned for reproducible builds: `requirements.txt` (full pip tree),
`package.json` + `package-lock.json`, all GitHub Actions pinned to commit SHAs, Hugo to a fixed
version, and the devcontainer Hugo feature. When bumping a tool, update it in **all** of these
(workflows, `.devcontainer/devcontainer.json`, and the relevant lock/requirements file).

## Caveats

- `DEPLOY.md` and `CONTRIBUTING.md` are partly stale: they reference the old `collection.json`
  (now `main-library.json`), `/go/` + `/api/scans` (now `/p/`, `/lets-play/`, `/api/plays`), and
  `/our-library/` (now `/g/`). Trust the code over those docs.
- Play-count slug = the anchorized game **name**. Renaming a game changes its slug and orphans the
  printed-sticker count — finalise names before generating QR codes.
