-- Title: Apartment Active Parking Incidents
-- Path: supabase/migrations/20260705000001_apartment_open_incidents.sql
-- Functionality: Sources apartment active incidents from current parking issue status instead of stale events.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_apartment_open_incidents(
  p_apartment_id uuid
) RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  content text,
  severity text,
  workflow_status text,
  action_type text,
  assigned_to uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  RETURN QUERY
  SELECT
    issue.id,
    issue.created_at,
    COALESCE(
      NULLIF(btrim(issue.comment), ''),
      initcap(replace(issue.issue_type, '_', ' '))
    )::text AS content,
    'warning'::text AS severity,
    issue.status::text AS workflow_status,
    'PARKING_ISSUE_REPORTED'::text AS action_type,
    NULL::uuid AS assigned_to
  FROM public.parking_issues AS issue
  JOIN public.parking_spots AS spot ON spot.id = issue.spot_id
  WHERE spot.assigned_apartment_id = p_apartment_id
    AND issue.status IN ('open', 'in_progress')
  ORDER BY issue.created_at DESC, issue.id DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_apartment_open_incidents(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_apartment_open_incidents(uuid)
  TO authenticated;

COMMIT;
