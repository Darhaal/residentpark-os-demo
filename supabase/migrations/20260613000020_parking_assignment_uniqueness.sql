-- Title: Parking Assignment Uniqueness + Locking
-- Path: supabase/applied/0020_parking_assignment_uniqueness.sql
-- Functionality: Make spot/vehicle double-assignment structurally impossible and serialize
--   concurrent assigns. parking_assignments had only a non-unique (spot_id, status) index,
--   and tx_assign_parking_spot inserted a new 'active' row without deactivating or checking
--   an existing active assignment — so two concurrent assigns could double-book a spot or a
--   vehicle. This adds partial unique indexes (one active assignment per spot, one per
--   vehicle) and hardens assign/transfer with row locks and clean pre-checks.
--
--   Verified before apply: live has 0 duplicate active assignments per spot or vehicle.

BEGIN;

-- Structural guarantee: at most one ACTIVE assignment per spot and per vehicle.
-- Partial indexes ignore historical (transferred/revoked/expired) rows and NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS ux_active_assignment_per_spot
  ON public.parking_assignments (spot_id) WHERE status = 'active' AND spot_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_active_assignment_per_vehicle
  ON public.parking_assignments (vehicle_id) WHERE status = 'active' AND vehicle_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tx_assign_parking_spot(
  p_spot_id uuid, p_apartment_id uuid, p_vehicle_id uuid,
  p_assignment_type text, p_ends_at timestamptz, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;

  -- Lock the spot row to serialize concurrent assigns.
  PERFORM 1 FROM public.parking_spots WHERE id = p_spot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: parking spot'; END IF;

  -- Clean errors for what the partial unique indexes would otherwise reject.
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
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;

  -- Lock both spots in a deterministic order to avoid deadlocks between concurrent transfers.
  PERFORM 1 FROM public.parking_spots WHERE id IN (p_old_spot_id, p_new_spot_id) ORDER BY id FOR UPDATE;

  -- The target spot must be free (the old spot is released below).
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
