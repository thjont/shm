# Project Guidance

## Overview

Static website built with Hugo, deployed to Cloudflare Pages via Wrangler.

## Stack

- **Hugo** (extended) — static site generator
- **Cloudflare Wrangler** — deployment CLI
- **markdownlint-cli2** — markdown linting

## Dev Container

Open in VS Code and reopen in container. The container installs Node LTS, Hugo extended, Wrangler, and markdownlint-cli2 automatically.

## Development Workflow

```bash
hugo server          # local dev server with live reload
hugo build           # production build → public/
wrangler pages deploy public/   # deploy to Cloudflare Pages
```

## Linting

```bash
markdownlint-cli2 "**/*.md"   # lint all markdown files
```

Configuration: `.markdownlint.yaml` — line length 120, inline HTML allowed.
