-- Title: Token-Bound Invitation Acceptance
-- Path: supabase/applied/0017_token_bound_invitation.sql
-- Functionality: Close the email-only invitation-acceptance hole. The previous
--   no-argument tx_consume_invitation() approved any pending account whose email
--   matched an open invitation — so with email confirmation disabled, an invited
--   email could be claimed without possessing the invitation link.
--
--   The new tx_consume_invitation(p_token) requires the matching unexpired one-time
--   token AND that the authenticated session's email equals the invited email, so
--   acceptance now proves both possession of the invite link and email ownership.
--   The token is delivered out-of-band via the admin "copy accept-link" action.

BEGIN;

-- Remove the insecure email-only signature.
DROP FUNCTION IF EXISTS public.tx_consume_invitation();

CREATE OR REPLACE FUNCTION public.tx_consume_invitation(p_token uuid)
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
  IF p_token IS NULL THEN
    RETURN jsonb_build_object('consumed', false, 'reason', 'missing_token');
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

  -- Possession (token) AND email ownership (invited email == session email).
  SELECT id, apartment_id
    INTO v_invite_id, v_invite_apartment_id
  FROM public.invitations
  WHERE token = p_token
    AND lower(email) = lower(v_profile.email)
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

REVOKE EXECUTE ON FUNCTION public.tx_consume_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_consume_invitation(uuid) TO authenticated;

COMMIT;
