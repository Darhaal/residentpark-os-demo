// Title: Rate Limit Guard Test
// Path: src/lib/rate-limit.test.ts
// Functionality: Unit coverage for enforceRateLimit — it passes the configured
//   window to the RPC, throws RATE_LIMITED when the limiter rejects, and fails open
//   (allows the request) when the limiter itself is unavailable.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), audit: vi.fn() },
}));

import { enforceRateLimit } from './rate-limit';
import { logger } from '@/lib/logger';
import { RATE_LIMITS } from '@/config/limits';

type RpcResult = { error: unknown };
const makeClient = (error: unknown) => {
  const rpc = vi.fn<(name: string, params: unknown) => Promise<RpcResult>>().mockResolvedValue({ error });
  // Cast through unknown — the helper only ever calls `.rpc`.
  return { client: { rpc } as unknown as Parameters<typeof enforceRateLimit>[0], rpc };
};

describe('enforceRateLimit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows the request and forwards the configured max/window', async () => {
    const { client, rpc } = makeClient(null);
    await expect(enforceRateLimit(client, 'account_create')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('tx_check_rate_limit', {
      p_action_key: 'account_create',
      p_max: RATE_LIMITS.account_create.max,
      p_window_seconds: RATE_LIMITS.account_create.windowSeconds,
    });
  });

  it('throws RATE_LIMITED when the limiter rejects', async () => {
    const { client } = makeClient({ message: 'RATE_LIMITED: too many "account_create" requests' });
    await expect(enforceRateLimit(client, 'account_create')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Please wait before creating another account.',
    });
  });

  it('uses the workflow-specific retry message', async () => {
    const { client } = makeClient({ message: 'RATE_LIMITED: too many "audit_export" requests' });
    await expect(enforceRateLimit(client, 'audit_export')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Please wait before exporting audit logs again.',
    });
  });

  it('fails open (resolves) and warns when the limiter is unavailable', async () => {
    const { client } = makeClient({ message: 'function tx_check_rate_limit does not exist' });
    await expect(enforceRateLimit(client, 'issue_report')).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
