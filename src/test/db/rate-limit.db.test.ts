// Title: Rate Limiting DB Test
// Path: src/test/db/rate-limit.db.test.ts
// Functionality: Coverage for tx_check_rate_limit (migration 0016) — per-actor windows
//   block past the max, action keys are isolated, and anon cannot call the limiter.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { anonClient, createResident, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('rate limiting (P2.4)', () => {
  const users: string[] = [];

  afterEach(async () => {
    while (users.length) {
      const id = users.pop();
      if (id) {
        await serviceClient().from('rate_limit_events').delete().eq('actor_id', id);
        await deleteUser(id);
      }
    }
  });

  it('allows up to max requests per window, then blocks', async () => {
    const user = await createResident({ approve: true });
    users.push(user.id);
    const client = await signedInClient(user.email, user.password);
    const key = `test_${Date.now()}`;
    const call = () => client.rpc('tx_check_rate_limit', { p_action_key: key, p_max: 3, p_window_seconds: 60 });

    expect((await call()).error).toBeNull();
    expect((await call()).error).toBeNull();
    expect((await call()).error).toBeNull();

    const blocked = await call();
    expect(blocked.error).not.toBeNull();
    expect(blocked.error?.message ?? '').toContain('RATE_LIMITED');
  });

  it('isolates limits per action key', async () => {
    const user = await createResident({ approve: true });
    users.push(user.id);
    const client = await signedInClient(user.email, user.password);

    expect((await client.rpc('tx_check_rate_limit', { p_action_key: 'key_a', p_max: 1, p_window_seconds: 60 })).error).toBeNull();
    // Second call on key_a is over the limit...
    expect((await client.rpc('tx_check_rate_limit', { p_action_key: 'key_a', p_max: 1, p_window_seconds: 60 })).error).not.toBeNull();
    // ...but key_b has its own independent budget.
    expect((await client.rpc('tx_check_rate_limit', { p_action_key: 'key_b', p_max: 1, p_window_seconds: 60 })).error).toBeNull();
  });

  it('denies anonymous callers', async () => {
    const { error } = await anonClient().rpc('tx_check_rate_limit', { p_action_key: 'x', p_max: 1, p_window_seconds: 60 });
    expect(error).not.toBeNull();
  });
});
