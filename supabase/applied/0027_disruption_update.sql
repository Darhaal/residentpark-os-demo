-- Title: Disruption Update (edit scheduled disruptions)
-- Path: supabase/applied/0027_disruption_update.sql
-- Functionality: tx_update_disruption lets an admin edit a not-yet-activated (scheduled)
--   disruption: its title, reason, date range, and target spot set. Only `scheduled`
--   disruptions can be edited — their spots are recorded intent and carry no captured
--   pre-block state yet, so re-pointing them is safe. Active/completed/cancelled
--   disruptions are immutable here (changing a live block must go through
--   complete/activate). Overlap with OTHER active/scheduled disruptions is rejected,
--   mirroring tx_create_disruption (0022/0023). Additive: no data or behavior change to
--   existing rows.

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_update_disruption(
  p_disruption_id uuid, p_spot_ids uuid[], p_title text, p_reason text,
  p_start date, p_end date, p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_spot_ids IS NULL OR array_length(p_spot_ids, 1) IS NULL THEN RAISE EXCEPTION 'No spots selected'; END IF;

  -- Only a not-yet-activated disruption can be edited; lock its row.
  SELECT status INTO v_status FROM public.parking_disruptions WHERE id = p_disruption_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'NOT_FOUND: disruption does not exist'; END IF;
  IF v_status <> 'scheduled' THEN RAISE EXCEPTION 'RULE: only scheduled disruptions can be edited'; END IF;

  -- Serialize on the target spots and reject overlap with any OTHER active/scheduled disruption.
  PERFORM 1 FROM public.parking_spots WHERE id = ANY(p_spot_ids) ORDER BY id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.parking_disruption_spots ds
    JOIN public.parking_disruptions d ON d.id = ds.disruption_id
    WHERE ds.spot_id = ANY(p_spot_ids) AND d.status IN ('active', 'scheduled') AND d.id <> p_disruption_id
  ) THEN
    RAISE EXCEPTION 'RULE: one or more spots are already in an active disruption';
  END IF;

  UPDATE public.parking_disruptions
    SET title = p_title, reason = p_reason, start_date = p_start, end_date = p_end
    WHERE id = p_disruption_id;

  -- Re-point the target spots (scheduled spots hold no captured pre-block state).
  DELETE FROM public.parking_disruption_spots WHERE disruption_id = p_disruption_id;
  INSERT INTO public.parking_disruption_spots (disruption_id, spot_id)
    SELECT p_disruption_id, id FROM public.parking_spots WHERE id = ANY(p_spot_ids);

  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','DISRUPTION_UPDATED','system',p_disruption_id,auth.uid(),'info','open',
      jsonb_build_object('title',p_title,'reason',p_reason,'start',p_start,'end',p_end,'status','scheduled','operation_type','bulk'));

  RETURN jsonb_build_object('disruption_id', p_disruption_id, 'status', 'scheduled');
END; $$;

REVOKE EXECUTE ON FUNCTION public.tx_update_disruption(uuid, uuid[], text, text, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_update_disruption(uuid, uuid[], text, text, date, date, uuid) TO authenticated;

COMMIT;
