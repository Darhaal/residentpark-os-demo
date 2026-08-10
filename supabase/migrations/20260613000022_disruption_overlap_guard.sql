-- Title: Disruption Overlap Guard + Spot Locks
-- Path: supabase/applied/0022_disruption_overlap_guard.sql
-- Functionality: Prevent two non-terminal disruptions from controlling the same spot.
--   tx_create_disruption recorded each spot's "previous" state for restoration but did not
--   check whether a spot was already in an active/scheduled disruption. Overlapping
--   disruptions therefore corrupted restoration: the second disruption recorded the
--   already-'blocked' state as "previous", so completing it restored the spot to 'blocked'.
--   This adds a FOR UPDATE lock on the affected spots (serializes concurrent creation) and
--   rejects creation when any requested spot is already in an active/scheduled disruption.
--   Behavior change: creating an overlapping disruption now errors instead of silently
--   double-blocking. All other logic is unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_create_disruption(
  p_spot_ids uuid[], p_title text, p_reason text,
  p_start date, p_end date, p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disruption_id uuid;
  v_spot    record;
  v_target  uuid;
  v_blocked int := 0; v_relocated int := 0; v_needs int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_spot_ids IS NULL OR array_length(p_spot_ids, 1) IS NULL THEN RAISE EXCEPTION 'No spots selected'; END IF;

  -- Serialize concurrent disruptions on these spots, then reject overlap with a
  -- non-terminal disruption (active or scheduled) so restoration stays correct.
  PERFORM 1 FROM public.parking_spots WHERE id = ANY(p_spot_ids) ORDER BY id FOR UPDATE;
  IF EXISTS (
    SELECT 1
    FROM public.parking_disruption_spots ds
    JOIN public.parking_disruptions d ON d.id = ds.disruption_id
    WHERE ds.spot_id = ANY(p_spot_ids) AND d.status IN ('active', 'scheduled')
  ) THEN
    RAISE EXCEPTION 'RULE: one or more spots are already in an active disruption';
  END IF;

  INSERT INTO public.parking_disruptions (title, reason, start_date, end_date, status, created_by)
    VALUES (p_title, p_reason, p_start, p_end, 'active', auth.uid())
    RETURNING id INTO v_disruption_id;

  FOR v_spot IN
    SELECT id, spot_number, status, assigned_apartment_id, assigned_vehicle_id
    FROM public.parking_spots WHERE id = ANY(p_spot_ids)
  LOOP
    INSERT INTO public.parking_disruption_spots
      (disruption_id, spot_id, previous_status, previous_apartment_id, previous_vehicle_id)
      VALUES (v_disruption_id, v_spot.id, v_spot.status, v_spot.assigned_apartment_id, v_spot.assigned_vehicle_id);

    -- Clear + block original FIRST (releases unique_active_vehicle_spot constraint)
    UPDATE public.parking_spots
      SET status = 'blocked', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
      WHERE id = v_spot.id;
    v_blocked := v_blocked + 1;

    IF v_spot.assigned_vehicle_id IS NOT NULL THEN
      SELECT id INTO v_target FROM public.parking_spots
        WHERE status = 'available' AND assigned_vehicle_id IS NULL AND NOT (id = ANY(p_spot_ids))
        ORDER BY spot_number LIMIT 1;

      IF v_target IS NOT NULL THEN
        UPDATE public.parking_spots
          SET status = 'occupied', assigned_apartment_id = v_spot.assigned_apartment_id,
              assigned_vehicle_id = v_spot.assigned_vehicle_id, updated_at = now()
          WHERE id = v_target;
        INSERT INTO public.temporary_relocations
          (disruption_id, vehicle_id, apartment_id, original_spot_id, temporary_spot_id, status)
          VALUES (v_disruption_id, v_spot.assigned_vehicle_id, v_spot.assigned_apartment_id, v_spot.id, v_target, 'active');
        v_relocated := v_relocated + 1;
      ELSE
        INSERT INTO public.temporary_relocations
          (disruption_id, vehicle_id, apartment_id, original_spot_id, temporary_spot_id, status)
          VALUES (v_disruption_id, v_spot.assigned_vehicle_id, v_spot.assigned_apartment_id, v_spot.id, NULL, 'needs_placement');
        v_needs := v_needs + 1;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','DISRUPTION_CREATED','system',v_disruption_id,auth.uid(),'warning','open',
      jsonb_build_object('title',p_title,'reason',p_reason,'blocked',v_blocked,'relocated',v_relocated,
        'needs_placement',v_needs,'start',p_start,'end',p_end,'status','active','operation_type','bulk'));

  RETURN jsonb_build_object('disruption_id',v_disruption_id,'blocked',v_blocked,'relocated',v_relocated,'needs_placement',v_needs,'status','active');
END; $$;

COMMIT;
