# qr-pdf

Generates a print-ready **A4 PDF of QR codes** for the games in the main library.
Each QR code points at that game's learn-to-play short link
(`https://shiny-hoppy-meeple.pages.dev/learn-to-play/<slug>/`), with the game name and
full address printed beneath it. Print the sheet, cut along the guides, and stick the
codes on the boxes.

This is a standalone tool, separate from `bgg_export.py`. It only **reads** the
generated collection JSON — it never modifies the site.

## How it works

1. Reads games from `shiny-hoppy-meeple/data/bgg-cache/collections/main-library.json`.
2. Slugifies each game name with the same algorithm Hugo's `anchorize` uses (GitHub
   heading-ID rules), so the links match the site's `/g/<slug>/` URLs.
3. Builds `<base>/<path-prefix>/<slug>/` for each game (default prefix `learn-to-play`).
4. Renders the QR codes as crisp vector squares laid out in a grid on A4 pages.

## Install

```bash
cd qr-pdf
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
```

## Usage

```bash
# Defaults: main library → shiny-hoppy-meeple/static/qr-codes.pdf, 3×4 grid (12 per page)
python generate_qr_pdf.py

# Cross-check generated slugs against the site's allowlist (needs a Hugo build)
python generate_qr_pdf.py --scan-slugs ../shiny-hoppy-meeple/public/scan-slugs.json

# Custom output and grid
python generate_qr_pdf.py --output stickers.pdf --cols 4 --rows 6
```

By default the PDF is written into the Hugo `static/` dir, so once committed and
deployed it is downloadable at **`https://shiny-hoppy-meeple.pages.dev/qr-codes.pdf`**.
The Cloudflare build runs `hugo --minify` (not this script), so the generated PDF must
be **committed to the repo** to publish it — same as the `bgg-cache` data and the
downloaded game images.

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--collection` | `../shiny-hoppy-meeple/.../main-library.json` | Collection JSON to read games from |
| `--base-url` | `https://shiny-hoppy-meeple.pages.dev/` | Site base URL |
| `--path-prefix` | `learn-to-play` | URL path segment before the slug |
| `--output` | `../shiny-hoppy-meeple/static/qr-codes.pdf` | Output PDF path (served at `/qr-codes.pdf`) |
| `--cols` / `--rows` | `3` / `4` | Grid size per A4 page |
| `--scan-slugs` | _(none)_ | Optional `scan-slugs.json` to validate slugs against |

## Notes

- Use `--path-prefix lets-play` or `p` to point the codes at the other play-counting
  short links instead. All three redirect to the game page after counting a scan.
- Slugs are the anchorized game **name**; renaming a game changes its slug. Finalise
  names before printing stickers (the printed code becomes stale on a rename).
