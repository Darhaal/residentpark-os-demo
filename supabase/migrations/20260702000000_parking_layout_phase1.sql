-- Title: Parking Layout Phase 1
-- Path: supabase/migrations/20260702000000_parking_layout_phase1.sql
-- Functionality: Adds spatial parking coordinates, privacy-safe layout reads, and atomic admin saves.

BEGIN;

ALTER TABLE public.parking_spots
  ADD COLUMN pos_x integer,
  ADD COLUMN pos_y integer,
  ADD COLUMN rotation smallint NOT NULL DEFAULT 0,
  ADD CONSTRAINT parking_spots_position_pair_check CHECK (
    (pos_x IS NULL AND pos_y IS NULL)
    OR (
      pos_x IS NOT NULL AND pos_y IS NOT NULL
      AND pos_x BETWEEN 0 AND 5000
      AND pos_y BETWEEN 0 AND 5000
    )
  ),
  ADD CONSTRAINT parking_spots_rotation_check CHECK (rotation BETWEEN -359 AND 359);

CREATE TABLE public.parking_layout_shapes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  floor       text        NOT NULL CHECK (length(btrim(floor)) BETWEEN 1 AND 64),
  kind        text        NOT NULL CHECK (kind IN ('wall', 'zone', 'lane', 'label')),
  x           integer     NOT NULL CHECK (x BETWEEN 0 AND 5000),
  y           integer     NOT NULL CHECK (y BETWEEN 0 AND 5000),
  w           integer     NOT NULL CHECK (w BETWEEN 1 AND 5000),
  h           integer     NOT NULL CHECK (h BETWEEN 1 AND 5000),
  rotation    smallint    NOT NULL DEFAULT 0 CHECK (rotation BETWEEN -359 AND 359),
  label       text        CHECK (label IS NULL OR length(label) <= 160),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX parking_layout_shapes_floor_idx ON public.parking_layout_shapes (floor);

ALTER TABLE public.parking_layout_shapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parking_layout_shapes_approved_read"
  ON public.parking_layout_shapes
  FOR SELECT
  TO authenticated
  USING (public.is_approved());

CREATE POLICY "parking_layout_shapes_admin_write"
  ON public.parking_layout_shapes
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON TABLE public.parking_layout_shapes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.parking_layout_shapes TO authenticated;

CREATE OR REPLACE FUNCTION public.tx_save_parking_layout(
  p_floor text,
  p_spots jsonb,
  p_shapes jsonb,
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_floor text := btrim(COALESCE(p_floor, ''));
  v_floor_spot_count integer;
  v_input_spot_count integer;
  v_unique_spot_count integer;
  v_shape_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;
  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN: actor mismatch';
  END IF;
  IF length(v_floor) NOT BETWEEN 1 AND 64 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: floor is required';
  END IF;
  IF jsonb_typeof(p_spots) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: spots must be an array';
  END IF;
  IF jsonb_typeof(p_shapes) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: shapes must be an array';
  END IF;

  PERFORM id
  FROM public.parking_spots
  WHERE COALESCE(floor, '1') = v_floor
  ORDER BY id
  FOR UPDATE;

  SELECT count(*)
  INTO v_floor_spot_count
  FROM public.parking_spots
  WHERE COALESCE(floor, '1') = v_floor;

  IF v_floor_spot_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: floor has no parking spots';
  END IF;

  SELECT count(*), count(DISTINCT item.id)
  INTO v_input_spot_count, v_unique_spot_count
  FROM jsonb_to_recordset(p_spots) AS item(
    id uuid,
    pos_x integer,
    pos_y integer,
    rotation smallint
  );

  IF v_input_spot_count <> v_floor_spot_count OR v_unique_spot_count <> v_floor_spot_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: layout must position every floor spot exactly once';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_spots) AS item(
      id uuid,
      pos_x integer,
      pos_y integer,
      rotation smallint
    )
    LEFT JOIN public.parking_spots AS spot
      ON spot.id = item.id
     AND COALESCE(spot.floor, '1') = v_floor
    WHERE item.id IS NULL
      OR spot.id IS NULL
      OR item.pos_x IS NULL
      OR item.pos_y IS NULL
      OR item.pos_x NOT BETWEEN 0 AND 5000
      OR item.pos_y NOT BETWEEN 0 AND 5000
      OR COALESCE(item.rotation, 0) NOT BETWEEN -359 AND 359
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid floor spot position';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_shapes) AS shape(
      id uuid,
      kind text,
      x integer,
      y integer,
      w integer,
      h integer,
      rotation smallint,
      label text
    )
    WHERE shape.kind IS NULL
      OR shape.x IS NULL
      OR shape.y IS NULL
      OR shape.w IS NULL
      OR shape.h IS NULL
      OR shape.kind NOT IN ('wall', 'zone', 'lane', 'label')
      OR shape.x NOT BETWEEN 0 AND 5000
      OR shape.y NOT BETWEEN 0 AND 5000
      OR shape.w NOT BETWEEN 1 AND 5000
      OR shape.h NOT BETWEEN 1 AND 5000
      OR COALESCE(shape.rotation, 0) NOT BETWEEN -359 AND 359
      OR length(COALESCE(shape.label, '')) > 160
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid parking layout shape';
  END IF;

  UPDATE public.parking_spots AS spot
  SET pos_x = item.pos_x,
      pos_y = item.pos_y,
      rotation = COALESCE(item.rotation, 0),
      updated_at = now()
  FROM jsonb_to_recordset(p_spots) AS item(
    id uuid,
    pos_x integer,
    pos_y integer,
    rotation smallint
  )
  WHERE spot.id = item.id;

  DELETE FROM public.parking_layout_shapes
  WHERE floor = v_floor;

  INSERT INTO public.parking_layout_shapes (
    id, floor, kind, x, y, w, h, rotation, label
  )
  SELECT
    COALESCE(shape.id, gen_random_uuid()),
    v_floor,
    shape.kind,
    shape.x,
    shape.y,
    shape.w,
    shape.h,
    COALESCE(shape.rotation, 0),
    NULLIF(btrim(shape.label), '')
  FROM jsonb_to_recordset(p_shapes) AS shape(
    id uuid,
    kind text,
    x integer,
    y integer,
    w integer,
    h integer,
    rotation smallint,
    label text
  );

  GET DIAGNOSTICS v_shape_count = ROW_COUNT;

  INSERT INTO public.events (
    domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status
  ) VALUES (
    'property', 'PARKING_LAYOUT_SAVED', 'parking_layout', gen_random_uuid(), auth.uid(),
    jsonb_build_object(
      'floor', v_floor,
      'spots', v_floor_spot_count,
      'shapes', v_shape_count
    ),
    'info', 'closed'
  );

  RETURN jsonb_build_object('floor', v_floor, 'spots', v_floor_spot_count, 'shapes', v_shape_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tx_save_parking_layout(text, jsonb, jsonb, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_save_parking_layout(text, jsonb, jsonb, uuid)
  TO authenticated;

DROP FUNCTION public.get_resident_parking_map();

CREATE FUNCTION public.get_resident_parking_map()
RETURNS TABLE (
  id                     uuid,
  spot_number            text,
  floor                  text,
  zone                   text,
  status                 text,
  pos_x                  integer,
  pos_y                  integer,
  rotation               smallint,
  is_own                 boolean,
  is_occupied            boolean,
  plate_number           text,
  make                   text,
  model                   text,
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
  v_apt uuid;
  v_appr text;
BEGIN
  SELECT profile.apartment_id, profile.approval_status
  INTO v_apt, v_appr
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid();

  IF v_apt IS NULL OR v_appr <> 'approved' THEN
    RAISE EXCEPTION 'FORBIDDEN: approved resident apartment required';
  END IF;

  RETURN QUERY
  SELECT
    spot.id,
    spot.spot_number::text,
    COALESCE(spot.floor::text, '1') AS floor,
    COALESCE(spot.zone::text, 'residential') AS zone,
    CASE
      WHEN own_context.is_visible THEN spot.status::text
      WHEN spot.status IN ('available', 'temporary') THEN 'available'
      WHEN spot.status IN ('blocked', 'maintenance') THEN 'blocked'
      WHEN spot.status = 'conflict' THEN 'conflict'
      ELSE 'occupied'
    END AS status,
    spot.pos_x,
    spot.pos_y,
    spot.rotation,
    own_context.is_visible AS is_own,
    (
      spot.assigned_vehicle_id IS NOT NULL
      OR spot.status IN ('assigned', 'occupied', 'reserved')
    ) AS is_occupied,
    CASE WHEN own_context.is_visible THEN vehicle.plate_number::text ELSE NULL END AS plate_number,
    CASE WHEN own_context.is_visible THEN vehicle.make::text ELSE NULL END AS make,
    CASE WHEN own_context.is_visible THEN vehicle.model::text ELSE NULL END AS model,
    relocation.status::text AS relocation_status,
    relocation.original_spot_number,
    relocation.temporary_spot_number,
    relocation.disruption_title
  FROM public.parking_spots AS spot
  LEFT JOIN public.vehicles AS vehicle
    ON vehicle.id = spot.assigned_vehicle_id
  LEFT JOIN LATERAL (
    SELECT
      item.status,
      original_spot.spot_number::text AS original_spot_number,
      temporary_spot.spot_number::text AS temporary_spot_number,
      disruption.title::text AS disruption_title,
      item.original_spot_id,
      item.temporary_spot_id
    FROM public.temporary_relocations AS item
    LEFT JOIN public.parking_spots AS original_spot ON original_spot.id = item.original_spot_id
    LEFT JOIN public.parking_spots AS temporary_spot ON temporary_spot.id = item.temporary_spot_id
    LEFT JOIN public.parking_disruptions AS disruption ON disruption.id = item.disruption_id
    WHERE item.apartment_id = v_apt
      AND item.status IN ('active', 'needs_placement', 'needs_review')
      AND (item.original_spot_id = spot.id OR item.temporary_spot_id = spot.id)
    ORDER BY item.created_at DESC
    LIMIT 1
  ) AS relocation ON true
  CROSS JOIN LATERAL (
    SELECT (
      spot.assigned_apartment_id = v_apt
      OR relocation.original_spot_id IS NOT NULL
      OR relocation.temporary_spot_id IS NOT NULL
    ) AS is_visible
  ) AS own_context
  ORDER BY COALESCE(spot.floor::text, '1'), spot.spot_number::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_resident_parking_map() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_resident_parking_map() TO authenticated;

COMMIT;
