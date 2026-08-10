-- Title: Fixed Settings Policy Migration
-- Path: supabase/pending/0011_fixed_settings_policy.sql
-- Functionality: Enforce fixed vehicle-approval policy and replace settings writes with a portal-banner RPC.

BEGIN;

-- Normalize the singleton row so legacy values cannot keep the retired policy alive.
UPDATE public.building_settings
SET
  max_spots_per_unit = 2,
  require_vehicle_approval = true
WHERE max_spots_per_unit IS DISTINCT FROM 2
   OR require_vehicle_approval IS DISTINCT FROM true;

-- Resident-submitted vehicles are always pending approval. The old building_settings
-- toggle is intentionally ignored: PD-010 makes approval a fixed policy.
CREATE OR REPLACE FUNCTION public.tx_submit_vehicle_request(
  p_apartment_id uuid,
  p_owner_id uuid,
  p_plate_number text,
  p_make text,
  p_model text,
  p_color text,
  p_year integer,
  p_actor_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_caller_apartment_id uuid;
  v_caller_status public.profile_status;
  v_vehicle_status public.vehicle_status := 'pending_approval'::public.vehicle_status;
  v_effective_apartment_id uuid;
  v_effective_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: authentication required';
  END IF;

  IF public.is_admin() THEN
    IF NOT EXISTS (SELECT 1 FROM public.apartments WHERE id = p_apartment_id) THEN
      RAISE EXCEPTION 'RULE: valid apartment required';
    END IF;

    IF p_owner_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = p_owner_id AND apartment_id = p_apartment_id
    ) THEN
      RAISE EXCEPTION 'RULE: vehicle owner must belong to the target apartment';
    END IF;

    v_effective_apartment_id := p_apartment_id;
    v_effective_owner_id := p_owner_id;
  ELSE
    SELECT apartment_id, approval_status
      INTO v_caller_apartment_id, v_caller_status
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'FORBIDDEN: approved account required';
    END IF;

    IF v_caller_apartment_id IS NULL THEN
      RAISE EXCEPTION 'FORBIDDEN: apartment assignment required';
    END IF;

    IF p_owner_id IS DISTINCT FROM auth.uid()
       OR p_apartment_id IS DISTINCT FROM v_caller_apartment_id THEN
      RAISE EXCEPTION 'FORBIDDEN: vehicle owner and apartment must match the current session';
    END IF;

    v_effective_apartment_id := v_caller_apartment_id;
    v_effective_owner_id := auth.uid();
  END IF;

  INSERT INTO public.vehicles (
    apartment_id,
    owner_id,
    plate_number,
    make,
    model,
    color,
    year,
    approval_status,
    approved_at
  ) VALUES (
    v_effective_apartment_id,
    v_effective_owner_id,
    p_plate_number,
    p_make,
    p_model,
    p_color,
    p_year,
    v_vehicle_status,
    NULL
  )
  RETURNING id INTO v_id;

  INSERT INTO public.events (
    domain,
    action_type,
    entity_type,
    entity_id,
    actor_id,
    payload,
    severity,
    workflow_status
  ) VALUES (
    'vehicle',
    'VEHICLE_SUBMITTED',
    'vehicle',
    v_id,
    auth.uid(),
    COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
      'approval_status', v_vehicle_status,
      'auto_approved', false
    ),
    'info',
    'closed'
  );

  RETURN v_id;
END;
$$;

-- The only live building-setting mutation is the resident portal banner.
CREATE OR REPLACE FUNCTION public.tx_update_portal_notice(
  p_notice text,
  p_actor uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_notice text := COALESCE(p_notice, '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  SELECT id
    INTO v_id
  FROM public.building_settings
  ORDER BY updated_at NULLS FIRST
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.building_settings (
      building_name,
      timezone,
      max_spots_per_unit,
      require_vehicle_approval,
      resident_portal_notice,
      updated_by
    ) VALUES (
      'ResidentPark',
      'UTC',
      2,
      true,
      v_notice,
      auth.uid()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.building_settings
    SET
      max_spots_per_unit = 2,
      require_vehicle_approval = true,
      resident_portal_notice = v_notice,
      updated_at = now(),
      updated_by = auth.uid()
    WHERE id = v_id;
  END IF;

  INSERT INTO public.events (
    domain,
    action_type,
    entity_type,
    entity_id,
    actor_id,
    severity,
    workflow_status,
    payload
  ) VALUES (
    'system',
    'SYSTEM_SETTINGS_CHANGED',
    'system',
    v_id,
    auth.uid(),
    'info',
    'closed',
    jsonb_build_object(
      'content', 'Resident portal banner updated',
      'portal_notice_present', btrim(v_notice) <> '',
      'operation_type', 'manual'
    )
  );
END;
$$;

-- Legacy compatibility wrapper: old clients may still call tx_update_settings, but
-- they can only change the portal banner. Retired policy fields are ignored.
CREATE OR REPLACE FUNCTION public.tx_update_settings(
  p_settings jsonb,
  p_actor uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notice text;
BEGIN
  IF COALESCE(p_settings, '{}'::jsonb) ? 'resident_portal_notice' THEN
    v_notice := COALESCE(p_settings->>'resident_portal_notice', '');
  ELSE
    SELECT resident_portal_notice
      INTO v_notice
    FROM public.building_settings
    ORDER BY updated_at NULLS FIRST
    LIMIT 1;
  END IF;

  PERFORM public.tx_update_portal_notice(COALESCE(v_notice, ''), p_actor);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tx_submit_vehicle_request(
  uuid, uuid, text, text, text, text, integer, uuid, jsonb
) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION
  public.tx_update_portal_notice(text, uuid),
  public.tx_update_settings(jsonb, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.tx_submit_vehicle_request(
  uuid, uuid, text, text, text, text, integer, uuid, jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.tx_update_portal_notice(text, uuid),
  public.tx_update_settings(jsonb, uuid)
  TO authenticated;

COMMIT;
