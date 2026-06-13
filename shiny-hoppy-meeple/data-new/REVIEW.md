# data Structure Design

## Structure

```
data/
  bgg-cache/
    collections/
      main-library.json       # BGG collection data — keyed by slug, no owner field
      <member-slug>.json      # one per member
      <library-slug>.json     # one per shadow/supplementary library
    games/
      <bgg-id>.json           # BGG game detail data
  definitions/
    libraries/
      main.json               # { slug, display_name, geeklist|username }
      <library-slug>.json     # one per shadow/supplementary library
    members/
      <member-slug>.json      # { slug, display_name, description, geeklist|username }
    games-bgg-override/
      <bgg-id>.json           # { description?, learn_to_play_video? }
```

## Design Principles

**`bgg-cache/` mirrors BGG's world.** All collections — main library, member libraries, and
shadow/supplementary libraries — are stored uniformly here. The cache has no concept of "member"
vs "library"; it only knows BGG items. The `owner` field is not stored: it is a website concept,
not a BGG attribute.

**`definitions/` mirrors the website's world.** Members are distinct from libraries because
the site presents them differently — members have profile pages and descriptions; libraries do
not. The `libraries/` folder holds the main library and any shadow/supplementary collections.
The `games-bgg-override/` folder holds editorial overrides applied at render time.

**Cache filename = slug.** The slug value in a definition file is the source of truth for the
corresponding cache filename. `slug: "main-library"` → `bgg-cache/collections/main-library.json`.

**`geeklist` or `username`, not both.** Each definition file specifies exactly one BGG source.
`geeklist` is an integer geeklist ID; `username` is a BGG username for a standard collection.

## Page Generation Data Flow

### Member and library pages — definition first

The definition is the spine. A member or library page exists because a definition file exists.
The corresponding cache file enriches it with game items. If the cache file is absent (e.g. BGG
data not yet fetched), the page still generates with an empty collection. A cache file with no
matching definition does not produce a page.

```
definitions/members/<slug>.json       ← drives page creation, provides display_name/description
  + bgg-cache/collections/<slug>.json ← provides .items for the collection grid
```

```
definitions/libraries/main.json            ← drives the main library page, provides display_name
  + bgg-cache/collections/main-library.json ← provides .items for the library grid
```

### Game pages — cache first, override on top

The BGG cache is the spine. A game page exists because a cache file exists (written there because
the game appears in at least one active collection). The override file patches specific fields;
all other fields remain as BGG returned them.

```
bgg-cache/games/<id>.json               ← base game data from BGG
  + definitions/games-bgg-override/<id>.json ← description and/or learn_to_play_video replace BGG values
```

---

## Implementation Plan

### 1. Data directory

- Rename `data-new/` → `data/`, removing the old `data/` directory entirely.

### 2. `bgg_export.py`

| Change | Detail |
|--------|--------|
| Output path: collections | `data/members/<slug>.json` and `data/main-library.json` → `data/bgg-cache/collections/<slug>.json` |
| Output path: games | `data/games/<id>.json` → `data/bgg-cache/games/<id>.json` |
| Input config: members | `data/sources/members/<slug>.json` → `data/definitions/members/<slug>.json` |
| Input config: main library | `data/sources/main-library.json` → `data/definitions/libraries/main.json` |
| Input config: shadow libraries | `data/sources/shadow-libraries/<slug>.json` → `data/definitions/libraries/<slug>.json` |
| Field rename | `collection` → `username` when reading BGG username from a definition |
| Remove `owner` from output | Do not write `owner` into generated collection JSON |

### 3. Hugo templates and content

**`content/g/_content.gotmpl`** _(cache first, override on top)_
- Iterate `index hugo.Data "bgg-cache" "games"` as the base
- Merge `index hugo.Data "definitions" "games-bgg-override" $key` on top (was `games-overrides`)

**`content/m/_content.gotmpl`** _(definition first, cache enriches)_
- Iterate `hugo.Data.definitions.members` to drive page creation (was `sources.members`)
- Look up `index hugo.Data "bgg-cache" "collections" $slug` for items; pass as `member` param even if nil so the page renders with an empty collection when cache is absent

**`layouts/g/list.html`** _(definition first, cache provides items)_
- Resolve main library slug from `hugo.Data.definitions.libraries.main.slug`
- Get items from `index hugo.Data "bgg-cache" "collections" "main-library"`
- Thumbnail fallback: `index hugo.Data "bgg-cache" "games" (print .id)`

**`layouts/g/single.html`** _(definition first for ownership check)_
- In-library check: `(index hugo.Data "bgg-cache" "collections" "main-library").items`
- Owner loop: iterate `hugo.Data.definitions.members` (definition is authoritative for who is a member), look up collection via `index hugo.Data "bgg-cache" "collections" $slug`
- `$member.owner` (removed from cache) → `$def.display_name` from the member definition

**`layouts/m/list.html`** _(definition first, cache provides count)_
- Iterate `hugo.Data.definitions.members` (was `sources.members`)
- Look up `index hugo.Data "bgg-cache" "collections" $slug` for game count

**`layouts/_default/stats.html`**
- `hugo.Data.games` → `index hugo.Data "bgg-cache" "games"`

**`layouts/index.scanslugs.json`**
- `hugo.Data.games` → `index hugo.Data "bgg-cache" "games"`

### 4. GitHub workflows

**`new-member-from-issue.yml`**
- `data/sources/members` → `data/definitions/members`
- `data['collection'] = bgg_username` → `data['username'] = bgg_username`

**`delete-member-from-issue.yml`**
- `data/sources/members/<slug>.json` → `data/definitions/members/<slug>.json`
- `data/members/<slug>.json` → `data/bgg-cache/collections/<slug>.json`

**`new-shadow-library-from-issue.yml`**
- `data/sources/shadow-libraries` → `data/definitions/libraries`
- `data['collection'] = bgg_username` → `data['username'] = bgg_username`

**`delete-shadow-library-from-issue.yml`**
- `data/sources/shadow-libraries/<slug>.json` → `data/definitions/libraries/<slug>.json`

**`new-game-override-from-issue.yml`**
- `data/games-overrides/<bgg_id>.json` → `data/definitions/games-bgg-override/<bgg_id>.json`

**`delete-game-override-from-issue.yml`**
- `data/games-overrides/<bgg_id>.json` → `data/definitions/games-bgg-override/<bgg_id>.json`
