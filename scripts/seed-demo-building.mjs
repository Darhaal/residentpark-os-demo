// Title: Demo Building Seed Script
// Path: scripts/seed-demo-building.mjs
// Functionality: Provision a realistic, namespaced demo building for scripted demos.
//
// Creates the "D" demo building used by scripted demos:
//   7 apartments (D-101..D-107), 7 approved residents (demo.*@qa.local),
//   20 parking spots on dedicated floors D1/D2 (D1 fully positioned with layout
//   shapes to showcase the spatial canvas; D2 left uncoordinated to showcase the
//   grid fallback), 8 vehicles (6 approved / 2 pending for the approval demo),
//   6 active assignments (one apartment-only), one reserved and one blocked spot,
//   and one unread notice batch to the demo residents.
//
// NON-DESTRUCTIVE to everything outside its namespace: it removes and re-creates
// ONLY rows it owns (auth users demo.*@qa.local, apartments D-1xx, spots on floors
// D1/D2, their assignments/vehicles, layout shapes on D1/D2, notices in its own
// batch). Safe to re-run on the shared/live project; never touches other data.
// Disruptions/issues are intentionally NOT seeded — the demo script performs those
// flows live.
//
// Usage:  node scripts/seed-demo-building.mjs

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

// Throwaway demo credential (local/demo only).
const PASSWORD = (process.env.SEED_PASSWORD || 'ChangeMe-Local-Only-123!');
const FLOORS = ['D1', 'D2'];
const NOTICE_BATCH_TITLE = 'Garage deep-clean this Friday';

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
  { id: randomUUID(), number: 'D-101' },
  { id: randomUUID(), number: 'D-102' },
  { id: randomUUID(), number: 'D-103' },
  { id: randomUUID(), number: 'D-104' },
  { id: randomUUID(), number: 'D-105' },
  { id: randomUUID(), number: 'D-106' },
  { id: randomUUID(), number: 'D-107' },
];
const aptByNum = Object.fromEntries(apartments.map((a) => [a.number, a.id]));

const people = [
  { email: 'demo.alice@qa.local', name: 'Alice Demo', apt: 'D-101', residency: 'owner' },
  { email: 'demo.boris@qa.local', name: 'Boris Demo', apt: 'D-102', residency: 'owner' },
  { email: 'demo.clara@qa.local', name: 'Clara Demo', apt: 'D-103', residency: 'tenant' },
  { email: 'demo.daniel@qa.local', name: 'Daniel Demo', apt: 'D-104', residency: 'owner' },
  { email: 'demo.elena@qa.local', name: 'Elena Demo', apt: 'D-105', residency: 'tenant' },
  { email: 'demo.frank@qa.local', name: 'Frank Demo', apt: 'D-106', residency: 'owner' },
  { email: 'demo.george@qa.local', name: 'George Demo', apt: 'D-107', residency: 'owner' },
];

const vehicles = [
  // Approved + assigned below.
  { id: randomUUID(), plate: 'DMO-101', apt: 'D-101', owner: 'demo.alice@qa.local', make: 'Toyota', model: 'RAV4', color: 'Silver', year: 2022, status: 'approved' },
  { id: randomUUID(), plate: 'DMO-102', apt: 'D-102', owner: 'demo.boris@qa.local', make: 'Skoda', model: 'Octavia', color: 'Blue', year: 2020, status: 'approved' },
  { id: randomUUID(), plate: 'DMO-103', apt: 'D-103', owner: 'demo.clara@qa.local', make: 'Tesla', model: 'Model Y', color: 'White', year: 2024, status: 'approved' },
  { id: randomUUID(), plate: 'DMO-104', apt: 'D-104', owner: 'demo.daniel@qa.local', make: 'BMW', model: 'i4', color: 'Black', year: 2023, status: 'approved' },
  { id: randomUUID(), plate: 'DMO-105', apt: 'D-105', owner: 'demo.elena@qa.local', make: 'Honda', model: 'CR-V', color: 'Grey', year: 2021, status: 'approved' },
  // Approved but NOT assigned — feeds the "vehicles awaiting a spot" report + assign demo.
  { id: randomUUID(), plate: 'DMO-106', apt: 'D-106', owner: 'demo.frank@qa.local', make: 'Kia', model: 'EV6', color: 'Red', year: 2024, status: 'approved' },
  // Pending — feeds the approval queue demo.
  { id: randomUUID(), plate: 'DMO-201', apt: 'D-101', owner: 'demo.alice@qa.local', make: 'Fiat', model: '500e', color: 'Mint', year: 2025, status: 'pending_approval' },
  { id: randomUUID(), plate: 'DMO-202', apt: 'D-105', owner: 'demo.elena@qa.local', make: 'Volvo', model: 'EX30', color: 'Sand', year: 2025, status: 'pending_approval' },
];
const vehByPlate = Object.fromEntries(vehicles.map((v) => [v.plate, v.id]));

// Floor D1: zone A (8 spots, positioned in a top row) + zone B (4 spots, bottom row).
// Floor D2: zone A (8 spots), intentionally without coordinates (grid fallback).
const spots = [];
for (let i = 1; i <= 8; i++) spots.push({ id: randomUUID(), number: `D1-${String(i).padStart(2, '0')}`, floor: 'D1', zone: 'A', pos: { x: 40 + (i - 1) * 130, y: 60, rotation: 0 } });
for (let i = 9; i <= 12; i++) spots.push({ id: randomUUID(), number: `D1-${String(i).padStart(2, '0')}`, floor: 'D1', zone: 'B', pos: { x: 40 + (i - 9) * 130, y: 330, rotation: 0 } });
for (let i = 1; i <= 8; i++) spots.push({ id: randomUUID(), number: `D2-${String(i).padStart(2, '0')}`, floor: 'D2', zone: 'A', pos: null });
const spotPlan = {
  'D1-01': { status: 'assigned', apt: 'D-101', plate: 'DMO-101' },
  'D1-02': { status: 'assigned', apt: 'D-102', plate: 'DMO-102' },
  'D1-03': { status: 'assigned', apt: 'D-103', plate: 'DMO-103' },
  'D1-04': { status: 'assigned', apt: 'D-104', plate: 'DMO-104' },
  'D1-05': { status: 'assigned', apt: 'D-107', plate: null }, // apartment-only assignment
  'D1-08': { status: 'reserved', apt: null, plate: null },
  'D2-01': { status: 'assigned', apt: 'D-105', plate: 'DMO-105' },
  'D2-08': { status: 'blocked', apt: null, plate: null },
};

// Layout shapes for floor D1 (coordinates in canvas units, limits 0..5000).
const shapes = [
  { kind: 'wall', x: 20, y: 20, w: 1080, h: 12, rotation: 0, label: null },
  { kind: 'wall', x: 20, y: 20, w: 12, h: 450, rotation: 0, label: null },
  { kind: 'lane', x: 30, y: 200, w: 1060, h: 100, rotation: 0, label: 'Drive lane' },
  { kind: 'zone', x: 30, y: 40, w: 1060, h: 150, rotation: 0, label: 'Zone A' },
  { kind: 'zone', x: 30, y: 310, w: 560, h: 150, rotation: 0, label: 'Zone B' },
  { kind: 'label', x: 640, y: 380, w: 320, h: 40, rotation: 0, label: 'Level D1 — Demo Garage' },
];

// Scoped cleanup: remove ONLY rows this seed owns, then re-create them.
async function cleanupOwnNamespace() {
  const spotIdsRes = await db.query(`SELECT id FROM public.parking_spots WHERE floor = ANY($1)`, [FLOORS]);
  const oldSpotIds = spotIdsRes.rows.map((r) => r.id);
  if (oldSpotIds.length) {
    await db.query(`DELETE FROM public.temporary_relocations WHERE original_spot_id = ANY($1) OR temporary_spot_id = ANY($1)`, [oldSpotIds]);
    await db.query(`DELETE FROM public.parking_issues WHERE spot_id = ANY($1)`, [oldSpotIds]);
    await db.query(`DELETE FROM public.parking_assignments WHERE spot_id = ANY($1)`, [oldSpotIds]);
    await db.query(
      `DELETE FROM public.parking_disruption_spots WHERE spot_id = ANY($1)`, [oldSpotIds],
    );
    // Disruptions that only targeted demo spots are left as completed/cancelled history;
    // remove ones that now have no spots at all to avoid orphan demo rows.
    await db.query(`DELETE FROM public.parking_disruptions d
      WHERE NOT EXISTS (SELECT 1 FROM public.parking_disruption_spots s WHERE s.disruption_id = d.id)
        AND d.title LIKE 'DEMO %'`);
    await db.query(`DELETE FROM public.parking_spots WHERE id = ANY($1)`, [oldSpotIds]);
  }
  await db.query(`DELETE FROM public.parking_layout_shapes WHERE floor = ANY($1)`, [FLOORS]);
  await db.query(`DELETE FROM public.notices WHERE title = $1`, [NOTICE_BATCH_TITLE]);
  await db.query(`DELETE FROM public.vehicles WHERE plate_number LIKE 'DMO-%'`);
  // Demo auth users (cascade removes their profiles).
  await db.query(`DELETE FROM auth.users WHERE email LIKE 'demo.%@qa.local'`);
  await db.query(`DELETE FROM public.apartments WHERE apartment_number LIKE 'D-1%'`);
}

async function run() {
  await db.connect();
  try {
    await cleanupOwnNamespace();

    for (const a of apartments) {
      await db.query(`INSERT INTO public.apartments (id, apartment_number, status) VALUES ($1, $2, 'occupied')`, [a.id, a.number]);
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
         SET role='resident', full_name=$1, email=$2, approval_status='approved', apartment_id=$3,
             residency_type=$4, is_apartment_manager=true, updated_at=now()
         WHERE id=$5`,
        [p.name, p.email, aptByNum[p.apt], p.residency, data.user.id],
      );
    }

    for (const v of vehicles) {
      const approved = v.status === 'approved';
      await db.query(
        `INSERT INTO public.vehicles (id, apartment_id, owner_id, plate_number, make, model, color, year, approval_status, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [v.id, aptByNum[v.apt], idByEmail[v.owner], v.plate, v.make, v.model, v.color, v.year, v.status, approved ? new Date().toISOString() : null],
      );
    }

    for (const s of spots) {
      const plan = spotPlan[s.number];
      await db.query(
        `INSERT INTO public.parking_spots (id, spot_number, zone, floor, type, status, assigned_apartment_id, assigned_vehicle_id, pos_x, pos_y, rotation)
         VALUES ($1,$2,$3,$4,'regular',$5,$6,$7,$8,$9,$10)`,
        [
          s.id, s.number, s.zone, s.floor,
          plan ? plan.status : 'available',
          plan?.apt ? aptByNum[plan.apt] : null,
          plan?.plate ? vehByPlate[plan.plate] : null,
          s.pos ? s.pos.x : null, s.pos ? s.pos.y : null, s.pos ? s.pos.rotation : 0,
        ],
      );
      if (plan && plan.status === 'assigned') {
        await db.query(
          `INSERT INTO public.parking_assignments (spot_id, apartment_id, vehicle_id, assignment_type, status)
           VALUES ($1,$2,$3,'permanent','active')`,
          [s.id, aptByNum[plan.apt], plan.plate ? vehByPlate[plan.plate] : null],
        );
      }
    }

    for (const shape of shapes) {
      await db.query(
        `INSERT INTO public.parking_layout_shapes (floor, kind, x, y, w, h, rotation, label)
         VALUES ('D1',$1,$2,$3,$4,$5,$6,$7)`,
        [shape.kind, shape.x, shape.y, shape.w, shape.h, shape.rotation, shape.label],
      );
    }

    const batchId = randomUUID();
    for (const p of people) {
      await db.query(
        `INSERT INTO public.notices (batch_id, recipient_id, title, body, type)
         VALUES ($1,$2,$3,$4,'maintenance')`,
        [batchId, idByEmail[p.email], NOTICE_BATCH_TITLE,
         '<p>The demo garage will be deep-cleaned this Friday from 8:00. Please move vehicles from Zone B by 7:45.</p>'],
      );
    }

    const counts = await db.query(
      `SELECT
         (SELECT count(*) FROM public.apartments WHERE apartment_number LIKE 'D-1%') AS apartments,
         (SELECT count(*) FROM public.profiles WHERE email LIKE 'demo.%@qa.local') AS residents,
         (SELECT count(*) FROM public.parking_spots WHERE floor = ANY($1)) AS spots,
         (SELECT count(*) FROM public.parking_layout_shapes WHERE floor = 'D1') AS shapes,
         (SELECT count(*) FROM public.vehicles WHERE plate_number LIKE 'DMO-%') AS vehicles,
         (SELECT count(*) FROM public.parking_assignments a JOIN public.parking_spots s ON s.id = a.spot_id
            WHERE s.floor = ANY($1) AND a.status = 'active') AS assignments,
         (SELECT count(*) FROM public.notices WHERE title = $2) AS notices`,
      [FLOORS, NOTICE_BATCH_TITLE],
    );
    console.log('demo building seeded:', counts.rows[0]);
    console.log(`resident logins: demo.<name>@qa.local / ${PASSWORD} (alice, boris, clara, daniel, elena, frank, george)`);
    console.log('spatial floor: D1 (positioned + shapes); grid-fallback floor: D2');
  } finally {
    await db.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
