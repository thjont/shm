'use strict';

// parseRows and validateRow decide which sheet rows become member, library and
// override definitions — and, because the sync deletes definitions before
// rewriting them, what parseRows returns for an empty tab decides whether a whole
// environment gets wiped. See the ALLOW_EMPTY guard in sheets-sync.js.

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseRows, validateRow } = require('../scripts/sheets-sync.js');

const HEADERS = ['slug', 'display_name', 'username', 'geeklist'];

test('parseRows maps rows onto their headers', () => {
  const rows = parseRows([HEADERS, ['ada', 'Ada', 'ada_bgg', '']]);
  assert.deepEqual(rows, [
    { slug: 'ada', display_name: 'Ada', username: 'ada_bgg', geeklist: '' },
  ]);
});

test('parseRows returns [] for an empty or header-only tab', () => {
  // The empty-sheet guard depends on exactly this: no error, no rows.
  assert.deepEqual(parseRows([HEADERS]), []);
  assert.deepEqual(parseRows([]), []);
  assert.deepEqual(parseRows(null), []);
  assert.deepEqual(parseRows(undefined), []);
});

test('parseRows trims cells and tolerates short rows', () => {
  const rows = parseRows([HEADERS, ['  ada  ', ' Ada Lovelace ', '', '12345']]);
  assert.deepEqual(rows[0], {
    slug: 'ada', display_name: 'Ada Lovelace', username: '', geeklist: '12345',
  });
  // A row that stops early still yields empty strings, not undefined.
  const short = parseRows([HEADERS, ['bob']]);
  assert.deepEqual(short[0], { slug: 'bob', display_name: '', username: '', geeklist: '' });
});

test('parseRows drops rows with no value in the key column', () => {
  const rows = parseRows([HEADERS, ['', 'No Slug', 'x', ''], ['ada', 'Ada', 'x', '']]);
  assert.deepEqual(rows.map(r => r.slug), ['ada']);
});

test('parseRows honours an alternative key column', () => {
  const values = [['game_id', 'description'], ['224037', 'A co-op'], ['', 'orphan']];
  assert.deepEqual(parseRows(values, 'game_id').map(r => r.game_id), ['224037']);
});

test('validateRow accepts a member with either source', () => {
  assert.equal(validateRow({ slug: 'ada', username: 'ada_bgg' }, 'member'), true);
  assert.equal(validateRow({ slug: 'ada', geeklist: '12345' }, 'member'), true);
  assert.equal(validateRow({ slug: 'a-b-1', username: 'x' }, 'member'), true);
});

test('validateRow rejects malformed slugs', () => {
  const bad = ['Ada', 'ada bloggs', '-leading', 'trailing_', 'ünïcode', '', 'a/b'];
  for (const slug of bad) {
    assert.equal(validateRow({ slug, username: 'x' }, 'member'), false, `slug ${JSON.stringify(slug)}`);
  }
});

test('validateRow rejects a row with no BGG source or a non-numeric geeklist', () => {
  assert.equal(validateRow({ slug: 'ada' }, 'member'), false);
  assert.equal(validateRow({ slug: 'ada', username: '', geeklist: '' }, 'member'), false);
  assert.equal(validateRow({ slug: 'ada', geeklist: 'abc' }, 'member'), false);
  assert.equal(validateRow({ slug: 'ada', geeklist: '12a' }, 'member'), false);
});
