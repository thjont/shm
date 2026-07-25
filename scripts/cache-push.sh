#!/usr/bin/env bash
# Publish the local shiny-hoppy-meeple/data/bgg-cache and static/images/games
# directories (plus the derived static/qr-codes.pdf) to the bgg-cache-<stage>
# branch, without disturbing the current checkout. Writes changed=true|false
# to $GITHUB_OUTPUT if it's set.
#
# The branch holds a SNAPSHOT, not a history: each push replaces it with a single
# parentless commit and force-pushes. Appending commits meant every daily run added
# another copy of any changed binary image forever, and history on derived data is
# worth little beyond last-known-good — which the snapshot is. The trade-off is that
# you can't check out yesterday's cache; re-running the export rebuilds it from BGG.
set -euo pipefail

STAGE="${1:?usage: cache-push.sh <prod|stage|dev>}"
BRANCH="bgg-cache-$STAGE"
cd "$(dirname "$0")/.."
WT=".cache-wt-$STAGE"

rm -rf "$WT"
# Forced, explicit refspec: the branch is rewritten on every push, so a plain
# fetch of the tracking ref would be a non-fast-forward update and could be
# rejected — which would look like "branch missing" further down.
git fetch --force origin "refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" 2>/dev/null || true

if git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
  git worktree add -q -B "$BRANCH" "$WT" "origin/$BRANCH"
else
  git worktree add -q --detach "$WT"
  (cd "$WT" && git checkout -q --orphan "$BRANCH" && git rm -rq -f . >/dev/null 2>&1 || true)
fi

mkdir -p "$WT/shiny-hoppy-meeple/data" "$WT/shiny-hoppy-meeple/static/images"
rm -rf "$WT/shiny-hoppy-meeple/data/bgg-cache" "$WT/shiny-hoppy-meeple/static/images/games"
cp -r shiny-hoppy-meeple/data/bgg-cache "$WT/shiny-hoppy-meeple/data/"
cp -r shiny-hoppy-meeple/static/images/games "$WT/shiny-hoppy-meeple/static/images/"

# qr-codes.pdf is derived from the main-library collection (update-bgg-cache.yml
# regenerates it), so it travels with the cache rather than living on main.
rm -f "$WT/shiny-hoppy-meeple/static/qr-codes.pdf"
if [ -f shiny-hoppy-meeple/static/qr-codes.pdf ]; then
  cp shiny-hoppy-meeple/static/qr-codes.pdf "$WT/shiny-hoppy-meeple/static/"
fi

git -C "$WT" add -A
if git -C "$WT" diff --cached --quiet; then
  echo "No BGG cache changes for $STAGE."
  echo "changed_${STAGE}=false" >> "${GITHUB_OUTPUT:-/dev/null}"
else
  # commit-tree with no -p makes a root commit, so the pushed branch is one commit
  # deep however many times this has run.
  TREE=$(git -C "$WT" write-tree)
  COMMIT=$(git -C "$WT" \
    -c user.name="github-actions[bot]" \
    -c user.email="github-actions[bot]@users.noreply.github.com" \
    commit-tree "$TREE" -m "chore: update BGG cache ($STAGE)")
  git -C "$WT" push -q --force origin "$COMMIT:refs/heads/$BRANCH"
  echo "changed_${STAGE}=true" >> "${GITHUB_OUTPUT:-/dev/null}"
fi

git worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"
