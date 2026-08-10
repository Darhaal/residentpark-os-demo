// Title: SQL Apply Script
// Path: scripts/apply-sql.mjs
// Functionality: Local maintenance script for applying SQL files against configured Supabase databases.

// Apply a SQL file to the database in SUPABASE_DB_URL (.env.local).
// The file is responsible for its own BEGIN/COMMIT. Used to apply reviewed
// migrations. Usage:  node scripts/apply-sql.mjs <path-to.sql>

import { existsSync, readFileSync } from 'node:fs';
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

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/apply-sql.mjs <path-to.sql>');
  process.exit(2);
}
const url = readDbUrl();
if (!url) {
  console.error('No SUPABASE_DB_URL found in env or .env.local');
  process.exit(2);
}

const sql = readFileSync(file, 'utf8');
const isLocal = /localhost|127\.0\.0\.1/.test(url);
const client = new pg.Client({
  connectionString: isLocal ? url : withoutSslMode(url),
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log(`applied: ${file}`);
} finally {
  await client.end();
}
