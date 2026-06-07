# Contributing

Technical reference for maintainers and developers.

---

## Stack

| Tool | Purpose |
|------|---------|
| [Hugo](https://gohugo.io/) (extended) | Static site generator |
| [PaperMod](https://github.com/adityatelange/hugo-PaperMod) | Hugo theme (Git submodule) |
| [Cloudflare Pages](https://pages.cloudflare.com/) | Hosting |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | Cloudflare deployment CLI |
| GitHub Actions | CI/CD and post publishing automation |
| markdownlint-cli2 | Markdown linting |

---

## Repository Structure

```
shm/
├── .devcontainer/              # VS Code dev container (Node LTS, Hugo, Wrangler, markdownlint)
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── new-post.md         # Issue template for community posts
│   └── workflows/
│       ├── deploy.yml          # Production deploy on push to main
│       └── publish-from-issue.yml  # Post creation from GitHub issues
├── shiny-hoppy-meeple/         # Hugo project root
│   ├── hugo.toml               # Site config (baseURL, theme, menus, params)
│   ├── archetypes/             # Content templates
│   ├── content/
│   │   ├── posts/              # Blog posts
│   │   ├── about-us.md
│   │   └── who-are-we.md
│   ├── static/
│   │   └── images/posts/       # Images downloaded from issues (per post slug)
│   └── themes/PaperMod/        # Theme submodule
├── .gitmodules
├── .markdownlint.yaml
└── .gitignore
```

---

## Local Development

Requires Hugo extended (v0.146.0+). Use the dev container or install manually.

```bash
cd shiny-hoppy-meeple
hugo server              # live reload at http://localhost:1313
hugo --minify            # production build → public/
```

Clone with submodules:

```bash
git clone --recurse-submodules <repo>
# or after a plain clone:
git submodule update --init --recursive
```

---

## Workflows

### `deploy.yml` — Production deploy

Triggers on push to `main` where files under `shiny-hoppy-meeple/` have changed.

1. Checkout with submodules
2. Build with `hugo --minify`
3. Deploy to Cloudflare Pages (production) via Wrangler

Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

### `publish-from-issue.yml` — Post publishing

Triggers when a GitHub issue is **labeled** with `publish` or **edited** while the `publish` label is present.

**Permission check**

The sender's collaborator permission is checked via the GitHub API. If they do not have `write` or `admin` access, the label is removed and a comment is posted on the issue. The workflow exits.

**Post creation (`labeled` event)**

1. Slugify the issue title → filename and branch name (`post/<slug>`)
2. Scan the issue body for `github.com/user-attachments` image URLs
3. Download each image, detect mime type with `file --mime-type`, save to `static/images/posts/<slug>/`
4. Strip `width`/`height` attributes from `<img>` tags
5. Rewrite image URLs to local paths
6. Write the Hugo post file with TOML front matter
7. Create `post/<slug>` branch, commit, push
8. Build with `hugo --minify --baseURL <preview-url>` (does not modify `hugo.toml`)
9. Deploy preview to Cloudflare Pages with `--branch=post/<slug>`
10. Open a PR to `main` with the preview URL in the body

**Post update (`edited` event)**

Steps 1–7 above, then:

- Fetch and checkout the existing `post/<slug>` branch
- Overwrite the post file and force-push with `--force-with-lease`
- Rebuild and redeploy the preview

No new PR is opened.

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production — deploys to `shiny-hoppy-meeple.pages.dev` |
| `post/<slug>` | One branch per post — deploys to `post-<slug>.shiny-hoppy-meeple.pages.dev` |

Post branches are created automatically by the publish workflow. Merge the PR to publish to production.

---

## Cloudflare Pages URLs

| Type | URL |
|------|-----|
| Production | `https://shiny-hoppy-meeple.pages.dev` |
| Branch preview | `https://post-<slug>.shiny-hoppy-meeple.pages.dev` |
| Unique deployment | `https://<hash>.shiny-hoppy-meeple.pages.dev` |

The unique deployment URL is posted in the PR body.

---

## Required GitHub Secrets

| Secret | Used by | Purpose |
|--------|---------|---------|
| `CLOUDFLARE_API_TOKEN` | Both workflows | Wrangler authentication |
| `CLOUDFLARE_ACCOUNT_ID` | Both workflows | Cloudflare account target |

---

## Adding Content

**New post via issue** — use the New Post issue template (recommended for community members).

**New post manually:**
```bash
cd shiny-hoppy-meeple
hugo new posts/my-post.md   # creates from archetype with draft: true
```
Set `draft = false` to publish.

**New page** — create a markdown file directly under `content/` and add a menu entry in `hugo.toml` if needed.

---

## Linting

```bash
markdownlint-cli2 "**/*.md"
```

Config: `.markdownlint.yaml` — 120 character line limit, inline HTML allowed.
