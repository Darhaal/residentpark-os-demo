// Title: Rate Limit Guard
// Path: src/lib/rate-limit.ts
// Functionality: Thin wrapper over the tx_check_rate_limit RPC (migration 0016). Call it
//   at the start of a sensitive server action with the signed-in user's Supabase client.
//   It throws AppError('RATE_LIMITED') when the per-actor window is exceeded, and fails
//   open (logs a warning, allows the request) if the limiter itself is unavailable — a
//   limiter outage must not block legitimate provisioning work.

import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/errors';
import { logRequestWarn } from '@/lib/request-logger';
import { RATE_LIMITS, type RateLimitKey } from '@/config/limits';
import { rateLimitMessages } from '@/localization/en/rate-limits';

export async function enforceRateLimit(supabase: SupabaseClient, key: RateLimitKey): Promise<void> {
  const { max, windowSeconds } = RATE_LIMITS[key];

  const { error } = await supabase.rpc('tx_check_rate_limit', {
    p_action_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });

  if (!error) return;

  if ((error.message || '').includes('RATE_LIMITED')) {
    throw new AppError('RATE_LIMITED', rateLimitMessages[key]);
  }

  // Any other failure (e.g. the function is not deployed yet) must not break the action.
  await logRequestWarn('Rate limit check failed; allowing request', { key, error: error.message });
}
