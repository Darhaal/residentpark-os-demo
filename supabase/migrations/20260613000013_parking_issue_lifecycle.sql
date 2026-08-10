-- Title: Parking Issue Lifecycle Migration
-- Path: supabase/pending/0013_parking_issue_lifecycle.sql
-- Functionality: Keep parking conflict state consistent across multiple active issues and status transitions.

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

CREATE OR REPLACE FUNCTION public.tx_update_parking_issue(
  p_issue_id uuid,
  p_status text,
  p_note text,
  p_actor uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issue record;
  v_spot record;
  v_has_active_issue boolean := false;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF p_status NOT IN ('open', 'in_progress', 'resolved', 'closed') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid issue status';
  END IF;
  IF p_status IN ('resolved', 'closed')
     AND length(btrim(COALESCE(p_note, ''))) < 3 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: resolution note is required';
  END IF;

  SELECT id, spot_id, status
    INTO v_issue
  FROM public.parking_issues
  WHERE id = p_issue_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'NOT_FOUND: parking issue';
  END IF;

  IF v_issue.spot_id IS NOT NULL THEN
    SELECT id, status, assigned_vehicle_id
      INTO v_spot
    FROM public.parking_spots
    WHERE id = v_issue.spot_id
    FOR UPDATE;
  END IF;

  UPDATE public.parking_issues
  SET status = p_status,
      resolution_note = CASE
        WHEN p_status IN ('resolved', 'closed') THEN btrim(COALESCE(p_note, ''))
        ELSE resolution_note
      END,
      resolved_at = CASE
        WHEN p_status IN ('resolved', 'closed') THEN now()
        ELSE NULL
      END,
      resolved_by = CASE
        WHEN p_status IN ('resolved', 'closed') THEN auth.uid()
        ELSE NULL
      END
  WHERE id = p_issue_id;

  IF v_issue.spot_id IS NOT NULL AND v_spot.id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.parking_issues
      WHERE spot_id = v_issue.spot_id
        AND id <> p_issue_id
        AND status IN ('open', 'in_progress')
    )
    INTO v_has_active_issue;

    IF p_status IN ('open', 'in_progress') THEN
      UPDATE public.parking_spots
      SET status = 'conflict',
          updated_at = now()
      WHERE id = v_issue.spot_id
        AND status IS DISTINCT FROM 'conflict';
    ELSIF v_spot.status = 'conflict' AND NOT v_has_active_issue THEN
      UPDATE public.parking_spots
      SET status = CASE
            WHEN assigned_vehicle_id IS NOT NULL THEN 'assigned'::public.parking_spot_status
            ELSE 'available'::public.parking_spot_status
          END,
          updated_at = now()
      WHERE id = v_issue.spot_id;
    END IF;
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
    'property',
    'PARKING_ISSUE_UPDATED',
    'system',
    p_issue_id,
    auth.uid(),
    'info',
    (CASE WHEN p_status IN ('resolved', 'closed') THEN 'closed' ELSE 'open' END)::public.event_status,
    jsonb_build_object(
      'old_status', v_issue.status,
      'new_status', p_status,
      'note', p_note,
      'active_issue_remaining', v_has_active_issue,
      'operation_type', 'manual'
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tx_report_parking_issue(uuid, varchar, varchar, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tx_update_parking_issue(uuid, text, text, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.tx_report_parking_issue(uuid, varchar, varchar, text, uuid),
  public.tx_update_parking_issue(uuid, text, text, uuid)
  TO authenticated;

COMMIT;
