-- Title: Bulk Block — Source Release Must Also Clear The Status
-- Path: supabase/migrations/20260702000002_bulk_block_release_status.sql
-- Functionality: Completes the 20260702000001 fix. Releasing the relocation source
--   cleared assigned_apartment_id/assigned_vehicle_id but left status='assigned',
--   which violates check_assigned_spot (status NOT IN ('assigned','occupied') OR
--   assigned_apartment_id IS NOT NULL) — caught as 23514 by the bulk-block DB suite
--   on CI run #50. The release now flips the source to 'available' together with the
--   NULLed columns, exactly like tx_transfer_parking_spot; the final bulk UPDATE then
--   blocks every affected spot. No other behavior change.

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_bulk_block_and_relocate(
  p_zone text,
  p_floor text,
  p_reason text,
  p_blocked_until text,
  p_actor_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected_ids uuid[];
  v_blocked_count integer := 0;
  v_relocated_count integer := 0;
  v_unassigned_count integer := 0;
  v_source record;
  v_target record;
  v_relocation_reason text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF length(btrim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: blocking reason is required';
  END IF;

  -- Bulk blocking is rare and garage-wide serialization keeps lock order compatible
  -- with assign/transfer/revoke while preventing two bulk operations from crossing.
  PERFORM id
  FROM public.parking_spots
  ORDER BY id
  FOR UPDATE;

  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[])
  INTO v_affected_ids
  FROM public.parking_spots
  WHERE status <> 'blocked'
    AND (p_zone IS NULL OR zone = p_zone)
    AND (p_floor IS NULL OR floor = p_floor);

  v_blocked_count := cardinality(v_affected_ids);
  IF v_blocked_count = 0 THEN
    RETURN jsonb_build_object('blocked', 0, 'relocated', 0, 'unassigned', 0);
  END IF;

  PERFORM id
  FROM public.parking_assignments
  WHERE spot_id = ANY(v_affected_ids)
    AND status = 'active'
  ORDER BY id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.parking_spots AS spot
    WHERE spot.id = ANY(v_affected_ids)
      AND spot.status IN ('assigned', 'occupied')
      AND spot.assigned_apartment_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.parking_assignments AS assignment
        WHERE assignment.spot_id = spot.id
          AND assignment.status = 'active'
      )
  ) THEN
    RAISE EXCEPTION 'RULE: assigned source spot has no active assignment';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parking_spots AS spot
    JOIN public.parking_assignments AS assignment
      ON assignment.spot_id = spot.id
     AND assignment.status = 'active'
    WHERE spot.id = ANY(v_affected_ids)
      AND spot.status IN ('assigned', 'occupied')
      AND (
        assignment.apartment_id IS DISTINCT FROM spot.assigned_apartment_id
        OR assignment.vehicle_id IS DISTINCT FROM spot.assigned_vehicle_id
      )
  ) THEN
    RAISE EXCEPTION 'RULE: source spot and active assignment disagree';
  END IF;

  v_relocation_reason := 'Auto-relocated due to zone block: ' || btrim(p_reason);

  FOR v_source IN
    SELECT
      spot.id AS spot_id,
      spot.spot_number,
      assignment.id AS assignment_id,
      assignment.apartment_id,
      assignment.vehicle_id,
      apartment.apartment_number,
      vehicle.plate_number
    FROM public.parking_spots AS spot
    JOIN public.parking_assignments AS assignment
      ON assignment.spot_id = spot.id
     AND assignment.status = 'active'
    LEFT JOIN public.apartments AS apartment ON apartment.id = assignment.apartment_id
    LEFT JOIN public.vehicles AS vehicle ON vehicle.id = assignment.vehicle_id
    WHERE spot.id = ANY(v_affected_ids)
      AND spot.status IN ('assigned', 'occupied')
      AND spot.assigned_apartment_id IS NOT NULL
    ORDER BY spot.id
  LOOP
    SELECT spot.id, spot.spot_number
    INTO v_target
    FROM public.parking_spots AS spot
    WHERE NOT (spot.id = ANY(v_affected_ids))
      AND spot.status = 'available'
      AND NOT EXISTS (
        SELECT 1
        FROM public.parking_assignments AS assignment
        WHERE assignment.spot_id = spot.id
          AND assignment.status = 'active'
      )
    ORDER BY spot.id
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.parking_assignments
      SET status = 'transferred', ends_at = now()
      WHERE id = v_source.assignment_id;

      -- Release the source spot BEFORE occupying the target:
      -- unique_active_vehicle_spot allows one spot per vehicle (23505), and
      -- check_assigned_spot forbids status 'assigned'/'occupied' without an
      -- apartment (23514) — so the status must flip together with the columns,
      -- exactly like tx_transfer_parking_spot releases its old spot.
      -- (The final bulk UPDATE blocks these spots afterwards.)
      UPDATE public.parking_spots
      SET status = 'available',
          assigned_apartment_id = NULL,
          assigned_vehicle_id = NULL,
          updated_at = now()
      WHERE id = v_source.spot_id;

      UPDATE public.parking_spots
      SET status = 'assigned',
          assigned_apartment_id = v_source.apartment_id,
          assigned_vehicle_id = v_source.vehicle_id,
          updated_at = now()
      WHERE id = v_target.id;

      INSERT INTO public.parking_assignments (
        spot_id, apartment_id, vehicle_id, assignment_type, status, starts_at, created_by
      ) VALUES (
        v_target.id, v_source.apartment_id, v_source.vehicle_id,
        'permanent', 'active', now(), auth.uid()
      );

      INSERT INTO public.events (
        domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
      ) VALUES (
        'property', 'PARKING_TRANSFERRED', 'parking_spot', v_target.id, auth.uid(),
        jsonb_build_object(
          'spot_from', v_source.spot_number,
          'spot_to', v_target.spot_number,
          'apartment_number', v_source.apartment_number,
          'plate_number', v_source.plate_number,
          'reason', v_relocation_reason,
          'operation_type', 'bulk'
        ),
        'info', 'closed'
      );

      v_relocated_count := v_relocated_count + 1;
    ELSE
      UPDATE public.parking_assignments
      SET status = 'revoked', ends_at = now()
      WHERE id = v_source.assignment_id;

      INSERT INTO public.events (
        domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
      ) VALUES (
        'property', 'PARKING_REVOKED', 'parking_spot', v_source.spot_id, auth.uid(),
        jsonb_build_object(
          'spot_number', v_source.spot_number,
          'previous_apartment_id', v_source.apartment_id,
          'reason', 'Unassigned: No available spots left during bulk block for ' || btrim(p_reason),
          'operation_type', 'bulk'
        ),
        'warning', 'closed'
      );

      v_unassigned_count := v_unassigned_count + 1;
    END IF;
  END LOOP;

  UPDATE public.parking_assignments
  SET status = 'revoked', ends_at = now()
  WHERE spot_id = ANY(v_affected_ids)
    AND status = 'active';

  UPDATE public.parking_spots
  SET status = 'blocked',
      assigned_apartment_id = NULL,
      assigned_vehicle_id = NULL,
      updated_at = now()
  WHERE id = ANY(v_affected_ids);

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'property', 'PARKING_SPOT_BLOCKED', 'system', gen_random_uuid(), auth.uid(),
    COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
      'zone', p_zone,
      'floor', p_floor,
      'reason', btrim(p_reason),
      'blocked_until', p_blocked_until,
      'blocked', v_blocked_count,
      'relocated', v_relocated_count,
      'unassigned', v_unassigned_count,
      'operation_type', 'bulk'
    ),
    'warning', 'closed'
  );

  RETURN jsonb_build_object(
    'blocked', v_blocked_count,
    'relocated', v_relocated_count,
    'unassigned', v_unassigned_count
  );
END;
$$;

COMMIT;
