'use strict';

// The QR sticker sheet builds its URLs with generate-qr-pdf.js's anchorize(), while
// the site's /games/<slug>/ paths come from Hugo's. If the two ever disagree, we
// print stickers that 404 — and stickers are already on boxes by the time anyone
// notices.
//
// Every expectation below was produced by Hugo 0.163.1 itself, by rendering
// {{ anchorize $name }} over this exact list. To refresh them after a Hugo
// upgrade, do the same and update the table.

const test = require('node:test');
const assert = require('node:assert/strict');

const { anchorize } = require('../scripts/generate-qr-pdf.js');

const HUGO_PAIRS = [
  // Real-world game names
  ['Codenames: Duet', 'codenames-duet'],
  ['7 Wonders', '7-wonders'],
  ['Ticket to Ride: Europe', 'ticket-to-ride-europe'],
  ['Betrayal at House on the Hill', 'betrayal-at-house-on-the-hill'],
  ["Hey, That's My Fish!", 'hey-thats-my-fish'],
  ["It's a Wonderful World", 'its-a-wonderful-world'],
  ['Tokyo Highway (Japanese edition)', 'tokyo-highway-japanese-edition'],
  ['1830: Railways & Robber Barons', '1830-railways--robber-barons'],
  ['Star Wars: X-Wing – Second Edition', 'star-wars-x-wing--second-edition'],
  ['Kill Doctor Lucky #2', 'kill-doctor-lucky-2'],
  ['Zoo Tycoon: 100% edition', 'zoo-tycoon-100-edition'],
  ['Crokinole/Carrom', 'crokinolecarrom'],

  // Non-ASCII letters are kept, not stripped — the case that used to diverge
  ['Café International', 'café-international'],
  ['Pokémon TCG', 'pokémon-tcg'],
  ['Ō-Sama', 'ō-sama'],
  ['straße', 'straße'],
  ['Æther', 'æther'],
  ['ñandú', 'ñandú'],
  ['Ångström', 'ångström'],
  ['日本語 game', '日本語-game'],
  ['Русский', 'русский'],

  // Decimal digits of any script survive; other numerals don't
  ['٣ arabic', '٣-arabic'],
  ['super²script', 'superscript'],
  ['Ⅳ roman', '-roman'],
  ['½ deck', '-deck'],

  // Separators and whitespace
  ['MiXeD CaSe', 'mixed-case'],
  ['a  b', 'a--b'],
  ['multi---hyphen', 'multi---hyphen'],
  ['under_score', 'under_score'],
  ['ends-', 'ends-'],
  ['-starts', '-starts'],
  [' leading', 'leading'],
  ['trailing ', 'trailing'],
  ['tab\tsep', 'tabsep'],

  // Symbols and punctuation are dropped
  ['plus+plus', 'plusplus'],
  ['dot.dot', 'dotdot'],
  ['curly’apostrophe', 'curlyapostrophe'],
  ['emoji 🎲 game', 'emoji--game'],
  ['n°5', 'n5'],
  ['co-op & fun', 'co-op--fun'],
];

test('anchorize matches Hugo for every recorded name', () => {
  for (const [name, expected] of HUGO_PAIRS) {
    assert.equal(anchorize(name), expected, `anchorize(${JSON.stringify(name)})`);
  }
});

test('anchorize output is stable under repetition', () => {
  // A slug fed back through must not change, or a re-export could rename pages.
  for (const [, slug] of HUGO_PAIRS) {
    assert.equal(anchorize(slug), slug, `anchorize is not idempotent for ${slug}`);
  }
});

test('anchorize never emits characters that are invalid in a scan slug', () => {
  // functions/_lib/play-handler.js gates writes on /^[a-z0-9-]{1,64}$/, so an
  // ASCII name must produce something that regex accepts.
  const asciiNames = HUGO_PAIRS
    .map(([name]) => name)
    .filter(name => /^[\x20-\x7E]+$/.test(name));

  for (const name of asciiNames) {
    const slug = anchorize(name);
    if (slug === '') continue;
    assert.match(slug, /^[a-z0-9_-]+$/, `anchorize(${JSON.stringify(name)}) = ${slug}`);
  }
});
