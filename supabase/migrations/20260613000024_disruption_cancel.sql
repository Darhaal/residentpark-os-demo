-- Title: Cancel a Scheduled Disruption
-- Path: supabase/applied/0024_disruption_cancel.sql
-- Functionality: Complete the scheduled-disruption lifecycle with cancellation. A disruption
--   that has not activated yet (status 'scheduled', no spots blocked) can be cancelled
--   outright. An ACTIVE disruption is not cancelled here — it is restored through
--   tx_complete_disruption — so cancellation needs no spot restoration and stays low-risk.

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_cancel_disruption(p_disruption_id uuid, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;

  SELECT status INTO v_status FROM public.parking_disruptions WHERE id = p_disruption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: disruption'; END IF;
  IF v_status <> 'scheduled' THEN
    RAISE EXCEPTION 'RULE: only a scheduled disruption can be cancelled (complete an active one)';
  END IF;

  UPDATE public.parking_disruptions
    SET status = 'cancelled', completed_at = now()
    WHERE id = p_disruption_id;

  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','DISRUPTION_CANCELLED','system',p_disruption_id,auth.uid(),'info','closed',
      jsonb_build_object('status','cancelled','operation_type','bulk'));

  RETURN jsonb_build_object('status','cancelled');
END; $$;

REVOKE EXECUTE ON FUNCTION public.tx_cancel_disruption(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_cancel_disruption(uuid, uuid) TO authenticated;

COMMIT;
