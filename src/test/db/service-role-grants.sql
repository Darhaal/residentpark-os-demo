-- Test-only: grant the Supabase API admin role (service_role) access to the loaded
-- schema. A real Supabase project gives service_role these privileges via the
-- platform's default privileges; baseline.sql only grants `authenticated`/`anon`
-- explicitly, so a raw `postgres` load into a fresh local stack leaves service_role
-- with nothing — the test's service client then gets "permission denied for table".
--
-- Scope is service_role ONLY, so the 0007/0008 anon/authenticated hardening (and the
-- verify-security checks) are unaffected. Apply after baseline + all migrations.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;
