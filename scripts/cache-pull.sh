#!/usr/bin/env bash
# Populate shiny-hoppy-meeple/data/bgg-cache, shiny-hoppy-meeple/static/images/games
# and shiny-hoppy-meeple/static/qr-codes.pdf from the bgg-cache-<stage> branch,
# without switching the current checkout off its branch.
set -euo pipefail

STAGE="${1:?usage: cache-pull.sh <prod|stage|dev>}"
BRANCH="bgg-cache-$STAGE"
cd "$(dirname "$0")/.."

if git fetch origin "$BRANCH" --depth 1 2>/dev/null; then
  for p in shiny-hoppy-meeple/data/bgg-cache shiny-hoppy-meeple/static/images/games shiny-hoppy-meeple/static/qr-codes.pdf; do
    git checkout FETCH_HEAD -- "$p" 2>/dev/null || true
  done
  git reset -q -- shiny-hoppy-meeple/data/bgg-cache shiny-hoppy-meeple/static/images/games shiny-hoppy-meeple/static/qr-codes.pdf 2>/dev/null || true
  echo "Cache restored from $BRANCH."
else
  echo "No $BRANCH branch yet — starting with an empty cache."
fi
