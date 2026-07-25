#!/usr/bin/env bash
# Fingerprint of everything a build takes from Google Sheets and Google Calendar:
# the generated definitions, the calendar JSON, and the event stub pages.
#
# deploy-prod.yml writes this into the BGG cache before pushing it, so the value
# travels on the cache branch and next hour's cache-pull restores it — which turns
# "did the sheet or calendar change?" into "did the cache change?", a question
# cache-push.sh already answers. The file lives inside data/bgg-cache as a DOTFILE
# on purpose: Hugo's data loader ignores dotfiles, but a plain .txt in data/ fails
# the build with "unmarshal of format is not supported".
#
# Filenames are part of the digest, so an added, removed or renamed definition
# changes the hash as well as an edited one.
set -euo pipefail
cd "$(dirname "$0")/.."

{
  find shiny-hoppy-meeple/data/definitions -type f 2>/dev/null || true
  find shiny-hoppy-meeple/content/events -type f -name '*.md' 2>/dev/null || true
  # `if`, not `[ … ] &&`: a false test as the last command in this group would be
  # the group's exit status, and with pipefail that aborts the whole script — which
  # is exactly what happens locally, where calendar-sync.js hasn't run.
  if [ -f shiny-hoppy-meeple/data/calendar.json ]; then
    echo shiny-hoppy-meeple/data/calendar.json
  fi
} | LC_ALL=C sort | xargs -r -d '\n' sha256sum | sha256sum | cut -d' ' -f1
