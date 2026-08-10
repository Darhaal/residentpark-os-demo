-- Title: Manual Spot Status Whitelist (roadmap F1)
-- Path: supabase/migrations/20260702000003_spot_status_whitelist.sql
-- Functionality: tx_update_spot_status accepted any parking_spot_status value, so a
--   direct RPC call could set a spot to 'assigned'/'occupied' without an assignment
--   row or to 'conflict' outside the issue lifecycle (0013 owns conflict), corrupting
--   state the UI would then trust. The RPC now accepts only the statuses the admin UI
--   legitimately sets manually (PARKING_MANUAL_STATUS_OPTIONS in src/config/parking.ts):
--   available | blocked | maintenance | reserved. 'assigned'/'occupied' stay owned by
--   assign/transfer/revoke, 'conflict' by the issue lifecycle, and 'temporary' by the
--   disruption flow. Otherwise identical to the 0026 version (FOR UPDATE spot lock).

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_update_spot_status(
  p_spot_id uuid, p_new_status text, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clear boolean := p_new_status IN ('available','blocked','maintenance');
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_new_status IS NULL
     OR p_new_status NOT IN ('available','blocked','maintenance','reserved') THEN
    RAISE EXCEPTION 'RULE: manual spot status must be available, blocked, maintenance, or reserved';
  END IF;
  PERFORM 1 FROM public.parking_spots WHERE id = p_spot_id FOR UPDATE;
  IF v_clear THEN
    UPDATE public.parking_assignments SET status = 'revoked', ends_at = now()
      WHERE spot_id = p_spot_id AND status = 'active';
  END IF;
  UPDATE public.parking_spots
    SET status = p_new_status::public.parking_spot_status,
        assigned_apartment_id = CASE WHEN v_clear THEN NULL ELSE assigned_apartment_id END,
        assigned_vehicle_id   = CASE WHEN v_clear THEN NULL ELSE assigned_vehicle_id   END,
        updated_at = now()
    WHERE id = p_spot_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property','PARKING_SPOT_UPDATED','parking_spot',p_spot_id,auth.uid(),p_payload,'info','closed');
END; $$;

COMMIT;
