import { readdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const dataDir = 'shiny-hoppy-meeple/data';
const collectionsDir = join(dataDir, 'bgg-cache', 'collections');
const gamesDir = join(dataDir, 'bgg-cache', 'games');
const imagesDir = 'shiny-hoppy-meeple/static/images/games';

// 1. Build valid slugs from definitions + hardcoded main-library
const validSlugs = new Set(['main-library']);
for (const dir of ['members', 'libraries']) {
  const defsDir = join(dataDir, 'definitions', dir);
  if (existsSync(defsDir)) {
    for (const f of readdirSync(defsDir).filter(f => f.endsWith('.json'))) {
      validSlugs.add(basename(f, '.json'));
    }
  }
}

// 2. Delete stale collection caches
if (existsSync(collectionsDir)) {
  for (const f of readdirSync(collectionsDir).filter(f => f.endsWith('.json')).sort()) {
    if (!validSlugs.has(basename(f, '.json'))) {
      console.log(`Removing stale collection: ${f}`);
      rmSync(join(collectionsDir, f));
    }
  }
}

// 3. Build referenced IDs from remaining collection files
const referencedIds = new Set();
if (existsSync(collectionsDir)) {
  for (const f of readdirSync(collectionsDir).filter(f => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(readFileSync(join(collectionsDir, f), 'utf8'));
      for (const item of data.items ?? []) {
        if (item.id != null) referencedIds.add(String(item.id));
      }
    } catch (e) {
      console.error(`::warning::Could not parse ${f}: ${e.message}`);
    }
  }
}

// 4. Delete stale game caches
if (existsSync(gamesDir)) {
  for (const f of readdirSync(gamesDir).filter(f => f.endsWith('.json')).sort()) {
    if (!referencedIds.has(basename(f, '.json'))) {
      console.log(`Removing stale game: ${f}`);
      rmSync(join(gamesDir, f));
    }
  }
}

// 5. Delete stale game images (id is stem prefix before first '-' or '.')
if (existsSync(imagesDir)) {
  for (const f of readdirSync(imagesDir).sort()) {
    const id = f.split(/[-.]/)[0];
    if (!referencedIds.has(id)) {
      console.log(`Removing stale image: ${f}`);
      rmSync(join(imagesDir, f));
    }
  }
}
