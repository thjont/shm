# Project Guidance

## Overview

Static website built with Hugo (extended) using the PaperMod theme, deployed to Cloudflare Pages via GitHub Actions and Wrangler.

- **Site name**: shiny-hoppy-meeple
- **Live URL**: https://shiny-hoppy-meeple.pages.dev/
- **Cloudflare project**: `shiny-hoppy-meeple`

## Stack

- **Hugo extended** — static site generator (minimum v0.146.0)
- **PaperMod** — Hugo theme (Git submodule from `adityatelange/hugo-PaperMod`)
- **Cloudflare Pages** — hosting
- **Wrangler v3** — deployment CLI
- **markdownlint-cli2** — markdown linting

## Repository Layout

```
shm/
├── .devcontainer/        # VS Code dev container config
├── .github/workflows/    # CI/CD (deploy.yml)
├── shiny-hoppy-meeple/   # Hugo project root
│   ├── hugo.toml         # Hugo config (baseURL, theme, menus)
│   ├── archetypes/       # Content templates
│   ├── content/posts/    # Blog posts
│   ├── layouts/          # Custom layout overrides (currently empty)
│   ├── static/           # Static assets served as-is
│   └── themes/PaperMod/  # Theme submodule
├── .gitmodules           # PaperMod submodule reference
├── .markdownlint.yaml    # Markdown lint config
└── .gitignore
```

## Development Workflow

All Hugo commands run from inside `shiny-hoppy-meeple/`:

```bash
cd shiny-hoppy-meeple
hugo server              # local dev with live reload
hugo --minify            # production build → public/
```

Cloning requires submodule init:

```bash
git clone --recurse-submodules <repo>
# or after a plain clone:
git submodule update --init --recursive
```

## Deployment

Deploys automatically on push to `main` via `.github/workflows/deploy.yml`:

1. Checkout with submodules
2. Build with `hugo --minify` inside `shiny-hoppy-meeple/`
3. Deploy `public/` to Cloudflare Pages via Wrangler

Required GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

Manual deploy:

```bash
cd shiny-hoppy-meeple
hugo --minify
wrangler pages deploy public/ --project-name shiny-hoppy-meeple
```

## Content

- New posts go in `shiny-hoppy-meeple/content/posts/`
- Use `hugo new posts/my-post.md` to create from archetype
- Posts default to `draft: true` — set to `false` to publish

## Linting

```bash
markdownlint-cli2 "**/*.md"
```

Config: `.markdownlint.yaml` — 120 char line limit, inline HTML allowed.

## Dev Container

Open in VS Code and choose "Reopen in Container". Provides Node LTS, Hugo extended, Wrangler, markdownlint-cli2, and relevant VS Code extensions.
