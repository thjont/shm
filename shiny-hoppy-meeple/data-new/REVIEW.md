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

**`content/g/_content.gotmpl`**
- `hugo.Data.games` → `index hugo.Data "bgg-cache" "games"`
- `index (index hugo.Data "games-overrides") $key` → `index (index hugo.Data "definitions") "games-bgg-override" $key`

**`content/m/_content.gotmpl`**
- `hugo.Data.sources.members` → `hugo.Data.definitions.members`
- `index hugo.Data.members $slug` → `index hugo.Data "bgg-cache" "collections" $slug`

**`layouts/g/list.html`**
- `(index hugo.Data "main-library").items` → `(index hugo.Data "bgg-cache" "collections" "main-library").items`
- `index hugo.Data.games (print .id)` → `index hugo.Data "bgg-cache" "games" (print .id)`

**`layouts/g/single.html`**
- `(index hugo.Data "main-library").items` → `(index hugo.Data "bgg-cache" "collections" "main-library").items`
- `range $slug, $member := hugo.Data.members` → `range $slug, $def := hugo.Data.definitions.members`, then look up collection via `index hugo.Data "bgg-cache" "collections" $slug`
- `$member.owner` (removed from cache) → `$def.display_name` from the definition

**`layouts/m/list.html`**
- `hugo.Data.sources.members` → `hugo.Data.definitions.members`
- `index hugo.Data.members $slug` → `index hugo.Data "bgg-cache" "collections" $slug`

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
