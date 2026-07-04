# Google Services Setup

This guide sets up the Google Calendar integration (events page) and Google Sheets integration (member collections and
shadow libraries).

Both integrations share the same Google Cloud project and service account.

---

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it (e.g. `shiny-hoppy-meeple`) and click **Create**
4. Make sure the new project is selected in the dropdown before continuing

---

## 2. Enable APIs

1. In the left menu go to **APIs & Services → Library**
2. Search for and enable each of these:
   - **Google Calendar API**
   - **Google Sheets API**

---

## 3. Create a service account

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → Service account**
3. Fill in a name (e.g. `site-reader`) — the ID and description fill automatically
4. Click **Create and Continue**
5. Skip the optional role and user access steps — click **Done**

---

## 4. Download the JSON key

1. On the **Credentials** page, click the service account you just created
2. Go to the **Keys** tab
3. Click **Add Key → Create new key**
4. Choose **JSON** and click **Create**
5. A `.json` file downloads automatically — keep it safe, you will need its contents shortly

The file looks like this:

```json
{
  "type": "service_account",
  "project_id": "shiny-hoppy-meeple",
  "private_key_id": "...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "client_email": "site-reader@shiny-hoppy-meeple.iam.gserviceaccount.com",
  ...
}
```

Note the `client_email` value — you need it in steps 6 and 8.

---

## 5. Create the Google Calendar

Skip this step if you already have a calendar you want to use.

1. Go to [calendar.google.com](https://calendar.google.com)
2. In the left sidebar under **Other calendars**, click **+**
3. Choose **Create new calendar**
4. Give it a name (e.g. `Shiny Hoppy Meeple Events`) and click **Create calendar**

---

## 6. Share the calendar with the service account

The service account needs read access to fetch events.

1. In Google Calendar, find your calendar in the left sidebar
2. Click the three-dot menu next to it → **Settings and sharing**
3. Scroll to **Share with specific people or groups**
4. Click **+ Add people** and enter the `client_email` from the JSON key (e.g. `site-reader@shiny-hoppy-meeple.iam.gserviceaccount.com`)
5. Set permission to **See all event details** and click **Send**

---

## 7. Get the calendar ID

On the same settings page, scroll to **Integrate calendar**. Copy the **Calendar ID** — it looks like either:

- Your email address (for your primary calendar)
- A long string like `abc123xyz@group.calendar.google.com` (for other calendars)

---

## 8. Create the Google Sheets spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Name it (e.g. `Shiny Hoppy Meeple — Site Data`)
3. Rename the first sheet tab to **Members** and add tabs named **Shadow Libraries** and **Game Overrides**

**Members** tab — add these headers in row 1:

| slug | display_name | description | username | geeklist |
|------|--------------|-------------|----------|----------|

**Shadow Libraries** tab — add these headers in row 1:

| slug | display_name | username | geeklist |
|------|--------------|----------|----------|

**Game Overrides** tab — add these headers in row 1:

| game_id | learn_to_play_video | description |
|---------|---------------------|-------------|

Column rules:

- `slug` — lowercase letters, numbers, and hyphens only (e.g. `jt`, `main-shadow-library`)
- `username` and `geeklist` are mutually exclusive — fill one, leave the other blank
- `description` is optional for members and game overrides; not used for shadow libraries
- `geeklist` must be a numeric ID (find it in the BGG GeekList URL)
- `game_id` must be a numeric BGG game ID; at least one of `learn_to_play_video` or `description` must be filled
- `learn_to_play_video` — YouTube video ID only (the part after `v=` in the URL, e.g. `dQw4w9WgXcQ`)

---

## 9. Share the spreadsheet with the service account

1. Click **Share** in the top-right corner of the spreadsheet
2. Enter the `client_email` from the JSON key
3. Set the role to **Viewer** and click **Send**

---

## 10. Get the spreadsheet ID

Copy the spreadsheet ID from the URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

The ID is the long string between `/d/` and `/edit`.

---

## 11. Add GitHub Actions secrets

Go to your GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**.

Add these secrets:

| Name | Value |
| ------ | ------- |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The full contents of the JSON key file downloaded in step 4 |
| `GOOGLE_CALENDAR_ID` | The Calendar ID copied in step 7 |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | The spreadsheet ID copied in step 10 |

For `GOOGLE_SERVICE_ACCOUNT_KEY`, paste the entire JSON content including the outer `{ }` braces.

---

## 12. Test locally (optional)

**Calendar sync:**

```bash
cd shiny-hoppy-meeple

export GOOGLE_CALENDAR_ID="your-calendar-id-here"
export GOOGLE_SERVICE_ACCOUNT_KEY='{ "type": "service_account", ... }'

node calendar-sync.js
# → calendar.json written (N events).

hugo server
# → visit http://localhost:1313/events/
```

**Sheets sync:**

```bash
cd shiny-hoppy-meeple

export GOOGLE_SHEETS_SPREADSHEET_ID="your-spreadsheet-id-here"
export GOOGLE_SERVICE_ACCOUNT_KEY='{ "type": "service_account", ... }'

node sheets-sync.js
# → members and shadow library definitions written to data/definitions/
```

---

## Done

The next deployment will automatically sync from Google Calendar and Google Sheets before building the site.

- **Events** — add or edit in Google Calendar; appear on `/events/` after the next deploy
- **Members** — add or edit rows in the Members sheet tab; picked up on the next BGG cache update
- **Shadow libraries** — add or edit rows in the Shadow Libraries sheet tab; picked up on the next BGG cache update
- **Game overrides** — add or edit rows in the Game Overrides sheet tab; picked up on the next deploy

---

## Stage environment (optional)

The stage environment can use its own calendar and spreadsheet, so content can be tested there without
touching production data. The main library (`data/definitions/libraries/main-library.json`) is committed
to the repo and shared by every environment regardless — only members, shadow libraries, and game
overrides differ per environment.

1. Repeat steps 5–10 above to create a second calendar and spreadsheet (spreadsheet: **File → Make a
   copy** of the prod one is fastest — it keeps the tabs/headers, but sharing does not carry over, so
   re-share the copy).
2. Reuse the **same service account** — just share both new resources with its `client_email` too.
3. Add two more GitHub Actions secrets instead of the ones in step 11:
   - `GOOGLE_CALENDAR_ID_STAGE`
   - `GOOGLE_SHEETS_SPREADSHEET_ID_STAGE`
