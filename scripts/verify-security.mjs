// Title: Security Verification Script
// Path: scripts/verify-security.mjs
// Functionality: Static verification script for secret exposure and security-sensitive build artifacts.

// Read-only verification that the P0/P1 security hardening (applied/0001 + 0006)
// is actually live on the target database.
//
// SAFETY: opens a single connection, forces `default_transaction_read_only = on`,
// and issues ONLY catalog SELECTs. No DDL/DML, no writes, no test users. The DB
// connection string is read from .env.local (SUPABASE_DB_URL) and is never printed.
//
// Usage:  node scripts/verify-security.mjs

import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

function readEnvFromFile(path, key) {
  if (!existsSync(path)) return '';
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1 || trimmed.slice(0, eq).trim() !== key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return '';
}

function readDbUrl() {
  return (
    process.env.SUPABASE_DB_URL
    || process.env.TEST_DATABASE_URL
    || readEnvFromFile('.env.local', 'SUPABASE_DB_URL')
    || readEnvFromFile('.env.test.local', 'TEST_DATABASE_URL')
    || ''
  );
}

const url = readDbUrl();
if (!url) {
  console.error('No SUPABASE_DB_URL found in env or .env.local');
  process.exit(2);
}

const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

const isLocal = /localhost|127\.0\.0\.1/.test(url);

// Drop sslmode so pg uses our explicit ssl options instead of forcing verify-full
// (Supabase presents a self-signed cert in its chain).
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

const client = new pg.Client({
  connectionString: isLocal ? url : withoutSslMode(url),
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query('SET default_transaction_read_only = on');

  // 1) profiles: authenticated may UPDATE only non-privileged columns.
  const cols = await client.query(
    `SELECT column_name FROM information_schema.role_column_grants
     WHERE table_schema='public' AND table_name='profiles'
       AND grantee='authenticated' AND privilege_type='UPDATE'
     ORDER BY column_name`,
  );
  const granted = cols.rows.map((r) => r.column_name);
  const leaked = ['role', 'approval_status', 'apartment_id', 'is_apartment_manager'].filter((c) => granted.includes(c));
  record('profiles: authenticated UPDATE limited to safe columns', leaked.length === 0,
    `granted=[${granted.join(', ')}]${leaked.length ? `  LEAKED=[${leaked.join(', ')}]` : ''}`);

  // 2) profiles: table-level INSERT/UPDATE/DELETE revoked from authenticated.
  const tbl = await client.query(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='profiles' AND grantee='authenticated'
     ORDER BY privilege_type`,
  );
  const tblPrivs = tbl.rows.map((r) => r.privilege_type);
  const badPrivs = ['INSERT', 'UPDATE', 'DELETE'].filter((p) => tblPrivs.includes(p));
  record('profiles: table-level INSERT/UPDATE/DELETE revoked from authenticated', badPrivs.length === 0,
    `table grants=[${tblPrivs.join(', ')}]`);

  // 3) RLS enabled on the core tables.
  const rls = await client.query(
    `SELECT relname, relrowsecurity FROM pg_class
     WHERE relnamespace='public'::regnamespace AND relkind='r'
       AND relname IN ('profiles','vehicles','invitations','events','apartments')
     ORDER BY relname`,
  );
  const noRls = rls.rows.filter((r) => r.relrowsecurity !== true).map((r) => r.relname);
  record('RLS enabled on core tables', rls.rows.length === 5 && noRls.length === 0,
    `${rls.rows.map((r) => `${r.relname}=${r.relrowsecurity ? 'on' : 'OFF'}`).join(', ')}`);

  // 4) profiles: own-update policy present.
  const pol = await client.query(
    `SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_own_update'`,
  );
  record('profiles: policy profiles_own_update present', pol.rowCount === 1, `found=${pol.rowCount}`);

  // 5) profiles: privilege-boundary trigger present.
  const trg = await client.query(
    `SELECT tgname FROM pg_trigger
     WHERE tgrelid='public.profiles'::regclass AND tgname='protect_profile_privileges' AND NOT tgisinternal`,
  );
  record('profiles: trigger protect_profile_privileges present', trg.rowCount === 1, `found=${trg.rowCount}`);

  // 6) Expected SECURITY DEFINER functions present + secdef.
  const expectedFns = [
    'enforce_profile_privilege_boundary',
    'tx_submit_vehicle_request',
    'tx_consume_invitation',
    'is_admin',
    'is_superadmin',
    'is_approved',
    'reconcile_identity_apartments',
    'lock_identity_apartment_state',
  ];
  const fns = await client.query(
    `SELECT proname, prosecdef FROM pg_proc
     WHERE pronamespace='public'::regnamespace AND proname = ANY($1)`,
    [expectedFns],
  );
  for (const fn of expectedFns) {
    const rows = fns.rows.filter((r) => r.proname === fn);
    const present = rows.length > 0;
    const secdef = rows.some((r) => r.prosecdef === true);
    record(`function ${fn}: present + SECURITY DEFINER`, present && secdef, present ? `secdef=${secdef}` : 'MISSING');
  }

  // 7) App RPCs must be callable by authenticated.
  const appRpcs = await client.query(
    `SELECT p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
     FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace
       AND p.proname IN ('tx_consume_invitation','tx_submit_vehicle_request')`,
  );
  for (const name of ['tx_consume_invitation', 'tx_submit_vehicle_request']) {
    const row = appRpcs.rows.find((r) => r.proname === name);
    record(`${name}: EXECUTE granted to authenticated`, Boolean(row) && row.auth_exec === true,
      row ? `authenticated=${row.auth_exec}` : 'MISSING');
  }

  // 8) EXECUTE surface: no SECURITY DEFINER function should be reachable by anon.
  const secdef = await client.query(
    `SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
     FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace AND p.prosecdef
     ORDER BY p.proname`,
  );
  // is_admin/is_superadmin/is_approved/get_auth_role are boolean RLS predicate helpers
  // that are intentionally readable by anon so policy evaluation works in every context.
  const anonAllowed = new Set(['is_admin', 'is_superadmin', 'is_approved', 'get_auth_role']);
  const anonReachable = secdef.rows
    .filter((r) => r.anon_exec === true && !anonAllowed.has(r.proname))
    .map((r) => r.proname);
  record('no privileged SECURITY DEFINER function executable by anon (RLS helpers excepted)', anonReachable.length === 0,
    anonReachable.length ? `anon can EXECUTE: [${anonReachable.join(', ')}]` : 'only RLS predicate helpers are anon-reachable');

  // 9) Severity split: anon-reachable SECDEF functions whose body has NO auth guard
  //    are the genuinely exploitable ones (anyone with the public anon key).
  const naked = await client.query(
    `SELECT proname FROM pg_proc
     WHERE pronamespace='public'::regnamespace AND prosecdef
       AND has_function_privilege('anon', oid, 'EXECUTE')
       AND prosrc !~* 'is_admin|is_superadmin|auth\\.uid|auth\\.role|FORBIDDEN|RAISE EXCEPTION'
     ORDER BY proname`,
  );
  const nakedNames = naked.rows.map((r) => r.proname);
  record('anon-reachable SECDEF functions all carry an internal auth guard', nakedNames.length === 0,
    nakedNames.length ? `NO INTERNAL GUARD + anon-executable: [${nakedNames.join(', ')}]` : 'all anon-reachable functions self-guard');

  // Diagnostic: per anon-reachable function, does the body actually check the admin role?
  const classify = await client.query(
    `SELECT proname,
            (prosrc ~* 'is_admin|is_superadmin') AS checks_role,
            (prosrc ~* 'auth\\.uid') AS checks_uid
     FROM pg_proc
     WHERE pronamespace='public'::regnamespace AND prosecdef
       AND has_function_privilege('anon', oid, 'EXECUTE')
       AND proname LIKE 'tx_%'
     ORDER BY (prosrc ~* 'is_admin|is_superadmin'), proname`,
  );
  console.log('\n-- anon-reachable tx_* functions: internal authz checks --');
  for (const r of classify.rows) {
    console.log(`   ${r.checks_role ? 'role' : '    '} ${r.checks_uid ? 'uid' : '   '}  ${r.proname}`);
  }

  // 10) Every SECURITY DEFINER function must pin a non-mutable search_path.
  const noPath = await client.query(
    `SELECT proname FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace AND p.prosecdef
       AND NOT EXISTS (
         SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS c WHERE c LIKE 'search_path=%'
       )
     ORDER BY proname`,
  );
  const noPathNames = noPath.rows.map((r) => r.proname);
  record('all SECURITY DEFINER functions pin search_path', noPathNames.length === 0,
    noPathNames.length ? `MISSING search_path: [${noPathNames.join(', ')}]` : 'all pinned');

  // 11) RLS enabled on every public base table.
  const rlsOff = await client.query(
    `SELECT relname FROM pg_class
     WHERE relnamespace='public'::regnamespace AND relkind='r' AND NOT relrowsecurity
     ORDER BY relname`,
  );
  const rlsOffNames = rlsOff.rows.map((r) => r.relname);
  record('RLS enabled on all public tables', rlsOffNames.length === 0,
    rlsOffNames.length ? `RLS OFF: [${rlsOffNames.join(', ')}]` : 'all tables have RLS');

  // 12) RLS-enabled tables with zero policies (deny-all — usually unintended).
  const noPolicy = await client.query(
    `SELECT c.relname FROM pg_class c
     WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relrowsecurity
       AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)
     ORDER BY c.relname`,
  );
  const noPolNames = noPolicy.rows.map((r) => r.relname);
  record('every RLS table has at least one policy', noPolNames.length === 0,
    noPolNames.length ? `RLS on but NO policy: [${noPolNames.join(', ')}]` : 'all RLS tables have policies');

  // Diagnostic: functions referenced by RLS policies must stay callable by policy roles.
  const policyFns = await client.query(
    `SELECT DISTINCT p.proname FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace
       AND EXISTS (
         SELECT 1 FROM pg_policies pol WHERE pol.schemaname='public'
           AND (coalesce(pol.qual,'') LIKE '%'||p.proname||'%'
                OR coalesce(pol.with_check,'') LIKE '%'||p.proname||'%')
       )
     ORDER BY p.proname`,
  );
  console.log(`\n-- functions referenced inside RLS policies --\n   ${policyFns.rows.map((r) => r.proname).join(', ') || '(none)'}`);

  // 13) Direct table write grants: writes should flow through the transactional RPCs,
  //     not direct INSERT/UPDATE/DELETE by authenticated/anon. (profiles' column-level
  //     full_name/phone grant is column-scoped and does not appear here.)
  const writeGrants = await client.query(
    `SELECT table_name, grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
     FROM information_schema.role_table_grants
     WHERE table_schema='public' AND grantee IN ('authenticated','anon')
       AND privilege_type IN ('INSERT','UPDATE','DELETE')
     GROUP BY table_name, grantee
     ORDER BY table_name, grantee`,
  );
  record('no direct table write grants to authenticated/anon (RPC-only writes)', writeGrants.rows.length === 0,
    writeGrants.rows.length ? writeGrants.rows.map((r) => `${r.table_name}[${r.grantee}]=${r.privs}`).join('; ') : 'all writes go through RPCs');

  // Diagnostic: write policies on the directly-writable tables (severity assessment).
  const writePolicies = await client.query(
    `SELECT tablename, policyname, cmd, roles::text AS roles,
            left(coalesce(qual,''), 140) AS using_expr, left(coalesce(with_check,''), 140) AS check_expr
     FROM pg_policies
     WHERE schemaname='public' AND tablename IN ('apartments','parking_assignments','parking_spots','vehicles')
       AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
     ORDER BY tablename, cmd, policyname`,
  );
  console.log('\n-- write policies on directly-writable tables --');
  for (const r of writePolicies.rows) {
    console.log(`   ${r.tablename}.${r.policyname} [${r.cmd} ${r.roles}]\n      USING(${r.using_expr})\n      CHECK(${r.check_expr})`);
  }

  await client.query('RESET default_transaction_read_only');
} finally {
  await client.end();
}

let pass = 0;
let fail = 0;
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
  if (r.ok) pass += 1;
  else fail += 1;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
