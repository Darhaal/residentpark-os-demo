-- Title: Account-Status Authorization
-- Path: supabase/applied/0015_account_status_authorization.sql
-- Functionality: Close the two account-status authorization blockers at the database
--   layer. Deactivated (suspended / rejected / pending) privileged accounts must lose
--   every admin read+write path, and non-approved residents must lose RLS read access
--   to apartment, vehicle, spot, relocation and building-settings data.
--
-- WHAT IT CHANGES
--   * is_admin() / is_superadmin()  — now also require approval_status = 'approved'.
--   * get_auth_role()               — returns the role only for approved accounts
--                                     (NULL otherwise), which closes every admin RLS
--                                     policy that gates on get_auth_role().
--   * is_approved()                 — new helper used by resident RLS policies.
--   * Admin policies that inline an EXISTS role check (events, parking_issues,
--     disruptions, disruption_spots, relocations, notices) now also require approval.
--   * Resident SELECT policies (apartments, vehicles, parking_spots, relocations) and
--     building_settings read now require an approved caller.
--
-- Resident-mutating RPCs (tx_report_parking_issue, tx_submit_vehicle_request) and the
-- resident map RPC (get_resident_parking_map) already require approval and are unchanged.

BEGIN;

-- ── Helper functions ──────────────────────────────────────────────────────────

-- True only for the current session's profile when it is approved.
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND approval_status = 'approved'
  );
$$;

-- Admin guard used inside SECURITY DEFINER RPCs — now approval-aware.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin','superadmin')
      AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'superadmin'
      AND approval_status = 'approved'
  );
$$;

-- Role lookup used by admin RLS policies — a non-approved account resolves to NULL,
-- so "get_auth_role() IN ('admin','superadmin')" fails for deactivated admins.
CREATE OR REPLACE FUNCTION public.get_auth_role() RETURNS text AS $$
  SELECT role::text FROM public.profiles
  WHERE id = auth.uid() AND approval_status = 'approved';
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Keep policy-evaluation grants (CREATE OR REPLACE preserves them, but be explicit).
GRANT EXECUTE ON FUNCTION public.is_approved()    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin()       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_superadmin()  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role()  TO authenticated, anon;

-- ── Admin policies with inlined role checks → require approval ─────────────────

DROP POLICY IF EXISTS "events_admin" ON public.events;
CREATE POLICY "events_admin" ON public.events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin') AND approval_status = 'approved')
);

DROP POLICY IF EXISTS "issues_admin_read" ON public.parking_issues;
CREATE POLICY "issues_admin_read" ON public.parking_issues FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin') AND approval_status = 'approved')
);

DROP POLICY IF EXISTS "disruptions_admin" ON public.parking_disruptions;
CREATE POLICY "disruptions_admin" ON public.parking_disruptions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin') AND approval_status = 'approved')
);

DROP POLICY IF EXISTS "disruption_spots_admin" ON public.parking_disruption_spots;
CREATE POLICY "disruption_spots_admin" ON public.parking_disruption_spots FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin') AND approval_status = 'approved')
);

DROP POLICY IF EXISTS "relocations_admin" ON public.temporary_relocations;
CREATE POLICY "relocations_admin" ON public.temporary_relocations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin') AND approval_status = 'approved')
);

DROP POLICY IF EXISTS "notices_admin_read" ON public.notices;
CREATE POLICY "notices_admin_read" ON public.notices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin') AND approval_status = 'approved')
);

-- ── Resident SELECT policies → require approval ───────────────────────────────

DROP POLICY IF EXISTS "apartments_resident" ON public.apartments;
CREATE POLICY "apartments_resident" ON public.apartments FOR SELECT USING (
  public.is_approved()
  AND id = (SELECT apartment_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "vehicles_resident" ON public.vehicles;
CREATE POLICY "vehicles_resident" ON public.vehicles FOR SELECT USING (
  public.is_approved()
  AND apartment_id = (SELECT apartment_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "spots_resident" ON public.parking_spots;
CREATE POLICY "spots_resident" ON public.parking_spots FOR SELECT USING (
  public.is_approved()
  AND assigned_apartment_id = (SELECT apartment_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "relocations_resident" ON public.temporary_relocations;
CREATE POLICY "relocations_resident" ON public.temporary_relocations FOR SELECT USING (
  public.is_approved()
  AND apartment_id = (SELECT apartment_id FROM public.profiles WHERE id = auth.uid())
);

-- Building settings (timezone, portal notice, policy) — approved accounts only.
DROP POLICY IF EXISTS "settings_read" ON public.building_settings;
CREATE POLICY "settings_read" ON public.building_settings FOR SELECT USING (
  public.is_approved()
);

COMMIT;
