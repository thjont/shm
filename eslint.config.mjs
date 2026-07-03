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
      'qr-pdf/**',
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
    // shiny-hoppy-meeple/functions/**/*.js — Cloudflare Pages Functions (ESM, Workers runtime)
    files: ['shiny-hoppy-meeple/functions/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.worker,
    },
  },
  {
    // shiny-hoppy-meeple/static/js/**/*.js — plain browser script, loaded via <script src>
    files: ['shiny-hoppy-meeple/static/js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: globals.browser,
    },
  },
];
