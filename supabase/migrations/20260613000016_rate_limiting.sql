-- Title: Request Rate Limiting (P2.4)
-- Path: supabase/applied/0016_rate_limiting.sql
-- Functionality: A database-backed, per-actor sliding-window rate limiter. Serverless
--   server actions run on many short-lived instances, so an in-memory limiter cannot
--   share state; Postgres is the one shared, transactional store every instance reaches.
--
--   tx_check_rate_limit(action_key, max, window_seconds) records one attempt for the
--   calling user and raises RATE_LIMITED once more than `max` attempts land inside the
--   trailing `window_seconds`. Sensitive server actions call it before doing work.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id   uuid        NOT NULL,
  action_key text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (actor_id, action_key, created_at DESC);

-- The table is reached only through the SECURITY DEFINER function below (and the
-- service role). Enable RLS and revoke every direct grant; the explicit deny policy
-- documents intent and keeps it consistent with the "every RLS table has a policy" rule.
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_events FROM authenticated, anon;

DROP POLICY IF EXISTS "rate_limit_no_direct_access" ON public.rate_limit_events;
CREATE POLICY "rate_limit_no_direct_access" ON public.rate_limit_events FOR ALL USING (false);

CREATE OR REPLACE FUNCTION public.tx_check_rate_limit(
  p_action_key text,
  p_max integer,
  p_window_seconds integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: authentication required';
  END IF;
  IF p_action_key IS NULL OR btrim(p_action_key) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: action key is required';
  END IF;
  IF p_max IS NULL OR p_max < 1 OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'VALIDATION: invalid rate-limit parameters';
  END IF;

  -- Prune this actor/key's expired rows so the table stays bounded.
  DELETE FROM public.rate_limit_events
   WHERE actor_id = v_actor
     AND action_key = p_action_key
     AND created_at < now() - make_interval(secs => p_window_seconds);

  SELECT count(*) INTO v_count
    FROM public.rate_limit_events
   WHERE actor_id = v_actor
     AND action_key = p_action_key;

  IF v_count >= p_max THEN
    RAISE EXCEPTION USING
      ERRCODE = '53400',
      MESSAGE = format('RATE_LIMITED: too many "%s" requests; please wait and try again', p_action_key);
  END IF;

  INSERT INTO public.rate_limit_events (actor_id, action_key) VALUES (v_actor, p_action_key);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tx_check_rate_limit(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tx_check_rate_limit(text, integer, integer) TO authenticated;

COMMIT;
