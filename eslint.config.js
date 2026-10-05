// packages
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'smoke-out', 'docs/mocks']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
  },
  {
    // Smoke checks hand callbacks to page.evaluate/waitForFunction, which run in the browser.
    files: ['scripts/smoke.mjs'],
    languageOptions: { globals: globals.browser },
  },
]);
