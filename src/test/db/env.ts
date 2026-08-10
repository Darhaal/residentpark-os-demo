// Title: Env DB Test Helper
// Path: src/test/db/env.ts
// Functionality: Shared database test harness support for Supabase authorization checks.

// Loads test-DB credentials from .env.test.local (gitignored) into process.env.
// Never commit real keys — this only reads a local, untracked file.

import { existsSync, readFileSync } from 'node:fs';

export function loadEnvFile(path = '.env.test.local'): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export interface DbTestEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
  databaseUrl: string;
}

export function dbEnv(): DbTestEnv {
  return {
    url: process.env.TEST_SUPABASE_URL ?? '',
    anonKey: process.env.TEST_SUPABASE_ANON_KEY ?? '',
    serviceKey: process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? '',
    databaseUrl: process.env.TEST_DATABASE_URL ?? '',
  };
}

export function hasDbEnv(): boolean {
  const e = dbEnv();
  return Boolean(e.url && e.anonKey && e.serviceKey && e.databaseUrl);
}
