# data-new Structure Review

## Overall: The concept is sound

The `definitions/` vs `bgg-cache/` split is the key win — it makes the human-authored config vs
machine-generated data distinction explicit and unambiguous. That clarity is worth the migration.

---

## What works well

- **`bgg-cache/collections/`** — treating main library, members, and shadow libraries as uniform
  collections here is clean. The old structure scattered these across `data/main-library.json`,
  `data/members/`, and implied shadow-library data somewhere else.
- **`definitions/games-bgg-override/`** — naming is more descriptive than `games-overrides/`; it's
  clear these are overrides of BGG data, not overrides of something else.
- **Member definitions are now explicit** — the old `data/sources/members/adam.json` was buried
  under `sources/`; promoting it to `definitions/members/` makes the intent clearer.

---

## Concerns

**1. Members still split from other collections in `definitions/`**

If main library, shadow libraries, and member collections are all the same conceptually, why does
`definitions/` have a `members/` folder separate from `collections/`? Hidden library sits under
`definitions/collections/` but member collections don't. A member *is* a collection. Consider either:

- Merging all into `definitions/collections/` and adding a `type` field (`"main"`, `"member"`,
  `"shadow"`), or
- Accepting members stay separate (they have extra metadata like `description`) — but then be
  explicit about why.

**2. `main.json` schema is inconsistent**

`definitions/collections/main.json` is just `{ "geeklist": ... }`, but `hidden-library.json` has
`slug`, `display_name`, and `geeklist`. If they're the same type, `main.json` should have the same
shape — a `slug` of `"main-library"` and a display name would make it consistent and self-describing.

**3. No `username` support visible in definitions**

`bgg_export.py` accepts a `BGG_USERNAME` for member collections. All the definition files only show
`geeklist`. If any collection is fetched by BGG username (not a geeklist), the schema needs to
handle both — e.g. a `username` field as an alternative to `geeklist`.

**4. Cache file naming convention needs to be explicit**

The cache filename for main is `main-library.json`; for members it's `adam.json` (matching the
slug). For a shadow library, would it be `secret-library.json` (its slug)? That's a reasonable
convention but it should be consistent and documented — the slug in the definition file should be
the source of truth for the cache filename.

---

## Bottom line

The structure is a clear improvement. The main thing to resolve is whether members should fully
merge into `definitions/collections/` (fully uniform) or stay separate with an accepted reason
(extra metadata). Everything else is schema tidying.
