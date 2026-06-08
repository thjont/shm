#!/usr/bin/env python3
"""Export a BGG user collection and game details to JSON.

Usage:
    BGG_API_TOKEN=<token> BGG_USERNAME=<username> python bgg_export.py

Output:
    data/collection.json        — collection summary with per-item ownership/rating data
    data/games/<id>.json        — full game detail for every game in the collection
"""

import json
import os
import sys
from pathlib import Path

from boardgamegeek import BGGClient, BGGRestrictCollectionTo
from boardgamegeek.exceptions import BGGError

DATA_DIR = Path(__file__).parent / "data"
GAMES_DIR = DATA_DIR / "games"
GAME_BATCH_SIZE = 20  # API max per request


def _serialise(obj):
    """Fallback serialiser for json.dumps — converts unknown types to str."""
    return str(obj)


def export_collection(username: str, client: BGGClient) -> list[int]:
    """Fetch owned board games and write data/collection.json.

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
        items.append({
            "id": item.id,
            "name": item.name,
            "year": item.year,
            "thumbnail": item.thumbnail,
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

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DATA_DIR / "collection.json"
    out_path.write_text(
        json.dumps({"owner": username, "count": len(items), "items": items}, indent=2, default=_serialise)
    )
    print(f"  Saved {len(items)} items → {out_path}")
    return [item["id"] for item in items]


def export_games(game_ids: list[int], client: BGGClient) -> None:
    """Fetch full game details and write data/games/<id>.json for each game."""
    GAMES_DIR.mkdir(parents=True, exist_ok=True)
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
            data = {
                "id": game.id,
                "name": game.name,
                "year": game.year,
                "thumbnail": game.thumbnail,
                "image": game.image,
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
            out_path = GAMES_DIR / f"{game.id}.json"
            out_path.write_text(json.dumps(data, indent=2, default=_serialise))
            saved += 1

    print(f"  Saved {saved} game files → {GAMES_DIR}/")


def main() -> None:
    token = os.environ.get("BGG_API_TOKEN")
    username = os.environ.get("BGG_USERNAME")

    if not token:
        sys.exit("Error: BGG_API_TOKEN environment variable not set")
    if not username:
        sys.exit("Error: BGG_USERNAME environment variable not set")

    client = BGGClient(token)

    game_ids = export_collection(username, client)
    export_games(game_ids, client)

    print("Done.")


if __name__ == "__main__":
    main()
