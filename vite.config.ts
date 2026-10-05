/// <reference types="vitest/config" />
// packages
import { defineConfig } from 'vite';

// GitHub Pages serves the game under the repository name; a self-hosted build passes BASE_PATH=/ instead.
const base = process.env.BASE_PATH ?? '/none-shall-pass/';

export default defineConfig({
  base,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      exclude: ['src/core/**/*.test.ts', 'src/core/testkit.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
