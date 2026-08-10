// Title: Vitest Configuration
// Path: vitest.config.ts
// Functionality: Unit and component test configuration for fast local checks.

import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Default (unit) test run. DB authorization tests live in src/test/db and run via
// `npm run test:db` (vitest.config.db.ts) — excluded here so unit tests and CI stay
// green without a database.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Default to node; component tests opt into jsdom with a `@vitest-environment jsdom`
    // docblock so the pure unit tests keep running in the lighter node environment.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, 'src/test/db/**'],
  },
});
