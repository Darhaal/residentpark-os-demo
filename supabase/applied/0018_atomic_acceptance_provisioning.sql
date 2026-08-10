-- Title: Atomic Acceptance-Aware Provisioning
-- Path: supabase/applied/0018_atomic_acceptance_provisioning.sql
-- Functionality: Make admin-created account provisioning atomic and acceptance-aware.
--
--   Before: createUserAccountAction ran two separate identity RPCs
--   (tx_identity_update_permissions to occupy the apartment, then
--   tx_identity_update_status to approve), after the invitation email was already
--   sent. A resident apartment was therefore occupied and the account approved at
--   creation, in two non-atomic steps.
--
--   After: a resident is provisioned PENDING in one transaction with the intended
--   apartment recorded in profiles.pending_apartment_id but NOT occupied. The
--   apartment is occupied + the account approved exactly once, atomically, when the
--   invited person accepts (tx_finalize_pending_account, keyed on auth.uid() so no
--   token or email match is needed and no one can finalize another identity).
--   Admin accounts have no apartment-at-acceptance concern, so they are still
--   provisioned approved, but now in a single transaction.

BEGIN;

-- Intended (not yet occupied) apartment for an admin-provisioned pending resident.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_apartment_id uuid
  REFERENCES public.apartments(id) ON DELETE SET NULL;

-- One-transaction provisioning. Residents become pending with a recorded intended
-- apartment (no occupancy); admins become approved (no apartment). Caller must be an
-- admin; granting an admin role requires a superadmin.
CREATE OR REPLACE FUNCTION public.tx_provision_pending_account(
  p_target_id uuid,
  p_role user_role,
  p_apartment_id uuid,
  p_actor_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_apartment_number text;
  v_reason text := 'Account created by administrator';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF p_target_id = auth.uid() THEN
    RAISE EXCEPTION 'RULE: self-modification is not allowed';
  END IF;
  IF p_role NOT IN ('resident', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: unsupported provisioning role';
  END IF;
  IF p_role = 'admin' AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin can create an admin account';
  END IF;
  IF p_role = 'resident' AND p_apartment_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: a resident requires an apartment';
  END IF;

  PERFORM public.lock_identity_apartment_state();

  IF p_role = 'resident' THEN
    SELECT apartment_number INTO v_apartment_number
    FROM public.apartments WHERE id = p_apartment_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: apartment';
    END IF;
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: profile';
  END IF;
  -- Only provision a freshly created identity; never re-provision an active account.
  IF v_target.apartment_id IS NOT NULL OR v_target.approval_status = 'approved' THEN
    RAISE EXCEPTION 'RULE: account is already provisioned';
  END IF;
  IF v_target.role IN ('admin', 'superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin may modify a privileged account';
  END IF;

  IF p_role = 'resident' THEN
    -- Manager assignment is owned by reconcile_identity_apartments and only matters
    -- once the apartment is actually occupied (at finalization), so it is not set here.
    UPDATE public.profiles
    SET role = 'resident',
        approval_status = 'pending_approval',
        apartment_id = NULL,
        pending_apartment_id = p_apartment_id,
        status_reason = v_reason,
        updated_at = now()
    WHERE id = p_target_id;
  ELSE
    UPDATE public.profiles
    SET role = 'admin',
        approval_status = 'approved',
        apartment_id = NULL,
        pending_apartment_id = NULL,
        status_reason = v_reason,
        updated_at = now()
    WHERE id = p_target_id;
  END IF;

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'identity', 'ACCOUNT_PROVISIONED', 'profile', p_target_id, auth.uid(),
    jsonb_build_object(
      'content', CASE WHEN p_role = 'resident'
                      THEN 'Resident account provisioned pending acceptance'
                      ELSE 'Admin account provisioned' END,
      'target_email', v_target.email,
      'target_name', v_target.full_name,
      'new_role', p_role,
      'new_status', CASE WHEN p_role = 'resident' THEN 'pending_approval' ELSE 'approved' END,
      'pending_apartment_id', CASE WHEN p_role = 'resident' THEN p_apartment_id ELSE NULL END,
      'apartment_number', v_apartment_number,
      'operation_type', 'manual'
    ),
    'info', 'closed'
  );
END;
$$;

-- Acceptance finalization for the authenticated user's OWN admin-provisioned pending
-- resident account. Occupies the recorded intended apartment, approves, and reconciles
-- the manager exactly once. Keyed on auth.uid(), so it can only finalize the caller's
-- own pending assignment (which only an admin could have set), with no token/email match.
CREATE OR REPLACE FUNCTION public.tx_finalize_pending_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_apartment_number text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'no_profile');
  END IF;

  IF v_profile.role <> 'resident'
     OR v_profile.approval_status <> 'pending_approval'
     OR v_profile.apartment_id IS NOT NULL
     OR v_profile.pending_apartment_id IS NULL THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'not_eligible');
  END IF;

  PERFORM public.lock_identity_apartment_state();

  -- Re-read under lock; the intended apartment may have been removed since creation.
  SELECT pending_apartment_id INTO v_profile.pending_apartment_id
  FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_profile.pending_apartment_id IS NULL THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'not_eligible');
  END IF;

  SELECT apartment_number INTO v_apartment_number
  FROM public.apartments WHERE id = v_profile.pending_apartment_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('finalized', false, 'reason', 'apartment_missing');
  END IF;

  UPDATE public.profiles
  SET approval_status = 'approved',
      apartment_id = v_profile.pending_apartment_id,
      pending_apartment_id = NULL,
      status_reason = 'Account activated on acceptance',
      updated_at = now()
  WHERE id = v_uid;

  PERFORM public.reconcile_identity_apartments(
    ARRAY[v_profile.pending_apartment_id],
    NULL,
    'Account activated on acceptance',
    'self'
  );

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'identity', 'ACCOUNT_ACTIVATED', 'profile', v_uid, v_uid,
    jsonb_build_object(
      'content', 'Admin-provisioned account activated on acceptance',
      'target_email', v_profile.email,
      'old_status', 'pending_approval',
      'new_status', 'approved',
      'new_apartment_id', v_profile.pending_apartment_id,
      'apartment_number', v_apartment_number,
      'operation_type', 'self'
    ),
    'info', 'closed'
  );

  RETURN jsonb_build_object('finalized', true, 'apartment_number', v_apartment_number);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tx_provision_pending_account(uuid, user_role, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tx_finalize_pending_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_provision_pending_account(uuid, user_role, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_finalize_pending_account() TO authenticated;

COMMIT;
