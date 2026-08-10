-- Title: Complete Only Active Disruptions
-- Path: supabase/applied/0025_disruption_complete_active_only.sql
-- Functionality: Tighten the disruption lifecycle so tx_complete_disruption only restores
--   an active disruption. Scheduled disruptions have not blocked their spots yet; they
--   must be activated first or cancelled through tx_cancel_disruption.

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_complete_disruption(
  p_disruption_id uuid, p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
  v_orig record;
  v_temp_ok boolean; v_elsewhere boolean;
  v_returned int := 0; v_review int := 0; v_unblocked int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;

  SELECT status INTO v_status
    FROM public.parking_disruptions
    WHERE id = p_disruption_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: disruption';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'RULE: only an active disruption can be completed';
  END IF;

  FOR v_orig IN
    SELECT pds.spot_id, pds.previous_status,
      COALESCE(pds.previous_apartment_id, tr.apartment_id) AS previous_apartment_id,
      COALESCE(pds.previous_vehicle_id,   tr.vehicle_id)   AS previous_vehicle_id,
      tr.id AS relocation_id, tr.temporary_spot_id, tr.status AS relocation_status
    FROM public.parking_disruption_spots pds
    LEFT JOIN public.temporary_relocations tr
      ON tr.disruption_id = pds.disruption_id AND tr.original_spot_id = pds.spot_id
      AND tr.status IN ('active','needs_placement')
    WHERE pds.disruption_id = p_disruption_id
  LOOP
    v_temp_ok := false; v_elsewhere := false;

    IF v_orig.previous_vehicle_id IS NOT NULL AND v_orig.temporary_spot_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.parking_spots
        WHERE id = v_orig.temporary_spot_id AND assigned_vehicle_id = v_orig.previous_vehicle_id) INTO v_temp_ok;
    END IF;

    IF v_orig.previous_vehicle_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.parking_spots
        WHERE assigned_vehicle_id = v_orig.previous_vehicle_id
          AND id <> COALESCE(v_orig.temporary_spot_id, v_orig.spot_id)) INTO v_elsewhere;
    END IF;

    IF v_orig.previous_vehicle_id IS NOT NULL AND v_orig.temporary_spot_id IS NOT NULL AND NOT v_temp_ok THEN
      UPDATE public.temporary_relocations SET status = 'needs_review' WHERE id = v_orig.relocation_id;
      v_review := v_review + 1; CONTINUE;
    END IF;

    IF v_orig.previous_vehicle_id IS NOT NULL AND v_orig.temporary_spot_id IS NULL AND v_elsewhere THEN
      UPDATE public.temporary_relocations SET status = 'needs_review' WHERE id = v_orig.relocation_id;
      v_review := v_review + 1; CONTINUE;
    END IF;

    IF v_orig.temporary_spot_id IS NOT NULL THEN
      UPDATE public.parking_spots
        SET status = 'available', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
        WHERE id = v_orig.temporary_spot_id AND assigned_vehicle_id = v_orig.previous_vehicle_id;
    END IF;

    UPDATE public.parking_spots
      SET status = COALESCE(v_orig.previous_status, 'available')::public.parking_spot_status,
          assigned_apartment_id = v_orig.previous_apartment_id,
          assigned_vehicle_id   = v_orig.previous_vehicle_id,
          updated_at = now()
      WHERE id = v_orig.spot_id
        AND (status = 'blocked' OR assigned_vehicle_id IS NULL OR assigned_vehicle_id = v_orig.previous_vehicle_id);

    IF FOUND THEN
      v_unblocked := v_unblocked + 1;
      IF v_orig.previous_vehicle_id IS NOT NULL THEN v_returned := v_returned + 1; END IF;
      IF v_orig.relocation_id IS NOT NULL THEN
        UPDATE public.temporary_relocations SET status = 'returned' WHERE id = v_orig.relocation_id;
      END IF;
    ELSE
      IF v_orig.relocation_id IS NOT NULL THEN
        UPDATE public.temporary_relocations SET status = 'needs_review' WHERE id = v_orig.relocation_id;
      END IF;
      v_review := v_review + 1;
    END IF;
  END LOOP;

  UPDATE public.parking_disruptions SET status = 'completed', completed_at = now() WHERE id = p_disruption_id;

  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','DISRUPTION_COMPLETED','system',p_disruption_id,auth.uid(),
      (CASE WHEN v_review > 0 THEN 'warning' ELSE 'info' END)::public.event_severity,
      (CASE WHEN v_review > 0 THEN 'open'    ELSE 'closed' END)::public.event_status,
      jsonb_build_object('returned',v_returned,'needs_review',v_review,'unblocked',v_unblocked,'operation_type','bulk'));

  RETURN jsonb_build_object('returned',v_returned,'needs_review',v_review,'unblocked',v_unblocked);
END; $$;

COMMIT;
