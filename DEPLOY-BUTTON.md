# Manual Deploy Button

A small standalone Google Apps Script Web App with two buttons — **Deploy Prod** and **Deploy
Stage** — for maintainers who edit the Google Sheet or Calendar but don't have GitHub accounts.
Clicking a button calls GitHub's API to dispatch `update-bgg-cache.yml` for that environment only.

Source: `google-apps-script/deploy-button/Code.gs` and `index.html`.

It's deployed as a standalone script (not bound to the spreadsheet) and run with **"Execute as:
Me"**, so it always uses the site admin's authorization regardless of who clicks the button.
Visitors only ever see the rendered page — never the script source or the GitHub token. This is
why it's a separate Web App rather than a custom menu added to the spreadsheet: anyone with Editor
access to the sheet can usually open Extensions → Apps Script and read Script Properties on a
bound script, which would expose the token.

## Setup

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Rename it (e.g. "Shiny Hoppy Meeple Deploy Button").
3. Replace the default `Code.gs` content with `google-apps-script/deploy-button/Code.gs` from this
   repo, editing `OWNER`/`REPO` at the top to match this repository.
4. Add a new HTML file named `index` (**File → New → HTML**) and paste in
   `google-apps-script/deploy-button/index.html`.
5. **Project Settings → Script Properties → Add script property**: name `GITHUB_TOKEN`, value a
   GitHub personal access token (see below). Never put the token in the script source.
6. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone within [your Workspace domain]** if you have one, otherwise
     **Anyone with the link** (the link itself is then the only access control — don't post it
     publicly)
7. Copy the deployment URL and share it with maintainers.

## GitHub token

Create a **fine-grained personal access token** (Settings → Developer settings → Personal access
tokens → Fine-grained tokens) scoped to just this repository, with **Actions: Read and write**
permission and nothing else. Set an expiration and rotate it periodically — update the
`GITHUB_TOKEN` script property when you do.

## How it works

Each button calls the GitHub API's `workflow_dispatch` endpoint for `update-bgg-cache.yml` with an
`inputs.target` of `prod` or `stage`, so it only runs (and deploys) that environment's leg. A
30-second per-target cooldown (stored in Script Properties) guards against accidental double-clicks
— it's not a debounce for rapid edits, just a shield against submitting the same click twice.

Because the workflow runs unconditionally on manual dispatch (it only skips the build/deploy step
on the unattended nightly cron when nothing changed), clicking the button always redeploys — even
for a sheet-only edit that doesn't touch the BGG cache.
