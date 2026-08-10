# ResidentPark OS Database Rebuild Guide

Last updated: 2026-06-11

Use this runbook for a new Supabase project or an explicitly approved reset.
Creating a new project is safer than destroying the only working environment.

## Before You Start

- [ ] Confirm owner approval for the target environment.
- [ ] Back up/export the current database, functions, grants, and policies.
- [ ] Record current environment variables and auth redirect configuration.
- [ ] Prepare rollback access to the previous project.
- [ ] Prepare non-sensitive seed data and test accounts.
- [ ] Review the database and migration notes and
      the migration archive.

## 1. Create or Reset the Target Project

Preferred: create a new Supabase project.

If an existing project is intentionally reset, use the Supabase dashboard only
after backup and explicit approval. A reset deletes public data and may remove
Auth users depending on the reset operation selected by Supabase.

## 2. Apply the Baseline

Open Supabase SQL Editor and run:

`supabase/baseline/baseline.sql`

The baseline is intended for an empty database. It is not a general-purpose
idempotent production migration and should not be repeatedly run against a
populated project.

After execution, verify:

- 13 product tables exist;
- RLS is enabled on every product table;
- auth profile trigger exists;
- expected helper and application RPCs exist;
- no SQL statement failed or was skipped unexpectedly.

## 3. Apply Post-Baseline Migrations

Apply every migration in `supabase/applied/` in filename order:

1. `0001_security_hardening.sql`
2. `0002_parking_assignment_history.sql`
3. `0003_invitation_event_transactions.sql`
4. `0004_identity_apartment_invariants.sql`
5. `0005_remove_unused_rpcs.sql`
6. `0006_invitation_consumption.sql`

In the Supabase SQL Editor press **Run** (not **Explain**). Test in a
non-production project before production application.

Do not reapply `supabase/applied/get_resident_parking_map.sql` on a clean rebuild;
the function is already included in the baseline.

## 4. Create the First Superadmin

1. Create a normal Auth user through the app or Supabase Authentication.
2. Confirm the auth trigger created the matching `public.profiles` row.
3. In SQL Editor, update only the intended bootstrap account:

```sql
UPDATE public.profiles
SET role = 'superadmin',
    approval_status = 'approved',
    updated_at = now()
WHERE email = 'owner@example.com';
```

4. Verify exactly one row changed.
5. Sign in and confirm `/admin/reports` and `/admin/logs` access.

Do not keep a reusable bootstrap script containing a real email address.

## 5. Seed Apartments

Seed apartments as vacant. Occupancy should be derived from approved resident
assignment, not fabricated in static seed data.

```sql
INSERT INTO public.apartments (apartment_number, status)
VALUES
  ('101', 'vacant'),
  ('102', 'vacant'),
  ('201', 'vacant'),
  ('202', 'vacant'),
  ('301', 'vacant')
ON CONFLICT (apartment_number) DO NOTHING;
```

## 6. Seed Parking Spots

Example for three floors with eight spots each:

```sql
DO $$
DECLARE
  floors text[] := ARRAY['1', '2', '3'];
  floor_value text;
  spot_index integer;
  spot_no text;
BEGIN
  FOREACH floor_value IN ARRAY floors LOOP
    FOR spot_index IN 1..8 LOOP
      spot_no := floor_value || '-' || LPAD(spot_index::text, 2, '0');
      INSERT INTO public.parking_spots (spot_number, zone, floor)
      VALUES (spot_no, 'residential', floor_value)
      ON CONFLICT (spot_number) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
```

Adjust floors, zones, spot types, accessible spaces, and restrictions to the
actual building model before production use.

## 7. Create Test Accounts

Minimum role matrix:

- one pending resident;
- two approved residents in different apartments;
- two approved residents in the same apartment;
- one suspended resident;
- one admin;
- one superadmin.

Use synthetic emails and names only. Do not seed real resident information.

Approve and assign residents through the app so occupancy, manager selection,
and event behavior are exercised.

## 8. Minimum Demo Dataset

- [ ] Superadmin account
- [ ] Admin account
- [ ] At least five apartments
- [ ] At least two floors and ten parking spots
- [ ] At least two approved resident apartments
- [ ] One apartment with two approved residents
- [ ] At least three vehicles across pending/approved states
- [ ] At least two active parking assignments
- [ ] One notice
- [ ] One parking issue
- [ ] One disruption scenario prepared for testing

## 9. Verification

Run the complete QA checklist.

The environment is not ready until:

- P0 security tests pass;
- resident/admin/superadmin access boundaries pass;
- occupancy and manager invariants pass;
- parking assignment and concurrency checks pass;
- disruption create-to-restore passes;
- notices, settings, invitations, reports, and audit checks pass;
- desktop and mobile browser QA passes.

## 10. Cutover

Only after verification:

1. Update deployment environment variables.
2. Confirm Supabase Auth site URL and redirect URLs.
3. Deploy the exact tested application version.
4. Run a production smoke test.
5. Keep the prior environment available for rollback until sign-off.

## Baseline Contents

The snapshot includes enums; apartments, profiles, vehicles, parking spots and
assignments; events and invitations; parking issues; disruptions and temporary
relocations; notices; building settings; indexes; grants; RLS; auth trigger;
helper functions; and the current application RPC layer.

Historical reconstruction SQL (not part of this copy) is reference-only and
must not be replayed as a migration chain.
