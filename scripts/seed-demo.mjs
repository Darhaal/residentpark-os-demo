// Title: Demo Seed Script
// Path: scripts/seed-demo.mjs
// Functionality: Local maintenance script for creating demo data used by development and QA.

// Seeds a demonstrable dataset into the database in .env.local:
//   1 superadmin, 1 admin, 4 approved residents, 1 pending resident,
//   6 apartments, 4 vehicles (3 approved + 1 pending), 12 parking spots
//   (assigned / available / blocked), and a building_settings row.
//
// Re-runnable: removes any prior @demo.local users + demo domain rows first.
// Auth users are created via the GoTrue admin API; domain rows via direct SQL.
//
// Usage:  node scripts/seed-demo.mjs

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

const PASSWORD = (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!');

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

const apartments = [
  { id: randomUUID(), number: 'A-101', status: 'occupied' },
  { id: randomUUID(), number: 'A-102', status: 'occupied' },
  { id: randomUUID(), number: 'A-201', status: 'occupied' },
  { id: randomUUID(), number: 'A-202', status: 'vacant' },
  { id: randomUUID(), number: 'A-301', status: 'occupied' },
  { id: randomUUID(), number: 'A-302', status: 'vacant' },
];
const aptByNum = Object.fromEntries(apartments.map((a) => [a.number, a.id]));

const people = [
  { email: 'sam.super@demo.local', name: 'Sam Superadmin', role: 'superadmin', approval: 'approved', apt: null, residency: null, manager: false },
  { email: 'mia.admin@demo.local', name: 'Mia Admin', role: 'admin', approval: 'approved', apt: null, residency: null, manager: false },
  { email: 'alice@demo.local', name: 'Alice Owner', role: 'resident', approval: 'approved', apt: 'A-101', residency: 'owner', manager: true },
  { email: 'bob@demo.local', name: 'Bob Tenant', role: 'resident', approval: 'approved', apt: 'A-102', residency: 'tenant', manager: false },
  { email: 'carol@demo.local', name: 'Carol Family', role: 'resident', approval: 'approved', apt: 'A-201', residency: 'family', manager: false },
  { email: 'dave@demo.local', name: 'Dave Owner', role: 'resident', approval: 'approved', apt: 'A-301', residency: 'owner', manager: true },
  { email: 'erin.pending@demo.local', name: 'Erin Pending', role: 'resident', approval: 'pending_approval', apt: null, residency: 'tenant', manager: false },
  { email: 'frank.suspended@demo.local', name: 'Frank Suspended', role: 'resident', approval: 'suspended', apt: null, residency: 'tenant', manager: false },
];

const vehicles = [
  { id: randomUUID(), plate: 'RPK-101', apt: 'A-101', owner: 'alice@demo.local', make: 'Toyota', model: 'Corolla', color: 'Silver', year: 2021, status: 'approved' },
  { id: randomUUID(), plate: 'RPK-102', apt: 'A-102', owner: 'bob@demo.local', make: 'Honda', model: 'Civic', color: 'Blue', year: 2019, status: 'approved' },
  { id: randomUUID(), plate: 'RPK-201', apt: 'A-201', owner: 'carol@demo.local', make: 'Tesla', model: 'Model 3', color: 'White', year: 2023, status: 'pending_approval' },
  { id: randomUUID(), plate: 'RPK-301', apt: 'A-301', owner: 'dave@demo.local', make: 'Ford', model: 'Focus', color: 'Black', year: 2020, status: 'approved' },
];
const vehByPlate = Object.fromEntries(vehicles.map((v) => [v.plate, v.id]));

// 12 spots; the first four assigned, one blocked, the rest available.
const spots = Array.from({ length: 12 }, (_, i) => ({
  id: randomUUID(),
  number: `P-${String(i + 1).padStart(2, '0')}`,
  zone: 'A',
  floor: i < 6 ? '1' : '2',
}));
const spotPlan = {
  'P-01': { status: 'assigned', apt: 'A-101', plate: 'RPK-101' },
  'P-02': { status: 'assigned', apt: 'A-102', plate: 'RPK-102' },
  'P-03': { status: 'assigned', apt: 'A-201', plate: null },
  'P-04': { status: 'assigned', apt: 'A-301', plate: 'RPK-301' },
  'P-05': { status: 'blocked', apt: null, plate: null },
};

async function cleanup() {
  await db.query(`DELETE FROM auth.users WHERE email ILIKE '%@demo.local'`);
  for (const t of [
    'public.parking_assignments', 'public.temporary_relocations', 'public.parking_disruption_spots',
    'public.parking_disruptions', 'public.parking_issues', 'public.notices', 'public.invitations',
    'public.events', 'public.vehicles', 'public.parking_spots', 'public.apartments', 'public.building_settings',
  ]) {
    await db.query(`DELETE FROM ${t}`);
  }
}

async function run() {
  await db.connect();
  try {
    await cleanup();

    await db.query(
      `INSERT INTO public.building_settings (building_name, timezone, require_vehicle_approval, resident_portal_notice)
       VALUES ('ResidentPark Demo', 'UTC', true, 'Welcome to the resident portal — submit vehicle requests and view your parking here.')`,
    );

    for (const a of apartments) {
      await db.query(`INSERT INTO public.apartments (id, apartment_number, status) VALUES ($1, $2, $3)`, [a.id, a.number, a.status]);
    }

    const idByEmail = {};
    for (const p of people) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: p.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: p.name },
      });
      if (error || !data.user) throw new Error(`createUser ${p.email}: ${error?.message ?? 'no user'}`);
      idByEmail[p.email] = data.user.id;
      await db.query(
        `UPDATE public.profiles
         SET role=$1, full_name=$2, email=$3, approval_status=$4, apartment_id=$5,
             residency_type=$6, is_apartment_manager=$7, updated_at=now()
         WHERE id=$8`,
        [p.role, p.name, p.email, p.approval, p.apt ? aptByNum[p.apt] : null, p.residency, p.manager, data.user.id],
      );
    }

    // No-profile fixture: an authenticated user whose profile row was removed (simulates a
    // DB reset / signup gap) — exercises the "Profile Not Found" account state.
    const ghost = await supabase.auth.admin.createUser({
      email: 'ghost.noprofile@demo.local', password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Ghost NoProfile' },
    });
    if (!ghost.error && ghost.data.user) {
      await db.query(`DELETE FROM public.profiles WHERE id=$1`, [ghost.data.user.id]);
    }

    const adminId = idByEmail['mia.admin@demo.local'];
    const superId = idByEmail['sam.super@demo.local'];
    for (const a of apartments.filter((x) => x.status === 'occupied')) {
      await db.query(`UPDATE public.apartments SET assigned_admin_id=$1 WHERE id=$2`, [adminId, a.id]);
    }

    for (const v of vehicles) {
      const approved = v.status === 'approved';
      await db.query(
        `INSERT INTO public.vehicles (id, apartment_id, owner_id, plate_number, make, model, color, year, approval_status, approved_by, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [v.id, aptByNum[v.apt], idByEmail[v.owner], v.plate, v.make, v.model, v.color, v.year, v.status, approved ? superId : null, approved ? new Date().toISOString() : null],
      );
    }

    for (const s of spots) {
      const plan = spotPlan[s.number];
      await db.query(
        `INSERT INTO public.parking_spots (id, spot_number, zone, floor, type, status, assigned_apartment_id, assigned_vehicle_id)
         VALUES ($1,$2,$3,$4,'regular',$5,$6,$7)`,
        [s.id, s.number, s.zone, s.floor, plan ? plan.status : 'available', plan?.apt ? aptByNum[plan.apt] : null, plan?.plate ? vehByPlate[plan.plate] : null],
      );
      if (plan && plan.status === 'assigned') {
        await db.query(
          `INSERT INTO public.parking_assignments (spot_id, apartment_id, vehicle_id, assignment_type, status, created_by)
           VALUES ($1,$2,$3,'permanent','active',$4)`,
          [s.id, aptByNum[plan.apt], plan.plate ? vehByPlate[plan.plate] : null, superId],
        );
      }
    }

    const counts = await db.query(
      `SELECT
         (SELECT count(*) FROM public.profiles) AS profiles,
         (SELECT count(*) FROM public.apartments) AS apartments,
         (SELECT count(*) FROM public.vehicles) AS vehicles,
         (SELECT count(*) FROM public.parking_spots) AS spots,
         (SELECT count(*) FROM public.parking_assignments) AS assignments`,
    );
    console.log('seeded:', counts.rows[0]);
    console.log(`login: sam.super@demo.local / ${PASSWORD}  (superadmin)`);
  } finally {
    await db.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
