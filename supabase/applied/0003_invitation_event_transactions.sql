-- Make invitation and event workflows atomic and enforce the audit role boundary.
-- Apply after supabase/baseline/baseline.sql.

BEGIN;

-- Application mutations use SECURITY DEFINER functions below. Keeping direct
-- table writes closed prevents state changes without their matching event.
REVOKE INSERT, UPDATE, DELETE ON public.invitations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.events FROM authenticated;

DROP POLICY IF EXISTS "events_admin" ON public.events;
DROP POLICY IF EXISTS "events_superadmin" ON public.events;
CREATE POLICY "events_superadmin"
  ON public.events
  FOR SELECT
  USING (public.is_superadmin());

CREATE OR REPLACE FUNCTION public.tx_create_invitation(
  p_email text,
  p_apartment_id uuid,
  p_expiration_days integer DEFAULT 7
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_apartment_number text;
  v_invitation_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid email address';
  END IF;

  IF p_expiration_days IS NULL OR p_expiration_days < 1 OR p_expiration_days > 90 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invitation lifetime must be between 1 and 90 days';
  END IF;

  SELECT apartment_number
    INTO v_apartment_number
  FROM public.apartments
  WHERE id = p_apartment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: apartment';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_email || ':' || p_apartment_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.invitations
    WHERE lower(email) = v_email
      AND apartment_id = p_apartment_id
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'CONFLICT: active invitation already exists';
  END IF;

  INSERT INTO public.invitations (
    email,
    role,
    apartment_id,
    status,
    invited_by,
    expires_at
  ) VALUES (
    v_email,
    'resident',
    p_apartment_id,
    'pending',
    auth.uid(),
    now() + make_interval(days => p_expiration_days)
  )
  RETURNING id INTO v_invitation_id;

  INSERT INTO public.events (
    domain,
    action_type,
    entity_type,
    entity_id,
    actor_id,
    payload,
    severity,
    workflow_status
  ) VALUES (
    'identity',
    'USER_INVITED',
    'invitation',
    v_invitation_id,
    auth.uid(),
    jsonb_build_object(
      'email', v_email,
      'apartment_number', v_apartment_number,
      'operation_type', 'manual'
    ),
    'info',
    'closed'
  );

  RETURN v_invitation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_bulk_create_invitations(
  p_invitations jsonb,
  p_expiration_days integer DEFAULT 7
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_email text;
  v_apartment_number text;
  v_apartment_id uuid;
  v_invitation_id uuid;
  v_successful integer := 0;
  v_failed jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  IF p_invitations IS NULL OR jsonb_typeof(p_invitations) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invitations must be a JSON array';
  END IF;

  IF jsonb_array_length(p_invitations) > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: at most 1000 invitations may be processed at once';
  END IF;

  IF p_expiration_days IS NULL OR p_expiration_days < 1 OR p_expiration_days > 90 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invitation lifetime must be between 1 and 90 days';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_invitations)
  LOOP
    v_email := lower(btrim(COALESCE(v_item->>'email', '')));
    v_apartment_number := upper(btrim(COALESCE(v_item->>'apartmentNumber', '')));
    v_apartment_id := NULL;

    IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'email', v_email,
        'apartmentNumber', v_apartment_number,
        'code', 'invalid_email'
      ));
      CONTINUE;
    END IF;

    IF v_apartment_number = '' THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'email', v_email,
        'apartmentNumber', v_apartment_number,
        'code', 'invalid_apartment_number'
      ));
      CONTINUE;
    END IF;

    SELECT id
      INTO v_apartment_id
    FROM public.apartments
    WHERE upper(btrim(apartment_number)) = v_apartment_number
    ORDER BY apartment_number
    LIMIT 1;

    IF v_apartment_id IS NULL THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'email', v_email,
        'apartmentNumber', v_apartment_number,
        'code', 'apartment_not_found'
      ));
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_email || ':' || v_apartment_id::text, 0)
    );

    IF EXISTS (
      SELECT 1
      FROM public.invitations
      WHERE lower(email) = v_email
        AND apartment_id = v_apartment_id
        AND status = 'pending'
        AND expires_at > now()
    ) THEN
      v_failed := v_failed || jsonb_build_array(jsonb_build_object(
        'email', v_email,
        'apartmentNumber', v_apartment_number,
        'code', 'duplicate_pending'
      ));
      CONTINUE;
    END IF;

    INSERT INTO public.invitations (
      email,
      role,
      apartment_id,
      status,
      invited_by,
      expires_at
    ) VALUES (
      v_email,
      'resident',
      v_apartment_id,
      'pending',
      auth.uid(),
      now() + make_interval(days => p_expiration_days)
    )
    RETURNING id INTO v_invitation_id;

    INSERT INTO public.events (
      domain,
      action_type,
      entity_type,
      entity_id,
      actor_id,
      payload,
      severity,
      workflow_status
    ) VALUES (
      'identity',
      'USER_INVITED',
      'invitation',
      v_invitation_id,
      auth.uid(),
      jsonb_build_object(
        'email', v_email,
        'apartment_number', v_apartment_number,
        'operation_type', 'bulk'
      ),
      'info',
      'closed'
    );

    v_successful := v_successful + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'successful', v_successful,
    'failed', v_failed
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_revoke_invitation(
  p_invitation_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.invitations%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  SELECT *
    INTO v_invitation
  FROM public.invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: invitation';
  END IF;

  IF v_invitation.status = 'accepted' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RULE: accepted invitation cannot be revoked';
  END IF;

  IF v_invitation.status = 'revoked' THEN
    RETURN;
  END IF;

  UPDATE public.invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id;

  INSERT INTO public.events (
    domain,
    action_type,
    entity_type,
    entity_id,
    actor_id,
    payload,
    severity,
    workflow_status
  ) VALUES (
    'identity',
    'INVITE_REVOKED',
    'invitation',
    p_invitation_id,
    auth.uid(),
    jsonb_build_object(
      'email', v_invitation.email,
      'old_status', v_invitation.status,
      'new_status', 'revoked',
      'operation_type', 'manual'
    ),
    'warning',
    'closed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_resend_invitation(
  p_invitation_id uuid,
  p_expiration_days integer DEFAULT 7
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.invitations%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  IF p_expiration_days IS NULL OR p_expiration_days < 1 OR p_expiration_days > 90 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invitation lifetime must be between 1 and 90 days';
  END IF;

  SELECT *
    INTO v_invitation
  FROM public.invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: invitation';
  END IF;

  IF v_invitation.status = 'accepted' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RULE: accepted invitation cannot be resent';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      lower(v_invitation.email) || ':' || COALESCE(v_invitation.apartment_id::text, 'unassigned'),
      0
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public.invitations
    WHERE lower(email) = lower(v_invitation.email)
      AND apartment_id IS NOT DISTINCT FROM v_invitation.apartment_id
      AND id <> p_invitation_id
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'CONFLICT: active invitation already exists';
  END IF;

  UPDATE public.invitations
  SET status = 'pending',
      token = gen_random_uuid(),
      expires_at = now() + make_interval(days => p_expiration_days)
  WHERE id = p_invitation_id;

  INSERT INTO public.events (
    domain,
    action_type,
    entity_type,
    entity_id,
    actor_id,
    payload,
    severity,
    workflow_status
  ) VALUES (
    'identity',
    'INVITE_RESENT',
    'invitation',
    p_invitation_id,
    auth.uid(),
    jsonb_build_object(
      'email', v_invitation.email,
      'old_status', v_invitation.status,
      'new_status', 'pending',
      'operation_type', 'manual'
    ),
    'info',
    'closed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_add_apartment_event(
  p_apartment_id uuid,
  p_content text,
  p_severity public.event_severity DEFAULT 'info'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content text := btrim(COALESCE(p_content, ''));
  v_event_id uuid;
  v_action_type text;
  v_workflow_status public.event_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.apartments WHERE id = p_apartment_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: apartment';
  END IF;

  IF v_content = '' OR length(v_content) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: event content must contain between 1 and 4000 characters';
  END IF;

  IF p_severity IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: event severity is required';
  END IF;

  v_action_type := CASE WHEN p_severity = 'info' THEN 'NOTE_ADDED' ELSE 'INCIDENT_REPORTED' END;
  v_workflow_status := CASE WHEN p_severity = 'info' THEN 'closed' ELSE 'open' END;

  INSERT INTO public.events (
    domain,
    action_type,
    entity_type,
    entity_id,
    actor_id,
    payload,
    severity,
    workflow_status
  ) VALUES (
    'property',
    v_action_type,
    'apartment',
    p_apartment_id,
    auth.uid(),
    jsonb_build_object('content', v_content, 'operation_type', 'manual'),
    p_severity,
    v_workflow_status
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_resolve_event(
  p_event_id uuid,
  p_resolution_note text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_resolution_note text := btrim(COALESCE(p_resolution_note, ''));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  IF v_resolution_note = '' OR length(v_resolution_note) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: resolution note must contain between 1 and 4000 characters';
  END IF;

  SELECT *
    INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: event';
  END IF;

  IF v_event.workflow_status NOT IN ('open', 'in_progress') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RULE: only open or in-progress events can be resolved';
  END IF;

  UPDATE public.events
  SET workflow_status = 'resolved'
  WHERE id = p_event_id;

  INSERT INTO public.events (
    domain,
    action_type,
    entity_type,
    entity_id,
    actor_id,
    payload,
    severity,
    workflow_status
  ) VALUES (
    v_event.domain,
    'INCIDENT_RESOLVED',
    v_event.entity_type,
    v_event.entity_id,
    auth.uid(),
    jsonb_build_object(
      'resolution_note', v_resolution_note,
      'resolved_at', now(),
      'resolved_by', auth.uid(),
      'resolved_event_id', p_event_id,
      'operation_type', 'manual'
    ),
    'info',
    'closed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_create_manual_event(
  p_domain text,
  p_action_type text,
  p_severity public.event_severity,
  p_description text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text := lower(btrim(COALESCE(p_domain, '')));
  v_action_type text := upper(regexp_replace(btrim(COALESCE(p_action_type, '')), '[^a-zA-Z0-9]+', '_', 'g'));
  v_description text := btrim(COALESCE(p_description, ''));
  v_event_id uuid := gen_random_uuid();
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: superadmin privileges required';
  END IF;

  IF v_domain NOT IN ('identity', 'property', 'vehicle', 'system') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: unsupported event domain';
  END IF;

  IF v_action_type = '' OR length(v_action_type) > 100 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: action type must contain between 1 and 100 characters';
  END IF;

  IF v_description = '' OR length(v_description) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: description must contain between 1 and 4000 characters';
  END IF;

  IF p_severity IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: event severity is required';
  END IF;

  INSERT INTO public.events (
    id,
    domain,
    action_type,
    entity_type,
    entity_id,
    actor_id,
    payload,
    severity,
    workflow_status
  ) VALUES (
    v_event_id,
    v_domain,
    v_action_type,
    'system',
    v_event_id,
    auth.uid(),
    jsonb_build_object(
      'description', v_description,
      'content', v_description,
      'operation_type', 'manual',
      'source', 'admin_audit_log'
    ),
    p_severity,
    'closed'
  );

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_apartment_open_incidents(
  p_apartment_id uuid
) RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  content text,
  severity text,
  workflow_status text,
  action_type text,
  assigned_to uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.created_at,
    COALESCE(e.payload->>'content', e.action_type)::text,
    e.severity::text,
    e.workflow_status::text,
    e.action_type::text,
    e.assigned_to
  FROM public.events e
  WHERE e.entity_type = 'apartment'
    AND e.entity_id = p_apartment_id
    AND e.workflow_status IN ('open', 'in_progress')
  ORDER BY e.created_at DESC, e.id DESC;
END;
$$;

-- Preserve the existing signature while enforcing the product decision that the
-- complete audit stream is superadmin-only and fixing stable keyset pagination.
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  cursor_created_at timestamptz DEFAULT NULL,
  cursor_id uuid DEFAULT NULL,
  limit_count int DEFAULT 100,
  search_query text DEFAULT NULL,
  action_filter text DEFAULT 'ALL',
  date_from timestamptz DEFAULT NULL,
  date_to timestamptz DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  admin_id uuid,
  action_type text,
  description text,
  created_at timestamptz,
  entity_type text,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  request_id uuid,
  actor_email_snapshot text,
  actor_role_snapshot text,
  admin_full_name text,
  admin_email text,
  workflow_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: superadmin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.actor_id AS admin_id,
    e.action_type::text,
    COALESCE(e.payload->>'content', e.payload->>'description', e.action_type)::text AS description,
    e.created_at,
    e.entity_type::text,
    e.entity_id,
    (e.payload->'old_data')::jsonb AS old_data,
    (e.payload->'new_data')::jsonb AS new_data,
    NULL::text,
    NULL::text,
    NULL::uuid,
    p.email::text,
    p.role::text,
    p.full_name::text,
    p.email::text,
    e.workflow_status::text
  FROM public.events e
  LEFT JOIN public.profiles p ON p.id = e.actor_id
  WHERE (action_filter = 'ALL' OR action_filter IS NULL OR e.action_type = action_filter)
    AND (date_from IS NULL OR e.created_at >= date_from)
    AND (date_to IS NULL OR e.created_at < date_to)
    AND (
      cursor_created_at IS NULL
      OR e.created_at < cursor_created_at
      OR (e.created_at = cursor_created_at AND cursor_id IS NOT NULL AND e.id < cursor_id)
    )
    AND (
      search_query IS NULL
      OR e.action_type ILIKE '%' || search_query || '%'
      OR COALESCE(e.payload->>'content', e.payload->>'description', '') ILIKE '%' || search_query || '%'
      OR e.entity_id::text = search_query
    )
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_count, 100), 1), 50001);
END;
$$;

REVOKE ALL ON FUNCTION public.tx_create_invitation(text, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_bulk_create_invitations(jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_revoke_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_resend_invitation(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_add_apartment_event(uuid, text, public.event_severity) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_resolve_event(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_create_manual_event(text, text, public.event_severity, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_apartment_open_incidents(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_audit_logs(timestamptz, uuid, int, text, text, timestamptz, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tx_create_invitation(text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_bulk_create_invitations(jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_revoke_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_resend_invitation(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_add_apartment_event(uuid, text, public.event_severity) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_resolve_event(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_create_manual_event(text, text, public.event_severity, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_apartment_open_incidents(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_logs(timestamptz, uuid, int, text, text, timestamptz, timestamptz) TO authenticated;

COMMIT;
