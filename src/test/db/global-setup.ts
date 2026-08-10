// Title: Global Setup DB Test Helper
// Path: src/test/db/global-setup.ts
// Functionality: Shared database test harness support for Supabase authorization checks.

// Vitest globalSetup for DB tests: load env + apply the schema once.

import { createClient } from '@supabase/supabase-js';
import { loadEnvFile } from './env';
import { loadSchema } from './schema';

// Poll the REST API until it can actually see `profiles`. PostgREST caches the schema
// at startup and reloads asynchronously, so the first `.from(...)` calls can otherwise
// race the reload and get an empty cache (every read returns nothing). In CI the schema
// is preloaded and PostgREST is restarted before this runs (see ci.yml); locally,
// loadSchema NOTIFYs a reload. Either way we wait here until the table is queryable.
async function waitForApiSchema(): Promise<void> {
  const url = process.env.TEST_SUPABASE_URL;
  const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let lastError = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    const { error } = await client.from('profiles').select('id').limit(1);
    if (!error) return;
    lastError = `${error.message} (code ${error.code ?? 'n/a'})`;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.warn(`[db tests] PostgREST never exposed public.profiles after 30s — last error: ${lastError}`);
}

export default async function globalSetup(): Promise<void> {
  loadEnvFile();
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    console.warn('[db tests] TEST_DATABASE_URL not set — schema load skipped; DB tests will be skipped.');
    return;
  }
  // In CI the workflow replays formal migrations and restarts PostgREST before the suite,
  // so skip the in-process load there (re-running the chain would hit existing tables).
  if (process.env.DB_TEST_SCHEMA_PRELOADED !== '1') {
    await loadSchema(databaseUrl);
  }
  await waitForApiSchema();
}
