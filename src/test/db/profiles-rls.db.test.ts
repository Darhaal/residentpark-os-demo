// Title: Profiles RLS DB Test
// Path: src/test/db/profiles-rls.db.test.ts
// Functionality: Database authorization and RLS coverage for profile visibility and account state.

// residents must not be able to escalate themselves via direct table writes.
// Verifies the column-level protection added in applied/0001_security_hardening.sql.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createResident, deleteUser, serviceClient, signedInClient, type TestUser } from './harness';

describe.skipIf(!hasDbEnv())('profiles RLS — resident self-escalation', () => {
  const created: string[] = [];

  afterEach(async () => {
    while (created.length) {
      const id = created.pop();
      if (id) await deleteUser(id);
    }
  });

  async function newResident(): Promise<TestUser> {
    const user = await createResident();
    created.push(user.id);
    return user;
  }

  it('cannot change its own role', async () => {
    const user = await newResident();
    const client = await signedInClient(user.email, user.password);
    await client.from('profiles').update({ role: 'admin' }).eq('id', user.id);
    const { data } = await serviceClient().from('profiles').select('role').eq('id', user.id).single();
    expect(data?.role).toBe('resident');
  });

  it('cannot approve itself', async () => {
    const user = await newResident();
    const client = await signedInClient(user.email, user.password);
    await client.from('profiles').update({ approval_status: 'approved' }).eq('id', user.id);
    const { data } = await serviceClient().from('profiles').select('approval_status').eq('id', user.id).single();
    expect(data?.approval_status).not.toBe('approved');
  });

  it('cannot assign itself an apartment', async () => {
    const user = await newResident();
    const client = await signedInClient(user.email, user.password);
    await client
      .from('profiles')
      .update({ apartment_id: '00000000-0000-0000-0000-000000000000' })
      .eq('id', user.id);
    const { data } = await serviceClient().from('profiles').select('apartment_id').eq('id', user.id).single();
    expect(data?.apartment_id).toBeNull();
  });

  it('can still edit its own full_name', async () => {
    const user = await newResident();
    const client = await signedInClient(user.email, user.password);
    await client.from('profiles').update({ full_name: 'Renamed Resident' }).eq('id', user.id);
    const { data } = await serviceClient().from('profiles').select('full_name').eq('id', user.id).single();
    expect(data?.full_name).toBe('Renamed Resident');
  });
});
