# Google Calendar Setup

This guide sets up the Google Calendar integration for the `/events/` page.

---

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it (e.g. `shiny-hoppy-meeple`) and click **Create**
4. Make sure the new project is selected in the dropdown before continuing

---

## 2. Enable the Google Calendar API

1. In the left menu go to **APIs & Services → Library**
2. Search for **Google Calendar API** and click it
3. Click **Enable**

---

## 3. Create a service account

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → Service account**
3. Fill in a name (e.g. `calendar-reader`) — the ID and description fill automatically
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
  "client_email": "calendar-reader@shiny-hoppy-meeple.iam.gserviceaccount.com",
  ...
}
```

Note the `client_email` value — you need it in step 6.

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
4. Click **+ Add people** and enter the `client_email` from the JSON key (e.g. `calendar-reader@shiny-hoppy-meeple.iam.gserviceaccount.com`)
5. Set permission to **See all event details** and click **Send**

---

## 7. Get the calendar ID

On the same settings page, scroll to **Integrate calendar**. Copy the **Calendar ID** — it looks like either:

- Your email address (for your primary calendar)
- A long string like `abc123xyz@group.calendar.google.com` (for other calendars)

---

## 8. Add GitHub Actions secrets

Go to your GitHub repository → **Settings → Secrets and variables → Actions → New repository secret**.

Add these two secrets:

| Name | Value |
|------|-------|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The full contents of the JSON key file downloaded in step 4 |
| `GOOGLE_CALENDAR_ID` | The Calendar ID copied in step 7 |

For `GOOGLE_SERVICE_ACCOUNT_KEY`, paste the entire JSON content including the outer `{ }` braces.

---

## 9. Test locally (optional)

If you want to test the sync before pushing:

```bash
cd shiny-hoppy-meeple

export GOOGLE_CALENDAR_ID="your-calendar-id-here"
export GOOGLE_SERVICE_ACCOUNT_KEY='{ "type": "service_account", ... }'

node calendar-sync.js
# → calendar.json written (N events).

hugo server
# → visit http://localhost:1313/events/
```

---

## Done

The next deployment will automatically sync events from your Google Calendar before building the site. Events appear on the `/events/` page in the 3-month rolling calendar view.

To add or edit events, use Google Calendar normally — they appear on the site after the next deploy or scheduled rebuild.
