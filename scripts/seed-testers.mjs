// Title: Tester Account Seed Script
// Path: scripts/seed-testers.mjs
// Functionality: Provision a fixed set of QA tester credentials in the project in .env.local.
//
// Creates (or refreshes) three role-scoped tester accounts for manual QA hand-off:
//   1. tester.super@qa.local     — superadmin (approved)
//   2. tester.admin@qa.local     — admin (approved)
//   3. tester.resident@qa.local  — resident (approved, manager of a dedicated QA unit)
//
// NON-DESTRUCTIVE + idempotent: it never deletes auth users or domain rows. Existing
// tester accounts are updated in place (password reset to the shared QA password,
// email re-confirmed, profile role/approval reasserted). Safe to re-run. Unlike
// scripts/seed-demo.mjs this does NOT wipe any data, so it is the only seed script
// appropriate to run against a shared/live project.
//
// Auth users are created via the GoTrue admin API; profile/apartment rows via SQL.
//
// Usage:  node scripts/seed-testers.mjs

import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

function envVal(key) {
  if (process.env[key]) return process.env[key];
  if (!existsSync('.env.local')) return '';
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1 || t.slice(0, eq).trim() !== key) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  }
  return '';
}

const SUPABASE_URL = envVal('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = envVal('SUPABASE_SERVICE_ROLE_KEY');
const DB_URL = envVal('SUPABASE_DB_URL');
if (!SUPABASE_URL || !SERVICE_KEY || !DB_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL in .env.local');
  process.exit(2);
}

// Shared QA password — meets the app policy (length, upper, number, special). This is a
// throwaway credential for non-production tester accounts only, matching the committed
// demo-password precedent in seed-demo.mjs. Rotate it (and re-run) before any real launch.
const PASSWORD = (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!');

// Dedicated QA unit so the resident tester has a real home apartment without touching any
// existing building data.
const QA_APARTMENT = 'QA-9001';

const TESTERS = [
  { email: 'tester.super@qa.local', name: 'QA Superadmin', role: 'superadmin', residency: null, manager: false, apt: false },
  { email: 'tester.admin@qa.local', name: 'QA Admin', role: 'admin', residency: null, manager: false, apt: false },
  { email: 'tester.resident@qa.local', name: 'QA Resident', role: 'resident', residency: 'owner', manager: true, apt: true },
];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

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
const isLocal = /localhost|127\.0\.0\.1/.test(DB_URL);
const db = new pg.Client({
  connectionString: isLocal ? DB_URL : withoutSslMode(DB_URL),
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});

async function ensureQaApartment(adminId) {
  const found = await db.query(`SELECT id FROM public.apartments WHERE apartment_number = $1`, [QA_APARTMENT]);
  let id = found.rows[0]?.id;
  if (!id) {
    id = randomUUID();
    await db.query(
      `INSERT INTO public.apartments (id, apartment_number, status, assigned_admin_id) VALUES ($1, $2, 'occupied', $3)`,
      [id, QA_APARTMENT, adminId],
    );
  } else if (adminId) {
    await db.query(`UPDATE public.apartments SET assigned_admin_id = $1, status = 'occupied' WHERE id = $2`, [adminId, id]);
  }
  return id;
}

async function upsertAuthUser(email, name) {
  // Reuse an existing auth user if present (re-runnable); otherwise create one.
  const existing = await db.query(`SELECT id FROM auth.users WHERE email = $1`, [email]);
  const existingId = existing.rows[0]?.id;
  if (existingId) {
    const { error } = await supabase.auth.admin.updateUserById(existingId, {
      password: PASSWORD, email_confirm: true, user_metadata: { full_name: name },
    });
    if (error) throw new Error(`updateUser ${email}: ${error.message}`);
    return existingId;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name },
  });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message ?? 'no user'}`);
  return data.user.id;
}

async function run() {
  await db.connect();
  try {
    const idByEmail = {};
    for (const t of TESTERS) idByEmail[t.email] = await upsertAuthUser(t.email, t.name);

    const adminId = idByEmail['tester.admin@qa.local'];
    const qaAptId = await ensureQaApartment(adminId);

    for (const t of TESTERS) {
      await db.query(
        `UPDATE public.profiles
         SET role = $1, full_name = $2, email = $3, approval_status = 'approved',
             apartment_id = $4, residency_type = $5, is_apartment_manager = $6, updated_at = now()
         WHERE id = $7`,
        [t.role, t.name, t.email, t.apt ? qaAptId : null, t.residency, t.manager, idByEmail[t.email]],
      );
    }

    const rows = await db.query(
      `SELECT email, role, approval_status FROM public.profiles
       WHERE email = ANY($1) ORDER BY role`,
      [TESTERS.map((t) => t.email)],
    );
    console.log('Tester accounts provisioned (password for all: ' + PASSWORD + '):');
    for (const r of rows.rows) console.log(`  ${r.role.padEnd(10)} ${r.email}  [${r.approval_status}]`);
    console.log(`QA unit: ${QA_APARTMENT} (home of tester.resident@qa.local)`);
  } finally {
    await db.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
