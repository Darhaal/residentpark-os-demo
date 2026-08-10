-- Pending migration: Privacy-safe resident parking map RPC
--
-- WHY THIS FILE EXISTS
-- The app calls supabase.rpc('get_resident_parking_map') from the resident
-- dashboard (src/app/page.tsx).  The function exists in baseline.sql but has
-- NOT yet been applied to the live database.  Until it is applied, residents
-- see "Parking Map Unavailable" instead of the full garage view.
--
-- HOW TO APPLY
-- 1. Open your Supabase project → SQL Editor → New query
-- 2. Paste this entire file and click Run
-- 3. Verify: the resident dashboard should now show the full parking map
--
-- WHAT IT DOES
-- Returns all parking spots in the garage, but hides private details
-- (plate numbers, makes, models) for spots belonging to OTHER residents.
-- The calling resident only sees their own spot in full detail.
-- Uses SECURITY DEFINER so it can bypass resident RLS and read every spot.
-- Enforces auth.uid() server-side: unauthenticated or unapproved callers
-- receive a FORBIDDEN exception before any data is returned.

CREATE OR REPLACE FUNCTION public.get_resident_parking_map()
RETURNS TABLE (
  id               uuid,
  spot_number      text,
  floor            text,
  zone             text,
  status           text,
  is_own           boolean,
  is_occupied      boolean,
  plate_number     text,
  make             text,
  model            text,
  relocation_status      text,
  original_spot_number   text,
  temporary_spot_number  text,
  disruption_title       text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_apt  uuid;
  v_appr text;
BEGIN
  -- Verify the caller is an approved resident with an apartment assignment.
  -- Use table alias to avoid ambiguity with the RETURNS TABLE output column "id".
  SELECT p.apartment_id, p.approval_status
    INTO v_apt, v_appr
    FROM public.profiles p
   WHERE p.id = auth.uid();

  IF v_apt IS NULL OR v_appr <> 'approved' THEN
    RAISE EXCEPTION 'FORBIDDEN: approved resident apartment required';
  END IF;

  RETURN QUERY
  SELECT
    ps.id,
    ps.spot_number::text,
    COALESCE(ps.floor::text, '1')           AS floor,
    COALESCE(ps.zone::text, 'residential')  AS zone,

    -- Mask status for spots that don't belong to this resident.
    CASE
      WHEN own_ctx.is_visible THEN ps.status::text
      WHEN ps.status IN ('available', 'temporary')  THEN 'available'
      WHEN ps.status IN ('blocked',  'maintenance') THEN 'blocked'
      WHEN ps.status =  'conflict'                  THEN 'conflict'
      ELSE 'occupied'
    END AS status,

    own_ctx.is_visible AS is_own,

    (ps.assigned_vehicle_id IS NOT NULL
      OR ps.status IN ('assigned', 'occupied', 'reserved')) AS is_occupied,

    -- Private fields: only revealed for this resident's own spots.
    CASE WHEN own_ctx.is_visible THEN v.plate_number::text ELSE NULL END AS plate_number,
    CASE WHEN own_ctx.is_visible THEN v.make::text         ELSE NULL END AS make,
    CASE WHEN own_ctx.is_visible THEN v.model::text        ELSE NULL END AS model,

    rel.status::text         AS relocation_status,
    rel.original_spot_number,
    rel.temporary_spot_number,
    rel.disruption_title

  FROM public.parking_spots ps

  LEFT JOIN public.vehicles v
         ON v.id = ps.assigned_vehicle_id

  -- Active relocation rows for this resident's apartment.
  LEFT JOIN LATERAL (
    SELECT
      tr.status,
      os.spot_number::text  AS original_spot_number,
      ts.spot_number::text  AS temporary_spot_number,
      pd.title::text        AS disruption_title,
      tr.original_spot_id,
      tr.temporary_spot_id
    FROM public.temporary_relocations tr
    LEFT JOIN public.parking_spots   os ON os.id = tr.original_spot_id
    LEFT JOIN public.parking_spots   ts ON ts.id = tr.temporary_spot_id
    LEFT JOIN public.parking_disruptions pd ON pd.id = tr.disruption_id
    WHERE tr.apartment_id = v_apt
      AND tr.status IN ('active', 'needs_placement', 'needs_review')
      AND (tr.original_spot_id = ps.id OR tr.temporary_spot_id = ps.id)
    ORDER BY tr.created_at DESC
    LIMIT 1
  ) rel ON true

  -- Compute visibility flag: own spot or involved in a relocation.
  CROSS JOIN LATERAL (
    SELECT (
      ps.assigned_apartment_id = v_apt
      OR rel.original_spot_id  IS NOT NULL
      OR rel.temporary_spot_id IS NOT NULL
    ) AS is_visible
  ) own_ctx

  ORDER BY COALESCE(ps.floor::text, '1'), ps.spot_number::text;
END;
$$;

-- Grant execute to the authenticated role so residents can call it via
-- the Supabase JS client (the anon/authenticated user credentials).
GRANT EXECUTE ON FUNCTION public.get_resident_parking_map() TO authenticated;
