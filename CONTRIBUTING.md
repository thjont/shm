# Contributing content

**No coding required.** Everything on the [Shiny Hoppy Meeple website](https://shiny-hoppy-meeple.pages.dev)
— posts, members, and game libraries — is added or removed by opening a **GitHub Issue** and filling
in a short form. A maintainer reviews it, and the site updates automatically.

This guide is for everyone in the community. If you want to change how the website *works* (its
code, layout, or build), see the [developer guide](DEVELOPMENT.md) instead.

## What you need

- A free [GitHub account](https://github.com/join).
- That's it. You never download anything or install software.

## How it works (the short version)

```text
You open an issue  →  Maintainer reviews & adds the "publish" label  →  Change goes live
```

1. **You** pick a form and fill it in (this guide shows each one below).
2. **A maintainer** checks it and applies the **`publish`** label.
3. A robot turns your issue into the actual website change and a maintainer approves it.
4. Your content appears on the site, usually within a few minutes of approval.

> [!IMPORTANT]
> You can open and fill in an issue, but only **maintainers** can apply the `publish` label that
> makes a change go live. That's the review step — it keeps the site tidy and safe. Just open your
> issue and a maintainer will take it from there.

## Step-by-step: opening an issue

1. Go to the [**Issues** tab](../../issues) and click **New issue**
   (or use [this direct link](../../issues/new/choose)).
2. Choose the form that matches what you want to do (see the list below).
3. Fill in the boxes. Required boxes are marked with a red asterisk.
4. Click **Submit new issue**.
5. Wait for a maintainer to review. If anything needs changing, just **edit your issue** and they'll
   take another look.

That's all you ever have to do. The rest is handled for you.

---

## The forms

There's a form for each kind of content. Pick the one you need.

### 📝 Write a post

Use **New Post** to publish news, event write-ups, or anything else to the site's blog.

- **Title** — type your post's title in the issue title box at the top. This also becomes part of
  the web address.
- **Content** — write your post in the big text box. Plain text works, and so does
  [Markdown](https://www.markdownguide.org/cheat-sheet/) if you'd like **bold**, links, headings,
  or lists.
- **Images** — just **drag and drop** (or paste) images straight into the text box. They'll be
  saved with the post automatically.

> [!TIP]
> **Previewing and editing a post.** Once a maintainer adds the `publish` label, a private preview
> of your post is built and the link is posted back to your issue. Want to change something? Simply
> **edit the issue body** — the preview updates itself. No need to open a new issue.

### 👤 Add a member

Use **New Member** to give someone a profile page and show their board-game collection.

- **Display Name** — the name shown on the site (e.g. `Alice`).
- **Slug** — a short version used in the web address, e.g. `alice` gives `/m/alice/`. Use lowercase
  letters, numbers, and hyphens only — no spaces.
- **Description** — an optional short bio.
- **BGG Username** *or* **GeekList ID** — fill in **one** of these so we can import their games
  from [BoardGameGeek](https://boardgamegeek.com/):
  - **BGG Username** — their BoardGameGeek account name, to pull in their whole collection.
  - **GeekList ID** — the number in a BGG GeekList's web address, if you'd rather use a curated list.

### 📚 Add a "shadow library"

Use **New Shadow Library** to add a collection of games to the site's game pages **without** giving
it its own browsable list page. Handy for, say, a venue's house collection.

- **Display Name** — a short name for the collection (used behind the scenes).
- **Slug** — a unique short identifier (lowercase letters, numbers, hyphens).
- **BGG Username** *or* **GeekList ID** — same as above: fill in just one.

### 🎲 Customise a game's page (game override)

Use **New Game Override** to replace the default BoardGameGeek text for a game, or to add a
"learn to play" video.

- **BGG Game ID** — the number for the game on BoardGameGeek. You'll find it in the game's web
  address, e.g. `13` in `boardgamegeek.com/boardgame/13/catan`.
- **Description** — your own description to show instead of the BGG one. Leave blank to keep
  what's there.
- **Learn to Play Video ID** — a YouTube video ID — the part after `?v=` in a YouTube link
  (e.g. `oiQ6SgBzfqY`). Leave blank to keep what's there.

---

## Removing content

Each "add" form has a matching "remove" form. Open the relevant one, give the slug or ID, and a
maintainer will publish the removal the same way.

| To remove… | Use the form | You'll need |
| --- | --- | --- |
| A post | **Delete Post** | The post's slug (the last part of its web address, e.g. `my-post`) |
| A member | **Delete Member** | The member's slug (e.g. `alice` from `/m/alice/`) |
| A shadow library | **Delete Shadow Library** | The library's slug |
| A game override | **Delete Game Override** | The game's BGG ID number |

> [!NOTE]
> Deleting a post also removes its images. Deleting a shadow library removes its configuration, but
> any game pages it created stay until the game data is next refreshed.

---

## Emergency: rolling back a mistake

If the wrong thing was just published and you need to undo it quickly, use the **Rollback Main**
form. It reverts the single most recent change to the site.

1. Open a **Rollback Main** issue and describe what went wrong in the **Reason** box.
2. A maintainer applies the `publish` label.
3. A pull request is automatically opened that undoes the last change. A maintainer reviews and
   merges it, and the site reverts.

> [!IMPORTANT]
> This undoes **the last commit on `main`** — whatever was most recently merged. If more than one
> thing needs reverting, or you need to undo a specific earlier change, contact a maintainer
> directly rather than opening multiple rollback issues.

---

## Finding a slug or ID

Some forms ask for a **slug** or an **ID**. Here's where to find them:

- **Post / member slug** — the last part of the page's web address. For `…/m/alice/`, the slug is
  `alice`. For `…/posts/my-post/`, it's `my-post`.
- **BGG Game ID** — the number in a BoardGameGeek game's address. For
  `boardgamegeek.com/boardgame/13/catan`, the ID is `13`.
- **GeekList ID** — the number in a BGG GeekList's address.

## Questions?

If you're unsure which form to use or something doesn't look right, open a plain issue describing
what you'd like to do, or ask a maintainer. We're happy to help.
