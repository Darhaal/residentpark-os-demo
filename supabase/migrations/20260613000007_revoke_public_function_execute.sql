-- 0007_revoke_public_function_execute.sql
-- Defense-in-depth: remove the default PUBLIC (hence `anon`) EXECUTE grant from
-- every SECURITY DEFINER function, then re-grant precisely. Apply after 0001-0006.
--
-- WHY
--   PostgreSQL grants EXECUTE to PUBLIC by default, and the baseline RPCs were only
--   `GRANT ... TO authenticated`, never `REVOKE ... FROM PUBLIC`. So the anon role
--   could reach every SECURITY DEFINER function (verified read-only against the live
--   DB with scripts/verify-security.mjs). Not currently exploitable — each privileged
--   tx_* function self-checks is_admin()/is_superadmin()/auth.uid() — but a regression
--   in any internal guard would otherwise be reachable by an unauthenticated anon key.
--   This closes the SECURITY DEFINER attack surface for anon.
--
-- SCOPE & SAFETY
--   * Only SECURITY DEFINER functions are touched. SECURITY INVOKER functions run as
--     the caller and are already RLS-constrained, so they are intentionally left alone.
--   * RLS policies on the live DB reference get_auth_role() and is_superadmin(); those
--     (plus is_admin()) are re-granted to authenticated AND anon so policy evaluation
--     keeps working in every context. They are boolean predicates and safe to expose.
--   * Client-invoked RPCs (tx_*, get_*) are re-granted to authenticated only — matching
--     how the app calls them (authenticated server actions / pages).
--   * Internal helpers (handle_new_user, enforce_profile_privilege_boundary,
--     reconcile_identity_apartments, lock_identity_apartment_state) get NO role grant;
--     they run in trigger/definer context where the owner already has EXECUTE.
--
-- VERIFY AFTER APPLYING:  node scripts/verify-security.mjs

BEGIN;

-- 1) Strip the implicit PUBLIC EXECUTE from every SECURITY DEFINER function.
DO $$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
  END LOOP;
END $$;

-- 2) RLS predicate helpers must stay callable by the querying roles.
DO $$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      AND p.proname IN ('get_auth_role', 'is_superadmin', 'is_admin')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, anon', fn);
  END LOOP;
END $$;

-- 3) Client-invoked RPCs: authenticated only.
DO $$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      AND (p.proname LIKE 'tx\_%' OR p.proname LIKE 'get\_%')
      AND p.proname <> 'get_auth_role'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

COMMIT;
