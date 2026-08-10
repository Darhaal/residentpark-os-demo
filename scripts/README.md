# Operational scripts

Node ESM scripts for working with the live (or local) database. Each reads the
target database from `.env.local` / `.env.test.local` (gitignored) — credentials
are never printed or committed.

| Script | npm command | What it does | Writes to DB? |
|---|---|---|---|
| `verify-security.mjs` | `npm run verify:security` | Read-only security-posture audit (20 checks): profiles lock, RLS on all tables, SECDEF `search_path`, anon EXECUTE surface, RPC-only writes. Exits non-zero on any failure. | No (READ ONLY) |
| `apply-sql.mjs` | `node scripts/apply-sql.mjs <file.sql>` | Applies one reviewed SQL file (the file owns its `BEGIN/COMMIT`). Used to apply migrations from `supabase/pending/`. | Yes |
| `seed-demo.mjs` | `npm run seed:demo` | Seeds a demonstrable dataset (see below). Re-runnable: clears prior `@demo.local` users + demo domain rows first. | Yes |

## DB target resolution

- `verify-security.mjs` / `apply-sql.mjs`: `SUPABASE_DB_URL` (env or `.env.local`),
  falling back to `TEST_DATABASE_URL` / `.env.test.local`.
- `seed-demo.mjs`: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (GoTrue
  admin API for auth users) and `SUPABASE_DB_URL` (domain rows).

## Demo seed contents (`seed:demo`)

- 6 apartments (`A-101…A-302`), 4 occupied + 2 vacant.
- 7 accounts, all password `SEED_PASSWORD` (see .env.example) (demo only — rotate before real use):
  `sam.super@demo.local` (superadmin), `mia.admin@demo.local` (admin),
  `alice/bob/carol/dave@demo.local` (approved residents),
  `erin.pending@demo.local` (pending resident).
- 4 vehicles (3 approved + 1 pending), 12 parking spots (4 assigned / 1 blocked / 7 available),
  4 active parking assignments, a `building_settings` row.

Non-demo accounts already in the database are left untouched.

## Safety

These can target **production** (`.env.local` points at the live project). `verify:security`
is always read-only. `apply-sql` and `seed:demo` write — review the SQL / seed data first.
Migrations are applied per the workflow in [`../supabase/applied/README.md`](../supabase/applied/README.md).
