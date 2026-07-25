#!/usr/bin/env bash
# Populate shiny-hoppy-meeple/data/bgg-cache, shiny-hoppy-meeple/static/images/games
# and shiny-hoppy-meeple/static/qr-codes.pdf from the bgg-cache-<stage> branch,
# without switching the current checkout off its branch.
set -euo pipefail

STAGE="${1:?usage: cache-pull.sh <prod|stage|dev>}"
BRANCH="bgg-cache-$STAGE"
cd "$(dirname "$0")/.."

# Forced, explicit refspec: cache-push.sh rewrites this branch on every push, so an
# unforced fetch could be rejected as a non-fast-forward and fall through to the
# "no branch" path below — which would silently re-download the whole cache.
if git fetch --force --depth 1 origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" 2>/dev/null; then
  for p in shiny-hoppy-meeple/data/bgg-cache shiny-hoppy-meeple/static/images/games shiny-hoppy-meeple/static/qr-codes.pdf; do
    git checkout FETCH_HEAD -- "$p" 2>/dev/null || true
  done
  git reset -q -- shiny-hoppy-meeple/data/bgg-cache shiny-hoppy-meeple/static/images/games shiny-hoppy-meeple/static/qr-codes.pdf 2>/dev/null || true
  echo "Cache restored from $BRANCH."
else
  echo "No $BRANCH branch yet — starting with an empty cache."
fi
