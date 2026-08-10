-- 0005_remove_unused_rpcs.sql
-- Purpose: Drop query RPCs that exist in baseline.sql but have no consumer in the
--          current application source. Confirmed 2026-06-13 by a full `src` scan:
--            get_admin_dashboard_metrics  -> 0 references
--            get_apartments_directory     -> 0 references
--          get_parking_map_state IS still used (via AdminLoaderService) and is kept.
--
-- Priority: P2 (maintainability). Safe to apply after 0001-0004.
--
-- Before applying: confirm no EXTERNAL consumer (a direct PostgREST/edge-function
-- call from outside this repo) depends on these RPCs. They were admin dashboard /
-- directory helpers superseded by per-loader queries.
--
-- How to apply: paste into Supabase SQL Editor and press RUN (not Explain).

DROP FUNCTION IF EXISTS public.get_admin_dashboard_metrics();
DROP FUNCTION IF EXISTS public.get_apartments_directory();
