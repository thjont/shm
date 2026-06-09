#!/usr/bin/env python3
"""Export a BGG user collection and game details to JSON, with local images.

Usage:
    BGG_API_TOKEN=<token> BGG_USERNAME=<username> python bgg_export.py [options]

BGG's API currently returns 401 for unauthenticated collection requests, so a
valid BGG_API_TOKEN is required in practice. The token is technically optional
(the script will attempt keyless access if it is unset), but expect a 401.

Options:
    --data-dir PATH        Where to write collection.json and games/
                           (default: shiny-hoppy-meeple/data)
    --image-dir PATH       Where to download images
                           (default: shiny-hoppy-meeple/static/images/games)
    --image-url-base PATH  Public URL prefix written into the JSON
                           (default: /images/games)
    --skip-images          Don't download images; keep the remote BGG URLs
    --force-images         Re-download images even if the file already exists

Output:
    <data-dir>/collection.json     — collection summary with per-item data
    <data-dir>/games/<id>.json     — full game detail for every game
    <image-dir>/<id>.<ext>         — full image per game
    <image-dir>/<id>-thumb.<ext>   — thumbnail per game

Images are served locally: the `image`/`thumbnail` fields in the JSON are
rewritten to local paths (e.g. /images/games/13.jpg), while the original BGG
URLs are preserved in `image_source`/`thumbnail_source`. If a download fails or
--skip-images is set, the fields keep the remote URL so the image still shows.
"""

import argparse
import json
import os
import sys
import urllib.request
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
    username: str, client: BGGClient, data_dir: Path, images: ImageDownloader
) -> list[int]:
    """Fetch owned board games and write <data-dir>/collection.json.

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

    data_dir.mkdir(parents=True, exist_ok=True)
    out_path = data_dir / "collection.json"
    out_path.write_text(
        json.dumps({"owner": username, "count": len(items), "items": items}, indent=2, default=_serialise)
    )
    print(f"  Saved {len(items)} items → {out_path}")
    return [item["id"] for item in items]


def export_games(
    game_ids: list[int], client: BGGClient, data_dir: Path, images: ImageDownloader
) -> None:
    """Fetch full game details and write <data-dir>/games/<id>.json for each game."""
    games_dir = data_dir / "games"
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
    parser = argparse.ArgumentParser(description="Export a BGG user collection and game details to JSON.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR,
                        help="Directory for collection.json and games/ (default: shiny-hoppy-meeple/data)")
    parser.add_argument("--image-dir", type=Path, default=DEFAULT_IMAGE_DIR,
                        help="Directory to download images into (default: shiny-hoppy-meeple/static/images/games)")
    parser.add_argument("--image-url-base", default=DEFAULT_IMAGE_URL_BASE,
                        help="Public URL prefix written into the JSON (default: /images/games)")
    parser.add_argument("--skip-images", action="store_true",
                        help="Don't download images; keep the remote BGG URLs")
    parser.add_argument("--force-images", action="store_true",
                        help="Re-download images even if the file already exists")
    args = parser.parse_args()

    # The token is optional at the call site (BGGClient("") sends no auth header),
    # but BGG currently rejects unauthenticated collection requests with a 401.
    token = os.environ.get("BGG_API_TOKEN", "")
    username = os.environ.get("BGG_USERNAME")

    if not username:
        sys.exit("Error: BGG_USERNAME environment variable not set")
    if not token:
        print("No BGG_API_TOKEN set — attempting keyless access "
              "(BGG may reject this with a 401).", file=sys.stderr)

    client = BGGClient(token)
    images = ImageDownloader(
        args.image_dir, args.image_url_base, enabled=not args.skip_images, force=args.force_images
    )

    try:
        game_ids = export_collection(username, client, args.data_dir, images)
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
