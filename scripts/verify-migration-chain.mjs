// Title: Formal Migration Chain Verifier
// Path: scripts/verify-migration-chain.mjs
// Functionality: Proves that Supabase CLI migrations mirror baseline plus numbered applied SQL byte-for-byte.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const baselineFile = 'supabase/baseline/baseline.sql';
const appliedDirectory = 'supabase/applied';
const migrationsDirectory = 'supabase/migrations';
const baselineVersion = 20260613000000n;

const appliedFiles = readdirSync(appliedDirectory)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort();

const errors = [];
const expectedMigrations = new Map([
  [`${baselineVersion}_baseline.sql`, baselineFile],
]);

appliedFiles.forEach((file, index) => {
  const expectedOrdinal = index + 1;
  const sourceOrdinal = Number(file.slice(0, 4));
  if (sourceOrdinal !== expectedOrdinal) {
    errors.push(`Expected applied/${String(expectedOrdinal).padStart(4, '0')}, found ${file}`);
    return;
  }

  const version = baselineVersion + BigInt(sourceOrdinal);
  expectedMigrations.set(`${version}_${file.slice(5)}`, join(appliedDirectory, file));
});

const actualMigrations = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const expectedNames = Array.from(expectedMigrations.keys()).sort();

for (const name of expectedNames) {
  if (!actualMigrations.includes(name)) {
    errors.push(`Missing migration: ${name}`);
    continue;
  }

  const source = readFileSync(expectedMigrations.get(name));
  const migration = readFileSync(join(migrationsDirectory, name));
  if (!source.equals(migration)) errors.push(`Migration differs from source: ${name}`);
}

const lastMirroredVersion = baselineVersion + BigInt(appliedFiles.length);
const forwardMigrations = [];
const forwardVersions = new Set();
for (const name of actualMigrations) {
  if (expectedMigrations.has(name)) continue;
  const match = name.match(/^(\d{14})_.+\.sql$/);
  if (!match || BigInt(match[1]) <= lastMirroredVersion) {
    errors.push(`Invalid forward migration name/version: ${name}`);
    continue;
  }
  if (forwardVersions.has(match[1])) {
    errors.push(`Duplicate forward migration version: ${match[1]}`);
    continue;
  }
  forwardVersions.add(match[1]);
  if (readFileSync(join(migrationsDirectory, name)).length === 0) {
    errors.push(`Forward migration is empty: ${name}`);
    continue;
  }
  forwardMigrations.push(name);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`[migrations] ${error}`);
  process.exit(1);
}

console.log(
  `[migrations] verified ${expectedNames.length} mirrored files `
  + `(baseline + ${appliedFiles.length} applied) and ${forwardMigrations.length} forward migration(s)`,
);
