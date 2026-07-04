#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseArgs } = require('util');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const MM = 2.8346; // 1 mm in points
const PAGE_MARGIN = 10 * MM;
const CELL_PADDING = 4 * MM;
const QR_QUIET_ZONE = 2; // modules of white border around the code

const DEFAULT_COLLECTION = path.resolve(
  __dirname, '../shiny-hoppy-meeple/data/bgg-cache/collections/main-library.json'
);
const DEFAULT_BASE_URL = 'https://shiny-hoppy-meeple.pages.dev/';
const DEFAULT_PATH_PREFIX = 'learn-to-play';
const DEFAULT_OUTPUT = path.resolve(
  __dirname, '../shiny-hoppy-meeple/static/qr-codes.pdf'
);

function anchorize(name) {
  let out = '';
  for (const ch of name.toLowerCase()) {
    if (ch === ' ')                              out += '-';
    else if (ch === '-' || /[a-z0-9]/.test(ch)) out += ch;
    // all other characters dropped
  }
  return out;
}

function loadGames(collectionPath, baseUrl, pathPrefix) {
  if (!fs.existsSync(collectionPath)) {
    process.stderr.write(`Error: collection file not found: ${collectionPath}\n`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
  const items = data.items || [];
  const base = baseUrl.replace(/\/$/, '');
  const prefix = pathPrefix.replace(/^\/|\/$/g, '');

  const games = [];
  for (const item of items) {
    const name = item.name || '';
    if (!name) continue;
    const slug = anchorize(name);
    games.push({ name, slug, url: `${base}/${prefix}/${slug}/` });
  }
  return games;
}

function crossCheckSlugs(games, scanSlugsPath) {
  if (!fs.existsSync(scanSlugsPath)) {
    process.stderr.write(
      `  Warning: scan-slugs file not found, skipping check: ${scanSlugsPath}\n`
    );
    return;
  }
  const allowed = new Set(JSON.parse(fs.readFileSync(scanSlugsPath, 'utf8')));
  const missing = games.filter(g => !allowed.has(g.slug));
  if (missing.length) {
    process.stderr.write(
      `  Warning: ${missing.length} slug(s) not found in ${path.basename(scanSlugsPath)}:\n`
    );
    for (const g of missing) {
      process.stderr.write(`    '${g.name}' → ${g.slug}\n`);
    }
  } else {
    process.stdout.write(
      `  Slug check: all ${games.length} slugs present in ${path.basename(scanSlugsPath)}\n`
    );
  }
}

function fitFontSize(doc, text, maxWidth, startSize, minimum = 5.0) {
  let size = startSize;
  doc.fontSize(size);
  while (size > minimum && doc.widthOfString(text) > maxWidth) {
    size -= 0.5;
    doc.fontSize(size);
  }
  return size;
}

function drawQr(doc, qr, qrX, qrY, boxSize) {
  const { data, size } = qr.modules;
  const modules = size + 2 * QR_QUIET_ZONE;
  const scale = boxSize / modules;
  const origin = QR_QUIET_ZONE * scale;

  doc.fillColor('#000000');
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (data[r * size + c]) {
        const px = qrX + origin + c * scale;
        const py = qrY + origin + r * scale;
        doc.rect(px, py, scale, scale).fill();
      }
    }
  }
}

function drawCell(doc, game, x, y, width, height) {
  // Cut guide
  doc.lineWidth(0.5).rect(x, y, width, height).stroke('#cccccc');

  const innerW = width - 2 * CELL_PADDING;
  const nameSize = 9;
  const urlSize = 6;
  const nameH = nameSize + 2;
  const urlH = urlSize + 2;
  const textBlock = nameH + urlH;

  // QR fills the cell above the text block, constrained to a square
  const qrAreaH = height - 2 * CELL_PADDING - textBlock;
  const qrSize = Math.min(innerW, qrAreaH);
  const qrX = x + (width - qrSize) / 2;
  const qrY = y + CELL_PADDING;

  const qr = QRCode.create(game.url, { errorCorrectionLevel: 'M' });
  drawQr(doc, qr, qrX, qrY, qrSize);

  // Game name (bold), shrunk to fit inner width
  doc.font('Helvetica-Bold').fontSize(nameSize);
  fitFontSize(doc, game.name, innerW, nameSize);
  const nameY = y + height - CELL_PADDING - urlH - nameSize;
  doc.fillColor('#000000').text(game.name, x, nameY, {
    align: 'center',
    width,
    lineBreak: false,
  });

  // Full URL (smaller), shrunk to fit; minimum 4pt
  doc.font('Helvetica').fontSize(urlSize);
  fitFontSize(doc, game.url, innerW, urlSize, 4.0);
  const urlY = y + height - CELL_PADDING - urlSize;
  doc.fillColor('#4d4d4d').text(game.url, x, urlY, {
    align: 'center',
    width,
    lineBreak: false,
  });
}

async function buildPdf(games, outputPath, cols, rows) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const doc = new PDFDocument({ size: 'A4', autoFirstPage: true, margin: 0 });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const gridW = pageW - 2 * PAGE_MARGIN;
  const gridH = pageH - 2 * PAGE_MARGIN;
  const cellW = gridW / cols;
  const cellH = gridH / rows;
  const perPage = cols * rows;

  let pages = 0;
  for (let i = 0; i < games.length; i++) {
    const slot = i % perPage;
    if (slot === 0) {
      if (i > 0) doc.addPage();
      pages++;
    }
    const row = Math.floor(slot / cols);
    const col = slot % cols;
    const x = PAGE_MARGIN + col * cellW;
    const y = PAGE_MARGIN + row * cellH;
    drawCell(doc, games[i], x, y, cellW, cellH);
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return pages;
}

async function main() {
  const { values } = parseArgs({
    options: {
      collection:    { type: 'string' },
      'base-url':    { type: 'string' },
      'path-prefix': { type: 'string' },
      output:        { type: 'string' },
      cols:          { type: 'string' },
      rows:          { type: 'string' },
      'scan-slugs':  { type: 'string' },
      help:          { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    process.stdout.write([
      'Usage: node generate_qr_pdf.js [options]',
      '',
      'Options:',
      '  --collection <path>    Collection JSON (default: main-library.json in Hugo data dir)',
      '  --base-url <url>       Site base URL (default: https://shiny-hoppy-meeple.pages.dev/)',
      '  --path-prefix <str>    URL path prefix before slug (default: learn-to-play)',
      '  --output <path>        Output PDF path (default: shiny-hoppy-meeple/static/qr-codes.pdf)',
      '  --cols <n>             Columns per page (default: 3)',
      '  --rows <n>             Rows per page (default: 4)',
      '  --scan-slugs <path>    scan-slugs.json to cross-check generated slugs against',
      '  -h, --help             Show this help',
      '',
    ].join('\n'));
    process.exit(0);
  }

  const collectionPath = values.collection ?? DEFAULT_COLLECTION;
  const baseUrl = values['base-url'] ?? DEFAULT_BASE_URL;
  const pathPrefix = values['path-prefix'] ?? DEFAULT_PATH_PREFIX;
  const outputPath = values.output ?? DEFAULT_OUTPUT;
  const cols = parseInt(values.cols ?? '3', 10);
  const rows = parseInt(values.rows ?? '4', 10);

  const games = loadGames(collectionPath, baseUrl, pathPrefix);
  if (games.length === 0) {
    process.stderr.write(`Error: no games found in ${collectionPath}\n`);
    process.exit(1);
  }

  if (values['scan-slugs']) {
    crossCheckSlugs(games, values['scan-slugs']);
  }

  const pages = await buildPdf(games, outputPath, cols, rows);
  process.stdout.write(`  ${games.length} games → ${pages} page(s) → ${outputPath}\n`);
  process.stdout.write('Done.\n');
}

main().catch(err => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
