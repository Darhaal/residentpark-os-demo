-- Title: Disruption Scheduling Lifecycle
-- Path: supabase/applied/0023_disruption_scheduling.sql
-- Functionality: Add a scheduled -> active lifecycle for future-dated disruptions (PD: real
--   scheduling). Previously every disruption was created 'active' and blocked spots
--   immediately. Now:
--     - tx_create_disruption inserts the disruption + its target spots, then activates
--       immediately only when start_date <= today; a future start_date stays 'scheduled'
--       (spots are NOT blocked yet).
--     - tx_activate_disruption(id) flips a scheduled disruption to active, recording each
--       spot's pre-block state, blocking it, and relocating its vehicle (the single source
--       of the block/relocate logic that create used to inline).
--     - tx_activate_due_disruptions() activates every scheduled disruption whose start_date
--       has arrived; intended to be called by a daily scheduler (pg_cron / Edge Function).
--   The overlap guard + spot row locks from 0022 are preserved. Behavior change: a
--   future-dated disruption no longer blocks spots until its start date.
--
--   NOTE: auto-activation requires a scheduler to call tx_activate_due_disruptions() daily
--   (owner infra; not configured here). Without it, scheduled disruptions can still be
--   activated manually via tx_activate_disruption.

BEGIN;

-- Block + relocate the spots of a SCHEDULED disruption and mark it active. Admin-only for
-- end users; auth.uid() IS NULL is the trusted scheduler/service path.
CREATE OR REPLACE FUNCTION public.tx_activate_disruption(p_disruption_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
  v_spot   record;
  v_target uuid;
  v_blocked int := 0; v_relocated int := 0; v_needs int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  SELECT status INTO v_status FROM public.parking_disruptions WHERE id = p_disruption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: disruption'; END IF;
  IF v_status <> 'scheduled' THEN RAISE EXCEPTION 'RULE: disruption is not scheduled'; END IF;

  -- Lock the target spots in a deterministic order.
  PERFORM 1 FROM public.parking_spots
    WHERE id IN (SELECT spot_id FROM public.parking_disruption_spots WHERE disruption_id = p_disruption_id)
    ORDER BY id FOR UPDATE;

  FOR v_spot IN
    SELECT ps.id, ps.spot_number, ps.status, ps.assigned_apartment_id, ps.assigned_vehicle_id
    FROM public.parking_disruption_spots pds
    JOIN public.parking_spots ps ON ps.id = pds.spot_id
    WHERE pds.disruption_id = p_disruption_id
  LOOP
    -- Record the pre-block state now (it was unknown when the disruption was scheduled).
    UPDATE public.parking_disruption_spots
      SET previous_status = v_spot.status,
          previous_apartment_id = v_spot.assigned_apartment_id,
          previous_vehicle_id = v_spot.assigned_vehicle_id
      WHERE disruption_id = p_disruption_id AND spot_id = v_spot.id;

    -- Clear + block original FIRST (releases unique_active_vehicle_spot constraint)
    UPDATE public.parking_spots
      SET status = 'blocked', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
      WHERE id = v_spot.id;
    v_blocked := v_blocked + 1;

    IF v_spot.assigned_vehicle_id IS NOT NULL THEN
      SELECT id INTO v_target FROM public.parking_spots
        WHERE status = 'available' AND assigned_vehicle_id IS NULL
          AND id NOT IN (SELECT spot_id FROM public.parking_disruption_spots WHERE disruption_id = p_disruption_id)
        ORDER BY spot_number LIMIT 1;

      IF v_target IS NOT NULL THEN
        UPDATE public.parking_spots
          SET status = 'occupied', assigned_apartment_id = v_spot.assigned_apartment_id,
              assigned_vehicle_id = v_spot.assigned_vehicle_id, updated_at = now()
          WHERE id = v_target;
        INSERT INTO public.temporary_relocations
          (disruption_id, vehicle_id, apartment_id, original_spot_id, temporary_spot_id, status)
          VALUES (p_disruption_id, v_spot.assigned_vehicle_id, v_spot.assigned_apartment_id, v_spot.id, v_target, 'active');
        v_relocated := v_relocated + 1;
      ELSE
        INSERT INTO public.temporary_relocations
          (disruption_id, vehicle_id, apartment_id, original_spot_id, temporary_spot_id, status)
          VALUES (p_disruption_id, v_spot.assigned_vehicle_id, v_spot.assigned_apartment_id, v_spot.id, NULL, 'needs_placement');
        v_needs := v_needs + 1;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.parking_disruptions SET status = 'active' WHERE id = p_disruption_id;

  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','DISRUPTION_ACTIVATED','system',p_disruption_id,auth.uid(),'warning','open',
      jsonb_build_object('blocked',v_blocked,'relocated',v_relocated,'needs_placement',v_needs,'status','active','operation_type','bulk'));

  RETURN jsonb_build_object('blocked',v_blocked,'relocated',v_relocated,'needs_placement',v_needs,'status','active');
END; $$;

CREATE OR REPLACE FUNCTION public.tx_create_disruption(
  p_spot_ids uuid[], p_title text, p_reason text,
  p_start date, p_end date, p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disruption_id uuid;
  v_status text;
  v_activation jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_spot_ids IS NULL OR array_length(p_spot_ids, 1) IS NULL THEN RAISE EXCEPTION 'No spots selected'; END IF;

  -- Serialize concurrent disruptions on these spots, then reject overlap (0022).
  PERFORM 1 FROM public.parking_spots WHERE id = ANY(p_spot_ids) ORDER BY id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.parking_disruption_spots ds
    JOIN public.parking_disruptions d ON d.id = ds.disruption_id
    WHERE ds.spot_id = ANY(p_spot_ids) AND d.status IN ('active', 'scheduled')
  ) THEN
    RAISE EXCEPTION 'RULE: one or more spots are already in an active disruption';
  END IF;

  -- Future start date -> scheduled (no blocking yet); today/past -> activate immediately.
  v_status := CASE WHEN p_start > current_date THEN 'scheduled' ELSE 'active' END;

  INSERT INTO public.parking_disruptions (title, reason, start_date, end_date, status, created_by)
    VALUES (p_title, p_reason, p_start, p_end, 'scheduled', auth.uid())
    RETURNING id INTO v_disruption_id;

  -- Record the target spots; their pre-block state is captured at activation.
  INSERT INTO public.parking_disruption_spots (disruption_id, spot_id)
    SELECT v_disruption_id, id FROM public.parking_spots WHERE id = ANY(p_spot_ids);

  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','DISRUPTION_CREATED','system',v_disruption_id,auth.uid(),'warning','open',
      jsonb_build_object('title',p_title,'reason',p_reason,'start',p_start,'end',p_end,'status',v_status,'operation_type','bulk'));

  IF v_status = 'active' THEN
    v_activation := public.tx_activate_disruption(v_disruption_id);
    RETURN jsonb_build_object('disruption_id', v_disruption_id) || v_activation;
  END IF;

  RETURN jsonb_build_object('disruption_id', v_disruption_id, 'blocked', 0, 'relocated', 0, 'needs_placement', 0, 'status', 'scheduled');
END; $$;

-- Activate every scheduled disruption whose start date has arrived. For a daily scheduler.
CREATE OR REPLACE FUNCTION public.tx_activate_due_disruptions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_count int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  FOR v_id IN
    SELECT id FROM public.parking_disruptions
    WHERE status = 'scheduled' AND start_date <= current_date
    ORDER BY start_date
  LOOP
    PERFORM public.tx_activate_disruption(v_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

REVOKE EXECUTE ON FUNCTION public.tx_activate_disruption(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tx_activate_due_disruptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_activate_disruption(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tx_activate_due_disruptions() TO authenticated;

COMMIT;
