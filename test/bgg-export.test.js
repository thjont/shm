'use strict';

// The text helpers in bgg-export.js decide what BGG data reaches the site, and two
// of them are load-bearing for safety: stripHtmlTags because descriptions are
// rendered with goldmark's unsafe HTML enabled, and isAllowedImageUrl because it's
// the SSRF gate on downloads.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  decodeHtmlEntities,
  stripHtmlTags,
  imageExt,
  isAllowedImageUrl,
  isRetryable,
} = require('../scripts/bgg-export.js');

test('decodeHtmlEntities handles named, decimal and hex references', () => {
  assert.equal(decodeHtmlEntities('Settlers &amp; Sons'), 'Settlers & Sons');
  assert.equal(decodeHtmlEntities('2&ndash;4 players'), '2–4 players');
  assert.equal(decodeHtmlEntities('&quot;quoted&quot;'), '"quoted"');
  assert.equal(decodeHtmlEntities('caf&#233;'), 'café');
  assert.equal(decodeHtmlEntities('caf&#xe9;'), 'café');
  assert.equal(decodeHtmlEntities('&hellip;and &mdash; more'), '…and — more');
});

test('decodeHtmlEntities leaves unknown entities and non-strings alone', () => {
  assert.equal(decodeHtmlEntities('&notanentity;'), '&notanentity;');
  assert.equal(decodeHtmlEntities(null), null);
  assert.equal(decodeHtmlEntities(undefined), undefined);
  assert.equal(decodeHtmlEntities(42), 42);
});

test('stripHtmlTags removes markup', () => {
  assert.equal(stripHtmlTags('plain text'), 'plain text');
  assert.equal(stripHtmlTags('a <b>bold</b> claim'), 'a bold claim');
  assert.equal(stripHtmlTags('line<br/>break'), 'linebreak');
  assert.equal(stripHtmlTags('<p class="x">para</p>'), 'para');
});

test('stripHtmlTags leaves no complete tag behind, however nested the input', () => {
  // This is the property that matters: descriptions are rendered with goldmark's
  // unsafe HTML enabled, so nothing of the form <…> may survive. The output need
  // not be tidy — stray text and lone '>' characters are fine, they're inert.
  const adversarial = [
    '<sc<x>ript>alert(1)</sc<x>ript>',
    '<scr<script>ipt>alert(1)',
    '<<>script>x',
    '<img src=x onerror=alert(1)>',
    '<a href="<b>">y</a>',
    '<div',            // unterminated: no tag, nothing to strip
    'a < b and c > d', // not markup, but see the pinned behaviour below
  ];
  for (const input of adversarial) {
    assert.doesNotMatch(stripHtmlTags(input), /<[^>]*>/, `input ${JSON.stringify(input)}`);
  }

  // Pinned so a rewrite has to acknowledge the shape of the output, not just the
  // invariant above.
  assert.equal(stripHtmlTags('<sc<x>ript>alert(1)</sc<x>ript>'), 'ript>alert(1)ript>');
  assert.equal(stripHtmlTags(null), null);

  // Known collateral, accepted: prose that happens to contain '<' … '>' loses the
  // span between them, because that is exactly what a tag looks like. Safety wins
  // over fidelity here, and BGG descriptions rarely contain bare angle brackets.
  assert.equal(stripHtmlTags('a < b and c > d'), 'a  d');
  assert.equal(stripHtmlTags('plays best with < 5 players'), 'plays best with < 5 players',
    'a lone "<" with no later ">" is left alone');
});

test('imageExt keeps known image extensions and defaults to .jpg', () => {
  assert.equal(imageExt('https://cf.geekdo-images.com/a/pic1.png'), '.png');
  assert.equal(imageExt('https://cf.geekdo-images.com/a/pic1.JPEG'), '.jpeg');
  assert.equal(imageExt('https://cf.geekdo-images.com/a/pic1.webp'), '.webp');
  assert.equal(imageExt('https://cf.geekdo-images.com/a/pic1.svg'), '.jpg', 'unknown type');
  assert.equal(imageExt('https://cf.geekdo-images.com/a/noext'), '.jpg');
  assert.equal(imageExt('not a url'), '.jpg');
  // Query strings are common on BGG's CDN URLs.
  assert.equal(imageExt('https://cf.geekdo-images.com/a/pic1.png?imagepage=42'), '.png');
});

test('isAllowedImageUrl only accepts https BGG image hosts', () => {
  assert.equal(isAllowedImageUrl('https://geekdo-images.com/x.png'), true);
  assert.equal(isAllowedImageUrl('https://cf.geekdo-images.com/x.png'), true);

  assert.equal(isAllowedImageUrl('http://cf.geekdo-images.com/x.png'), false, 'plain http');
  assert.equal(isAllowedImageUrl('https://evil.example.com/x.png'), false);
  assert.equal(isAllowedImageUrl('https://geekdo-images.com.evil.example/x.png'), false,
    'suffix must be a real domain boundary');
  assert.equal(isAllowedImageUrl('https://notgeekdo-images.com/x.png'), false);
  assert.equal(isAllowedImageUrl('file:///etc/passwd'), false);
  assert.equal(isAllowedImageUrl('https://127.0.0.1/x.png'), false);
  assert.equal(isAllowedImageUrl(''), false);
  assert.equal(isAllowedImageUrl(null), false);
});

test('isRetryable retries throttling and server faults, not client errors', () => {
  assert.equal(isRetryable({ response: { status: 429 } }), true);
  assert.equal(isRetryable({ response: { status: 503 } }), true);
  assert.equal(isRetryable({ message: 'HTTP 429 Too Many Requests' }), true);
  assert.equal(isRetryable({ message: 'socket hang up' }), true);
  assert.equal(isRetryable({ message: 'fetch failed' }), true);

  assert.equal(isRetryable({ response: { status: 401 } }), false, 'bad token is final');
  assert.equal(isRetryable({ response: { status: 404 } }), false);
  assert.equal(isRetryable({ message: '401 Unauthorized' }), false);
  assert.equal(isRetryable({ message: 'something else entirely' }), false);
  assert.equal(isRetryable({}), false);
});
