# Pipeline scripts

The build and data-pipeline scripts, run from the **repo root**. See
[DEVELOPMENT.md](../DEVELOPMENT.md) for how they fit together.

| Script | Purpose |
| --- | --- |
| `bgg-export.js` | BoardGameGeek → JSON generator: exports a collection/geeklist plus per-game detail and images |
| `bgg-export-members.js` | Runs `bgg-export.js` for every member definition in `data/definitions/members/` |
| `sheets-sync.js` | Google Sheets → `data/definitions/` (members, shadow libraries, game overrides) |
| `calendar-sync.js` | Google Calendar → `data/calendar.json` + stub pages under `content/events/` |
| `cleanup-stale-cache.js` | Deletes cached collections/games/images no longer referenced by any definition |
| `cache-pull.sh <stage>` | Restores the BGG cache (+ `qr-codes.pdf`) from the `bgg-cache-<stage>` orphan branch |
| `cache-push.sh <stage>` | Commits local BGG cache changes back to the `bgg-cache-<stage>` branch |
| `generate-qr-pdf.js` | Print-ready QR sticker PDF — detailed below |

The Node scripts take their configuration from environment variables (`BGG_API_TOKEN`,
`BGG_USERNAME`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`,
`GOOGLE_CALENDAR_ID`) and/or flags — run one with `--help` or see its header comment.

---

## generate-qr-pdf.js

Generates a print-ready **A4 PDF of QR codes** for the games in the main library.
Each QR code points at that game's learn-to-play short link
(`https://shiny-hoppy-meeple.pages.dev/learn-to-play/<slug>/`), with the game name and
full address printed beneath it. Print the sheet, cut along the guides, and stick the
codes on the boxes.

This is a standalone script, separate from `bgg-export.js`. It only **reads** the
generated collection JSON — it never modifies the site.

### How it works

1. Reads games from `shiny-hoppy-meeple/data/bgg-cache/collections/main-library.json`.
2. Slugifies each game name with the same algorithm Hugo's `anchorize` uses (GitHub
   heading-ID rules), so the links match the site's `/games/<slug>/` URLs.
3. Builds `<base>/<path-prefix>/<slug>/` for each game (default prefix `learn-to-play`).
4. Renders the QR codes as crisp vector squares laid out in a grid on A4 pages.

### Install

Dev tooling is pinned in the repo-root `package.json`:

```bash
npm install
```

### Usage

Run from the repo root:

```bash
# Defaults: main library → shiny-hoppy-meeple/static/qr-codes.pdf, 3×4 grid (12 per page)
node scripts/generate-qr-pdf.js

# Cross-check generated slugs against the site's allowlist (needs a Hugo build)
node scripts/generate-qr-pdf.js --scan-slugs shiny-hoppy-meeple/public/scan-slugs.json

# Custom output and grid
node scripts/generate-qr-pdf.js --output stickers.pdf --cols 4 --rows 6
```

By default the PDF is written into the Hugo `static/` dir, so once deployed it is
downloadable at **`https://shiny-hoppy-meeple.pages.dev/qr-codes.pdf`**. Like the
`bgg-cache` data and the downloaded game images, the PDF is derived output: it is
gitignored on `main` and lives on the **`bgg-cache-*` orphan branches** instead
(`cache-push.sh` saves it, `cache-pull.sh` restores it before each build).
`update-bgg-cache.yml` regenerates it automatically whenever `main-library.json`
changes, cross-checking the slugs against Hugo's `/scan-slugs.json` allowlist.

#### Options

| Option | Default | Description |
| --- | --- | --- |
| `--collection` | `shiny-hoppy-meeple/data/bgg-cache/collections/main-library.json` | Collection JSON to read games from |
| `--base-url` | `https://shiny-hoppy-meeple.pages.dev/` | Site base URL |
| `--path-prefix` | `learn-to-play` | URL path segment before the slug |
| `--output` | `shiny-hoppy-meeple/static/qr-codes.pdf` | Output PDF path (served at `/qr-codes.pdf`) |
| `--cols` / `--rows` | `3` / `4` | Grid size per A4 page |
| `--scan-slugs` | _(none)_ | Optional `scan-slugs.json` to validate slugs against |

### Notes

- Use `--path-prefix lets-play` or `p` to point the codes at the other play-counting
  short links instead. All three redirect to the game page after counting a scan.
- Slugs are the anchorized game **name**; renaming a game changes its slug. Finalise
  names before printing stickers (the printed code becomes stale on a rename).
