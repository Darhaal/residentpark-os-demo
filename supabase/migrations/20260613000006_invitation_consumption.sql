-- 0006_invitation_consumption.sql
-- Consume a pending invitation when the invited person registers.
-- Apply after 0001-0004 and the database baseline.
--
-- Closes the audit gap "registration currently does not consume invitation
-- tokens".
--
-- Security model:
--   * SECURITY DEFINER, but identity is derived ONLY from auth.uid() and the
--     caller's own profile email. No client-supplied parameters are trusted, so
--     a caller can consume only an invitation addressed to their own email.
--   * The function only ever transitions the CALLER's own *pending resident*
--     profile to approved + assigned. It refuses to touch privileged accounts or
--     already-approved/assigned profiles, and it never grants a privileged role —
--     a privileged-role invitation still becomes an approved resident, and a
--     superadmin elevates the role afterward. This prevents privilege escalation
--     through self-registration.
--   * Occupancy/manager state is reconciled through the same atomic helper used
--     by the hardened identity RPCs (reconcile_identity_apartments from 0004).

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
     OR v_profile.approval_status <> 'pending'
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
      'old_status', 'pending',
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

REVOKE ALL ON FUNCTION public.tx_consume_invitation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tx_consume_invitation() TO authenticated;

COMMIT;
