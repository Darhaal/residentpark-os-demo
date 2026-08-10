// Title: Live Schema Export Script
// Path: scripts/export-schema.mjs
// Functionality: Read-only inventory export of the Supabase `public` schema, used to
//   reconcile the live schema against the migration archive. Connects with
//   SUPABASE_DB_URL, runs entirely inside a READ ONLY transaction (no mutation is
//   possible), and writes a timestamped Markdown inventory under supabase/inventory/.
//   Catalog metadata only — no table data, no secrets.
//
// Usage: node scripts/export-schema.mjs [outFile]

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

function readDbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  if (!existsSync('.env.local')) return '';
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1 || trimmed.slice(0, eq).trim() !== 'SUPABASE_DB_URL') continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return '';
}

function withoutSslMode(raw) {
  try {
    const u = new URL(raw);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('uselibpqcompat');
    return u.toString();
  } catch {
    return raw;
  }
}

const QUERIES = {
  tables: `SELECT table_name FROM information_schema.tables
           WHERE table_schema='public' AND table_type='BASE TABLE'
           ORDER BY table_name`,
  columns: `SELECT table_name, column_name, data_type, is_nullable, column_default
            FROM information_schema.columns WHERE table_schema='public'
            ORDER BY table_name, ordinal_position`,
  constraints: `SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def
                FROM pg_constraint WHERE connamespace='public'::regnamespace
                ORDER BY tbl, conname`,
  indexes: `SELECT tablename, indexname, indexdef FROM pg_indexes
            WHERE schemaname='public' ORDER BY tablename, indexname`,
  rls: `SELECT c.relname, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
        FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r'
        ORDER BY c.relname`,
  policies: `SELECT tablename, policyname, cmd, roles::text AS roles, qual, with_check
             FROM pg_policies WHERE schemaname='public'
             ORDER BY tablename, policyname`,
  functions: `SELECT p.proname,
                     pg_get_function_identity_arguments(p.oid) AS args,
                     p.prosecdef AS security_definer,
                     COALESCE(array_to_string(p.proconfig, ', '), '') AS config
              FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
              ORDER BY p.proname, args`,
  triggers: `SELECT event_object_table AS tbl, trigger_name, action_timing,
                    event_manipulation, action_statement
             FROM information_schema.triggers WHERE trigger_schema='public'
             ORDER BY tbl, trigger_name, event_manipulation`,
  table_grants: `SELECT table_name, grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privs
                 FROM information_schema.role_table_grants
                 WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role')
                 GROUP BY table_name, grantee ORDER BY table_name, grantee`,
  function_grants: `SELECT routine_name, grantee, privilege_type
                    FROM information_schema.role_routine_grants
                    WHERE routine_schema='public' AND grantee IN ('anon','authenticated','service_role')
                    ORDER BY routine_name, grantee`,
};

function table(rows, columns) {
  if (rows.length === 0) return '_none_\n';
  const head = `| ${columns.join(' | ')} |`;
  const sep = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((r) => `| ${columns.map((c) => String(r[c] ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')).join(' | ')} |`)
    .join('\n');
  return `${head}\n${sep}\n${body}\n`;
}

const url = readDbUrl();
if (!url) {
  console.error('No SUPABASE_DB_URL found in env or .env.local');
  process.exit(2);
}

const isLocal = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({
  connectionString: isLocal ? url : withoutSslMode(url),
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

const date = new Date().toISOString().slice(0, 10);
const outFile = process.argv[2] ?? `supabase/inventory/live-schema-${date}.md`;

await client.connect();
try {
  // Hard guarantee: no statement in this session can write.
  await client.query('BEGIN');
  await client.query('SET TRANSACTION READ ONLY');

  const results = {};
  for (const [key, sql] of Object.entries(QUERIES)) {
    results[key] = (await client.query(sql)).rows;
  }

  // Optional: Supabase CLI migration metadata (absent in the baseline+applied workflow).
  let migrations = [];
  let migrationsNote = 'No `supabase_migrations.schema_migrations` table (expected — this project uses baseline + applied archive, not the CLI migration chain).';
  try {
    migrations = (await client.query('SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version')).rows;
    migrationsNote = `\`supabase_migrations.schema_migrations\` present with ${migrations.length} row(s).`;
  } catch {
    /* table absent — keep the note above */
  }

  await client.query('ROLLBACK');

  const host = (() => { try { return new URL(url).host; } catch { return 'unknown'; } })();
  const lines = [];
  lines.push(`# Live Supabase Schema Inventory`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()} (read-only export via \`scripts/export-schema.mjs\`)`);
  lines.push(`Source host: \`${host}\` · schema: \`public\``);
  lines.push('');
  lines.push('Catalog metadata only — no table data. Reconciliation artifact: compare it');
  lines.push('against `supabase/baseline/baseline.sql` + the applied migration archive.');
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`- Tables: ${results.tables.length}`);
  lines.push(`- Functions: ${results.functions.length} (SECURITY DEFINER: ${results.functions.filter((f) => f.security_definer).length})`);
  lines.push(`- RLS policies: ${results.policies.length}`);
  lines.push(`- Triggers: ${results.triggers.length}`);
  lines.push(`- ${migrationsNote}`);
  lines.push('');
  lines.push(`## Tables`);
  lines.push('');
  lines.push(table(results.tables, ['table_name']));
  lines.push(`## Columns`);
  lines.push('');
  lines.push(table(results.columns, ['table_name', 'column_name', 'data_type', 'is_nullable', 'column_default']));
  lines.push(`## Constraints`);
  lines.push('');
  lines.push(table(results.constraints, ['tbl', 'conname', 'def']));
  lines.push(`## Indexes`);
  lines.push('');
  lines.push(table(results.indexes, ['tablename', 'indexname', 'indexdef']));
  lines.push(`## Row-Level Security (per table)`);
  lines.push('');
  lines.push(table(results.rls, ['relname', 'rls_enabled', 'rls_forced']));
  lines.push(`## RLS Policies`);
  lines.push('');
  lines.push(table(results.policies, ['tablename', 'policyname', 'cmd', 'roles', 'qual', 'with_check']));
  lines.push(`## Functions`);
  lines.push('');
  lines.push(table(results.functions, ['proname', 'args', 'security_definer', 'config']));
  lines.push(`## Triggers`);
  lines.push('');
  lines.push(table(results.triggers, ['tbl', 'trigger_name', 'action_timing', 'event_manipulation', 'action_statement']));
  lines.push(`## Table Grants (anon / authenticated / service_role)`);
  lines.push('');
  lines.push(table(results.table_grants, ['table_name', 'grantee', 'privs']));
  lines.push(`## Function EXECUTE Grants (anon / authenticated / service_role)`);
  lines.push('');
  lines.push(table(results.function_grants, ['routine_name', 'grantee', 'privilege_type']));
  if (migrations.length > 0) {
    lines.push(`## CLI Migration Metadata`);
    lines.push('');
    lines.push(table(migrations, ['version', 'name']));
  }

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`wrote inventory: ${outFile}`);
  console.log(`  tables=${results.tables.length} functions=${results.functions.length} policies=${results.policies.length} triggers=${results.triggers.length}`);
} finally {
  await client.end();
}
