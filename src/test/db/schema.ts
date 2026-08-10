// Title: Schema DB Test Helper
// Path: src/test/db/schema.ts
// Functionality: Shared database test harness support for Supabase authorization checks.

// Loads the canonical Supabase CLI migration chain into the test DB.

import { readFileSync, readdirSync } from 'node:fs';
import { Client } from 'pg';

const MIGRATION_FILES = readdirSync('supabase/migrations')
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => `supabase/migrations/${file}`);

const SCHEMA_FILES = [
  ...MIGRATION_FILES,
  // Test-only: grant service_role access that a real Supabase project provides via
  // platform defaults (baseline only grants authenticated/anon).
  'src/test/db/service-role-grants.sql',
];

export async function loadSchema(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const file of SCHEMA_FILES) {
      await client.query(readFileSync(file, 'utf8'));
    }
    // We loaded the tables via raw SQL, so PostgREST (the Supabase REST API that the
    // test clients use) still has its pre-load schema cached. Without this reload,
    // `.from('profiles')` and friends resolve against an empty cache and return
    // nothing. NOTIFY on the default PostgREST channel triggers a schema reload.
    await client.query("NOTIFY pgrst, 'reload schema'");
  } finally {
    await client.end();
  }
}
