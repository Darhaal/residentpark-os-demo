# Database Authorization Tests

These tests verify RLS policies and `SECURITY DEFINER` RPC behavior against a
disposable Supabase database.

Never point them at the production project. They create users and rows and assume
a throwaway database.

## Option A: Local Supabase (recommended)

Requires Docker Desktop installed and running.

```bash
npx supabase init
npx supabase start
npx supabase db reset
```

Create `.env.test.local` in the repo root (gitignored):

```dotenv
TEST_SUPABASE_URL=http://127.0.0.1:54321
TEST_SUPABASE_ANON_KEY=<anon key from supabase start>
TEST_SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Option B: Separate Staging Project

Use a new Supabase project, not production. Replay `supabase/migrations/` in
filename order, then apply `src/test/db/service-role-grants.sql`.

Then fill `.env.test.local` with that project's URL, anon key, service role key,
and database connection string.

## Run

```bash
npm.cmd run test:db
```

Without `.env.test.local`, local runs skip these suites safely. CI starts a local
Supabase stack, loads the schema, and runs the suites.

## Current Coverage

- [x] `profiles`: residents cannot escalate role, approval, or apartment; allowed
      self-service fields still work (`profiles-rls.db.test.ts`).
- [x] Account status authorization: non-approved admin/resident accounts lose
      privileged and operational access (`account-status-rls.db.test.ts`).
- [x] Vehicle approval: residents submit pending vehicles; admins review
      (`vehicle-approval-rls.db.test.ts`).
- [x] Invitation consumption: token-bound matching invite, single-use,
      missing/expired, wrong-token, and wrong-email cases
      (`invitation-consume.db.test.ts`).
- [x] Audit logs: full stream is superadmin-only (`audit-logs-rls.db.test.ts`).
- [x] Cross-tenant isolation: residents read only their own scope
      (`cross-tenant-rls.db.test.ts`).
- [x] Invitations: admin-only creation and duplicate active invite denial
      (`invitations.db.test.ts`).
- [x] Parking ops: admin assign/revoke smoke coverage (`parking-ops.db.test.ts`).
- [x] Parking transfer source ownership: direct RPC cannot remove another
      apartment/vehicle assignment (`parking-assignment-validation.db.test.ts`).
- [x] Parking time machine: assign/transfer/revoke windows reconstruct correctly
      for admins and are denied to residents (`parking-history.db.test.ts`).
- [x] Disruptions: admin-only create/complete restores spot state
      (`disruptions.db.test.ts`).
- [x] Notices: targeted audience delivery (`notices.db.test.ts`).
- [x] Fixed settings policy: legacy settings writes cannot disable mandatory
      vehicle approval or restore max-spots (`settings-policy.db.test.ts`).
- [x] Apartment manager preservation: first manager selected, later normal
      approve/invite paths preserve manager (`apartment-manager.db.test.ts`).
- [x] Parking issue lifecycle: multi-issue conflict restoration, duplicate
      active issue denial by spot/type, and suspended resident denial
      (`parking-issue-lifecycle.db.test.ts`).
- [x] Vehicle transitions: owner/apartment consistency, normalized plates,
      assignment release, terminal archive (`vehicle-transitions.db.test.ts`).
- [x] Rate limiting: `tx_check_rate_limit` per-actor windows
      (`rate-limit.db.test.ts`).
- [x] Legacy RPC denial: replaced identity/apartment RPC signatures are not
      executable by normal authenticated clients (`legacy-rpc-denial.db.test.ts`).

## Known Test Gaps

- [ ] parking concurrency and bulk block rollback;
- [ ] disruption scheduling, overlap, cancellation, and relocation history;
- [ ] atomic admin account provisioning rollback/acceptance.
