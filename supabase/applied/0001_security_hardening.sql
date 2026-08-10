-- P0 security hardening for profile self-service and resident vehicle requests.
-- Apply after supabase/baseline/baseline.sql.

BEGIN;

-- Prevent authenticated users from changing protected profile columns such as
-- role, approval_status, apartment_id, and is_apartment_manager directly.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;

-- Self-service profile editing is intentionally limited to non-privileged fields.
GRANT UPDATE (full_name, phone, updated_at) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
CREATE POLICY "profiles_own_update"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Protect privileged accounts regardless of which current or future RPC performs
-- the update. Regular admins may manage residents, but only a superadmin may
-- change another admin/superadmin account or grant a privileged role.
CREATE OR REPLACE FUNCTION public.enforce_profile_privilege_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow trusted administrative maintenance outside an end-user JWT context.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.id <> auth.uid()
     AND OLD.role IN ('admin', 'superadmin')
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin may modify another privileged account';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND NEW.role IN ('admin', 'superadmin')
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin may grant a privileged role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileges ON public.profiles;
CREATE TRIGGER protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_privilege_boundary();

-- The original resident vehicle RPC trusted apartment and owner IDs supplied by
-- the caller. Keep the public signature stable, but bind both values to the
-- verified session and enforce the account approval state inside the database.
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
  v_requires_approval boolean := true;
  v_vehicle_status public.vehicle_status;
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
    v_vehicle_status := 'pending_approval'::public.vehicle_status;
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

    SELECT require_vehicle_approval
      INTO v_requires_approval
    FROM public.building_settings
    LIMIT 1;

    v_effective_apartment_id := v_caller_apartment_id;
    v_effective_owner_id := auth.uid();
    v_vehicle_status := CASE
      WHEN COALESCE(v_requires_approval, true) THEN 'pending_approval'::public.vehicle_status
      ELSE 'approved'::public.vehicle_status
    END;
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
    CASE WHEN v_vehicle_status = 'approved' THEN now() ELSE NULL END
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
      'auto_approved', v_vehicle_status = 'approved'
    ),
    'info',
    'closed'
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tx_submit_vehicle_request(
  uuid, uuid, text, text, text, text, integer, uuid, jsonb
) TO authenticated;

COMMIT;
