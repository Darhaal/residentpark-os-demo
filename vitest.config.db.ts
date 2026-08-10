// Title: Database Vitest Configuration
// Path: vitest.config.db.ts
// Functionality: Database authorization test configuration for Supabase-backed integration checks.

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// DB authorization tests. Require a disposable Supabase (local CLI or staging) —
// see src/test/db/README.md. Without .env.test.local they are skipped.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/db/**/*.db.test.ts'],
    setupFiles: ['src/test/db/setup-env.ts'],
    globalSetup: ['src/test/db/global-setup.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
