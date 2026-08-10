-- Title: Parking Assignment Source Validation and Row Locks
-- Path: supabase/migrations/20260628000000_parking_assignment_source_validation.sql
-- Functionality: Locks apartment, vehicle, spot, and active-assignment rows during assign/transfer
--   and proves that a transfer source belongs to the supplied apartment and vehicle.

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_assign_parking_spot(
  p_spot_id uuid, p_apartment_id uuid, p_vehicle_id uuid,
  p_assignment_type text, p_ends_at timestamptz, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_spot_status public.parking_spot_status;
  v_veh_status public.vehicle_status;
  v_veh_apartment uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;

  PERFORM 1 FROM public.apartments WHERE id = p_apartment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: apartment'; END IF;

  SELECT status INTO v_spot_status
  FROM public.parking_spots
  WHERE id = p_spot_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: parking spot'; END IF;
  IF v_spot_status NOT IN ('available', 'temporary') THEN
    RAISE EXCEPTION 'RULE: spot is not assignable (status: %)', v_spot_status;
  END IF;

  IF p_vehicle_id IS NOT NULL THEN
    SELECT approval_status, apartment_id INTO v_veh_status, v_veh_apartment
    FROM public.vehicles
    WHERE id = p_vehicle_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: vehicle'; END IF;
    IF v_veh_status <> 'approved' THEN RAISE EXCEPTION 'RULE: vehicle is not approved'; END IF;
    IF v_veh_apartment <> p_apartment_id THEN RAISE EXCEPTION 'RULE: vehicle does not belong to the target apartment'; END IF;
  END IF;

  PERFORM 1 FROM public.parking_assignments
  WHERE spot_id = p_spot_id AND status = 'active'
  FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'RULE: spot already has an active assignment'; END IF;

  IF p_vehicle_id IS NOT NULL THEN
    PERFORM 1 FROM public.parking_assignments
    WHERE vehicle_id = p_vehicle_id AND status = 'active'
    FOR UPDATE;
    IF FOUND THEN RAISE EXCEPTION 'RULE: vehicle already has an active assignment'; END IF;
  END IF;

  UPDATE public.parking_spots
  SET status = 'assigned',
      assigned_apartment_id = p_apartment_id,
      assigned_vehicle_id = p_vehicle_id,
      updated_at = now()
  WHERE id = p_spot_id;

  INSERT INTO public.parking_assignments (
    spot_id, apartment_id, vehicle_id, assignment_type, status, starts_at, ends_at, created_by
  ) VALUES (
    p_spot_id, p_apartment_id, p_vehicle_id,
    COALESCE(p_assignment_type, 'permanent'), 'active', now(), p_ends_at, auth.uid()
  );

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'property', 'PARKING_ASSIGNED', 'parking_spot', p_spot_id, auth.uid(), p_payload, 'info', 'closed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tx_transfer_parking_spot(
  p_old_spot_id uuid, p_new_spot_id uuid, p_apartment_id uuid,
  p_vehicle_id uuid, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_status public.parking_spot_status;
  v_source_assignment public.parking_assignments%ROWTYPE;
  v_veh_status public.vehicle_status;
  v_veh_apartment uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_old_spot_id = p_new_spot_id THEN RAISE EXCEPTION 'RULE: source and target spots must differ'; END IF;

  PERFORM 1 FROM public.apartments WHERE id = p_apartment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: apartment'; END IF;

  PERFORM 1
  FROM public.parking_spots
  WHERE id IN (p_old_spot_id, p_new_spot_id)
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_source_assignment
  FROM public.parking_assignments
  WHERE spot_id = p_old_spot_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RULE: source spot does not have an active assignment'; END IF;
  IF v_source_assignment.apartment_id IS DISTINCT FROM p_apartment_id THEN
    RAISE EXCEPTION 'RULE: source assignment belongs to a different apartment';
  END IF;
  IF v_source_assignment.vehicle_id IS DISTINCT FROM p_vehicle_id THEN
    RAISE EXCEPTION 'RULE: source assignment belongs to a different vehicle';
  END IF;

  SELECT status INTO v_new_status
  FROM public.parking_spots
  WHERE id = p_new_spot_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: target parking spot'; END IF;
  IF v_new_status NOT IN ('available', 'temporary') THEN
    RAISE EXCEPTION 'RULE: target spot is not assignable (status: %)', v_new_status;
  END IF;

  IF p_vehicle_id IS NOT NULL THEN
    SELECT approval_status, apartment_id INTO v_veh_status, v_veh_apartment
    FROM public.vehicles
    WHERE id = p_vehicle_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: vehicle'; END IF;
    IF v_veh_status <> 'approved' THEN RAISE EXCEPTION 'RULE: vehicle is not approved'; END IF;
    IF v_veh_apartment <> p_apartment_id THEN RAISE EXCEPTION 'RULE: vehicle does not belong to the target apartment'; END IF;
  END IF;

  PERFORM 1 FROM public.parking_assignments
  WHERE spot_id = p_new_spot_id AND status = 'active'
  FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'RULE: target spot already has an active assignment'; END IF;

  UPDATE public.parking_assignments
  SET status = 'transferred', ends_at = now()
  WHERE id = v_source_assignment.id;

  UPDATE public.parking_spots
  SET status = 'available', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
  WHERE id = p_old_spot_id;

  UPDATE public.parking_spots
  SET status = 'assigned', assigned_apartment_id = p_apartment_id, assigned_vehicle_id = p_vehicle_id, updated_at = now()
  WHERE id = p_new_spot_id;

  INSERT INTO public.parking_assignments (
    spot_id, apartment_id, vehicle_id, assignment_type, status, starts_at, created_by
  ) VALUES (
    p_new_spot_id, p_apartment_id, p_vehicle_id, 'permanent', 'active', now(), auth.uid()
  );

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'property', 'PARKING_TRANSFERRED', 'parking_spot', p_new_spot_id, auth.uid(), p_payload, 'info', 'closed'
  );
END;
$$;

COMMIT;
