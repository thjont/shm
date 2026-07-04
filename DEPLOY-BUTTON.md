# Manual Deploy Button

A small standalone Google Apps Script Web App with two buttons — **Deploy Prod** and **Deploy
Stage** — for maintainers who edit the Google Sheet or Calendar but don't have GitHub accounts.
Clicking a button calls GitHub's API to dispatch `update-bgg-cache.yml` for that environment only.

Source: `google-apps-script/deploy-button/Code.gs` and `index.html`.

It's deployed as a standalone script (not bound to the spreadsheet), which is why it's a separate
Web App rather than a custom menu added to the spreadsheet: anyone with Editor access to the sheet
can usually open Extensions → Apps Script and read Script Properties on a bound script, which would
expose the GitHub token.

There's no Google Workspace domain here (personal Gmail accounts), so there's no built-in "anyone
in our org" access option. Instead the app is deployed as **"Execute as: User accessing the web
app"** + **"Anyone with a Google account"**, which forces a Google login, and `isAuthorized_()` in
`Code.gs` additionally checks the visiting email against an `ALLOWED_EMAILS` script property —
otherwise "anyone with a Google account" really does mean anyone on the internet with a Gmail
address. Because it runs as the visiting user rather than the owner, each maintainer will see a
one-time "Google hasn't verified this app" warning the first time they open it — expected, since
this is a small internal tool, not something worth going through Google's app-verification process
for. They click **Advanced → Go to [project name] (unsafe)** once and it won't ask again.

## Setup

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Rename it (e.g. "Shiny Hoppy Meeple Deploy Button").
3. Replace the default `Code.gs` content with `google-apps-script/deploy-button/Code.gs` from this
   repo, editing `OWNER`/`REPO` at the top to match this repository.
4. Add a new HTML file named `index` (**File → New → HTML**) and paste in
   `google-apps-script/deploy-button/index.html`.
5. **Project Settings → Script Properties → Add script property**:
   - `GITHUB_TOKEN` — a GitHub personal access token (see below). Never put this in the script
     source.
   - `ALLOWED_EMAILS` — comma-separated list of maintainer Gmail addresses allowed to use the
     button, e.g. `alice@gmail.com,bob@gmail.com`.
6. **Deploy → New deployment → Web app**:
   - Execute as: **User accessing the web app**
   - Who has access: **Anyone with a Google account**
7. Copy the deployment URL and share it with the maintainers on the `ALLOWED_EMAILS` list.

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
