'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const KEY_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const OUT_PATH = path.join(__dirname, '..', 'shiny-hoppy-meeple', 'data', 'calendar.json');
const CONTENT_DIR = path.join(__dirname, '..', 'shiny-hoppy-meeple', 'content', 'events');

if (!CALENDAR_ID || !KEY_JSON) {
  console.warn('GOOGLE_CALENDAR_ID or GOOGLE_SERVICE_ACCOUNT_KEY not set — writing empty calendar.json');
  fs.writeFileSync(OUT_PATH, '[]');
  process.exit(0);
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toDateString(dt) {
  if (!dt) return null;
  return dt.date || dt.dateTime.slice(0, 10);
}

function formatTime(dateTimeStr) {
  if (!dateTimeStr) return null;
  const match = dateTimeStr.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m === '00' ? `${h}${ampm}` : `${h}:${m}${ampm}`;
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function generateStub(ev) {
  const title = ev.summary.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const lines = [`+++`, `title = "${title}"`, `+++`, ''];

  if (ev.description) {
    lines.push(ev.description, '');
  }

  return lines.join('\n');
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
    if (endDate === startDate) {
      const d = new Date(endDate + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      endDate = d.toISOString().slice(0, 10);
    }
    return {
      summary: e.summary || '',
      slug: slugify(e.summary || ''),
      startDate,
      endDate,
      startTime: formatTime(e.start.dateTime),
      endTime: formatTime(e.end.dateTime),
      location: e.location || null,
      description: stripHtml(e.description),
    };
  });

  fs.writeFileSync(OUT_PATH, JSON.stringify(events, null, 2));
  console.log(`calendar.json written (${events.length} events).`);

  // Generate stub content pages for events that don't have one yet
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const seen = new Set();
  for (const ev of events) {
    if (seen.has(ev.slug)) continue;
    seen.add(ev.slug);

    const filePath = path.join(CONTENT_DIR, `${ev.slug}.md`);
    if (fs.existsSync(filePath)) continue;

    fs.writeFileSync(filePath, generateStub(ev));
    console.log(`Created content/events/${ev.slug}.md`);
  }
}

main().catch(err => {
  console.error('calendar-sync failed:', err.message);
  process.exit(1);
});
