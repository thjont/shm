'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const KEY_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const DEFINITIONS_DIR = path.join(__dirname, '..', 'shiny-hoppy-meeple', 'data', 'definitions');

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

if (!SPREADSHEET_ID || !KEY_JSON) {
  console.warn('GOOGLE_SHEETS_SPREADSHEET_ID or GOOGLE_SERVICE_ACCOUNT_KEY not set — skipping sheets sync');
  process.exit(0);
}

function parseRows(values, key = 'slug') {
  if (!values || values.length < 2) return [];
  const [headers, ...rows] = values;
  return rows
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
      return obj;
    })
    .filter(row => row[key]);
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

  const [membersRes, librariesRes, overridesRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Members' }),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Shadow Libraries' }),
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Game Overrides' }),
  ]);

  const members = parseRows(membersRes.data.values);
  const libraries = parseRows(librariesRes.data.values);
  const overrides = parseRows(overridesRes.data.values, 'game_id');

  const membersDir = path.join(DEFINITIONS_DIR, 'members');
  fs.mkdirSync(membersDir, { recursive: true });
  for (const f of fs.readdirSync(membersDir).filter(n => n.endsWith('.json'))) {
    fs.rmSync(path.join(membersDir, f));
  }

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
  for (const f of fs.readdirSync(librariesDir).filter(n => n.endsWith('.json') && n !== 'main-library.json')) {
    fs.rmSync(path.join(librariesDir, f));
  }

  if (!fs.existsSync(path.join(librariesDir, 'main-library.json'))) {
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

  const overridesDir = path.join(DEFINITIONS_DIR, 'games-bgg-override');
  fs.mkdirSync(overridesDir, { recursive: true });
  for (const f of fs.readdirSync(overridesDir).filter(n => n.endsWith('.json'))) {
    fs.rmSync(path.join(overridesDir, f));
  }

  let overrideCount = 0;
  for (const row of overrides) {
    if (!/^\d+$/.test(row.game_id)) {
      console.warn(`game override: skipping row — game_id must be numeric, got ${JSON.stringify(row.game_id)}`);
      continue;
    }
    if (!row.learn_to_play_video && !row.description) {
      console.warn(`game override ${row.game_id}: skipping row — must have learn_to_play_video or description`);
      continue;
    }
    const data = {};
    if (row.learn_to_play_video) data.learn_to_play_video = row.learn_to_play_video;
    if (row.description) data.description = row.description;
    fs.writeFileSync(
      path.join(overridesDir, `${row.game_id}.json`),
      JSON.stringify(data, null, 4) + '\n'
    );
    console.log(`game override: ${row.game_id}`);
    overrideCount++;
  }

  console.log(`sheets-sync done: ${memberCount} members, ${libraryCount} shadow libraries, ${overrideCount} game overrides.`);
}

main().catch(err => {
  console.error('sheets-sync failed:', err.message);
  process.exit(1);
});
