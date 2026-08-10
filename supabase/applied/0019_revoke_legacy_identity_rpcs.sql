-- Title: Revoke Legacy Identity/Apartment RPCs (security hardening)
-- Path: supabase/applied/0019_revoke_legacy_identity_rpcs.sql
-- Functionality: Close a latent gap surfaced by legacy-rpc-denial.db.test.ts. The
--   pre-`tx_identity_*` identity/apartment RPCs use the old caller-supplied actor
--   pattern (p_actor_id) and are no longer called by the application — every live path
--   uses the auth.uid()-bound tx_identity_* / tx_apartment_update_status replacements.
--   They were nonetheless still EXECUTE-granted to `authenticated`, so a signed-in
--   client could invoke them directly. Revoke EXECUTE from PUBLIC/anon/authenticated;
--   the functions remain (callable only by the owner / service role) to avoid breaking
--   any internal SECURITY DEFINER references.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.tx_update_profile_status(uuid, profile_status, text, uuid, jsonb, event_severity) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_bulk_update_profile_status(uuid[], profile_status, text, uuid, jsonb, event_severity) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_approve_and_assign(uuid, uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_update_permissions(uuid, user_role, boolean, uuid, uuid, jsonb, event_severity) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_bulk_update_permissions(uuid[], user_role, boolean, uuid, jsonb, event_severity) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_bulk_approve_and_assign_units(jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_update_apartment_status(uuid, apartment_status, uuid, jsonb, event_severity, event_status) FROM PUBLIC, anon, authenticated;

COMMIT;
