#!/usr/bin/env python3
"""Export a BGG user collection or geeklist and game details to JSON, with local images.

Usage:
    # Main library or shadow library from definition file (recommended):
    BGG_API_TOKEN=<token> python bgg_export.py --library main-library
    BGG_API_TOKEN=<token> python bgg_export.py --library <slug>

    # User collection (requires auth):
    BGG_API_TOKEN=<token> BGG_USERNAME=<username> python bgg_export.py [options]

    # Geeklist by ID (BGG_API_TOKEN required — BGG returns 401 without auth):
    BGG_API_TOKEN=<token> python bgg_export.py --geeklist <id> [options]

BGG's API currently returns 401 for unauthenticated requests, so a valid
BGG_API_TOKEN is required for both collection mode and geeklist mode.

Options:
    --library SLUG         Read geeklist/username from definitions/libraries/<slug>.json
                           and write to bgg-cache/collections/<slug>.json
    --geeklist ID          Import a BGG geeklist by ID instead of a user collection
    --data-dir PATH        Where to write bgg-cache/ output
                           (default: shiny-hoppy-meeple/data)
    --image-dir PATH       Where to download images
                           (default: shiny-hoppy-meeple/static/images/games)
    --image-url-base PATH  Public URL prefix written into the JSON
                           (default: /images/games)
    --skip-images          Don't download images; keep the remote BGG URLs
    --force-images         Re-download images even if the file already exists

Output:
    <data-dir>/bgg-cache/collections/main-library.json — collection summary with per-item data
    <data-dir>/bgg-cache/games/<id>.json               — full game detail for every game
    <image-dir>/<id>.<ext>                             — full image per game
    <image-dir>/<id>-thumb.<ext>                       — thumbnail per game

Member and shadow-library definitions live under:
    <data-dir>/definitions/members/<slug>.json         — { slug, display_name, description, geeklist|username }
    <data-dir>/definitions/libraries/<slug>.json       — { slug, display_name, geeklist|username }
    <data-dir>/definitions/libraries/main.json         — main library definition

Images are served locally: the `image`/`thumbnail` fields in the JSON are
rewritten to local paths (e.g. /images/games/13.jpg), while the original BGG
URLs are preserved in `image_source`/`thumbnail_source`. If a download fails or
--skip-images is set, the fields keep the remote URL so the image still shows.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

from boardgamegeek import BGGClient, BGGRestrictCollectionTo
from boardgamegeek.exceptions import BGGApiUnauthorizedError, BGGError

PROJECT_DIR = Path(__file__).parent / "shiny-hoppy-meeple"
DEFAULT_DATA_DIR = PROJECT_DIR / "data"
DEFAULT_IMAGE_DIR = PROJECT_DIR / "static" / "images" / "games"
DEFAULT_IMAGE_URL_BASE = "/images/games"

GAME_BATCH_SIZE = 20  # API max per request
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
USER_AGENT = "shiny-hoppy-meeple-export/1.0 (+https://shiny-hoppy-meeple.pages.dev)"

# Image URLs come from BGG responses, which are externally influenced (a malicious
# geeklist could reference arbitrary URLs). Restrict fetches to https on BGG's own
# image CDN so a crafted URL can't turn the downloader into an SSRF / file-read
# primitive (e.g. file:///… or http://169.254.169.254/…).
ALLOWED_IMAGE_HOSTS = ("geekdo-images.com",)


def _is_allowed_image_url(url: str) -> bool:
    """True only for https URLs hosted on BGG's image CDN (geekdo-images.com)."""
    parsed = urlparse(url)
    if parsed.scheme != "https":
        return False
    host = parsed.hostname or ""
    return any(host == h or host.endswith("." + h) for h in ALLOWED_IMAGE_HOSTS)


def _serialise(obj):
    """Fallback serialiser for json.dumps — converts unknown types to str."""
    return str(obj)


def _image_ext(url: str) -> str:
    """Pick a sensible file extension from an image URL, defaulting to .jpg."""
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix if suffix in IMAGE_EXTS else ".jpg"


class ImageDownloader:
    """Downloads BGG images into image_dir and maps them to public URLs."""

    def __init__(self, image_dir: Path, url_base: str, enabled: bool, force: bool):
        self.image_dir = image_dir
        self.url_base = url_base.rstrip("/")
        self.enabled = enabled
        self.force = force
        self.downloaded = 0
        self.skipped = 0
        self.failed = 0
        if enabled:
            image_dir.mkdir(parents=True, exist_ok=True)

    def fetch(self, game_id: int, url: str, variant: str = "") -> str | None:
        """Download `url` for a game and return its public URL, or None on failure.

        `variant` is "" for the full image or "-thumb" for the thumbnail.
        """
        if not self.enabled or not url:
            return None

        if not _is_allowed_image_url(url):
            print(f"  Warning: refusing non-BGG image URL: {url}", file=sys.stderr)
            self.failed += 1
            return None

        filename = f"{game_id}{variant}{_image_ext(url)}"
        dest = self.image_dir / filename
        public = f"{self.url_base}/{filename}"

        if dest.exists() and not self.force:
            self.skipped += 1
            return public

        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as resp:
                dest.write_bytes(resp.read())
            self.downloaded += 1
            return public
        except Exception as exc:  # noqa: BLE001 — network/HTTP errors vary widely
            print(f"  Warning: image download failed ({url}): {exc}", file=sys.stderr)
            self.failed += 1
            return None

    def summary(self) -> None:
        if self.enabled:
            print(
                f"  Images: {self.downloaded} downloaded, "
                f"{self.skipped} already present, {self.failed} failed"
            )


def export_collection(
    username: str, client: BGGClient, data_dir: Path, images: ImageDownloader,
    collection_file: Path | None = None,
) -> list[int]:
    """Fetch owned board games and write the collection JSON file.

    Writes to `collection_file` if given, otherwise `<data-dir>/main-library.json`.
    Returns the list of game IDs for downstream game-detail export.
    """
    print(f"Fetching collection for '{username}' …")
    collection = client.collection(
        username,
        subtype=BGGRestrictCollectionTo.BOARD_GAME,
        own=True,
    )

    items = []
    for item in collection:
        local_thumb = images.fetch(item.id, item.thumbnail, "-thumb")
        items.append({
            "id": item.id,
            "name": item.name,
            "year": item.year,
            "thumbnail": local_thumb or item.thumbnail,
            "thumbnail_source": item.thumbnail,
            "owned": item.owned,
            "prev_owned": item.prev_owned,
            "for_trade": item.for_trade,
            "want": item.want,
            "want_to_play": item.want_to_play,
            "want_to_buy": item.want_to_buy,
            "wishlist": item.wishlist,
            "wishlist_priority": item.wishlist_priority,
            "preordered": item.preordered,
            "rating": item.rating,
            "numplays": item.numplays,
            "comment": item.comment,
            "last_modified": item.last_modified,
        })

    out_path = collection_file if collection_file else data_dir / "bgg-cache" / "collections" / "main-library.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps({"count": len(items), "items": items}, indent=2, default=_serialise)
    )
    print(f"  Saved {len(items)} items → {out_path}")
    return [item["id"] for item in items]


def _fetch_geeklist_xml(geeklist_id: int, client: BGGClient) -> tuple[str, list[dict]]:
    """Fetch a BGG geeklist via the XML API v1 and return (title, items).

    BGG's v2 API does not expose geeklists, so this calls the v1 endpoint
    directly. Items are filtered to objecttype="thing" (games/expansions).
    Uses the library's requests session for Bearer auth. Handles both the
    202 HTTP status and the XML <message> queued-response that v1 returns.
    """
    url = f"https://boardgamegeek.com/xmlapi/geeklist/{geeklist_id}"
    auth_headers = client._get_auth_headers() or {}

    for attempt in range(10):
        r = client.requests_session.get(url, timeout=30, headers=auth_headers)
        if r.status_code == 401:
            raise BGGApiUnauthorizedError("invalid access token")
        if r.status_code == 202:
            print(f"  BGG queued (202) — retrying in 10s … (attempt {attempt + 1}/10)")
            time.sleep(10)
            continue
        r.raise_for_status()
        root = ET.fromstring(r.text)
        if root.tag == "message":
            print(f"  BGG queued (message) — retrying in 10s … (attempt {attempt + 1}/10)")
            time.sleep(10)
            continue
        break
    else:
        raise RuntimeError("BGG API did not respond in time — try again later")

    title_el = root.find("title")
    title = title_el.text if title_el is not None else f"Geeklist {geeklist_id}"

    items = []
    for item in root.findall("item"):
        if item.get("objecttype") != "thing":
            continue
        items.append({
            "id": int(item.get("objectid")),
            "name": item.get("objectname", ""),
        })
    return title, items


def export_geeklist(
    geeklist_id: int, _client: BGGClient, data_dir: Path, images: ImageDownloader,
    collection_file: Path | None = None,
) -> list[int]:
    """Fetch a BGG geeklist and write a collection JSON file.

    Writes to `collection_file` if given, otherwise `<data-dir>/main-library.json`.
    Thumbnails are not available from the geeklist API; they are populated at
    build time from the game-detail files fetched by export_games().
    Returns the list of game IDs for downstream game-detail export.
    """
    print(f"Fetching geeklist {geeklist_id} …")
    title, geeklist_items = _fetch_geeklist_xml(geeklist_id, _client)

    items = [{"id": gi["id"], "name": gi["name"], "thumbnail": None} for gi in geeklist_items]

    out_path = collection_file if collection_file else data_dir / "bgg-cache" / "collections" / "main-library.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps({"count": len(items), "items": items}, indent=2, default=_serialise)
    )
    print(f"  Saved {len(items)} items → {out_path}")
    return [item["id"] for item in items]


def export_games(
    game_ids: list[int], client: BGGClient, data_dir: Path, images: ImageDownloader
) -> None:
    """Fetch full game details and write <data-dir>/bgg-cache/games/<id>.json for each game."""
    games_dir = data_dir / "bgg-cache" / "games"
    games_dir.mkdir(parents=True, exist_ok=True)
    total = len(game_ids)
    saved = 0

    for batch_start in range(0, total, GAME_BATCH_SIZE):
        batch = game_ids[batch_start : batch_start + GAME_BATCH_SIZE]
        print(f"Fetching games {batch_start + 1}–{batch_start + len(batch)} of {total} …")

        try:
            games = client.game_list(batch)
        except BGGError as exc:
            print(f"  Warning: batch failed — {exc}", file=sys.stderr)
            continue

        for game in games:
            local_image = images.fetch(game.id, game.image, "")
            local_thumb = images.fetch(game.id, game.thumbnail, "-thumb")
            data = {
                "id": game.id,
                "name": game.name,
                "year": game.year,
                "thumbnail": local_thumb or game.thumbnail,
                "thumbnail_source": game.thumbnail,
                "image": local_image or game.image,
                "image_source": game.image,
                "description": game.description,
                "min_players": game.min_players,
                "max_players": game.max_players,
                "min_playing_time": game.min_playing_time,
                "max_playing_time": game.max_playing_time,
                "playing_time": game.playing_time,
                "min_age": game.min_age,
                "expansion": game.expansion,
                "categories": game.categories,
                "mechanics": game.mechanics,
                "families": game.families,
                "designers": game.designers,
                "artists": game.artists,
                "publishers": game.publishers,
                "expansions": [{"id": e.id, "name": e.name} for e in (game.expansions or [])],
                "alternative_names": game.alternative_names,
                "bgg_rank": game.bgg_rank,
                "ranks": game.ranks,
                "users_rated": game.users_rated,
                "rating_average": game.rating_average,
                "rating_bayes_average": game.rating_bayes_average,
                "rating_stddev": game.rating_stddev,
                "rating_average_weight": game.rating_average_weight,
                "rating_num_weights": game.rating_num_weights,
                "users_owned": game.users_owned,
                "users_trading": game.users_trading,
                "users_wanting": game.users_wanting,
                "users_wishing": game.users_wishing,
                "users_commented": game.users_commented,
            }
            out_path = games_dir / f"{game.id}.json"
            out_path.write_text(json.dumps(data, indent=2, default=_serialise))
            saved += 1

    print(f"  Saved {saved} game files → {games_dir}/")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export a BGG user collection or geeklist and game details to JSON.")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--library", metavar="SLUG",
                        help="Read source (geeklist/username) from definitions/libraries/<slug>.json "
                             "and write to bgg-cache/collections/<slug>.json")
    source.add_argument("--geeklist", type=int, metavar="ID",
                        help="Import a BGG geeklist by ID instead of a user collection")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR,
                        help="Root data directory (default: shiny-hoppy-meeple/data); "
                             "bgg-cache/ is written under here")
    parser.add_argument("--image-dir", type=Path, default=DEFAULT_IMAGE_DIR,
                        help="Directory to download images into (default: shiny-hoppy-meeple/static/images/games)")
    parser.add_argument("--image-url-base", default=DEFAULT_IMAGE_URL_BASE,
                        help="Public URL prefix written into the JSON (default: /images/games)")
    parser.add_argument("--collection-file", type=Path, default=None,
                        help="Override output path for collection JSON "
                             "(default: <data-dir>/bgg-cache/collections/main-library.json). "
                             "Use data/bgg-cache/collections/<slug>.json for member collections.")
    parser.add_argument("--skip-images", action="store_true",
                        help="Don't download images; keep the remote BGG URLs")
    parser.add_argument("--force-images", action="store_true",
                        help="Re-download images even if the file already exists")
    args = parser.parse_args()

    token = os.environ.get("BGG_API_TOKEN", "")
    username = os.environ.get("BGG_USERNAME")

    # Resolve --library: read definition file and derive geeklist/username + collection path.
    if args.library:
        def_path = args.data_dir / "definitions" / "libraries" / f"{args.library}.json"
        if not def_path.exists():
            sys.exit(f"Error: library definition not found: {def_path}")
        defn = json.loads(def_path.read_text())
        if "geeklist" in defn:
            args.geeklist = int(defn["geeklist"])
        elif "username" in defn:
            username = defn["username"]
        else:
            sys.exit(f"Error: {def_path} must have a 'geeklist' or 'username' field")
        if args.collection_file is None:
            args.collection_file = (
                args.data_dir / "bgg-cache" / "collections" / f"{args.library}.json"
            )

    if not args.geeklist and not username:
        sys.exit("Error: BGG_USERNAME environment variable not set (required for collection mode)")
    if not token:
        print("No BGG_API_TOKEN set — attempting keyless access "
              "(BGG may reject this with a 401).", file=sys.stderr)

    client = BGGClient(token)
    images = ImageDownloader(
        args.image_dir, args.image_url_base, enabled=not args.skip_images, force=args.force_images
    )

    try:
        if args.geeklist:
            game_ids = export_geeklist(args.geeklist, client, args.data_dir, images, args.collection_file)
        else:
            game_ids = export_collection(username, client, args.data_dir, images, args.collection_file)
        export_games(game_ids, client, args.data_dir, images)
    except BGGApiUnauthorizedError:
        sys.exit("Error: BGG returned 401 Unauthorized — a valid BGG_API_TOKEN is "
                 "required for this request. Set it and retry.")
    except BGGError as exc:
        sys.exit(f"Error: BGG API request failed — {exc}")
    images.summary()

    print("Done.")


if __name__ == "__main__":
    main()
