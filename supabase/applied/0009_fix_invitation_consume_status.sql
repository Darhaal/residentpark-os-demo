-- 0009_fix_invitation_consume_status.sql
-- Bug fix for 0006: tx_consume_invitation() compared approval_status to the literal
-- 'pending', but the profile_status enum value is 'pending_approval'. At runtime
-- Postgres coerces 'pending' to profile_status and raises invalid_text_representation,
-- so the function throws for exactly the pending residents it should serve —
-- invitation-based auto-approval on registration never works.
--
-- Fix: compare against 'pending_approval'. Body otherwise identical to 0006.
-- Apply after 0001-0008.

BEGIN;

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

  -- Only a self-registered, not-yet-reviewed resident may auto-consume.
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
    v_uid,
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

REVOKE ALL ON FUNCTION public.tx_consume_invitation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_consume_invitation() TO authenticated;

COMMIT;
