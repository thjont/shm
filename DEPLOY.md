# Deployment

The site is a Hugo static build hosted on **Cloudflare Pages** (project `shiny-hoppy-meeple`,
live at <https://shiny-hoppy-meeple.pages.dev>). Cloudflare **Pages Functions** add a small
amount of server-side logic (QR scan tracking), backed by a **Workers KV** namespace.

## Automatic deploys

Pushing to `main` triggers `.github/workflows/deploy.yml`, which:

1. Checks out the repo with submodules (PaperMod theme).
2. Builds the site with `hugo --minify` inside `shiny-hoppy-meeple/`.
3. Runs `wrangler pages deploy` from inside `shiny-hoppy-meeple/`.

The deploy step runs **from `shiny-hoppy-meeple/`** so that wrangler discovers the `./functions`
directory and reads `wrangler.toml`. Build output (`public`), project name, and the KV binding all
come from `wrangler.toml`.

Required GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Manual deploy

```bash
cd shiny-hoppy-meeple
hugo --minify
wrangler pages deploy        # reads wrangler.toml (output dir, name, KV binding)
```

## Project layout that affects deployment

```text
shiny-hoppy-meeple/
├── wrangler.toml         # Pages config: build output, project name, KV binding
├── functions/            # Cloudflare Pages Functions (server-side, KV-backed)
│   ├── go/[slug].js      # QR target: increments scan count, redirects to game page
│   └── api/scans.js      # returns all scan counts as JSON
├── static/js/scans.js    # client-side: fetches counts, injects into pages
└── public/               # Hugo build output (deployed as static assets)
```

`functions/` and `wrangler.toml` sit at the Hugo project root but are **not** Hugo-recognised, so
Hugo ignores them — they are read by wrangler at deploy time, not copied into `public/`.

---

## QR scan tracking

QR-code stickers on physical games point at `…/go/<slug>`. A visitor who scans is counted and
redirected to the game's page. Counts are shown on the Our Library grid cards and on each game's
detail page. Counts are **publicly visible** (the site is public).

### How it works

- **`functions/go/[slug].js`** — increments `SCANS[<slug>]` in KV, then 302-redirects to
  `/our-library/<slug>/`. Only slugs in the allowlist are counted (see below).
- **`functions/api/scans.js`** — returns `{ "<slug>": <count>, … }` (restricted to allowlisted
  slugs), cached 60s at the edge.
- **`static/js/scans.js`** — fetches `/api/scans` after the page renders and fills any element
  with a `data-scan-slug` attribute (so counts never block the static content).

#### Slug allowlist

To stop arbitrary requests writing junk keys into KV (which would burn the write quota and bloat
`/api/scans`), only slugs that correspond to a real game are counted. Hugo emits the list of valid
slugs at build time to **`/scan-slugs.json`** via a custom `ScanSlugs` output format
(`layouts/index.scanslugs.json`, derived from `data/collection.json`). Both Functions fetch this
file and reject anything not on it; if the file is unreachable they fall back to a format-only check
(`[a-z0-9-]`). The same `[outputs]` block also enables the `JSON` output PaperMod needs for site
search.

> Because the allowlist comes from the collection data, **re-running the export and rebuilding keeps
> it in sync automatically** — newly added games become counted, removed games stop counting.

KV is eventually consistent, so two scans of the same game within a second can rarely lose one
increment — acceptable for venue-scale traffic. Free-tier KV limits (100k reads / 1k writes per
day) are far above expected use.

> **Slug = name-slug.** The KV key and QR URL use the lowercased, hyphenated game name
> (e.g. `terraforming-mars`). Renaming a game changes its slug, which breaks printed stickers and
> splits the count. Finalise game names before printing stickers.

### One-time setup

1. **Create the KV namespace:**

   ```bash
   cd shiny-hoppy-meeple
   wrangler kv namespace create SCANS
   ```

2. **Paste the returned `id`** into `wrangler.toml`, replacing `REPLACE_WITH_KV_NAMESPACE_ID`, and
   commit. (Optionally add a `preview_id` for preview deployments.)
3. **Deploy** by pushing to `main`, or run `wrangler pages deploy` locally.
4. **Generate QR codes** pointing at `https://shiny-hoppy-meeple.pages.dev/go/<slug>` —
   e.g. `/go/catan`, `/go/terraforming-mars`.

### Local testing

Hugo and wrangler are provided by the dev container. To exercise the Functions + KV flow before
printing stickers:

```bash
cd shiny-hoppy-meeple
hugo --minify
wrangler pages dev public      # serves functions + assets locally
```

Visit `/go/<slug>` to confirm the redirect and that `/api/scans` reflects the increment.

### Hardening the counts (recommended follow-ups)

The allowlist stops junk keys, but scan counts are still **soft metrics**: they can be inflated by
scripted requests to valid slugs, and by link unfurlers (WhatsApp, iMessage, Slack, Discord) and
crawlers that fetch `/go/` URLs to build previews. To reduce this, configure the following in the
Cloudflare dashboard (all free-tier):

1. **Bot Fight Mode** — *Security → Bots*. Challenges known bots and crawlers, cutting accidental
   inflation from automated fetches.
2. **Rate-limiting rule on `/go/*`** — *Security → WAF → Rate limiting rules*. Limit requests per
   IP (e.g. 5 requests / 10 seconds per path) to blunt scripted inflation.
3. **Skip counting prefetch/bot requests** — optionally, in `functions/go/[slug].js`, skip the KV
   increment when request headers indicate a prefetch or bot (e.g. `Sec-Purpose: prefetch`, or a
   known bot `User-Agent`) while still performing the redirect.

> Treat the numbers as an indicator of interest, not precise analytics. None of these measures make
> the counts tamper-proof — that's inherent to a no-auth QR endpoint.
