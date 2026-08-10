-- Title: Parking Revoke/Block Row Locks
-- Path: supabase/applied/0026_parking_revoke_block_locks.sql
-- Functionality: Serialize the remaining single-spot parking write RPCs with assign/transfer
--   by taking a FOR UPDATE lock on the spot row before mutating it. tx_assign_parking_spot
--   and tx_transfer_parking_spot already lock (0020/0021); tx_revoke_parking_spot and
--   tx_update_spot_status did not, so a concurrent assign + revoke/block could interleave.
--   Logic is otherwise unchanged (no behavior change for the app, which serializes anyway).

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_revoke_parking_spot(
  p_spot_id uuid, p_reason text, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  PERFORM 1 FROM public.parking_spots WHERE id = p_spot_id FOR UPDATE;
  UPDATE public.parking_assignments SET status = 'revoked', ends_at = now()
    WHERE spot_id = p_spot_id AND status = 'active';
  UPDATE public.parking_spots
    SET status = 'available', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
    WHERE id = p_spot_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property','PARKING_REVOKED','parking_spot',p_spot_id,auth.uid(),p_payload,'warning','closed');
END; $$;

CREATE OR REPLACE FUNCTION public.tx_update_spot_status(
  p_spot_id uuid, p_new_status text, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clear boolean := p_new_status IN ('available','blocked','maintenance');
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
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
