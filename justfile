# shiny-hoppy-meeple task runner

# List available recipes
default:
    @just --list

# ── Onboarding ─────────────────────────────────────────────────────────────────

# Install Node.js dependencies
setup:
    npm install

# Update the PaperMod theme submodule
update-theme:
    git submodule update --init --recursive

# ── Development ────────────────────────────────────────────────────────────────

# Start Hugo dev server with live reload on :1313
serve:
    cd shiny-hoppy-meeple && hugo server --bind 0.0.0.0

# Build site into shiny-hoppy-meeple/public/
build:
    cd shiny-hoppy-meeple && hugo --minify

# Start Pages Functions + KV dev server (requires a prior `just build`)
dev:
    cd shiny-hoppy-meeple && wrangler pages dev public

# Run markdownlint on all Markdown files
lint:
    npm run lint

# Check Hugo build without writing to disk
check:
    cd shiny-hoppy-meeple && hugo --renderToMemory

# Run lint and Hugo build check
validate: lint check

# ── Deployment ─────────────────────────────────────────────────────────────────

# Build and deploy to production Cloudflare Pages
deploy: build
    cd shiny-hoppy-meeple && wrangler pages deploy

# Build and deploy a named preview branch
deploy-preview branch: build
    cd shiny-hoppy-meeple && wrangler pages deploy --branch {{branch}}

# ── Content scaffolding ────────────────────────────────────────────────────────

# Create a new post stub (slug should be kebab-case)
new-post slug:
    cd shiny-hoppy-meeple && hugo new content posts/{{slug}}/index.md

# Create an empty BGG game override file (id = BGG game ID)
new-game id:
    @mkdir -p shiny-hoppy-meeple/data/definitions/games-bgg-override
    @echo '{}' > shiny-hoppy-meeple/data/definitions/games-bgg-override/{{id}}.json
    @echo "Created data/definitions/games-bgg-override/{{id}}.json"

# ── Cloudflare KV ──────────────────────────────────────────────────────────────

# List all keys in the SCANS KV namespace
kv-list:
    cd shiny-hoppy-meeple && wrangler kv key list --binding SCANS

# Get a value from the SCANS KV namespace
kv-get key:
    cd shiny-hoppy-meeple && wrangler kv key get --binding SCANS "{{key}}"

# Put a value into the SCANS KV namespace
kv-put key value:
    cd shiny-hoppy-meeple && wrangler kv key put --binding SCANS "{{key}}" "{{value}}"
