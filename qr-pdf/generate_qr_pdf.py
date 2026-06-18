#!/usr/bin/env python3
"""Generate a print-ready A4 PDF of QR codes for the main-library games.

One QR code per game in the collection, each pointing at that game's
learn-to-play short link (https://shiny-hoppy-meeple.pages.dev/learn-to-play/<slug>/),
with the game name and full address printed beneath it. Lay it out on A4, print,
cut along the guides, and stick the codes on the boxes.

Usage:
    python generate_qr_pdf.py                       # defaults: main library → qr-codes.pdf
    python generate_qr_pdf.py --output stickers.pdf --cols 3 --rows 4
    python generate_qr_pdf.py --scan-slugs ../shiny-hoppy-meeple/public/scan-slugs.json

The slug is derived from the game name with the same algorithm Hugo's `anchorize`
uses (GitHub heading-ID rules), so the generated links match the site's URLs. Pass
--scan-slugs to cross-check every slug against the site's generated allowlist.
"""

import argparse
import json
import sys
from pathlib import Path

import segno
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

DEFAULT_COLLECTION = (
    Path(__file__).parent.parent
    / "shiny-hoppy-meeple" / "data" / "bgg-cache" / "collections" / "main-library.json"
)
DEFAULT_BASE_URL = "https://shiny-hoppy-meeple.pages.dev/"
DEFAULT_PATH_PREFIX = "learn-to-play"
DEFAULT_OUTPUT = (
    Path(__file__).parent.parent / "shiny-hoppy-meeple" / "static" / "qr-codes.pdf"
)

PAGE_MARGIN = 10 * mm   # outer margin around the grid
CELL_PADDING = 4 * mm   # inner padding within each grid cell
QR_QUIET_ZONE = 2       # QR modules of white border around the code


def anchorize(name: str) -> str:
    """Slugify a game name to match Hugo's `anchorize` (GitHub heading-ID rules).

    Lowercase; keep letters, numbers and hyphens; turn each space into a hyphen;
    drop everything else. Consecutive hyphens are preserved (not collapsed), so
    "Rome & Roll" → "rome--roll", matching the slugs Hugo writes for the site.
    """
    out = []
    for ch in name.lower():
        if ch == " ":
            out.append("-")
        elif ch == "-" or ch.isalnum():
            out.append(ch)
        # all other characters are dropped
    return "".join(out)


def load_games(collection_path: Path, base_url: str, path_prefix: str) -> list[dict]:
    """Read the collection JSON and return [{name, slug, url}] for each game."""
    if not collection_path.exists():
        sys.exit(f"Error: collection file not found: {collection_path}")

    data = json.loads(collection_path.read_text())
    items = data.get("items", [])
    base = base_url.rstrip("/")
    prefix = path_prefix.strip("/")

    games = []
    for item in items:
        name = item.get("name", "")
        if not name:
            continue
        slug = anchorize(name)
        games.append({
            "name": name,
            "slug": slug,
            "url": f"{base}/{prefix}/{slug}/",
        })
    return games


def cross_check_slugs(games: list[dict], scan_slugs_path: Path) -> None:
    """Warn if any generated slug is missing from the site's scan-slugs allowlist."""
    if not scan_slugs_path.exists():
        print(f"  Warning: scan-slugs file not found, skipping check: {scan_slugs_path}",
              file=sys.stderr)
        return

    allowed = set(json.loads(scan_slugs_path.read_text()))
    missing = [g for g in games if g["slug"] not in allowed]
    if missing:
        print(f"  Warning: {len(missing)} slug(s) not found in {scan_slugs_path.name}:",
              file=sys.stderr)
        for g in missing:
            print(f"    {g['name']!r} → {g['slug']}", file=sys.stderr)
    else:
        print(f"  Slug check: all {len(games)} slugs present in {scan_slugs_path.name}")


def _fit_font_size(c: canvas.Canvas, text: str, font: str, max_width: float,
                   start: float, minimum: float = 5.0) -> float:
    """Largest font size (down to `minimum`) at which `text` fits in `max_width`."""
    size = start
    while size > minimum and c.stringWidth(text, font, size) > max_width:
        size -= 0.5
    return size


def draw_qr(c: canvas.Canvas, matrix, x: float, y: float, size: float) -> None:
    """Draw a segno QR `matrix` as filled vector squares inside a `size` box at (x, y)."""
    rows = list(matrix)
    n = len(rows)
    modules = n + 2 * QR_QUIET_ZONE          # include the quiet zone
    scale = size / modules
    origin = QR_QUIET_ZONE * scale

    c.setFillColorRGB(0, 0, 0)
    for r, row in enumerate(rows):
        for col, dark in enumerate(row):
            if dark:
                # PDF y grows upward; draw rows top-to-bottom.
                px = x + origin + col * scale
                py = y + size - origin - (r + 1) * scale
                c.rect(px, py, scale, scale, stroke=0, fill=1)


def draw_cell(c: canvas.Canvas, game: dict, x: float, y: float,
              width: float, height: float) -> None:
    """Render one game cell: cut border, QR, bold name, and the URL beneath."""
    # Cut guide.
    c.setStrokeColorRGB(0.8, 0.8, 0.8)
    c.setLineWidth(0.5)
    c.rect(x, y, width, height, stroke=1, fill=0)

    inner_w = width - 2 * CELL_PADDING
    name_size = 9
    url_size = 6
    name_h = name_size + 2
    url_h = url_size + 2
    text_block = name_h + url_h

    # QR fills the cell above the text block, constrained to a square.
    qr_area_h = height - 2 * CELL_PADDING - text_block
    qr_size = min(inner_w, qr_area_h)
    qr_x = x + (width - qr_size) / 2
    qr_y = y + CELL_PADDING + text_block + (qr_area_h - qr_size)

    qr = segno.make(game["url"], error="m")
    draw_qr(c, qr.matrix, qr_x, qr_y, qr_size)

    # Game name (bold), shrunk to fit the cell width.
    c.setFillColorRGB(0, 0, 0)
    cx = x + width / 2
    ns = _fit_font_size(c, game["name"], "Helvetica-Bold", inner_w, name_size)
    c.setFont("Helvetica-Bold", ns)
    c.drawCentredString(cx, y + CELL_PADDING + url_h, game["name"])

    # Full URL (smaller), shrunk to fit.
    us = _fit_font_size(c, game["url"], "Helvetica", inner_w, url_size, minimum=4.0)
    c.setFont("Helvetica", us)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawCentredString(cx, y + CELL_PADDING, game["url"])


def build_pdf(games: list[dict], output: Path, cols: int, rows: int) -> int:
    """Lay out the games in a cols×rows grid across A4 pages. Returns page count."""
    page_w, page_h = A4
    output.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output), pagesize=A4)

    grid_w = page_w - 2 * PAGE_MARGIN
    grid_h = page_h - 2 * PAGE_MARGIN
    cell_w = grid_w / cols
    cell_h = grid_h / rows
    per_page = cols * rows

    pages = 0
    for i, game in enumerate(games):
        slot = i % per_page
        if slot == 0:
            if i > 0:
                c.showPage()
            pages += 1
        row = slot // cols
        col = slot % cols
        # Top-left origin for cells; PDF y grows upward.
        x = PAGE_MARGIN + col * cell_w
        y = page_h - PAGE_MARGIN - (row + 1) * cell_h
        draw_cell(c, game, x, y, cell_w, cell_h)

    if games:
        c.showPage()
    c.save()
    return pages


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a printable A4 PDF of learn-to-play QR codes for the main library."
    )
    parser.add_argument("--collection", type=Path, default=DEFAULT_COLLECTION,
                        help="Collection JSON to read games from "
                             "(default: main-library.json in the Hugo data dir)")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL,
                        help=f"Site base URL (default: {DEFAULT_BASE_URL})")
    parser.add_argument("--path-prefix", default=DEFAULT_PATH_PREFIX,
                        help=f"URL path prefix before the slug (default: {DEFAULT_PATH_PREFIX})")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                        help="Output PDF path "
                             "(default: shiny-hoppy-meeple/static/qr-codes.pdf, served at /qr-codes.pdf)")
    parser.add_argument("--cols", type=int, default=3, help="Columns per page (default: 3)")
    parser.add_argument("--rows", type=int, default=4, help="Rows per page (default: 4)")
    parser.add_argument("--scan-slugs", type=Path, default=None,
                        help="Optional scan-slugs.json to cross-check generated slugs against")
    args = parser.parse_args()

    games = load_games(args.collection, args.base_url, args.path_prefix)
    if not games:
        sys.exit(f"Error: no games found in {args.collection}")

    if args.scan_slugs:
        cross_check_slugs(games, args.scan_slugs)

    pages = build_pdf(games, args.output, args.cols, args.rows)
    print(f"  {len(games)} games → {pages} page(s) → {args.output}")
    print("Done.")


if __name__ == "__main__":
    main()
