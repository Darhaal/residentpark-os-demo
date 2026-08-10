-- =============================================================================
-- ResidentPark OS — Complete Database Baseline
-- =============================================================================
-- Run this file on a FRESH Supabase project (or after a full DB reset) to
-- recreate the entire schema deterministically from version control.
--
-- Order:
--   1. Enums
--   2. Tables
--   3. Constraints & Indexes
--   4. GRANTs (table-level permissions for the API role)
--   5. Row Level Security
--   6. Trigger (auto-create profile on signup)
--   7. Helper functions
--   8. Identity RPCs         (tx_update_profile_status, tx_approve_and_assign, ...)
--   9. Parking RPCs          (tx_assign_parking_spot, tx_review_vehicle, ...)
--  10. Audit & Query RPCs    (get_audit_logs, get_apartment_timeline, get_parking_map_state, ...)
--  11. Feature RPCs          (disruptions, notices, issues, settings, bulk approve)
--
-- DO NOT apply individual numbered legacy migrations on top of this file.
-- New features are added as numbered files (0001_xxx.sql) AFTER this baseline.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1 · ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE public.user_role AS ENUM ('resident', 'admin', 'superadmin');

CREATE TYPE public.profile_status AS ENUM (
  'pending_approval', 'approved', 'rejected', 'suspended', 'archived'
);

CREATE TYPE public.resident_type AS ENUM (
  'owner', 'tenant', 'family', 'guest', 'contractor'
);

CREATE TYPE public.apartment_status AS ENUM (
  'vacant', 'occupied', 'problem', 'restricted'
);

CREATE TYPE public.vehicle_status AS ENUM (
  'pending_approval', 'approved', 'rejected', 'archived'
);

CREATE TYPE public.parking_spot_status AS ENUM (
  'available', 'assigned', 'occupied', 'blocked', 'reserved',
  'temporary', 'conflict', 'maintenance'
);

CREATE TYPE public.parking_spot_type AS ENUM (
  'regular', 'guest', 'valet', 'construction_reserved', 'handicap', 'loading'
);

CREATE TYPE public.event_severity AS ENUM ('info', 'warning', 'critical');

CREATE TYPE public.event_status AS ENUM (
  'open', 'in_progress', 'resolved', 'closed'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2 · TABLES  (dependency order)
-- ─────────────────────────────────────────────────────────────────────────────

-- Units / apartments
CREATE TABLE public.apartments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_number  varchar(50) NOT NULL UNIQUE,
  notes             text,
  status            public.apartment_status NOT NULL DEFAULT 'vacant',
  assigned_admin_id uuid,                                   -- FK added below (profiles not yet created)
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- User profiles (one per auth.user)
CREATE TABLE public.profiles (
  id                   uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                 public.user_role NOT NULL DEFAULT 'resident',
  full_name            varchar(255),
  email                varchar(255),
  phone                varchar(50),
  apartment_id         uuid        REFERENCES public.apartments(id) ON DELETE SET NULL,
  approval_status      public.profile_status NOT NULL DEFAULT 'pending_approval',
  status_reason        text,
  residency_type       public.resident_type DEFAULT 'tenant',
  is_apartment_manager boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Now we can close the self-referencing FK on apartments
ALTER TABLE public.apartments
  ADD CONSTRAINT apartments_assigned_admin_id_fkey
  FOREIGN KEY (assigned_admin_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Vehicles (linked to apartment, not profile — multi-resident model)
CREATE TABLE public.vehicles (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_id    uuid        NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  owner_id        uuid        REFERENCES public.profiles(id)  ON DELETE SET NULL,
  plate_number    varchar(50) NOT NULL UNIQUE,
  make            text,
  model           text,
  color           varchar(50),
  year            integer,
  approval_status public.vehicle_status NOT NULL DEFAULT 'pending_approval',
  approved_by     uuid        REFERENCES public.profiles(id)  ON DELETE SET NULL,
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Parking spots (source of truth for current state)
CREATE TABLE public.parking_spots (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_number           text        NOT NULL UNIQUE,
  zone                  text,
  floor                 text,
  type                  public.parking_spot_type NOT NULL DEFAULT 'regular',
  status                public.parking_spot_status NOT NULL DEFAULT 'available',
  assigned_apartment_id uuid        REFERENCES public.apartments(id) ON DELETE SET NULL,
  assigned_vehicle_id   uuid        REFERENCES public.vehicles(id)   ON DELETE SET NULL,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Assignment history (enables the time-machine feature)
CREATE TABLE public.parking_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id         uuid        REFERENCES public.parking_spots(id)  ON DELETE CASCADE,
  apartment_id    uuid        REFERENCES public.apartments(id)     ON DELETE CASCADE,
  vehicle_id      uuid        REFERENCES public.vehicles(id)       ON DELETE SET NULL,
  assignment_type text        NOT NULL DEFAULT 'permanent',
  status          text        NOT NULL DEFAULT 'active',
  starts_at       timestamptz NOT NULL DEFAULT now(),
  ends_at         timestamptz,
  created_by      uuid        REFERENCES public.profiles(id)       ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Global event / audit bus
CREATE TABLE public.events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain          varchar(50) NOT NULL,
  action_type     varchar(100) NOT NULL,
  entity_type     varchar(50) NOT NULL,
  entity_id       uuid        NOT NULL,
  actor_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload         jsonb       NOT NULL DEFAULT '{}',
  severity        public.event_severity  NOT NULL DEFAULT 'info',
  workflow_status public.event_status    NOT NULL DEFAULT 'closed',
  assigned_to     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Invitations (admin sends link to future resident)
CREATE TABLE public.invitations (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        varchar(255) NOT NULL,
  role         varchar(50) NOT NULL DEFAULT 'resident',
  apartment_id uuid        REFERENCES public.apartments(id) ON DELETE CASCADE,
  token        uuid        NOT NULL DEFAULT gen_random_uuid(),
  status       varchar(50) NOT NULL DEFAULT 'pending',
  invited_by   uuid        REFERENCES public.profiles(id)   ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Parking issue reports (from residents)
CREATE TABLE public.parking_issues (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id          uuid        REFERENCES public.parking_spots(id) ON DELETE SET NULL,
  reporter_id      uuid        REFERENCES public.profiles(id)      ON DELETE SET NULL,
  issue_type       varchar     NOT NULL,
  violating_plate  varchar,
  comment          text,
  status           varchar     NOT NULL DEFAULT 'open',
  resolution_note  text,
  resolved_at      timestamptz,
  resolved_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Construction disruptions
CREATE TABLE public.parking_disruptions (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text  NOT NULL,
  reason       text  NOT NULL,
  start_date   date  NOT NULL,
  end_date     date  NOT NULL,
  status       text  NOT NULL DEFAULT 'active'
               CHECK (status IN ('scheduled','active','completed','cancelled')),
  created_by   uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Spots blocked by a disruption (with restore state)
CREATE TABLE public.parking_disruption_spots (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disruption_id         uuid NOT NULL REFERENCES public.parking_disruptions(id) ON DELETE CASCADE,
  spot_id               uuid NOT NULL REFERENCES public.parking_spots(id),
  previous_status       text,
  previous_apartment_id uuid REFERENCES public.apartments(id) ON DELETE SET NULL,
  previous_vehicle_id   uuid REFERENCES public.vehicles(id)   ON DELETE SET NULL
);

-- Per-vehicle relocation records for a disruption
CREATE TABLE public.temporary_relocations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disruption_id     uuid NOT NULL REFERENCES public.parking_disruptions(id) ON DELETE CASCADE,
  vehicle_id        uuid REFERENCES public.vehicles(id)    ON DELETE SET NULL,
  apartment_id      uuid REFERENCES public.apartments(id)  ON DELETE SET NULL,
  original_spot_id  uuid REFERENCES public.parking_spots(id),
  temporary_spot_id uuid REFERENCES public.parking_spots(id),
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','returned','needs_placement','needs_review')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- In-app notices (admin → residents)
CREATE TABLE public.notices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     uuid NOT NULL,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  title        text NOT NULL,
  body         text NOT NULL,
  type         text NOT NULL DEFAULT 'announcement',
  created_by   uuid REFERENCES public.profiles(id)           ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

-- Building-wide configuration (singleton row)
CREATE TABLE public.building_settings (
  id                       uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  building_name            text    NOT NULL DEFAULT 'ResidentPark',
  timezone                 text    NOT NULL DEFAULT 'UTC',
  max_spots_per_unit       int     NOT NULL DEFAULT 2,
  require_vehicle_approval boolean NOT NULL DEFAULT true,
  resident_portal_notice   text    NOT NULL DEFAULT '',
  updated_at               timestamptz DEFAULT now(),
  updated_by               uuid    REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3 · CONSTRAINTS & INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- A vehicle can only sit in one spot at a time.
ALTER TABLE public.parking_spots
  ADD CONSTRAINT unique_active_vehicle_spot UNIQUE (assigned_vehicle_id);

-- An available spot must have no assignment.
ALTER TABLE public.parking_spots
  ADD CONSTRAINT check_available_spot
  CHECK (status <> 'available' OR (assigned_apartment_id IS NULL AND assigned_vehicle_id IS NULL));

-- An occupied/assigned spot must have an apartment.
ALTER TABLE public.parking_spots
  ADD CONSTRAINT check_assigned_spot
  CHECK (status NOT IN ('assigned','occupied') OR assigned_apartment_id IS NOT NULL);

-- Indexes
CREATE INDEX idx_events_entity       ON public.events(entity_type, entity_id);
CREATE INDEX idx_events_domain       ON public.events(domain, action_type);
CREATE INDEX idx_events_created_at   ON public.events(created_at DESC);
CREATE INDEX idx_parking_spots_floor ON public.parking_spots(floor);
CREATE INDEX idx_parking_spots_zone  ON public.parking_spots(zone);
CREATE INDEX idx_notices_recipient   ON public.notices(recipient_id, created_at DESC);
CREATE INDEX idx_notices_batch       ON public.notices(batch_id);
CREATE INDEX idx_vehicles_apartment  ON public.vehicles(apartment_id);
CREATE INDEX idx_profiles_apartment  ON public.profiles(apartment_id);
CREATE INDEX idx_assignments_spot    ON public.parking_assignments(spot_id, status);
CREATE INDEX idx_invitations_token   ON public.invitations(token);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4 · GRANTS (table-level, before RLS)
-- ─────────────────────────────────────────────────────────────────────────────
-- The `authenticated` role needs table-level permission before RLS can run.
-- RLS policies restrict WHICH rows each user may touch.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apartments            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_spots         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_assignments   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations           TO authenticated;
-- parking_issues: residents read their own; writes via RPC (tx_report_parking_issue is SECURITY DEFINER)
GRANT SELECT                         ON public.parking_issues        TO authenticated;

-- Disruption tables: admins get full access via RPCs; residents get SELECT-only.
-- (RPCs are SECURITY DEFINER so the write GRANTs are intentionally revoked below.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_disruptions       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parking_disruption_spots  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.temporary_relocations     TO authenticated;

-- Notices: residents may SELECT + UPDATE read_at only; INSERT/DELETE go via RPC.
GRANT SELECT                         ON public.notices             TO authenticated;
GRANT UPDATE (read_at)               ON public.notices             TO authenticated;

-- Settings: all authenticated may read; writes via RPC only.
GRANT SELECT                         ON public.building_settings   TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5 · ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.apartments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_spots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_issues        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_disruptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_disruption_spots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temporary_relocations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_settings     ENABLE ROW LEVEL SECURITY;

-- Helper (re-created later as proper SECURITY DEFINER function; needed for policies):
CREATE OR REPLACE FUNCTION public.get_auth_role() RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- apartments
CREATE POLICY "apartments_admin"    ON public.apartments FOR ALL     USING (public.get_auth_role() IN ('admin','superadmin'));
CREATE POLICY "apartments_resident" ON public.apartments FOR SELECT  USING (
  id = (SELECT apartment_id FROM public.profiles WHERE id = auth.uid())
);

-- profiles
CREATE POLICY "profiles_own_read"   ON public.profiles FOR SELECT  USING (auth.uid() = id);
CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE  USING (auth.uid() = id);
CREATE POLICY "profiles_admin"      ON public.profiles FOR ALL     USING (public.get_auth_role() IN ('admin','superadmin'));

-- vehicles
CREATE POLICY "vehicles_admin"      ON public.vehicles FOR ALL     USING (public.get_auth_role() IN ('admin','superadmin'));
CREATE POLICY "vehicles_resident"   ON public.vehicles FOR SELECT  USING (
  apartment_id = (SELECT apartment_id FROM public.profiles WHERE id = auth.uid())
);

-- parking_spots
CREATE POLICY "spots_admin"         ON public.parking_spots FOR ALL    USING (public.get_auth_role() IN ('admin','superadmin'));
CREATE POLICY "spots_resident"      ON public.parking_spots FOR SELECT USING (
  assigned_apartment_id = (SELECT apartment_id FROM public.profiles WHERE id = auth.uid())
);

-- parking_assignments
CREATE POLICY "assignments_admin"   ON public.parking_assignments FOR ALL USING (public.get_auth_role() IN ('admin','superadmin'));

-- events
CREATE POLICY "events_admin"        ON public.events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);

-- invitations
CREATE POLICY "invitations_admin"   ON public.invitations FOR ALL USING (public.get_auth_role() IN ('admin','superadmin'));

-- parking_issues
CREATE POLICY "issues_admin_read"   ON public.parking_issues FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);
-- Residents can only report (INSERT) for their own spot — enforced inside RPC, not here.

-- disruption tables: admin full access; residents read their relocations
CREATE POLICY "disruptions_admin"       ON public.parking_disruptions      FOR ALL    USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);
CREATE POLICY "disruption_spots_admin"  ON public.parking_disruption_spots FOR ALL    USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);
-- Revoke direct writes; disruptions are created/completed via SECURITY DEFINER RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.parking_disruptions      FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.parking_disruption_spots FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.temporary_relocations    FROM authenticated;

CREATE POLICY "relocations_admin"        ON public.temporary_relocations FOR ALL    USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);
CREATE POLICY "relocations_resident"     ON public.temporary_relocations FOR SELECT USING (
  apartment_id = (SELECT apartment_id FROM public.profiles WHERE id = auth.uid())
);

-- notices
CREATE POLICY "notices_admin_read"       ON public.notices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
);
CREATE POLICY "notices_recipient_read"   ON public.notices FOR SELECT USING (recipient_id = auth.uid());
CREATE POLICY "notices_recipient_update" ON public.notices FOR UPDATE
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- settings: any authenticated user may read
CREATE POLICY "settings_read"            ON public.building_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seed the settings singleton
INSERT INTO public.building_settings (building_name)
SELECT 'ResidentPark'
WHERE NOT EXISTS (SELECT 1 FROM public.building_settings);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6 · TRIGGER — auto-create profile on auth.user INSERT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Resident'),
    new.email,
    'resident'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 7 · HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- Primary admin guard — used inside SECURITY DEFINER RPCs.
-- SECURITY DEFINER bypasses RLS; this re-checks the REAL session role.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','superadmin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 8 · IDENTITY RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- Update a single account's approval status.
CREATE OR REPLACE FUNCTION public.tx_update_profile_status(
  p_target_id uuid, p_new_status public.profile_status, p_reason text,
  p_actor_id uuid, p_payload jsonb, p_severity public.event_severity
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin()    THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_target_id = auth.uid() THEN RAISE EXCEPTION 'RULE: self-modification is not allowed'; END IF;
  UPDATE public.profiles
    SET approval_status = p_new_status, status_reason = p_reason, updated_at = now()
    WHERE id = p_target_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('identity','ACCOUNT_STATUS_CHANGED','profile',p_target_id,auth.uid(),p_payload,p_severity,'closed');
END; $$;

-- Bulk status update.
CREATE OR REPLACE FUNCTION public.tx_bulk_update_profile_status(
  p_target_ids uuid[], p_new_status public.profile_status, p_reason text,
  p_actor_id uuid, p_payload jsonb, p_severity public.event_severity
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  FOREACH v_id IN ARRAY p_target_ids LOOP
    IF v_id = auth.uid() THEN CONTINUE; END IF;
    UPDATE public.profiles SET approval_status = p_new_status, status_reason = p_reason, updated_at = now() WHERE id = v_id;
    INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
      VALUES ('identity','ACCOUNT_STATUS_CHANGED','profile',v_id,auth.uid(),p_payload,p_severity,'closed');
  END LOOP;
END; $$;

-- Approve a single account and optionally assign an apartment atomically.
CREATE OR REPLACE FUNCTION public.tx_approve_and_assign(
  p_target_id uuid, p_apartment_id uuid, p_reason text, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin()    THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_target_id = auth.uid() THEN RAISE EXCEPTION 'RULE: self-modification is not allowed'; END IF;
  UPDATE public.profiles
    SET approval_status = 'approved', apartment_id = p_apartment_id, status_reason = p_reason, updated_at = now()
    WHERE id = p_target_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('identity','ACCOUNT_APPROVED_AND_ASSIGNED','profile',p_target_id,auth.uid(),p_payload,'info','closed');
END; $$;

-- Change role / permissions for a single user.
CREATE OR REPLACE FUNCTION public.tx_update_permissions(
  p_target_id uuid, p_new_role public.user_role, p_is_manager boolean,
  p_apartment_id uuid, p_actor_id uuid, p_payload jsonb, p_severity public.event_severity
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin()    THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_target_id = auth.uid() THEN RAISE EXCEPTION 'RULE: cannot change your own privileges'; END IF;
  IF p_new_role IN ('admin','superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin can grant admin or superadmin roles';
  END IF;
  UPDATE public.profiles
    SET role = p_new_role, is_apartment_manager = p_is_manager, apartment_id = p_apartment_id, updated_at = now()
    WHERE id = p_target_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('identity','UPDATE_PERMISSIONS','profile',p_target_id,auth.uid(),p_payload,p_severity,'closed');
END; $$;

-- Bulk role update.
CREATE OR REPLACE FUNCTION public.tx_bulk_update_permissions(
  p_target_ids uuid[], p_new_role public.user_role, p_is_manager boolean,
  p_actor_id uuid, p_payload jsonb, p_severity public.event_severity
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_new_role IN ('admin','superadmin') AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'FORBIDDEN: only a superadmin can grant admin roles in bulk';
  END IF;
  FOREACH v_id IN ARRAY p_target_ids LOOP
    IF v_id = auth.uid() THEN CONTINUE; END IF;
    UPDATE public.profiles SET role = p_new_role, is_apartment_manager = p_is_manager, updated_at = now() WHERE id = v_id;
    INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
      VALUES ('identity','UPDATE_PERMISSIONS','profile',v_id,auth.uid(),p_payload,p_severity,'closed');
  END LOOP;
END; $$;

-- Assign a responsible admin to a unit.
CREATE OR REPLACE FUNCTION public.tx_assign_admin(
  p_apartment_id uuid, p_admin_id uuid,
  p_actor_id uuid, p_payload jsonb, p_severity public.event_severity
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_admin_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role IN ('admin','superadmin')) THEN
    RAISE EXCEPTION 'RULE: only admin/superadmin users can be assigned to a unit';
  END IF;
  UPDATE public.apartments SET assigned_admin_id = p_admin_id WHERE id = p_apartment_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property','APARTMENT_LINKED','apartment',p_apartment_id,auth.uid(),p_payload,p_severity,'closed');
END; $$;

-- Change a unit's status.
CREATE OR REPLACE FUNCTION public.tx_update_apartment_status(
  p_apartment_id uuid, p_new_status public.apartment_status,
  p_actor_id uuid, p_payload jsonb, p_severity public.event_severity, p_workflow_status public.event_status
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  UPDATE public.apartments SET status = p_new_status WHERE id = p_apartment_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property','APARTMENT_STATUS_CHANGED','apartment',p_apartment_id,auth.uid(),p_payload,p_severity,p_workflow_status);
END; $$;

-- Atomic bulk approve-and-assign (hardened: uses auth.uid(), skips self).
CREATE OR REPLACE FUNCTION public.tx_bulk_approve_and_assign_units(
  p_targets jsonb, p_reason text, p_actor_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target   record;
  v_uid    uuid;
  v_apt_id uuid;
  v_apt_num varchar;
  v_old    varchar;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  FOR target IN SELECT * FROM jsonb_array_elements(p_targets) LOOP
    v_uid := (target.value->>'targetUserId')::uuid;
    IF v_uid = auth.uid() THEN CONTINUE; END IF;
    IF (target.value->>'apartmentId') IS NOT NULL THEN
      v_apt_id := (target.value->>'apartmentId')::uuid;
      SELECT apartment_number INTO v_apt_num FROM public.apartments WHERE id = v_apt_id;
      SELECT approval_status  INTO v_old     FROM public.profiles    WHERE id = v_uid;
      UPDATE public.profiles SET approval_status = 'approved', apartment_id = v_apt_id, updated_at = now() WHERE id = v_uid;
      INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
        VALUES ('identity','BULK_ACCOUNT_APPROVED_AND_ASSIGNED','profile',v_uid,auth.uid(),'info','closed',
          jsonb_build_object('old_status',v_old,'new_status','approved','apartment_number',v_apt_num,'reason',p_reason,'operation_type','bulk'));
    ELSE
      SELECT approval_status INTO v_old FROM public.profiles WHERE id = v_uid;
      UPDATE public.profiles SET approval_status = 'approved', updated_at = now() WHERE id = v_uid;
      INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
        VALUES ('identity','BULK_ACCOUNT_APPROVED','profile',v_uid,auth.uid(),'info','closed',
          jsonb_build_object('old_status',v_old,'new_status','approved','reason',p_reason,'operation_type','bulk'));
    END IF;
  END LOOP;
END; $$;

GRANT EXECUTE ON FUNCTION
  public.tx_update_profile_status(uuid, public.profile_status, text, uuid, jsonb, public.event_severity),
  public.tx_bulk_update_profile_status(uuid[], public.profile_status, text, uuid, jsonb, public.event_severity),
  public.tx_approve_and_assign(uuid, uuid, text, uuid, jsonb),
  public.tx_update_permissions(uuid, public.user_role, boolean, uuid, uuid, jsonb, public.event_severity),
  public.tx_bulk_update_permissions(uuid[], public.user_role, boolean, uuid, jsonb, public.event_severity),
  public.tx_assign_admin(uuid, uuid, uuid, jsonb, public.event_severity),
  public.tx_update_apartment_status(uuid, public.apartment_status, uuid, jsonb, public.event_severity, public.event_status),
  public.tx_bulk_approve_and_assign_units(jsonb, text, uuid)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 9 · PARKING & VEHICLE RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- Assign a vehicle to a spot + create assignment history record.
CREATE OR REPLACE FUNCTION public.tx_assign_parking_spot(
  p_spot_id uuid, p_apartment_id uuid, p_vehicle_id uuid,
  p_assignment_type text, p_ends_at timestamptz, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  UPDATE public.parking_spots
    SET status = 'assigned', assigned_apartment_id = p_apartment_id, assigned_vehicle_id = p_vehicle_id, updated_at = now()
    WHERE id = p_spot_id;
  INSERT INTO public.parking_assignments (spot_id, apartment_id, vehicle_id, assignment_type, status, starts_at, ends_at, created_by)
    VALUES (p_spot_id, p_apartment_id, p_vehicle_id, COALESCE(p_assignment_type,'permanent'), 'active', now(), p_ends_at, auth.uid());
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property','PARKING_ASSIGNED','parking_spot',p_spot_id,auth.uid(),p_payload,'info','closed');
END; $$;

-- Move a vehicle from one spot to another atomically.
CREATE OR REPLACE FUNCTION public.tx_transfer_parking_spot(
  p_old_spot_id uuid, p_new_spot_id uuid, p_apartment_id uuid,
  p_vehicle_id uuid, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  -- Release old spot
  UPDATE public.parking_spots
    SET status = 'available', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
    WHERE id = p_old_spot_id;
  UPDATE public.parking_assignments SET status = 'transferred', ends_at = now()
    WHERE spot_id = p_old_spot_id AND status = 'active';
  -- Occupy new spot
  UPDATE public.parking_spots
    SET status = 'assigned', assigned_apartment_id = p_apartment_id, assigned_vehicle_id = p_vehicle_id, updated_at = now()
    WHERE id = p_new_spot_id;
  INSERT INTO public.parking_assignments (spot_id, apartment_id, vehicle_id, assignment_type, status, starts_at, created_by)
    VALUES (p_new_spot_id, p_apartment_id, p_vehicle_id, 'permanent', 'active', now(), auth.uid());
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property','PARKING_TRANSFERRED','parking_spot',p_new_spot_id,auth.uid(),p_payload,'info','closed');
END; $$;

-- Revoke a spot's assignment.
CREATE OR REPLACE FUNCTION public.tx_revoke_parking_spot(
  p_spot_id uuid, p_reason text, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  UPDATE public.parking_assignments SET status = 'revoked', ends_at = now()
    WHERE spot_id = p_spot_id AND status = 'active';
  UPDATE public.parking_spots
    SET status = 'available', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
    WHERE id = p_spot_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property','PARKING_REVOKED','parking_spot',p_spot_id,auth.uid(),p_payload,'warning','closed');
END; $$;

-- Manually set a spot status (block / unblock / maintenance / reserve).
CREATE OR REPLACE FUNCTION public.tx_update_spot_status(
  p_spot_id uuid, p_new_status text, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_clear boolean := p_new_status IN ('available','blocked','maintenance');
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
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

-- Soft-archive a vehicle (release any spot, end assignment, set status=archived).
CREATE OR REPLACE FUNCTION public.tx_archive_vehicle(
  p_vehicle_id uuid, p_actor_id uuid, p_reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  UPDATE public.parking_spots
    SET status = 'available', assigned_vehicle_id = NULL, assigned_apartment_id = NULL, updated_at = now()
    WHERE assigned_vehicle_id = p_vehicle_id;
  UPDATE public.parking_assignments SET status = 'revoked', ends_at = now()
    WHERE vehicle_id = p_vehicle_id AND status = 'active';
  UPDATE public.vehicles SET approval_status = 'archived', updated_at = now()
    WHERE id = p_vehicle_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('vehicle','VEHICLE_REMOVED','vehicle',p_vehicle_id,auth.uid(),
      jsonb_build_object('reason',p_reason,'operation','archive'),'warning','closed');
END; $$;

-- Admin adds a vehicle directly (auto-approved).
CREATE OR REPLACE FUNCTION public.tx_add_vehicle_by_admin(
  p_apartment_id uuid, p_owner_id uuid, p_plate_number text, p_make text, p_model text,
  p_color text, p_year integer, p_actor_id uuid, p_payload jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  INSERT INTO public.vehicles (apartment_id, owner_id, plate_number, make, model, color, year, approval_status, approved_by, approved_at)
    VALUES (p_apartment_id, p_owner_id, p_plate_number, p_make, p_model, p_color, p_year, 'approved', auth.uid(), now())
    RETURNING id INTO v_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('vehicle','VEHICLE_ADDED_BY_ADMIN','vehicle',v_id,auth.uid(),p_payload,'info','closed');
  RETURN v_id;
END; $$;

-- Resident submits a vehicle request (pending_approval).
CREATE OR REPLACE FUNCTION public.tx_submit_vehicle_request(
  p_apartment_id uuid, p_owner_id uuid, p_plate_number text, p_make text, p_model text,
  p_color text, p_year integer, p_actor_id uuid, p_payload jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  -- Accessible to approved residents; the app-layer requireApprovedUser guards first.
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'FORBIDDEN: authentication required'; END IF;
  INSERT INTO public.vehicles (apartment_id, owner_id, plate_number, make, model, color, year, approval_status)
    VALUES (p_apartment_id, p_owner_id, p_plate_number, p_make, p_model, p_color, p_year, 'pending_approval')
    RETURNING id INTO v_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('vehicle','VEHICLE_SUBMITTED','vehicle',v_id,auth.uid(),p_payload,'info','closed');
  RETURN v_id;
END; $$;

-- Approve or reject a vehicle.
CREATE OR REPLACE FUNCTION public.tx_review_vehicle(
  p_vehicle_id uuid, p_decision text, p_reason text, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision: %', p_decision; END IF;
  UPDATE public.vehicles
    SET approval_status = p_decision::public.vehicle_status,
        approved_by = CASE WHEN p_decision = 'approved' THEN auth.uid() ELSE NULL END,
        approved_at = CASE WHEN p_decision = 'approved' THEN now()      ELSE NULL END,
        updated_at  = now()
    WHERE id = p_vehicle_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('vehicle','VEHICLE_STATUS_CHANGED','vehicle',p_vehicle_id,auth.uid(),p_payload,'info','closed');
END; $$;

-- Bulk review vehicles.
CREATE OR REPLACE FUNCTION public.tx_bulk_review_vehicles(
  p_vehicle_ids uuid[], p_decision text, p_reason text, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Invalid decision: %', p_decision; END IF;
  FOREACH v_id IN ARRAY p_vehicle_ids LOOP
    UPDATE public.vehicles
      SET approval_status = p_decision::public.vehicle_status,
          approved_by = CASE WHEN p_decision = 'approved' THEN auth.uid() ELSE NULL END,
          approved_at = CASE WHEN p_decision = 'approved' THEN now()      ELSE NULL END,
          updated_at  = now()
      WHERE id = v_id;
    INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
      VALUES ('vehicle','VEHICLE_STATUS_CHANGED','vehicle',v_id,auth.uid(),p_payload,'info','closed');
  END LOOP;
END; $$;

-- Resident reports an issue for their own spot.
CREATE OR REPLACE FUNCTION public.tx_report_parking_issue(
  p_spot_id uuid, p_issue_type varchar, p_violating_plate varchar, p_comment text, p_actor_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller_apt uuid; v_spot_apt uuid; v_spot_num text; v_id uuid;
BEGIN
  SELECT apartment_id INTO v_caller_apt FROM public.profiles WHERE id = auth.uid();
  IF v_caller_apt IS NULL THEN RAISE EXCEPTION 'FORBIDDEN: no apartment associated with this account'; END IF;
  SELECT assigned_apartment_id, spot_number INTO v_spot_apt, v_spot_num
    FROM public.parking_spots WHERE id = p_spot_id;
  IF v_spot_apt IS NULL OR v_spot_apt <> v_caller_apt THEN
    RAISE EXCEPTION 'FORBIDDEN: you can only report issues for your own assigned spot';
  END IF;
  INSERT INTO public.parking_issues (spot_id, reporter_id, issue_type, violating_plate, comment)
    VALUES (p_spot_id, auth.uid(), p_issue_type, p_violating_plate, p_comment)
    RETURNING id INTO v_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','PARKING_ISSUE_REPORTED','apartment',v_caller_apt,auth.uid(),'warning','open',
      jsonb_build_object('spot_number',v_spot_num,'issue_type',p_issue_type,'violating_plate',p_violating_plate,'comment',p_comment,'operation_type','manual'));
  UPDATE public.parking_spots SET status = 'conflict', updated_at = now() WHERE id = p_spot_id;
  RETURN v_id;
END; $$;

-- Admin moves a parking issue through its workflow.
CREATE OR REPLACE FUNCTION public.tx_update_parking_issue(
  p_issue_id uuid, p_status text, p_note text, p_actor uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_issue record; v_spot record;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_status NOT IN ('open','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'Invalid issue status: %', p_status;
  END IF;
  SELECT id, spot_id, status INTO v_issue FROM public.parking_issues WHERE id = p_issue_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found'; END IF;
  UPDATE public.parking_issues
    SET status = p_status,
        resolution_note = COALESCE(NULLIF(btrim(p_note),''), resolution_note),
        resolved_at = CASE WHEN p_status IN ('resolved','closed') THEN now() ELSE NULL END,
        resolved_by = CASE WHEN p_status IN ('resolved','closed') THEN auth.uid() ELSE NULL END
    WHERE id = p_issue_id;
  IF p_status IN ('resolved','closed') AND v_issue.spot_id IS NOT NULL THEN
    SELECT id, status, assigned_vehicle_id INTO v_spot FROM public.parking_spots WHERE id = v_issue.spot_id;
    IF v_spot.id IS NOT NULL AND v_spot.status = 'conflict' THEN
      UPDATE public.parking_spots
        SET status = CASE WHEN v_spot.assigned_vehicle_id IS NOT NULL THEN 'occupied' ELSE 'available' END,
            updated_at = now()
        WHERE id = v_spot.id;
    END IF;
  END IF;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','PARKING_ISSUE_UPDATED','system',p_issue_id,auth.uid(),'info',
      CASE WHEN p_status IN ('resolved','closed') THEN 'closed' ELSE 'open' END,
      jsonb_build_object('old_status',v_issue.status,'new_status',p_status,'note',p_note,'operation_type','manual'));
END; $$;

-- Bulk-block an entire zone/floor (simple status sweep; no relocation logic).
-- Caller: ParkingService.bulkBlockZones (relocations already handled in service before this call).
CREATE OR REPLACE FUNCTION public.tx_bulk_block_spots(
  p_zone text, p_floor text, p_reason text, p_blocked_until text, p_actor_id uuid, p_payload jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;

  UPDATE public.parking_assignments SET status = 'revoked', ends_at = now()
    WHERE spot_id IN (
      SELECT id FROM public.parking_spots
      WHERE status <> 'blocked'
        AND (p_zone  IS NULL OR zone  = p_zone)
        AND (p_floor IS NULL OR floor = p_floor)
    ) AND status = 'active';

  UPDATE public.parking_spots
    SET status = 'blocked', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
    WHERE status <> 'blocked'
      AND (p_zone  IS NULL OR zone  = p_zone)
      AND (p_floor IS NULL OR floor = p_floor);

  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, payload, severity, workflow_status)
    VALUES ('property','PARKING_SPOT_BLOCKED','system',gen_random_uuid(),auth.uid(),
      COALESCE(p_payload, '{}'::jsonb) || jsonb_build_object(
        'reason', p_reason, 'blocked_until', p_blocked_until, 'operation_type', 'bulk'
      ),
      'warning','closed');
END; $$;

GRANT EXECUTE ON FUNCTION
  public.tx_assign_parking_spot(uuid, uuid, uuid, text, timestamptz, uuid, jsonb),
  public.tx_transfer_parking_spot(uuid, uuid, uuid, uuid, uuid, jsonb),
  public.tx_revoke_parking_spot(uuid, text, uuid, jsonb),
  public.tx_update_spot_status(uuid, text, uuid, jsonb),
  public.tx_bulk_block_spots(text, text, text, text, uuid, jsonb),
  public.tx_archive_vehicle(uuid, uuid, text),
  public.tx_add_vehicle_by_admin(uuid, uuid, text, text, text, text, integer, uuid, jsonb),
  public.tx_submit_vehicle_request(uuid, uuid, text, text, text, text, integer, uuid, jsonb),
  public.tx_review_vehicle(uuid, text, text, uuid, jsonb),
  public.tx_bulk_review_vehicles(uuid[], text, text, uuid, jsonb),
  public.tx_report_parking_issue(uuid, varchar, varchar, text, uuid),
  public.tx_update_parking_issue(uuid, text, text, uuid)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 10 · QUERY & READ RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- Parking map state.
-- For today: reads directly from parking_spots (always authoritative).
-- For historical dates: reconstructs from parking_assignments time-slice.
CREATE OR REPLACE FUNCTION public.get_parking_map_state(
  p_target_date timestamptz DEFAULT now()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_current boolean := (p_target_date::date = CURRENT_DATE);
  v_spots jsonb;
  v_pool  jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;

  IF v_is_current THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id', ps.id, 'spot_number', ps.spot_number, 'zone', ps.zone, 'floor', ps.floor, 'type', ps.type,
      'status', ps.status,
      'assigned_apartment_id', ps.assigned_apartment_id,
      'assigned_vehicle_id',   ps.assigned_vehicle_id,
      'apartments', CASE WHEN a.id IS NOT NULL THEN jsonb_build_object('apartment_number', a.apartment_number) ELSE NULL END,
      'vehicles', CASE WHEN v.id IS NOT NULL THEN jsonb_build_object(
        'id', v.id, 'plate_number', v.plate_number, 'make', v.make, 'model', v.model,
        'color', v.color, 'year', v.year, 'apartment_id', v.apartment_id, 'owner_id', v.owner_id,
        'apartments', CASE WHEN va.id IS NOT NULL THEN jsonb_build_object('apartment_number', va.apartment_number) ELSE NULL END,
        'profiles',   CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('full_name', pr.full_name) ELSE NULL END
      ) ELSE NULL END
    ) ORDER BY ps.floor NULLS FIRST, ps.spot_number) INTO v_spots
    FROM public.parking_spots ps
    LEFT JOIN public.apartments a  ON a.id  = ps.assigned_apartment_id
    LEFT JOIN public.vehicles   v  ON v.id  = ps.assigned_vehicle_id
    LEFT JOIN public.apartments va ON va.id = v.apartment_id
    LEFT JOIN public.profiles   pr ON pr.id = v.owner_id;

    SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'plate_number', v.plate_number, 'make', v.make, 'model', v.model,
      'color', v.color, 'year', v.year, 'apartment_id', v.apartment_id, 'owner_id', v.owner_id,
      'apartments', jsonb_build_object('apartment_number', a.apartment_number),
      'profiles',   CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('full_name', pr.full_name) ELSE NULL END
    ) ORDER BY v.created_at DESC) INTO v_pool
    FROM public.vehicles v
    JOIN public.apartments a  ON a.id  = v.apartment_id
    LEFT JOIN public.profiles pr ON pr.id = v.owner_id
    WHERE v.approval_status = 'approved'
      AND v.id NOT IN (
        SELECT assigned_vehicle_id FROM public.parking_spots WHERE assigned_vehicle_id IS NOT NULL
      );
  ELSE
    -- Historical reconstruction via parking_assignments time-slice
    SELECT jsonb_agg(jsonb_build_object(
      'id', ps.id, 'spot_number', ps.spot_number, 'zone', ps.zone, 'floor', ps.floor, 'type', ps.type,
      'status', CASE WHEN pa.id IS NOT NULL THEN 'assigned' ELSE ps.status::text END,
      'assigned_apartment_id', pa.apartment_id,
      'assigned_vehicle_id',   pa.vehicle_id,
      'apartments', CASE WHEN a.id IS NOT NULL THEN jsonb_build_object('apartment_number', a.apartment_number) ELSE NULL END,
      'vehicles', CASE WHEN v.id IS NOT NULL THEN jsonb_build_object(
        'id', v.id, 'plate_number', v.plate_number, 'make', v.make, 'model', v.model,
        'color', v.color, 'year', v.year, 'apartment_id', v.apartment_id, 'owner_id', v.owner_id,
        'apartments', CASE WHEN va.id IS NOT NULL THEN jsonb_build_object('apartment_number', va.apartment_number) ELSE NULL END,
        'profiles',   CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('full_name', pr.full_name) ELSE NULL END
      ) ELSE NULL END
    ) ORDER BY ps.floor NULLS FIRST, ps.spot_number) INTO v_spots
    FROM public.parking_spots ps
    LEFT JOIN public.parking_assignments pa
      ON ps.id = pa.spot_id AND pa.status = 'active'
      AND pa.starts_at <= p_target_date AND (pa.ends_at IS NULL OR pa.ends_at >= p_target_date)
    LEFT JOIN public.apartments a  ON a.id  = pa.apartment_id
    LEFT JOIN public.vehicles   v  ON v.id  = pa.vehicle_id
    LEFT JOIN public.apartments va ON va.id = v.apartment_id
    LEFT JOIN public.profiles   pr ON pr.id = v.owner_id;

    SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'plate_number', v.plate_number, 'make', v.make, 'model', v.model,
      'color', v.color, 'year', v.year, 'apartment_id', v.apartment_id, 'owner_id', v.owner_id,
      'apartments', jsonb_build_object('apartment_number', a.apartment_number)
    ) ORDER BY v.created_at DESC) INTO v_pool
    FROM public.vehicles v
    JOIN public.apartments a ON a.id = v.apartment_id
    WHERE v.approval_status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM public.parking_assignments pa
        WHERE pa.vehicle_id = v.id AND pa.status = 'active'
          AND pa.starts_at <= p_target_date AND (pa.ends_at IS NULL OR pa.ends_at >= p_target_date)
      );
  END IF;

  RETURN jsonb_build_object(
    'spots',           COALESCE(v_spots, '[]'::jsonb),
    'unassigned_pool', COALESCE(v_pool,  '[]'::jsonb)
  );
END; $$;

-- Admin dashboard metrics card.
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unassigned int; v_blocked int; v_pending_veh int; v_pending_acc int; v_problem int;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  SELECT COUNT(*)::int INTO v_unassigned FROM public.vehicles
    WHERE approval_status = 'approved'
      AND id NOT IN (SELECT assigned_vehicle_id FROM public.parking_spots WHERE assigned_vehicle_id IS NOT NULL);
  SELECT COUNT(*)::int INTO v_blocked      FROM public.parking_spots WHERE status = 'blocked';
  SELECT COUNT(*)::int INTO v_pending_veh  FROM public.vehicles       WHERE approval_status = 'pending_approval';
  SELECT COUNT(*)::int INTO v_pending_acc  FROM public.profiles        WHERE approval_status = 'pending_approval';
  SELECT COUNT(*)::int INTO v_problem      FROM public.apartments      WHERE status IN ('problem','restricted');
  RETURN jsonb_build_object(
    'unassigned_vehicles', v_unassigned, 'blocked_spots', v_blocked,
    'pending_vehicles', v_pending_veh, 'pending_accounts', v_pending_acc, 'problem_units', v_problem
  );
END; $$;

-- Apartments directory with resident + vehicle counts.
CREATE OR REPLACE FUNCTION public.get_apartments_directory()
RETURNS TABLE (
  id uuid, apartment_number text, status text, assigned_admin_id uuid,
  profiles_count bigint, vehicles_count bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  RETURN QUERY
  SELECT a.id, a.apartment_number::text, a.status::text, a.assigned_admin_id,
    (SELECT COUNT(*) FROM public.profiles p WHERE p.apartment_id = a.id AND p.approval_status <> 'rejected') AS profiles_count,
    (SELECT COUNT(*) FROM public.vehicles v WHERE v.apartment_id = a.id AND v.approval_status <> 'archived')  AS vehicles_count
  FROM public.apartments a ORDER BY a.apartment_number;
END; $$;

-- Privacy-safe parking map for residents (hides other residents' plates/units).
CREATE OR REPLACE FUNCTION public.get_resident_parking_map()
RETURNS TABLE (
  id uuid, spot_number text, floor text, zone text, status text, is_own boolean, is_occupied boolean,
  plate_number text, make text, model text,
  relocation_status text, original_spot_number text, temporary_spot_number text, disruption_title text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_apt uuid; v_appr text;
BEGIN
  SELECT apartment_id, approval_status INTO v_apt, v_appr FROM public.profiles WHERE id = auth.uid();
  IF v_apt IS NULL OR v_appr <> 'approved' THEN
    RAISE EXCEPTION 'FORBIDDEN: approved resident apartment required';
  END IF;
  RETURN QUERY
  SELECT
    ps.id,
    ps.spot_number::text,
    COALESCE(ps.floor::text,'1') AS floor,
    COALESCE(ps.zone::text,'residential') AS zone,
    CASE
      WHEN own_ctx.is_visible THEN ps.status::text
      WHEN ps.status IN ('available','temporary') THEN 'available'
      WHEN ps.status IN ('blocked','maintenance')  THEN 'blocked'
      WHEN ps.status = 'conflict'                  THEN 'conflict'
      ELSE 'occupied'
    END AS status,
    own_ctx.is_visible AS is_own,
    (ps.assigned_vehicle_id IS NOT NULL OR ps.status IN ('assigned','occupied','reserved')) AS is_occupied,
    CASE WHEN own_ctx.is_visible THEN v.plate_number::text ELSE NULL END AS plate_number,
    CASE WHEN own_ctx.is_visible THEN v.make::text         ELSE NULL END AS make,
    CASE WHEN own_ctx.is_visible THEN v.model::text        ELSE NULL END AS model,
    rel.status::text        AS relocation_status,
    rel.original_spot_number,
    rel.temporary_spot_number,
    rel.disruption_title
  FROM public.parking_spots ps
  LEFT JOIN public.vehicles v ON v.id = ps.assigned_vehicle_id
  LEFT JOIN LATERAL (
    SELECT tr.status, os.spot_number::text AS original_spot_number, ts.spot_number::text AS temporary_spot_number,
           pd.title::text AS disruption_title, tr.original_spot_id, tr.temporary_spot_id
    FROM public.temporary_relocations tr
    LEFT JOIN public.parking_spots os ON os.id = tr.original_spot_id
    LEFT JOIN public.parking_spots ts ON ts.id = tr.temporary_spot_id
    LEFT JOIN public.parking_disruptions pd ON pd.id = tr.disruption_id
    WHERE tr.apartment_id = v_apt
      AND tr.status IN ('active','needs_placement','needs_review')
      AND (tr.original_spot_id = ps.id OR tr.temporary_spot_id = ps.id)
    ORDER BY tr.created_at DESC LIMIT 1
  ) rel ON true
  CROSS JOIN LATERAL (
    SELECT (
      ps.assigned_apartment_id = v_apt
      OR rel.original_spot_id IS NOT NULL
      OR rel.temporary_spot_id IS NOT NULL
    ) AS is_visible
  ) own_ctx
  ORDER BY COALESCE(ps.floor::text,'1'), ps.spot_number::text;
END; $$;

-- Keyset-paginated audit log.
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  cursor_created_at timestamptz DEFAULT NULL, cursor_id uuid DEFAULT NULL,
  limit_count int DEFAULT 100, search_query text DEFAULT NULL,
  action_filter text DEFAULT 'ALL', date_from timestamptz DEFAULT NULL, date_to timestamptz DEFAULT NULL
) RETURNS TABLE (
  id uuid, admin_id uuid, action_type text, description text, created_at timestamptz,
  entity_type text, entity_id uuid, old_data jsonb, new_data jsonb,
  ip_address text, user_agent text, request_id uuid,
  actor_email_snapshot text, actor_role_snapshot text,
  admin_full_name text, admin_email text, workflow_status text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  RETURN QUERY
  SELECT e.id, e.actor_id AS admin_id, e.action_type::text,
    COALESCE(e.payload->>'content', e.action_type)::text AS description,
    e.created_at, e.entity_type::text, e.entity_id,
    (e.payload->'old_data')::jsonb AS old_data, (e.payload->'new_data')::jsonb AS new_data,
    NULL::text, NULL::text, NULL::uuid,
    p.email::text, p.role::text, p.full_name::text, p.email::text, e.workflow_status::text
  FROM public.events e
  LEFT JOIN public.profiles p ON p.id = e.actor_id
  WHERE (action_filter = 'ALL' OR action_filter IS NULL OR e.action_type = action_filter)
    AND (date_from IS NULL OR e.created_at >= date_from)
    AND (date_to   IS NULL OR e.created_at < date_to)
    AND (cursor_created_at IS NULL OR e.created_at < cursor_created_at)
    AND (search_query IS NULL
         OR e.action_type ILIKE '%' || search_query || '%'
         OR COALESCE(e.payload->>'content','') ILIKE '%' || search_query || '%'
         OR e.entity_id::text = search_query)
  ORDER BY e.created_at DESC
  LIMIT COALESCE(limit_count, 100);
END; $$;

-- Apartment activity timeline (last 200 events).
CREATE OR REPLACE FUNCTION public.get_apartment_timeline(p_apartment_id uuid)
RETURNS TABLE (
  id uuid, created_at timestamptz, content text, author_name text, author_role text, action_type text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  RETURN QUERY
  SELECT e.id, e.created_at,
    COALESCE(e.payload->>'content', e.action_type)::text AS content,
    p.full_name::text, p.role::text, e.action_type::text
  FROM public.events e
  LEFT JOIN public.profiles p ON p.id = e.actor_id
  WHERE e.entity_id = p_apartment_id
  ORDER BY e.created_at DESC LIMIT 200;
END; $$;

GRANT EXECUTE ON FUNCTION
  public.get_parking_map_state(timestamptz),
  public.get_admin_dashboard_metrics(),
  public.get_apartments_directory(),
  public.get_resident_parking_map(),
  public.get_audit_logs(timestamptz, uuid, int, text, text, timestamptz, timestamptz),
  public.get_apartment_timeline(uuid)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 11 · FEATURE RPCs — Disruptions / Notices / Settings
-- ─────────────────────────────────────────────────────────────────────────────

-- Block spots for construction, auto-relocate affected vehicles.
-- Disruptions always activate immediately (start/end dates are documentation only).
CREATE OR REPLACE FUNCTION public.tx_create_disruption(
  p_spot_ids uuid[], p_title text, p_reason text,
  p_start date, p_end date, p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_disruption_id uuid;
  v_spot    record;
  v_target  uuid;
  v_blocked int := 0; v_relocated int := 0; v_needs int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF p_spot_ids IS NULL OR array_length(p_spot_ids, 1) IS NULL THEN RAISE EXCEPTION 'No spots selected'; END IF;

  INSERT INTO public.parking_disruptions (title, reason, start_date, end_date, status, created_by)
    VALUES (p_title, p_reason, p_start, p_end, 'active', auth.uid())
    RETURNING id INTO v_disruption_id;

  FOR v_spot IN
    SELECT id, spot_number, status, assigned_apartment_id, assigned_vehicle_id
    FROM public.parking_spots WHERE id = ANY(p_spot_ids)
  LOOP
    INSERT INTO public.parking_disruption_spots
      (disruption_id, spot_id, previous_status, previous_apartment_id, previous_vehicle_id)
      VALUES (v_disruption_id, v_spot.id, v_spot.status, v_spot.assigned_apartment_id, v_spot.assigned_vehicle_id);

    -- Clear + block original FIRST (releases unique_active_vehicle_spot constraint)
    UPDATE public.parking_spots
      SET status = 'blocked', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
      WHERE id = v_spot.id;
    v_blocked := v_blocked + 1;

    IF v_spot.assigned_vehicle_id IS NOT NULL THEN
      SELECT id INTO v_target FROM public.parking_spots
        WHERE status = 'available' AND assigned_vehicle_id IS NULL AND NOT (id = ANY(p_spot_ids))
        ORDER BY spot_number LIMIT 1;

      IF v_target IS NOT NULL THEN
        UPDATE public.parking_spots
          SET status = 'occupied', assigned_apartment_id = v_spot.assigned_apartment_id,
              assigned_vehicle_id = v_spot.assigned_vehicle_id, updated_at = now()
          WHERE id = v_target;
        INSERT INTO public.temporary_relocations
          (disruption_id, vehicle_id, apartment_id, original_spot_id, temporary_spot_id, status)
          VALUES (v_disruption_id, v_spot.assigned_vehicle_id, v_spot.assigned_apartment_id, v_spot.id, v_target, 'active');
        v_relocated := v_relocated + 1;
      ELSE
        INSERT INTO public.temporary_relocations
          (disruption_id, vehicle_id, apartment_id, original_spot_id, temporary_spot_id, status)
          VALUES (v_disruption_id, v_spot.assigned_vehicle_id, v_spot.assigned_apartment_id, v_spot.id, NULL, 'needs_placement');
        v_needs := v_needs + 1;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','DISRUPTION_CREATED','system',v_disruption_id,auth.uid(),'warning','open',
      jsonb_build_object('title',p_title,'reason',p_reason,'blocked',v_blocked,'relocated',v_relocated,
        'needs_placement',v_needs,'start',p_start,'end',p_end,'status','active','operation_type','bulk'));

  RETURN jsonb_build_object('disruption_id',v_disruption_id,'blocked',v_blocked,'relocated',v_relocated,'needs_placement',v_needs,'status','active');
END; $$;

-- Return all vehicles to their original spots after construction.
CREATE OR REPLACE FUNCTION public.tx_complete_disruption(
  p_disruption_id uuid, p_actor uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_orig record;
  v_temp_ok boolean; v_elsewhere boolean;
  v_returned int := 0; v_review int := 0; v_unblocked int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parking_disruptions WHERE id = p_disruption_id AND status IN ('active','scheduled')) THEN
    RAISE EXCEPTION 'Disruption not found or already completed';
  END IF;

  FOR v_orig IN
    SELECT pds.spot_id, pds.previous_status,
      COALESCE(pds.previous_apartment_id, tr.apartment_id) AS previous_apartment_id,
      COALESCE(pds.previous_vehicle_id,   tr.vehicle_id)   AS previous_vehicle_id,
      tr.id AS relocation_id, tr.temporary_spot_id, tr.status AS relocation_status
    FROM public.parking_disruption_spots pds
    LEFT JOIN public.temporary_relocations tr
      ON tr.disruption_id = pds.disruption_id AND tr.original_spot_id = pds.spot_id
      AND tr.status IN ('active','needs_placement')
    WHERE pds.disruption_id = p_disruption_id
  LOOP
    v_temp_ok := false; v_elsewhere := false;

    IF v_orig.previous_vehicle_id IS NOT NULL AND v_orig.temporary_spot_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.parking_spots
        WHERE id = v_orig.temporary_spot_id AND assigned_vehicle_id = v_orig.previous_vehicle_id) INTO v_temp_ok;
    END IF;

    IF v_orig.previous_vehicle_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.parking_spots
        WHERE assigned_vehicle_id = v_orig.previous_vehicle_id
          AND id <> COALESCE(v_orig.temporary_spot_id, v_orig.spot_id)) INTO v_elsewhere;
    END IF;

    IF v_orig.previous_vehicle_id IS NOT NULL AND v_orig.temporary_spot_id IS NOT NULL AND NOT v_temp_ok THEN
      UPDATE public.temporary_relocations SET status = 'needs_review' WHERE id = v_orig.relocation_id;
      v_review := v_review + 1; CONTINUE;
    END IF;

    IF v_orig.previous_vehicle_id IS NOT NULL AND v_orig.temporary_spot_id IS NULL AND v_elsewhere THEN
      UPDATE public.temporary_relocations SET status = 'needs_review' WHERE id = v_orig.relocation_id;
      v_review := v_review + 1; CONTINUE;
    END IF;

    IF v_orig.temporary_spot_id IS NOT NULL THEN
      UPDATE public.parking_spots
        SET status = 'available', assigned_apartment_id = NULL, assigned_vehicle_id = NULL, updated_at = now()
        WHERE id = v_orig.temporary_spot_id AND assigned_vehicle_id = v_orig.previous_vehicle_id;
    END IF;

    UPDATE public.parking_spots
      SET status = COALESCE(v_orig.previous_status, 'available'),
          assigned_apartment_id = v_orig.previous_apartment_id,
          assigned_vehicle_id   = v_orig.previous_vehicle_id,
          updated_at = now()
      WHERE id = v_orig.spot_id
        AND (status = 'blocked' OR assigned_vehicle_id IS NULL OR assigned_vehicle_id = v_orig.previous_vehicle_id);

    IF FOUND THEN
      v_unblocked := v_unblocked + 1;
      IF v_orig.previous_vehicle_id IS NOT NULL THEN v_returned := v_returned + 1; END IF;
      IF v_orig.relocation_id IS NOT NULL THEN
        UPDATE public.temporary_relocations SET status = 'returned' WHERE id = v_orig.relocation_id;
      END IF;
    ELSE
      IF v_orig.relocation_id IS NOT NULL THEN
        UPDATE public.temporary_relocations SET status = 'needs_review' WHERE id = v_orig.relocation_id;
      END IF;
      v_review := v_review + 1;
    END IF;
  END LOOP;

  UPDATE public.parking_disruptions SET status = 'completed', completed_at = now() WHERE id = p_disruption_id;

  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('property','DISRUPTION_COMPLETED','system',p_disruption_id,auth.uid(),
      CASE WHEN v_review > 0 THEN 'warning' ELSE 'info' END,
      CASE WHEN v_review > 0 THEN 'open'    ELSE 'closed' END,
      jsonb_build_object('returned',v_returned,'needs_review',v_review,'unblocked',v_unblocked,'operation_type','bulk'));

  RETURN jsonb_build_object('returned',v_returned,'needs_review',v_review,'unblocked',v_unblocked);
END; $$;

-- Send a notice to all/apartment/single recipient.
CREATE OR REPLACE FUNCTION public.tx_send_notice(
  p_audience text, p_apartment_id uuid, p_target_id uuid,
  p_title text, p_body text, p_type text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch uuid := gen_random_uuid(); v_count int := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  IF coalesce(btrim(p_title),'') = '' OR coalesce(btrim(p_body),'') = '' THEN
    RAISE EXCEPTION 'Title and body are required';
  END IF;
  INSERT INTO public.notices (batch_id, recipient_id, title, body, type, created_by)
  SELECT v_batch, pr.id, p_title, p_body, coalesce(p_type,'announcement'), auth.uid()
  FROM public.profiles pr
  WHERE pr.approval_status = 'approved' AND pr.role = 'resident'
    AND (p_audience = 'all'
      OR (p_audience = 'apartment' AND pr.apartment_id = p_apartment_id)
      OR (p_audience = 'profile'   AND pr.id           = p_target_id));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('system','NOTICE_SENT','system',v_batch,auth.uid(),'info','closed',
      jsonb_build_object('title',p_title,'type',p_type,'audience',p_audience,'recipients',v_count,'operation_type','manual'));
  RETURN jsonb_build_object('batch_id', v_batch, 'count', v_count);
END; $$;

-- Update building settings.
CREATE OR REPLACE FUNCTION public.tx_update_settings(
  p_settings jsonb, p_actor uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN: administrator privileges required'; END IF;
  SELECT id INTO v_id FROM public.building_settings ORDER BY updated_at NULLS FIRST LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.building_settings (building_name) VALUES ('ResidentPark') RETURNING id INTO v_id;
  END IF;
  UPDATE public.building_settings SET
    building_name            = COALESCE(p_settings->>'building_name',            building_name),
    timezone                 = COALESCE(p_settings->>'timezone',                 timezone),
    max_spots_per_unit       = COALESCE((p_settings->>'max_spots_per_unit')::int, max_spots_per_unit),
    require_vehicle_approval = COALESCE((p_settings->>'require_vehicle_approval')::boolean, require_vehicle_approval),
    resident_portal_notice   = COALESCE(p_settings->>'resident_portal_notice',   resident_portal_notice),
    updated_at               = now(),
    updated_by               = auth.uid()
  WHERE id = v_id;
  INSERT INTO public.events (domain, action_type, entity_type, entity_id, actor_id, severity, workflow_status, payload)
    VALUES ('system','SYSTEM_SETTINGS_CHANGED','system',v_id,auth.uid(),'warning','closed',
      jsonb_build_object('content','Building settings updated','new_data',p_settings,'operation_type','manual'));
END; $$;

GRANT EXECUTE ON FUNCTION
  public.tx_create_disruption(uuid[], text, text, date, date, uuid),
  public.tx_complete_disruption(uuid, uuid),
  public.tx_send_notice(text, uuid, uuid, text, text, text),
  public.tx_update_settings(jsonb, uuid),
  public.is_admin(),
  public.is_superadmin(),
  public.get_auth_role()
  TO authenticated;

-- =============================================================================
-- END OF BASELINE
-- =============================================================================
-- After applying this file on a fresh Supabase project:
--   1. Create the first superadmin account via Supabase Auth → update their
--      profile role to 'superadmin' in the profiles table directly.
--   2. Insert parking spots via the Supabase dashboard or a seed script.
--   3. The app is ready.
-- =============================================================================
