'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const KEY_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const OUT_PATH = path.join(__dirname, 'data', 'calendar.json');

if (!CALENDAR_ID || !KEY_JSON) {
  console.warn('GOOGLE_CALENDAR_ID or GOOGLE_SERVICE_ACCOUNT_KEY not set — writing empty calendar.json');
  fs.writeFileSync(OUT_PATH, '[]');
  process.exit(0);
}

function toDateString(dt) {
  if (!dt) return null;
  return dt.date || dt.dateTime.slice(0, 10);
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(KEY_JSON),
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  const cal = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString();

  const res = await cal.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = (res.data.items || []).map(e => {
    const startDate = toDateString(e.start);
    let endDate = toDateString(e.end);
    // Timed same-day events: advance end to next day so the event renders on its day
    if (endDate === startDate) {
      const d = new Date(endDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      endDate = d.toISOString().slice(0, 10);
    }
    return {
      summary: e.summary || '',
      startDate,
      endDate,
      location: e.location || null,
    };
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify(events, null, 2));
  console.log(`calendar.json written (${events.length} events).`);
}

main().catch(err => {
  console.error('calendar-sync failed:', err.message);
  process.exit(1);
});
