-- Make identity changes and apartment occupancy/manager reconciliation atomic.
-- Apply after 0001_security_hardening.sql and the database baseline.

BEGIN;

-- Identity mutations are low-volume administrative operations in the current
-- single-building product. Serializing them avoids cross-apartment races while
-- preserving deterministic manager selection.
CREATE OR REPLACE FUNCTION public.lock_identity_apartment_state()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_xact_lock(
    hashtextextended('residentpark:identity-apartment-state', 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.reconcile_identity_apartments(
  p_apartment_ids uuid[],
  p_preferred_manager_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'Automatic identity reconciliation',
  p_operation_type text DEFAULT 'system'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apartment_id uuid;
  v_apartment public.apartments%ROWTYPE;
  v_occupant_count integer;
  v_next_status public.apartment_status;
  v_target_manager_id uuid;
  v_existing_manager_ids uuid[];
  v_expected_manager_ids uuid[];
BEGIN
  IF p_apartment_ids IS NULL OR cardinality(p_apartment_ids) = 0 THEN
    RETURN;
  END IF;

  PERFORM public.lock_identity_apartment_state();

  FOR v_apartment_id IN
    SELECT DISTINCT requested.apartment_id
    FROM unnest(p_apartment_ids) AS requested(apartment_id)
    WHERE requested.apartment_id IS NOT NULL
    ORDER BY requested.apartment_id
  LOOP
    SELECT *
      INTO v_apartment
    FROM public.apartments
    WHERE id = v_apartment_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    SELECT count(*)
      INTO v_occupant_count
    FROM public.profiles
    WHERE apartment_id = v_apartment_id
      AND role = 'resident'
      AND approval_status <> 'rejected';

    v_next_status := CASE
      WHEN v_occupant_count > 0 THEN 'occupied'::public.apartment_status
      ELSE 'vacant'::public.apartment_status
    END;

    -- Operational problem/restricted states are intentional manual overrides.
    IF v_apartment.status IN ('vacant', 'occupied')
       AND v_apartment.status IS DISTINCT FROM v_next_status THEN
      UPDATE public.apartments
      SET status = v_next_status
      WHERE id = v_apartment_id;

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
        'APARTMENT_STATUS_RECONCILED',
        'apartment',
        v_apartment_id,
        auth.uid(),
        jsonb_build_object(
          'content', format('Unit %s occupancy reconciled to %s', v_apartment.apartment_number, v_next_status),
          'old_status', v_apartment.status,
          'new_status', v_next_status,
          'occupant_count', v_occupant_count,
          'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'Automatic identity reconciliation'),
          'operation_type', COALESCE(NULLIF(btrim(p_operation_type), ''), 'system')
        ),
        'info',
        'closed'
      );
    END IF;

    v_target_manager_id := NULL;

    IF p_preferred_manager_id IS NOT NULL THEN
      SELECT id
        INTO v_target_manager_id
      FROM public.profiles
      WHERE id = p_preferred_manager_id
        AND apartment_id = v_apartment_id
        AND role = 'resident'
        AND approval_status = 'approved';
    END IF;

    IF v_target_manager_id IS NULL THEN
      SELECT id
        INTO v_target_manager_id
      FROM public.profiles
      WHERE apartment_id = v_apartment_id
        AND role = 'resident'
        AND approval_status = 'approved'
        AND is_apartment_manager
      ORDER BY created_at, id
      LIMIT 1;
    END IF;

    IF v_target_manager_id IS NULL THEN
      SELECT id
        INTO v_target_manager_id
      FROM public.profiles
      WHERE apartment_id = v_apartment_id
        AND role = 'resident'
        AND approval_status = 'approved'
      ORDER BY created_at, id
      LIMIT 1;
    END IF;

    SELECT COALESCE(array_agg(id ORDER BY id), '{}'::uuid[])
      INTO v_existing_manager_ids
    FROM public.profiles
    WHERE apartment_id = v_apartment_id
      AND role = 'resident'
      AND is_apartment_manager;

    v_expected_manager_ids := CASE
      WHEN v_target_manager_id IS NULL THEN '{}'::uuid[]
      ELSE ARRAY[v_target_manager_id]
    END;

    UPDATE public.profiles
    SET is_apartment_manager = COALESCE(id = v_target_manager_id, false),
        updated_at = CASE
          WHEN is_apartment_manager IS DISTINCT FROM COALESCE(id = v_target_manager_id, false) THEN now()
          ELSE updated_at
        END
    WHERE apartment_id = v_apartment_id
      AND role = 'resident'
      AND is_apartment_manager IS DISTINCT FROM COALESCE(id = v_target_manager_id, false);

    IF v_existing_manager_ids IS DISTINCT FROM v_expected_manager_ids THEN
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
        'APARTMENT_MANAGER_RECONCILED',
        'apartment',
        v_apartment_id,
        auth.uid(),
        jsonb_build_object(
          'content', CASE
            WHEN v_target_manager_id IS NULL THEN format('Unit %s has no eligible apartment manager', v_apartment.apartment_number)
            ELSE format('Unit %s apartment manager reconciled', v_apartment.apartment_number)
          END,
          'old_manager_ids', v_existing_manager_ids,
          'new_manager_id', v_target_manager_id,
          'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'Automatic identity reconciliation'),
          'operation_type', COALESCE(NULLIF(btrim(p_operation_type), ''), 'system')
        ),
        'info',
        'closed'
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_identity_update_status(
  p_target_id uuid,
  p_new_status public.profile_status,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
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
  IF v_target.approval_status = p_new_status THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET approval_status = p_new_status,
      status_reason = btrim(p_reason),
      updated_at = now()
  WHERE id = p_target_id;

  PERFORM public.reconcile_identity_apartments(
    ARRAY[v_target.apartment_id],
    NULL,
    p_reason,
    'manual'
  );

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'identity', 'ACCOUNT_STATUS_CHANGED', 'profile', p_target_id, auth.uid(),
    jsonb_build_object(
      'content', 'Account status changed',
      'target_email', v_target.email,
      'target_name', v_target.full_name,
      'old_status', v_target.approval_status,
      'new_status', p_new_status,
      'reason', btrim(p_reason),
      'operation_type', 'manual'
    ),
    CASE WHEN p_new_status = 'suspended' THEN 'warning'::public.event_severity ELSE 'info'::public.event_severity END,
    'closed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_identity_bulk_update_status(
  p_target_ids uuid[],
  p_new_status public.profile_status,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_requested_count integer;
  v_found_count integer;
  v_apartment_ids uuid[] := '{}'::uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF p_target_ids IS NULL OR cardinality(p_target_ids) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(p_target_ids) > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: too many target profiles';
  END IF;
  IF auth.uid() = ANY(p_target_ids) THEN
    RAISE EXCEPTION 'RULE: self-modification is not allowed';
  END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: reason is required';
  END IF;

  SELECT count(DISTINCT requested.target_id)
    INTO v_requested_count
  FROM unnest(p_target_ids) AS requested(target_id);
  SELECT count(*) INTO v_found_count FROM public.profiles WHERE id = ANY(p_target_ids);
  IF v_found_count <> v_requested_count THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: one or more profiles';
  END IF;
  IF NOT public.is_superadmin() AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = ANY(p_target_ids) AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin may modify privileged accounts';
  END IF;

  PERFORM public.lock_identity_apartment_state();

  FOR v_target IN
    SELECT * FROM public.profiles
    WHERE id = ANY(p_target_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    v_apartment_ids := array_append(v_apartment_ids, v_target.apartment_id);

    IF v_target.approval_status IS DISTINCT FROM p_new_status THEN
      UPDATE public.profiles
      SET approval_status = p_new_status,
          status_reason = btrim(p_reason),
          updated_at = now()
      WHERE id = v_target.id;

      INSERT INTO public.events (
        domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
      ) VALUES (
        'identity', 'ACCOUNT_STATUS_CHANGED', 'profile', v_target.id, auth.uid(),
        jsonb_build_object(
          'content', 'Account status changed',
          'target_email', v_target.email,
          'target_name', v_target.full_name,
          'old_status', v_target.approval_status,
          'new_status', p_new_status,
          'reason', btrim(p_reason),
          'operation_type', 'bulk'
        ),
        CASE WHEN p_new_status = 'suspended' THEN 'warning'::public.event_severity ELSE 'info'::public.event_severity END,
        'closed'
      );
    END IF;
  END LOOP;

  PERFORM public.reconcile_identity_apartments(v_apartment_ids, NULL, p_reason, 'bulk');
END;
$$;

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
    p_target_id,
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

CREATE OR REPLACE FUNCTION public.tx_identity_update_permissions(
  p_target_id uuid,
  p_new_role public.user_role,
  p_is_manager boolean,
  p_apartment_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_final_target public.profiles%ROWTYPE;
  v_effective_manager boolean;
  v_preferred_manager_id uuid;
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
  IF p_new_role IN ('admin', 'superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin may grant a privileged role';
  END IF;

  PERFORM public.lock_identity_apartment_state();

  IF p_apartment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.apartments WHERE id = p_apartment_id
  ) THEN
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

  v_effective_manager := COALESCE(p_is_manager, false)
    AND p_new_role = 'resident'
    AND p_apartment_id IS NOT NULL
    AND v_target.approval_status = 'approved';

  IF v_target.role = p_new_role
     AND v_target.is_apartment_manager = v_effective_manager
     AND v_target.apartment_id IS NOT DISTINCT FROM p_apartment_id THEN
    RETURN;
  END IF;

  UPDATE public.profiles
  SET role = p_new_role,
      is_apartment_manager = v_effective_manager,
      apartment_id = p_apartment_id,
      updated_at = now()
  WHERE id = p_target_id;

  v_preferred_manager_id := CASE WHEN v_effective_manager THEN p_target_id ELSE NULL END;

  IF v_preferred_manager_id IS NULL
     AND v_target.is_apartment_manager
     AND p_new_role = 'resident'
     AND p_apartment_id IS NOT NULL
     AND v_target.approval_status = 'approved' THEN
    SELECT id
      INTO v_preferred_manager_id
    FROM public.profiles
    WHERE apartment_id = p_apartment_id
      AND id <> p_target_id
      AND role = 'resident'
      AND approval_status = 'approved'
    ORDER BY created_at, id
    LIMIT 1;
  END IF;

  PERFORM public.reconcile_identity_apartments(
    ARRAY[v_target.apartment_id, p_apartment_id],
    v_preferred_manager_id,
    p_reason,
    'manual'
  );

  SELECT * INTO v_final_target
  FROM public.profiles
  WHERE id = p_target_id;

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'identity', 'UPDATE_PERMISSIONS', 'profile', p_target_id, auth.uid(),
    jsonb_build_object(
      'content', 'Identity permissions updated',
      'target_email', v_target.email,
      'old_data', jsonb_build_object(
        'role', v_target.role,
        'is_manager', v_target.is_apartment_manager,
        'apartment_id', v_target.apartment_id
      ),
      'new_data', jsonb_build_object(
        'role', v_final_target.role,
        'is_manager', v_final_target.is_apartment_manager,
        'apartment_id', v_final_target.apartment_id
      ),
      'reason', btrim(p_reason),
      'operation_type', 'manual'
    ),
    CASE WHEN p_new_role IN ('admin', 'superadmin') THEN 'warning'::public.event_severity ELSE 'info'::public.event_severity END,
    'closed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_identity_bulk_update_permissions(
  p_target_ids uuid[],
  p_new_role public.user_role,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
  v_requested_count integer;
  v_found_count integer;
  v_apartment_ids uuid[] := '{}'::uuid[];
  v_next_manager boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF p_target_ids IS NULL OR cardinality(p_target_ids) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(p_target_ids) > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: too many target profiles';
  END IF;
  IF auth.uid() = ANY(p_target_ids) THEN
    RAISE EXCEPTION 'RULE: self-modification is not allowed';
  END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: reason is required';
  END IF;
  IF p_new_role = 'superadmin' THEN
    RAISE EXCEPTION 'RULE: superadmin role cannot be granted in bulk';
  END IF;
  IF p_new_role = 'admin' AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin may grant admin roles in bulk';
  END IF;

  SELECT count(DISTINCT requested.target_id)
    INTO v_requested_count
  FROM unnest(p_target_ids) AS requested(target_id);
  SELECT count(*) INTO v_found_count FROM public.profiles WHERE id = ANY(p_target_ids);
  IF v_found_count <> v_requested_count THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: one or more profiles';
  END IF;
  IF NOT public.is_superadmin() AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = ANY(p_target_ids) AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin may modify privileged accounts';
  END IF;

  PERFORM public.lock_identity_apartment_state();

  FOR v_target IN
    SELECT * FROM public.profiles
    WHERE id = ANY(p_target_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    v_apartment_ids := array_append(v_apartment_ids, v_target.apartment_id);
    v_next_manager := p_new_role = 'resident'
      AND v_target.role = 'resident'
      AND v_target.is_apartment_manager
      AND v_target.approval_status = 'approved'
      AND v_target.apartment_id IS NOT NULL;

    IF v_target.role IS DISTINCT FROM p_new_role
       OR v_target.is_apartment_manager IS DISTINCT FROM v_next_manager THEN
      UPDATE public.profiles
      SET role = p_new_role,
          is_apartment_manager = v_next_manager,
          updated_at = now()
      WHERE id = v_target.id;

      INSERT INTO public.events (
        domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
      ) VALUES (
        'identity', 'UPDATE_PERMISSIONS', 'profile', v_target.id, auth.uid(),
        jsonb_build_object(
          'content', 'Identity permissions updated',
          'target_email', v_target.email,
          'old_data', jsonb_build_object(
            'role', v_target.role,
            'is_manager', v_target.is_apartment_manager,
            'apartment_id', v_target.apartment_id
          ),
          'new_data', jsonb_build_object(
            'role', p_new_role,
            'is_manager', v_next_manager,
            'apartment_id', v_target.apartment_id
          ),
          'reason', btrim(p_reason),
          'operation_type', 'bulk'
        ),
        CASE WHEN p_new_role = 'admin' THEN 'warning'::public.event_severity ELSE 'info'::public.event_severity END,
        'closed'
      );
    END IF;
  END LOOP;

  PERFORM public.reconcile_identity_apartments(v_apartment_ids, NULL, p_reason, 'bulk');
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_identity_bulk_approve_and_assign(
  p_targets jsonb,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_target public.profiles%ROWTYPE;
  v_target_id uuid;
  v_apartment_id uuid;
  v_apartment_number text;
  v_seen_ids uuid[] := '{}'::uuid[];
  v_apartment_ids uuid[] := '{}'::uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF p_targets IS NULL OR jsonb_typeof(p_targets) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: targets must be a JSON array';
  END IF;
  IF jsonb_array_length(p_targets) > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: too many target profiles';
  END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: reason is required';
  END IF;

  PERFORM public.lock_identity_apartment_state();

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_targets)
  LOOP
    v_target_id := NULLIF(v_item->>'targetUserId', '')::uuid;
    v_apartment_id := NULLIF(v_item->>'apartmentId', '')::uuid;

    IF v_target_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: target user is required';
    END IF;
    IF v_target_id = auth.uid() THEN
      RAISE EXCEPTION 'RULE: self-modification is not allowed';
    END IF;
    IF v_target_id = ANY(v_seen_ids) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: duplicate target profile';
    END IF;
    v_seen_ids := array_append(v_seen_ids, v_target_id);

    SELECT * INTO v_target
    FROM public.profiles
    WHERE id = v_target_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: profile';
    END IF;
    IF v_target.role IN ('admin', 'superadmin') AND NOT public.is_superadmin() THEN
      RAISE EXCEPTION 'FORBIDDEN: only a superadmin may modify a privileged account';
    END IF;

    v_apartment_number := NULL;
    IF v_apartment_id IS NOT NULL THEN
      SELECT apartment_number INTO v_apartment_number
      FROM public.apartments
      WHERE id = v_apartment_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: apartment';
      END IF;
    ELSE
      v_apartment_id := v_target.apartment_id;
      IF v_apartment_id IS NOT NULL THEN
        SELECT apartment_number INTO v_apartment_number
        FROM public.apartments
        WHERE id = v_apartment_id;
      END IF;
    END IF;

    v_apartment_ids := array_append(v_apartment_ids, v_target.apartment_id);
    v_apartment_ids := array_append(v_apartment_ids, v_apartment_id);

    UPDATE public.profiles
    SET approval_status = 'approved',
        apartment_id = v_apartment_id,
        status_reason = btrim(p_reason),
        updated_at = now()
    WHERE id = v_target_id;

    INSERT INTO public.events (
      domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
    ) VALUES (
      'identity',
      CASE WHEN v_apartment_id IS NULL THEN 'BULK_ACCOUNT_APPROVED' ELSE 'BULK_ACCOUNT_APPROVED_AND_ASSIGNED' END,
      'profile',
      v_target_id,
      auth.uid(),
      jsonb_build_object(
        'content', CASE WHEN v_apartment_id IS NULL THEN 'Account approved' ELSE 'Account approved and assigned' END,
        'target_email', v_target.email,
        'target_name', v_target.full_name,
        'old_status', v_target.approval_status,
        'new_status', 'approved',
        'old_apartment_id', v_target.apartment_id,
        'new_apartment_id', v_apartment_id,
        'apartment_number', v_apartment_number,
        'reason', btrim(p_reason),
        'operation_type', 'bulk'
      ),
      'info',
      'closed'
    );
  END LOOP;

  PERFORM public.reconcile_identity_apartments(v_apartment_ids, NULL, p_reason, 'bulk');
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_apartment_update_status(
  p_apartment_id uuid,
  p_new_status public.apartment_status,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apartment public.apartments%ROWTYPE;
  v_occupant_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: reason is required';
  END IF;

  PERFORM public.lock_identity_apartment_state();

  SELECT * INTO v_apartment
  FROM public.apartments
  WHERE id = p_apartment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: apartment';
  END IF;
  IF v_apartment.status = p_new_status THEN
    RETURN;
  END IF;

  IF p_new_status = 'vacant' THEN
    SELECT count(*) INTO v_occupant_count
    FROM public.profiles
    WHERE apartment_id = p_apartment_id
      AND role = 'resident'
      AND approval_status <> 'rejected';

    IF v_occupant_count > 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RULE: an apartment with assigned residents cannot be vacant';
    END IF;
  END IF;

  UPDATE public.apartments
  SET status = p_new_status
  WHERE id = p_apartment_id;

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'property', 'APARTMENT_STATUS_CHANGED', 'apartment', p_apartment_id, auth.uid(),
    jsonb_build_object(
      'content', format('Unit %s status changed to %s', v_apartment.apartment_number, p_new_status),
      'old_status', v_apartment.status,
      'new_status', p_new_status,
      'reason', btrim(p_reason),
      'apartment_number', v_apartment.apartment_number,
      'operation_type', 'manual'
    ),
    CASE WHEN p_new_status IN ('problem', 'restricted') THEN 'warning'::public.event_severity ELSE 'info'::public.event_severity END,
    CASE WHEN p_new_status IN ('problem', 'restricted') THEN 'open'::public.event_status ELSE 'closed'::public.event_status END
  );
END;
$$;

-- Remove invalid flags left by older application-level reconciliation, then
-- repair existing apartment states before closing the transaction.
UPDATE public.profiles
SET is_apartment_manager = false,
    updated_at = now()
WHERE is_apartment_manager
  AND (
    role <> 'resident'
    OR approval_status <> 'approved'
    OR apartment_id IS NULL
  );

SELECT public.reconcile_identity_apartments(
  ARRAY(SELECT id FROM public.apartments ORDER BY id),
  NULL,
  'Migration reconciliation',
  'system'
);

-- Old RPCs trusted caller-authored audit payloads and left apartment invariants
-- to non-atomic application follow-up requests.
REVOKE ALL ON FUNCTION public.tx_update_profile_status(
  uuid, public.profile_status, text, uuid, jsonb, public.event_severity
) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.tx_bulk_update_profile_status(
  uuid[], public.profile_status, text, uuid, jsonb, public.event_severity
) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.tx_approve_and_assign(
  uuid, uuid, text, uuid, jsonb
) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.tx_update_permissions(
  uuid, public.user_role, boolean, uuid, uuid, jsonb, public.event_severity
) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.tx_bulk_update_permissions(
  uuid[], public.user_role, boolean, uuid, jsonb, public.event_severity
) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.tx_bulk_approve_and_assign_units(
  jsonb, text, uuid
) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.tx_update_apartment_status(
  uuid, public.apartment_status, uuid, jsonb, public.event_severity, public.event_status
) FROM PUBLIC, authenticated;

REVOKE ALL ON FUNCTION public.lock_identity_apartment_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_identity_apartments(uuid[], uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_identity_update_status(uuid, public.profile_status, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_identity_bulk_update_status(uuid[], public.profile_status, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_identity_approve_and_assign(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_identity_update_permissions(uuid, public.user_role, boolean, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_identity_bulk_update_permissions(uuid[], public.user_role, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_identity_bulk_approve_and_assign(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tx_apartment_update_status(uuid, public.apartment_status, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tx_identity_update_status(uuid, public.profile_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_identity_bulk_update_status(uuid[], public.profile_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_identity_approve_and_assign(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_identity_update_permissions(uuid, public.user_role, boolean, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_identity_bulk_update_permissions(uuid[], public.user_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_identity_bulk_approve_and_assign(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_apartment_update_status(uuid, public.apartment_status, text) TO authenticated;

COMMIT;
