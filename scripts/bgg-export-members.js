// Usage: node .github/scripts/bgg-export-members.js [--skip-existing-games]
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const skipExisting = process.argv.includes('--skip-existing-games');
const dataDir = 'shiny-hoppy-meeple/data';
const membersDir = join(dataDir, 'definitions', 'members');

for (const file of readdirSync(membersDir).filter(f => f.endsWith('.json')).sort()) {
  const defn = JSON.parse(readFileSync(join(membersDir, file), 'utf8'));
  const slug = defn.slug ?? basename(file, '.json');
  const out  = join(dataDir, 'bgg-cache', 'collections', `${slug}.json`);

  let cmd, env;
  if ('geeklist' in defn) {
    cmd = ['node', 'scripts/bgg-export.js', '--geeklist', String(defn.geeklist), '--collection-file', out];
  } else if ('username' in defn) {
    cmd = ['node', 'scripts/bgg-export.js', '--collection-file', out];
    env = { ...process.env, BGG_USERNAME: defn.username };
  } else {
    console.error(`::warning::No geeklist or username in ${file}`);
    continue;
  }

  if (skipExisting) cmd.push('--skip-existing-games');
  console.log(`--- member: ${slug}`);
  const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env: env ?? process.env });
  if (r.status !== 0) console.error(`::warning::Export failed for member '${slug}'`);
}
