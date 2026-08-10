-- Title: Parking Assignment In-Transaction Validation
-- Path: supabase/applied/0021_parking_assignment_validation.sql
-- Functionality: Enforce in the database the same assignment rules ParkingService already
--   checks in TypeScript, so a direct RPC call (bypassing the service) cannot assign a
--   non-assignable spot or an unapproved / wrong-apartment vehicle. Builds on 0020 (row
--   locks + active-assignment uniqueness). Safe for the app: the service already rejects
--   these inputs, so it never sends them.
--
--   Rules enforced inside tx_assign_parking_spot / tx_transfer_parking_spot:
--     - target spot status must be assignable (available | temporary);
--     - if a vehicle is given, it must be approved and belong to the target apartment.

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

  -- Lock the spot row to serialize concurrent assigns.
  SELECT status INTO v_spot_status FROM public.parking_spots WHERE id = p_spot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: parking spot'; END IF;
  IF v_spot_status NOT IN ('available', 'temporary') THEN
    RAISE EXCEPTION 'RULE: spot is not assignable (status: %)', v_spot_status;
  END IF;

  IF p_vehicle_id IS NOT NULL THEN
    SELECT approval_status, apartment_id INTO v_veh_status, v_veh_apartment
    FROM public.vehicles WHERE id = p_vehicle_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: vehicle'; END IF;
    IF v_veh_status <> 'approved' THEN RAISE EXCEPTION 'RULE: vehicle is not approved'; END IF;
    IF v_veh_apartment <> p_apartment_id THEN RAISE EXCEPTION 'RULE: vehicle does not belong to the target apartment'; END IF;
  END IF;

  -- One active assignment per spot / per vehicle (also enforced structurally by 0020).
  IF EXISTS (SELECT 1 FROM public.parking_assignments WHERE spot_id = p_spot_id AND status = 'active') THEN
    RAISE EXCEPTION 'RULE: spot already has an active assignment';
  END IF;
  IF p_vehicle_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.parking_assignments WHERE vehicle_id = p_vehicle_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'RULE: vehicle already has an active assignment';
  END IF;

  UPDATE public.parking_spots
    SET status = 'assigned', assigned_apartment_id = p_apartment_id, assigned_vehicle_id = p_vehicle_id, updated_at = now()
    WHERE id = p_spot_id;
  INSERT INTO public.parking_assignments (spot_id, apartment_id, vehicle_id, assignment_type, status, starts_at, ends_at, created_by)
    VALUES (p_spot_id, p_apartment_id, p_vehicle_id, COALESCE(p_assignment_type, 'permanent'), 'active', now(), p_ends_at, auth.uid());
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property', 'PARKING_ASSIGNED', 'parking_spot', p_spot_id, auth.uid(), p_payload, 'info', 'closed');
END; $$;

CREATE OR REPLACE FUNCTION public.tx_transfer_parking_spot(
  p_old_spot_id uuid, p_new_spot_id uuid, p_apartment_id uuid,
  p_vehicle_id uuid, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_status public.parking_spot_status;
  v_veh_status public.vehicle_status;
  v_veh_apartment uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;

  -- Lock both spots in a deterministic order to avoid deadlocks between concurrent transfers.
  PERFORM 1 FROM public.parking_spots WHERE id IN (p_old_spot_id, p_new_spot_id) ORDER BY id FOR UPDATE;

  SELECT status INTO v_new_status FROM public.parking_spots WHERE id = p_new_spot_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: target parking spot'; END IF;
  IF v_new_status NOT IN ('available', 'temporary') THEN
    RAISE EXCEPTION 'RULE: target spot is not assignable (status: %)', v_new_status;
  END IF;

  IF p_vehicle_id IS NOT NULL THEN
    SELECT approval_status, apartment_id INTO v_veh_status, v_veh_apartment
    FROM public.vehicles WHERE id = p_vehicle_id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: vehicle'; END IF;
    IF v_veh_status <> 'approved' THEN RAISE EXCEPTION 'RULE: vehicle is not approved'; END IF;
    IF v_veh_apartment <> p_apartment_id THEN RAISE EXCEPTION 'RULE: vehicle does not belong to the target apartment'; END IF;
  END IF;

  IF p_new_spot_id <> p_old_spot_id AND EXISTS (
    SELECT 1 FROM public.parking_assignments WHERE spot_id = p_new_spot_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'RULE: target spot already has an active assignment';
  END IF;

  -- Release old spot (deactivate its active assignment first so the vehicle is free).
  UPDATE public.parking_assignments SET status = 'transferred', ends_at = now()
    WHERE spot_id = p_old_spot_id AND status = 'active';
  UPDATE public.parking_spots
    SET status = 'available', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
    WHERE id = p_old_spot_id;

  -- Occupy new spot.
  UPDATE public.parking_spots
    SET status = 'assigned', assigned_apartment_id = p_apartment_id, assigned_vehicle_id = p_vehicle_id, updated_at = now()
    WHERE id = p_new_spot_id;
  INSERT INTO public.parking_assignments (spot_id, apartment_id, vehicle_id, assignment_type, status, starts_at, created_by)
    VALUES (p_new_spot_id, p_apartment_id, p_vehicle_id, 'permanent', 'active', now(), auth.uid());
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property', 'PARKING_TRANSFERRED', 'parking_spot', p_new_spot_id, auth.uid(), p_payload, 'info', 'closed');
END; $$;

COMMIT;
