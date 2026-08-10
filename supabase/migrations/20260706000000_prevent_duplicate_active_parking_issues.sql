-- Title: Prevent Duplicate Active Parking Issues
-- Path: supabase/migrations/20260706000000_prevent_duplicate_active_parking_issues.sql
-- Functionality: Reject duplicate open/in-progress resident parking issues for the same spot and issue type.

BEGIN;

CREATE OR REPLACE FUNCTION public.tx_report_parking_issue(
  p_spot_id uuid,
  p_issue_type varchar,
  p_violating_plate varchar,
  p_comment text,
  p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_apt uuid;
  v_caller_status public.profile_status;
  v_spot_apt uuid;
  v_spot_num text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: authentication required';
  END IF;

  SELECT apartment_id, approval_status
    INTO v_caller_apt, v_caller_status
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'FORBIDDEN: approved account required';
  END IF;
  IF v_caller_apt IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: no apartment associated with this account';
  END IF;
  IF p_issue_type IS NULL OR p_issue_type NOT IN (
    'unauthorized_vehicle',
    'wrong_plate',
    'blocked_access',
    'maintenance',
    'safety',
    'damaged',
    'other'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid issue type';
  END IF;

  SELECT assigned_apartment_id, spot_number
    INTO v_spot_apt, v_spot_num
  FROM public.parking_spots
  WHERE id = p_spot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: parking spot';
  END IF;
  IF v_spot_apt IS NULL OR v_spot_apt <> v_caller_apt THEN
    RAISE EXCEPTION 'FORBIDDEN: you can only report issues for your own assigned spot';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.parking_issues
    WHERE spot_id = p_spot_id
      AND issue_type = p_issue_type
      AND status IN ('open', 'in_progress')
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'CONFLICT: active parking issue already exists for this spot and issue type';
  END IF;

  INSERT INTO public.parking_issues (
    spot_id,
    reporter_id,
    issue_type,
    violating_plate,
    comment,
    status
  ) VALUES (
    p_spot_id,
    auth.uid(),
    p_issue_type,
    NULLIF(btrim(COALESCE(p_violating_plate, '')), ''),
    NULLIF(btrim(COALESCE(p_comment, '')), ''),
    'open'
  )
  RETURNING id INTO v_id;

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
    'property',
    'PARKING_ISSUE_REPORTED',
    'apartment',
    v_caller_apt,
    auth.uid(),
    'warning',
    'open',
    jsonb_build_object(
      'spot_number', v_spot_num,
      'issue_type', p_issue_type,
      'violating_plate', p_violating_plate,
      'comment', p_comment,
      'operation_type', 'manual'
    )
  );

  UPDATE public.parking_spots
  SET status = 'conflict',
      updated_at = now()
  WHERE id = p_spot_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tx_report_parking_issue(uuid, varchar, varchar, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_report_parking_issue(uuid, varchar, varchar, text, uuid) TO authenticated;

COMMIT;
