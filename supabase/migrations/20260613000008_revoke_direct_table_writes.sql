-- 0008_revoke_direct_table_writes.sql
-- Defense-in-depth: force all writes to the operational tables through the
-- transactional SECURITY DEFINER RPCs by removing direct INSERT/UPDATE/DELETE from
-- the authenticated role. Apply after 0001-0007.
--
-- WHY
--   apartments, parking_assignments, parking_spots and vehicles still granted
--   INSERT/UPDATE/DELETE to `authenticated` (verified read-only via
--   scripts/verify-security.mjs). Their RLS write policy is admin-only
--   (USING get_auth_role() IN ('admin','superadmin')), so this is NOT exploitable by
--   residents today — but it is a latent bypass of the RPCs' validation/auditing and
--   is inconsistent with 0001 (profiles) and 0003 (invitations/events), which already
--   revoked direct writes.
--
-- SAFETY
--   The app performs every write through RPCs (no direct .from(...).insert/update/delete
--   on these tables), and the RPCs run as the function owner, so removing these grants
--   does not affect them. SELECT is left intact — RLS-gated reads are unchanged.

BEGIN;

REVOKE INSERT, UPDATE, DELETE ON public.apartments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.parking_assignments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.parking_spots FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.vehicles FROM authenticated;

COMMIT;
