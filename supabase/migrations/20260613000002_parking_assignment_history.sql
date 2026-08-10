-- Restore the Parking Map assignment-history read model.
-- Apply after supabase/baseline/baseline.sql.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_parking_map_state(
  p_target_date timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_date timestamptz := COALESCE(p_target_date, now());
  v_is_current boolean := (COALESCE(p_target_date, now())::date = CURRENT_DATE);
  v_spots jsonb;
  v_pool jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN: administrator privileges required';
  END IF;

  IF v_is_current THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', ps.id,
      'spot_number', ps.spot_number,
      'zone', ps.zone,
      'floor', ps.floor,
      'type', ps.type,
      'status', ps.status,
      'assigned_apartment_id', ps.assigned_apartment_id,
      'assigned_vehicle_id', ps.assigned_vehicle_id,
      'apartments', CASE WHEN a.id IS NOT NULL
        THEN jsonb_build_object('apartment_number', a.apartment_number)
        ELSE NULL
      END,
      'vehicles', CASE WHEN v.id IS NOT NULL THEN jsonb_build_object(
        'id', v.id,
        'plate_number', v.plate_number,
        'make', v.make,
        'model', v.model,
        'color', v.color,
        'year', v.year,
        'apartment_id', v.apartment_id,
        'owner_id', v.owner_id,
        'apartments', CASE WHEN va.id IS NOT NULL
          THEN jsonb_build_object('apartment_number', va.apartment_number)
          ELSE NULL
        END,
        'profiles', CASE WHEN pr.id IS NOT NULL
          THEN jsonb_build_object('full_name', pr.full_name)
          ELSE NULL
        END
      ) ELSE NULL END
    ) ORDER BY ps.floor NULLS FIRST, ps.spot_number)
    INTO v_spots
    FROM public.parking_spots ps
    LEFT JOIN public.apartments a ON a.id = ps.assigned_apartment_id
    LEFT JOIN public.vehicles v ON v.id = ps.assigned_vehicle_id
    LEFT JOIN public.apartments va ON va.id = v.apartment_id
    LEFT JOIN public.profiles pr ON pr.id = v.owner_id;

    SELECT jsonb_agg(jsonb_build_object(
      'id', v.id,
      'plate_number', v.plate_number,
      'make', v.make,
      'model', v.model,
      'color', v.color,
      'year', v.year,
      'apartment_id', v.apartment_id,
      'owner_id', v.owner_id,
      'apartments', jsonb_build_object('apartment_number', a.apartment_number),
      'profiles', CASE WHEN pr.id IS NOT NULL
        THEN jsonb_build_object('full_name', pr.full_name)
        ELSE NULL
      END
    ) ORDER BY v.created_at DESC)
    INTO v_pool
    FROM public.vehicles v
    JOIN public.apartments a ON a.id = v.apartment_id
    LEFT JOIN public.profiles pr ON pr.id = v.owner_id
    WHERE v.approval_status = 'approved'
      AND NOT EXISTS (
        SELECT 1
        FROM public.parking_spots ps
        WHERE ps.assigned_vehicle_id = v.id
      );
  ELSE
    -- Assignment history is authoritative for historical occupancy. Operational
    -- spot states such as blocked/maintenance are not versioned, so an unassigned
    -- historical spot is represented as available.
    SELECT jsonb_agg(jsonb_build_object(
      'id', ps.id,
      'spot_number', ps.spot_number,
      'zone', ps.zone,
      'floor', ps.floor,
      'type', ps.type,
      'status', CASE WHEN pa.id IS NOT NULL THEN 'assigned' ELSE 'available' END,
      'assigned_apartment_id', pa.apartment_id,
      'assigned_vehicle_id', pa.vehicle_id,
      'apartments', CASE WHEN a.id IS NOT NULL
        THEN jsonb_build_object('apartment_number', a.apartment_number)
        ELSE NULL
      END,
      'vehicles', CASE WHEN v.id IS NOT NULL THEN jsonb_build_object(
        'id', v.id,
        'plate_number', v.plate_number,
        'make', v.make,
        'model', v.model,
        'color', v.color,
        'year', v.year,
        'apartment_id', v.apartment_id,
        'owner_id', v.owner_id,
        'apartments', CASE WHEN va.id IS NOT NULL
          THEN jsonb_build_object('apartment_number', va.apartment_number)
          ELSE NULL
        END,
        'profiles', CASE WHEN pr.id IS NOT NULL
          THEN jsonb_build_object('full_name', pr.full_name)
          ELSE NULL
        END
      ) ELSE NULL END
    ) ORDER BY ps.floor NULLS FIRST, ps.spot_number)
    INTO v_spots
    FROM public.parking_spots ps
    LEFT JOIN LATERAL (
      SELECT candidate.*
      FROM public.parking_assignments candidate
      WHERE candidate.spot_id = ps.id
        AND candidate.starts_at <= v_target_date
        AND (candidate.ends_at IS NULL OR candidate.ends_at > v_target_date)
      ORDER BY candidate.starts_at DESC, candidate.created_at DESC
      LIMIT 1
    ) pa ON true
    LEFT JOIN public.apartments a ON a.id = pa.apartment_id
    LEFT JOIN public.vehicles v ON v.id = pa.vehicle_id
    LEFT JOIN public.apartments va ON va.id = v.apartment_id
    LEFT JOIN public.profiles pr ON pr.id = v.owner_id
    WHERE ps.created_at <= v_target_date;

    SELECT jsonb_agg(jsonb_build_object(
      'id', v.id,
      'plate_number', v.plate_number,
      'make', v.make,
      'model', v.model,
      'color', v.color,
      'year', v.year,
      'apartment_id', v.apartment_id,
      'owner_id', v.owner_id,
      'apartments', jsonb_build_object('apartment_number', a.apartment_number),
      'profiles', CASE WHEN pr.id IS NOT NULL
        THEN jsonb_build_object('full_name', pr.full_name)
        ELSE NULL
      END
    ) ORDER BY v.created_at DESC)
    INTO v_pool
    FROM public.vehicles v
    JOIN public.apartments a ON a.id = v.apartment_id
    LEFT JOIN public.profiles pr ON pr.id = v.owner_id
    WHERE v.created_at <= v_target_date
      AND v.approval_status = 'approved'
      AND NOT EXISTS (
        SELECT 1
        FROM public.parking_assignments candidate
        WHERE candidate.vehicle_id = v.id
          AND candidate.starts_at <= v_target_date
          AND (candidate.ends_at IS NULL OR candidate.ends_at > v_target_date)
      );
  END IF;

  RETURN jsonb_build_object(
    'spots', COALESCE(v_spots, '[]'::jsonb),
    'unassigned_pool', COALESCE(v_pool, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parking_map_state(timestamptz) TO authenticated;

COMMIT;
