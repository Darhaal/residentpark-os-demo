-- Title: Vehicle Transition Hardening Migration
-- Path: supabase/pending/0014_vehicle_transition_hardening.sql
-- Functionality: Enforce vehicle owner/apartment consistency, normalized plates, terminal archive state, and assignment release on rejection.

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_add_vehicle_by_admin(
  p_apartment_id uuid,
  p_owner_id uuid,
  p_plate_number text,
  p_make text,
  p_model text,
  p_color text,
  p_year integer,
  p_actor_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_plate text := upper(btrim(COALESCE(p_plate_number, '')));
  v_make text := NULLIF(btrim(COALESCE(p_make, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.apartments WHERE id = p_apartment_id) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: apartment';
  END IF;
  IF length(v_plate) < 2 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid plate number';
  END IF;
  IF v_make IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: vehicle make is required';
  END IF;
  IF p_year IS NOT NULL AND (p_year < 1980 OR p_year > EXTRACT(YEAR FROM now())::int + 1) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid vehicle year';
  END IF;
  IF p_owner_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_owner_id
      AND role = 'resident'
      AND apartment_id = p_apartment_id
      AND approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'RULE: vehicle owner must be an approved resident in the target apartment';
  END IF;

  INSERT INTO public.vehicles (
    apartment_id,
    owner_id,
    plate_number,
    make,
    model,
    color,
    year,
    approval_status,
    approved_by,
    approved_at
  ) VALUES (
    p_apartment_id,
    p_owner_id,
    v_plate,
    v_make,
    NULLIF(btrim(COALESCE(p_model, '')), ''),
    NULLIF(btrim(COALESCE(p_color, '')), ''),
    p_year,
    'approved',
    auth.uid(),
    now()
  )
  RETURNING id INTO v_id;

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
    'vehicle',
    'VEHICLE_ADDED_BY_ADMIN',
    'vehicle',
    v_id,
    auth.uid(),
    jsonb_build_object(
      'plate_number', v_plate,
      'apartment_id', p_apartment_id,
      'owner_id', p_owner_id,
      'operation_type', 'manual'
    ),
    'info',
    'closed'
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_submit_vehicle_request(
  p_apartment_id uuid,
  p_owner_id uuid,
  p_plate_number text,
  p_make text,
  p_model text,
  p_color text,
  p_year integer,
  p_actor_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_caller_apartment_id uuid;
  v_caller_status public.profile_status;
  v_vehicle_status public.vehicle_status := 'pending_approval'::public.vehicle_status;
  v_plate text := upper(btrim(COALESCE(p_plate_number, '')));
  v_make text := NULLIF(btrim(COALESCE(p_make, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: authentication required';
  END IF;
  IF length(v_plate) < 2 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid plate number';
  END IF;
  IF v_make IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: vehicle make is required';
  END IF;
  IF p_year IS NOT NULL AND (p_year < 1980 OR p_year > EXTRACT(YEAR FROM now())::int + 1) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid vehicle year';
  END IF;

  IF public.is_admin() THEN
    IF NOT EXISTS (SELECT 1 FROM public.apartments WHERE id = p_apartment_id) THEN
      RAISE EXCEPTION 'RULE: valid apartment required';
    END IF;

    IF p_owner_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = p_owner_id
        AND apartment_id = p_apartment_id
        AND role = 'resident'
        AND approval_status = 'approved'
    ) THEN
      RAISE EXCEPTION 'RULE: vehicle owner must be an approved resident in the target apartment';
    END IF;
  ELSE
    SELECT apartment_id, approval_status
      INTO v_caller_apartment_id, v_caller_status
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'FORBIDDEN: approved account required';
    END IF;
    IF v_caller_apartment_id IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: apartment assignment required';
    END IF;
    IF p_owner_id IS DISTINCT FROM auth.uid()
       OR p_apartment_id IS DISTINCT FROM v_caller_apartment_id THEN
      RAISE EXCEPTION 'FORBIDDEN: vehicle owner and apartment must match the current session';
    END IF;
  END IF;

  INSERT INTO public.vehicles (
    apartment_id,
    owner_id,
    plate_number,
    make,
    model,
    color,
    year,
    approval_status,
    approved_at
  ) VALUES (
    p_apartment_id,
    p_owner_id,
    v_plate,
    v_make,
    NULLIF(btrim(COALESCE(p_model, '')), ''),
    NULLIF(btrim(COALESCE(p_color, '')), ''),
    p_year,
    v_vehicle_status,
    NULL
  )
  RETURNING id INTO v_id;

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
    'vehicle',
    'VEHICLE_SUBMITTED',
    'vehicle',
    v_id,
    auth.uid(),
    jsonb_build_object(
      'plate_number', v_plate,
      'apartment_id', p_apartment_id,
      'owner_id', p_owner_id,
      'approval_status', v_vehicle_status,
      'auto_approved', false,
      'operation_type', 'manual'
    ),
    'info',
    'closed'
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_review_vehicle(
  p_vehicle_id uuid,
  p_decision text,
  p_reason text,
  p_actor_id uuid,
  p_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle public.vehicles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid vehicle decision';
  END IF;
  IF p_decision = 'rejected' AND length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: rejection reason is required';
  END IF;

  SELECT *
    INTO v_vehicle
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: vehicle';
  END IF;
  IF v_vehicle.approval_status = 'archived' THEN
    RAISE EXCEPTION 'RULE: archived vehicles cannot be reviewed';
  END IF;
  IF v_vehicle.approval_status::text = p_decision THEN
    RETURN;
  END IF;

  IF p_decision = 'rejected' THEN
    UPDATE public.parking_assignments
    SET status = 'revoked',
        ends_at = now()
    WHERE vehicle_id = p_vehicle_id
      AND status = 'active';

    UPDATE public.parking_spots
    SET status = 'available',
        assigned_vehicle_id = NULL,
        assigned_apartment_id = NULL,
        updated_at = now()
    WHERE assigned_vehicle_id = p_vehicle_id;
  END IF;

  UPDATE public.vehicles
  SET approval_status = p_decision::public.vehicle_status,
      approved_by = CASE WHEN p_decision = 'approved' THEN auth.uid() ELSE NULL END,
      approved_at = CASE WHEN p_decision = 'approved' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_vehicle_id;

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
    'vehicle',
    'VEHICLE_STATUS_CHANGED',
    'vehicle',
    p_vehicle_id,
    auth.uid(),
    jsonb_build_object(
      'plate_number', v_vehicle.plate_number,
      'old_status', v_vehicle.approval_status,
      'new_status', p_decision,
      'reason', p_reason,
      'operation_type', 'manual'
    ),
    CASE WHEN p_decision = 'rejected' THEN 'warning'::public.event_severity ELSE 'info'::public.event_severity END,
    'closed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_bulk_review_vehicles(
  p_vehicle_ids uuid[],
  p_decision text,
  p_reason text,
  p_actor_id uuid,
  p_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF p_vehicle_ids IS NULL OR cardinality(p_vehicle_ids) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(p_vehicle_ids) > 1000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: too many vehicles';
  END IF;

  FOR v_id IN
    SELECT DISTINCT requested.vehicle_id
    FROM unnest(p_vehicle_ids) AS requested(vehicle_id)
    WHERE requested.vehicle_id IS NOT NULL
    ORDER BY requested.vehicle_id
  LOOP
    PERFORM public.tx_review_vehicle(v_id, p_decision, p_reason, p_actor_id, p_payload);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_archive_vehicle(
  p_vehicle_id uuid,
  p_actor_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle public.vehicles%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  SELECT *
    INTO v_vehicle
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: vehicle';
  END IF;
  IF v_vehicle.approval_status = 'archived' THEN
    RETURN;
  END IF;

  UPDATE public.parking_spots
  SET status = 'available',
      assigned_vehicle_id = NULL,
      assigned_apartment_id = NULL,
      updated_at = now()
  WHERE assigned_vehicle_id = p_vehicle_id;

  UPDATE public.parking_assignments
  SET status = 'revoked',
      ends_at = now()
  WHERE vehicle_id = p_vehicle_id
    AND status = 'active';

  UPDATE public.vehicles
  SET approval_status = 'archived',
      approved_by = NULL,
      approved_at = NULL,
      updated_at = now()
  WHERE id = p_vehicle_id;

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
    'vehicle',
    'VEHICLE_REMOVED',
    'vehicle',
    p_vehicle_id,
    auth.uid(),
    jsonb_build_object(
      'plate_number', v_vehicle.plate_number,
      'old_status', v_vehicle.approval_status,
      'new_status', 'archived',
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'Admin archived'),
      'operation_type', 'manual'
    ),
    'warning',
    'closed'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tx_add_vehicle_by_admin(uuid, uuid, text, text, text, text, integer, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tx_submit_vehicle_request(uuid, uuid, text, text, text, text, integer, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tx_review_vehicle(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tx_bulk_review_vehicles(uuid[], text, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tx_archive_vehicle(uuid, uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.tx_add_vehicle_by_admin(uuid, uuid, text, text, text, text, integer, uuid, jsonb),
  public.tx_submit_vehicle_request(uuid, uuid, text, text, text, text, integer, uuid, jsonb),
  public.tx_review_vehicle(uuid, text, text, uuid, jsonb),
  public.tx_bulk_review_vehicles(uuid[], text, text, uuid, jsonb),
  public.tx_archive_vehicle(uuid, uuid, text)
  TO authenticated;

COMMIT;
