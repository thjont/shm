'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const KEY_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const DEFINITIONS_DIR = path.join(__dirname, 'data', 'definitions');

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

if (!SPREADSHEET_ID || !KEY_JSON) {
  console.warn('GOOGLE_SHEETS_SPREADSHEET_ID or GOOGLE_SERVICE_ACCOUNT_KEY not set — skipping sheets sync');
  process.exit(0);
}

function parseRows(values) {
  if (!values || values.length < 2) return [];
  const [headers, ...rows] = values;
  return rows
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
      return obj;
    })
    .filter(row => row.slug);
}

function validateRow(row, context) {
  if (!SLUG_RE.test(row.slug)) {
    console.warn(`${context}: skipping row — invalid slug ${JSON.stringify(row.slug)}`);
    return false;
  }
  if (!row.username && !row.geeklist) {
    console.warn(`${context} ${row.slug}: skipping row — no username or geeklist`);
    return false;
  }
  if (row.geeklist && !/^\d+$/.test(row.geeklist)) {
    console.warn(`${context} ${row.slug}: skipping row — geeklist must be numeric`);
    return false;
  }
  return true;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(KEY_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const [membersRes, librariesRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Members' }),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Shadow Libraries' }),
  ]);

  const members = parseRows(membersRes.data.values);
  const libraries = parseRows(librariesRes.data.values);

  const membersDir = path.join(DEFINITIONS_DIR, 'members');
  fs.mkdirSync(membersDir, { recursive: true });

  let memberCount = 0;
  for (const row of members) {
    if (!validateRow(row, 'member')) continue;
    const data = { slug: row.slug, display_name: row.display_name };
    if (row.description) data.description = row.description;
    if (row.username) data.username = row.username;
    if (row.geeklist) data.geeklist = parseInt(row.geeklist, 10);
    fs.writeFileSync(
      path.join(membersDir, `${row.slug}.json`),
      JSON.stringify(data, null, 4) + '\n'
    );
    console.log(`member: ${row.slug}`);
    memberCount++;
  }

  const librariesDir = path.join(DEFINITIONS_DIR, 'libraries');
  fs.mkdirSync(librariesDir, { recursive: true });

  // Copy the static main-library.json if it exists in the repo
  const mainLibSrc = path.join(librariesDir, 'main-library.json');
  if (!fs.existsSync(mainLibSrc)) {
    console.warn('main-library.json not found — it must be committed to the repo');
  }

  let libraryCount = 0;
  for (const row of libraries) {
    if (!validateRow(row, 'shadow library')) continue;
    const data = { slug: row.slug, display_name: row.display_name };
    if (row.username) data.username = row.username;
    if (row.geeklist) data.geeklist = parseInt(row.geeklist, 10);
    fs.writeFileSync(
      path.join(librariesDir, `${row.slug}.json`),
      JSON.stringify(data, null, 4) + '\n'
    );
    console.log(`shadow library: ${row.slug}`);
    libraryCount++;
  }

  console.log(`sheets-sync done: ${memberCount} members, ${libraryCount} shadow libraries.`);
}

main().catch(err => {
  console.error('sheets-sync failed:', err.message);
  process.exit(1);
});
