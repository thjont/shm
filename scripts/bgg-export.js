#!/usr/bin/env node
'use strict';

const { parseArgs } = require('node:util');
const { BggXmlApiClient } = require('bgg-xml-api-client');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { URL } = require('node:url');

const PROJECT_DIR = path.join(__dirname, '..', 'shiny-hoppy-meeple');
const DEFAULT_DATA_DIR = path.join(PROJECT_DIR, 'data');
const DEFAULT_IMAGE_DIR = path.join(PROJECT_DIR, 'static', 'images', 'games');
const DEFAULT_IMAGE_URL_BASE = '/images/games';
const GAME_BATCH_SIZE = 20;
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const USER_AGENT = 'shiny-hoppy-meeple-export/1.0 (+https://shiny-hoppy-meeple.pages.dev)';

// BGG serves box art at its original size — up to 3000×4302 / 3.3 MB — while the
// detail page never renders the hero wider than the content column. Downscale and
// re-encode at export time so the deployed image is the one the page needs.
const HERO_MAX_WIDTH = 900;
const WEBP_QUALITY = 80;

const USAGE = `\
Export a BGG user collection or geeklist and game details to JSON, with local images.

Usage:
  BGG_API_TOKEN=<token> node bgg_export.js --library main-library
  BGG_API_TOKEN=<token> BGG_USERNAME=<user> node bgg_export.js [options]
  BGG_API_TOKEN=<token> node bgg_export.js --geeklist <id> [options]

Options:
  --library SLUG          Read geeklist/username from definitions/libraries/<slug>.json
  --geeklist ID           Import a BGG geeklist by ID instead of a user collection
  --data-dir PATH         Root data directory (default: shiny-hoppy-meeple/data)
  --image-dir PATH        Directory to download images into
  --image-url-base PATH   Public URL prefix written into JSON (default: /images/games)
  --collection-file PATH  Override output path for collection JSON
  --skip-existing-games   Skip game detail fetch for games already cached
  --skip-images           Don't download images; keep remote BGG URLs
  --force-images          Re-download images even if already present
  --help                  Show this help message

Game hero images are downscaled to at most ${HERO_MAX_WIDTH}px wide and re-encoded as
WebP (quality ${WEBP_QUALITY}); thumbnails are stored as downloaded.
`;

// --- SSRF protection ---

function isAllowedImageUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname;
    return host === 'geekdo-images.com' || host.endsWith('.geekdo-images.com');
  } catch {
    return false;
  }
}

function imageExt(url) {
  try {
    const suffix = path.extname(new URL(url).pathname).toLowerCase();
    return IMAGE_EXTS.has(suffix) ? suffix : '.jpg';
  } catch {
    return '.jpg';
  }
}

// --- HTML entity decoding ---

const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', copy: '©', reg: '®',
  ndash: '–', mdash: '—', hellip: '…',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»',
  times: '×', divide: '÷',
  bull: '•', middot: '·',
};

function decodeHtmlEntities(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/g, (match, dec, hex, name) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return HTML_ENTITIES[name] ?? match;
  });
}

// Descriptions are rendered by Hugo with goldmark's unsafe HTML enabled, and the
// entity decode above can turn e.g. &lt;script&gt; into a live tag — so no markup
// may survive the export. BGG descriptions are plain text with entities, so
// dropping tags loses nothing. Iterate because stripping can splice new tags
// together (e.g. "<sc<x>ript>").
function stripHtmlTags(str) {
  if (typeof str !== 'string') return str;
  let prev;
  do {
    prev = str;
    str = str.replace(/<[^>]*>/g, '');
  } while (str !== prev);
  return str;
}

// --- Field mapping ---

function mapCollectionItem(item) {
  const ratingValue = item.stats?.rating?.value;
  return {
    id: Number(item.objectid),
    name: decodeHtmlEntities(item.name?.text ?? item.name),
    year: item.yearpublished ?? null,
    thumbnail: item.thumbnail ?? null,
    owned:        Number(item.status?.own ?? 0) === 1,
    prev_owned:   Number(item.status?.prevowned ?? 0) === 1,
    for_trade:    Number(item.status?.fortrade ?? 0) === 1,
    want:         Number(item.status?.want ?? 0) === 1,
    want_to_play: Number(item.status?.wanttoplay ?? 0) === 1,
    want_to_buy:  Number(item.status?.wanttobuy ?? 0) === 1,
    wishlist:     Number(item.status?.wishlist ?? 0) === 1,
    wishlist_priority: item.status?.wishlistpriority ?? null,
    preordered:   Number(item.status?.preordered ?? 0) === 1,
    rating:    (ratingValue && ratingValue !== 'N/A') ? Number(ratingValue) : null,
    numplays:  Number(item.numplays ?? 0),
    comment:   decodeHtmlEntities(item.comment) ?? null,
    last_modified: item.status?.lastmodified ?? null,
  };
}

function mapGame(thing) {
  const names = [].concat(thing.name ?? []);
  const links = [].concat(thing.link ?? []);
  return {
    id:   Number(thing.id),
    name: decodeHtmlEntities(names.find(n => n.type === 'primary')?.value ?? names[0]?.value ?? ''),
    year: thing.yearpublished?.value ?? null,
    thumbnail: thing.thumbnail ?? null,
    image:     thing.image ?? null,
    image_width:  null,
    image_height: null,
    description: stripHtmlTags(decodeHtmlEntities(thing.description ?? null)),
    min_players: Number(thing.minplayers?.value ?? 0),
    max_players: Number(thing.maxplayers?.value ?? 0),
    playing_time: Number(thing.playingtime?.value ?? 0),
    min_age: Number(thing.minage?.value ?? 0),
    type: thing.type ?? null,
    expansion: thing.type === 'boardgameexpansion',
    categories: links.filter(l => l.type === 'boardgamecategory').map(l => decodeHtmlEntities(l.value)),
    mechanics:  links.filter(l => l.type === 'boardgamemechanic').map(l => decodeHtmlEntities(l.value)),
    rating_bayes_average: Number(thing.statistics?.ratings?.bayesaverage?.value ?? 0),
    rating_average_weight: Number(thing.statistics?.ratings?.averageweight?.value ?? 0),
  };
}

function mapGeeklistItems(data) {
  return [].concat(data.item ?? [])
    .filter(i => i.objecttype === 'thing')
    .map(i => ({ id: Number(i.objectid), name: i.objectname ?? '' }));
}

// --- ImageDownloader ---

// Dimensions of an already-cached image, so a skipped download still yields the
// width/height the template needs. Best-effort: an unreadable file just loses them.
async function imageDimensions(file) {
  try {
    const { width, height } = await sharp(file).metadata();
    return { width, height };
  } catch {
    return {};
  }
}

class ImageDownloader {
  constructor(imageDir, urlBase, enabled, force) {
    this.imageDir = imageDir;
    this.urlBase = urlBase.replace(/\/$/, '');
    this.enabled = enabled;
    this.force = force;
    this.downloaded = 0;
    this.skipped = 0;
    this.failed = 0;
    this.superseded = 0;
    if (enabled) fs.mkdirSync(imageDir, { recursive: true });
  }

  // Returns { url, width?, height? } or null. Pass maxWidth to downscale and
  // re-encode as WebP; without it the source bytes are stored verbatim.
  async fetch(gameId, url, variant = '', maxWidth = null) {
    if (!this.enabled || !url) return null;

    if (!isAllowedImageUrl(url)) {
      process.stderr.write(`  Warning: refusing non-BGG image URL: ${url}\n`);
      this.failed++;
      return null;
    }

    // Resizing re-encodes, so the cached extension no longer follows the source URL.
    const expectedExt = maxWidth ? '.webp' : imageExt(url);
    const cached = path.join(this.imageDir, `${gameId}${variant}${expectedExt}`);

    if (fs.existsSync(cached) && !this.force) {
      this.skipped++;
      return {
        url: `${this.urlBase}/${path.basename(cached)}`,
        ...(maxWidth ? await imageDimensions(cached) : {}),
      };
    }

    let source;
    try {
      source = await this.download(url);
    } catch (err) {
      process.stderr.write(`  Warning: image download failed (${url}): ${err.message}\n`);
      this.failed++;
      return null;
    }

    const { data, ext, width, height } = await this.encode(source, url, maxWidth);
    const filename = `${gameId}${variant}${ext}`;
    try {
      fs.writeFileSync(path.join(this.imageDir, filename), data);
    } catch (err) {
      process.stderr.write(`  Warning: could not write ${filename}: ${err.message}\n`);
      this.failed++;
      return null;
    }
    this.removeOtherFormats(gameId, variant, filename);
    this.downloaded++;
    return { url: `${this.urlBase}/${filename}`, width, height };
  }

  async download(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
  }

  // Falls back to the original bytes if sharp can't handle the image — an
  // oversized hero beats a missing one. The next run retries the resize, since
  // the expected `.webp` still won't be on disk.
  async encode(source, url, maxWidth) {
    if (!maxWidth) return { data: source, ext: imageExt(url) };
    try {
      const { data, info } = await sharp(source)
        // Bake in EXIF orientation: browsers honour it on the original, but the
        // re-encode drops the metadata, which would leave a rotated source sideways.
        .rotate()
        .resize({ width: maxWidth, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      return { data, ext: '.webp', width: info.width, height: info.height };
    } catch (err) {
      process.stderr.write(`  Warning: resize failed (${url}): ${err.message} — keeping original\n`);
      return { data: source, ext: imageExt(url) };
    }
  }

  // Re-encoding renames `224037.png` to `224037.webp`; the old file would
  // otherwise sit on the cache branch forever, because cleanup-stale-cache.js
  // only prunes images whose game id is no longer referenced at all.
  removeOtherFormats(gameId, variant, keep) {
    for (const ext of IMAGE_EXTS) {
      const filename = `${gameId}${variant}${ext}`;
      if (filename === keep) continue;
      const stale = path.join(this.imageDir, filename);
      if (fs.existsSync(stale)) {
        fs.rmSync(stale);
        this.superseded++;
      }
    }
  }

  summary() {
    if (this.enabled) {
      console.log(
        `  Images: ${this.downloaded} downloaded, ` +
        `${this.skipped} already present, ${this.failed} failed` +
        (this.superseded ? `, ${this.superseded} superseded removed` : '')
      );
    }
  }
}

// --- Export functions ---

async function exportCollection(username, client, dataDir, images, collectionFile) {
  console.log('Fetching BGG collection …');
  const response = await client.getBggCollection({
    username,
    subtype: 'boardgame',
    own: 1,
    stats: 1,
  });

  const rawItems = [].concat(response.item ?? []);
  const items = [];

  for (const raw of rawItems) {
    const mapped = mapCollectionItem(raw);
    const remoteThumbnail = mapped.thumbnail;
    const localThumb = await images.fetch(mapped.id, remoteThumbnail, '-thumb');
    mapped.thumbnail = localThumb?.url ?? remoteThumbnail;
    mapped.thumbnail_source = remoteThumbnail;
    items.push(mapped);
  }

  const outPath = collectionFile
    ?? path.join(dataDir, 'bgg-cache', 'collections', 'main-library.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ count: items.length, items }, null, 2));
  console.log(`  Saved ${items.length} items → ${outPath}`);
  return items.map(i => i.id);
}

async function exportGeeklist(geeklistId, client, dataDir, images, collectionFile) {
  console.log(`Fetching geeklist ${geeklistId} …`);
  const response = await client.getBggGeeklist({ id: geeklistId });
  const geeklistItems = mapGeeklistItems(response);
  const items = geeklistItems.map(gi => ({ id: gi.id, name: gi.name, thumbnail: null }));

  const outPath = collectionFile
    ?? path.join(dataDir, 'bgg-cache', 'collections', 'main-library.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ count: items.length, items }, null, 2));
  console.log(`  Saved ${items.length} items → ${outPath}`);
  return items.map(i => i.id);
}

async function exportGames(gameIds, client, dataDir, images, skipExisting) {
  const gamesDir = path.join(dataDir, 'bgg-cache', 'games');
  fs.mkdirSync(gamesDir, { recursive: true });

  if (skipExisting) {
    gameIds = gameIds.filter(id => !fs.existsSync(path.join(gamesDir, `${id}.json`)));
    if (!gameIds.length) {
      console.log('  All games already cached — skipping game detail fetch.');
      return 0;
    }
    console.log(`  ${gameIds.length} new game(s) to fetch.`);
  }

  const total = gameIds.length;
  let saved = 0;
  let failedBatches = 0;

  for (let start = 0; start < total; start += GAME_BATCH_SIZE) {
    const batch = gameIds.slice(start, start + GAME_BATCH_SIZE);
    console.log(`Fetching games ${start + 1}–${start + batch.length} of ${total} …`);

    let response;
    try {
      response = await client.getBggThing({ id: batch, stats: 1 });
    } catch (err) {
      // Keep going so the rest of the collection still refreshes, but count it:
      // main() turns any failure into a non-zero exit so callers can tell a
      // complete refresh from a partial one.
      process.stderr.write(`  Warning: batch failed — ${err.message}\n`);
      failedBatches++;
      continue;
    }

    const things = [].concat(response.item ?? []);
    for (const thing of things) {
      const game = mapGame(thing);
      const remoteImage = game.image;
      const remoteThumbnail = game.thumbnail;

      const localImage = await images.fetch(game.id, remoteImage, '', HERO_MAX_WIDTH);
      const localThumb = await images.fetch(game.id, remoteThumbnail, '-thumb');

      game.thumbnail = localThumb?.url ?? remoteThumbnail;
      game.thumbnail_source = remoteThumbnail;
      game.image = localImage?.url ?? remoteImage;
      game.image_source = remoteImage;
      game.image_width = localImage?.width ?? null;
      game.image_height = localImage?.height ?? null;

      fs.writeFileSync(
        path.join(gamesDir, `${game.id}.json`),
        JSON.stringify(game, null, 2)
      );
      saved++;
    }
  }

  console.log(`  Saved ${saved} game files → ${gamesDir}/`);
  return failedBatches;
}

// --- Main ---

async function main() {
  const { values } = parseArgs({
    options: {
      library:              { type: 'string' },
      geeklist:             { type: 'string' },
      'data-dir':           { type: 'string' },
      'image-dir':          { type: 'string' },
      'image-url-base':     { type: 'string' },
      'collection-file':    { type: 'string' },
      'skip-existing-games': { type: 'boolean', default: false },
      'skip-images':        { type: 'boolean', default: false },
      'force-images':       { type: 'boolean', default: false },
      help:                 { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (values.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  const dataDir   = values['data-dir']       ?? DEFAULT_DATA_DIR;
  const imageDir  = values['image-dir']      ?? DEFAULT_IMAGE_DIR;
  const imageBase = values['image-url-base'] ?? DEFAULT_IMAGE_URL_BASE;
  let collectionFile = values['collection-file'] ?? null;
  let geeklistId = values.geeklist ? Number(values.geeklist) : null;

  if (values.library && values.geeklist) {
    process.stderr.write('Error: --library and --geeklist are mutually exclusive.\n');
    process.exit(1);
  }

  const token    = process.env.BGG_API_TOKEN ?? '';
  let   username = process.env.BGG_USERNAME  ?? null;

  if (values.library) {
    const defPath = path.join(dataDir, 'definitions', 'libraries', `${values.library}.json`);
    if (!fs.existsSync(defPath)) {
      process.stderr.write(`Error: library definition not found: ${defPath}\n`);
      process.exit(1);
    }
    const defn = JSON.parse(fs.readFileSync(defPath, 'utf8'));
    if ('geeklist' in defn) {
      geeklistId = Number(defn.geeklist);
    } else if ('username' in defn) {
      username = defn.username;
    } else {
      process.stderr.write(`Error: ${defPath} must have a 'geeklist' or 'username' field\n`);
      process.exit(1);
    }
    if (!collectionFile) {
      collectionFile = path.join(dataDir, 'bgg-cache', 'collections', `${values.library}.json`);
    }
  }

  if (!geeklistId && !username) {
    process.stderr.write(
      'Error: BGG_USERNAME environment variable not set (required for collection mode)\n'
    );
    process.exit(1);
  }

  if (!token) {
    process.stderr.write(
      'No BGG_API_TOKEN set — attempting keyless access (BGG may reject this with a 401).\n'
    );
  }

  const client = new BggXmlApiClient(token);
  const images = new ImageDownloader(
    imageDir, imageBase, !values['skip-images'], values['force-images']
  );

  let failedBatches = 0;
  try {
    let gameIds;
    if (geeklistId) {
      gameIds = await exportGeeklist(geeklistId, client, dataDir, images, collectionFile);
    } else {
      gameIds = await exportCollection(username, client, dataDir, images, collectionFile);
    }
    failedBatches = await exportGames(gameIds, client, dataDir, images, values['skip-existing-games']);
  } catch (err) {
    if (err.response?.status === 401 || /401|Unauthorized/i.test(err.message)) {
      process.stderr.write(
        'Error: BGG returned 401 Unauthorized — a valid BGG_API_TOKEN is required. Set it and retry.\n'
      );
      process.exit(1);
    }
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  images.summary();

  // Partial data is still written and kept — the cache stays stale-but-complete
  // — but the exit code has to say so, or a wholly failed export deploys green.
  // Image failures stay warning-level: a missing hero degrades one page, a
  // missing batch silently freezes up to 20 games' data.
  if (failedBatches) {
    process.stderr.write(
      `Error: ${failedBatches} game batch(es) failed — cached data for those games is unchanged.\n`
    );
    process.exit(1);
  }

  console.log('Done.');
}

main();
