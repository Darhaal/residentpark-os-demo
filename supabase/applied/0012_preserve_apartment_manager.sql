-- Title: Preserve Apartment Manager Migration
-- Path: supabase/pending/0012_preserve_apartment_manager.sql
-- Functionality: Preserve an existing apartment manager during approve-and-assign and invitation consumption.

BEGIN;

-- p_preferred_manager_id is reserved for explicit manager-transfer commands.
-- Normal approve-and-assign must let reconcile_identity_apartments preserve the
-- existing eligible manager or choose the first approved resident when none exists.
CREATE OR REPLACE FUNCTION public.tx_identity_approve_and_assign(
  p_target_id uuid,
  p_apartment_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_apartment_number text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF p_target_id = auth.uid() THEN
    RAISE EXCEPTION 'RULE: self-modification is not allowed';
  END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: reason is required';
  END IF;

  PERFORM public.lock_identity_apartment_state();

  SELECT apartment_number INTO v_apartment_number
  FROM public.apartments
  WHERE id = p_apartment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: apartment';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE id = p_target_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: profile';
  END IF;
  IF v_target.role IN ('admin', 'superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin may modify a privileged account';
  END IF;

  UPDATE public.profiles
  SET approval_status = 'approved',
      apartment_id = p_apartment_id,
      status_reason = btrim(p_reason),
      updated_at = now()
  WHERE id = p_target_id;

  PERFORM public.reconcile_identity_apartments(
    ARRAY[v_target.apartment_id, p_apartment_id],
    NULL,
    p_reason,
    'manual'
  );

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'identity', 'ACCOUNT_APPROVED_AND_ASSIGNED', 'profile', p_target_id, auth.uid(),
    jsonb_build_object(
      'content', 'Account approved and assigned',
      'target_email', v_target.email,
      'target_name', v_target.full_name,
      'old_status', v_target.approval_status,
      'new_status', 'approved',
      'old_apartment_id', v_target.apartment_id,
      'new_apartment_id', p_apartment_id,
      'apartment_number', v_apartment_number,
      'reason', btrim(p_reason),
      'operation_type', 'manual'
    ),
    'info',
    'closed'
  );
END;
$$;

-- Invitation consumption is a normal resident activation flow, not an explicit
-- manager transfer. It must preserve the current manager when the unit already
-- has one.
CREATE OR REPLACE FUNCTION public.tx_consume_invitation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_invite_id uuid;
  v_invite_apartment_id uuid;
  v_apartment_number text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'unauthenticated');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'no_profile');
  END IF;

  IF v_profile.role <> 'resident'
     OR v_profile.approval_status <> 'pending_approval'
     OR v_profile.apartment_id IS NOT NULL THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'not_eligible');
  END IF;

  PERFORM public.lock_identity_apartment_state();

  SELECT id, apartment_id
    INTO v_invite_id, v_invite_apartment_id
  FROM public.invitations
  WHERE lower(email) = lower(v_profile.email)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_invite_id IS NULL THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'no_invitation');
  END IF;

  IF v_invite_apartment_id IS NOT NULL THEN
    SELECT apartment_number INTO v_apartment_number
    FROM public.apartments WHERE id = v_invite_apartment_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('consumed', false, 'reason', 'apartment_missing');
    END IF;
  END IF;

  UPDATE public.profiles
  SET approval_status = 'approved',
      apartment_id = v_invite_apartment_id,
      status_reason = 'Invitation accepted',
      updated_at = now()
  WHERE id = v_uid;

  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = v_invite_id;

  PERFORM public.reconcile_identity_apartments(
    ARRAY[v_invite_apartment_id],
    NULL,
    'Invitation accepted',
    'self'
  );

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'identity', 'INVITATION_ACCEPTED', 'profile', v_uid, v_uid,
    jsonb_build_object(
      'content', 'Invitation accepted on registration',
      'invitation_id', v_invite_id,
      'target_email', v_profile.email,
      'old_status', 'pending_approval',
      'new_status', 'approved',
      'new_apartment_id', v_invite_apartment_id,
      'apartment_number', v_apartment_number,
      'operation_type', 'self'
    ),
    'info', 'closed'
  );

  RETURN jsonb_build_object(
    'consumed', true,
    'apartment_number', v_apartment_number
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tx_identity_approve_and_assign(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tx_consume_invitation() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.tx_identity_approve_and_assign(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_consume_invitation() TO authenticated;

COMMIT;
