import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'shiny-hoppy-meeple/themes/**',
      'shiny-hoppy-meeple/public/**',
      'shiny-hoppy-meeple/resources/**',
      'shiny-hoppy-meeple/data/**',
      // wrangler's generated bundles. Gitignored, so CI never sees them, but they
      // survive a killed `wrangler pages dev` and would otherwise fail local lint.
      '**/.wrangler/**',
    ],
  },
  js.configs.recommended,
  {
    // scripts/*.js — Node CLI scripts. Mostly CommonJS, a couple use ESM import/export;
    // 'module' sourceType parses both, since `require`/`module` are still just globals.
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    // test/**/*.test.js — node:test suites for the scripts above (CommonJS).
    files: ['test/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
  {
    // shiny-hoppy-meeple/functions/**/*.js — Cloudflare Pages Functions (ESM, Workers runtime)
    files: ['shiny-hoppy-meeple/functions/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.worker,
    },
  },
  {
    // Plain browser scripts, loaded via <script src>. They live in assets/ and go
    // through Hugo's minify+fingerprint pipeline; static/js is matched too so a file
    // served verbatim from there still lints as browser code rather than falling
    // back to the default globals (which is silently every `document` undefined).
    files: [
      'shiny-hoppy-meeple/assets/js/**/*.js',
      'shiny-hoppy-meeple/static/js/**/*.js',
    ],
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser,
    },
  },
];
