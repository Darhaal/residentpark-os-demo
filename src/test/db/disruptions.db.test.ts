// Title: Disruptions DB Test
// Path: src/test/db/disruptions.db.test.ts
// Functionality: Database authorization and RLS coverage for construction disruption workflows.

// disruptions are admin-only. Creating one blocks the affected spot; completing it
// restores the spot's previous status (tx_create_disruption / tx_complete_disruption).

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createResident, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('disruptions create -> restore', () => {
  const users: string[] = [];
  const spots: string[] = [];
  const disruptions: string[] = [];

  afterEach(async () => {
    const svc = serviceClient();
    while (disruptions.length) { const id = disruptions.pop(); if (id) await svc.from('parking_disruptions').delete().eq('id', id); }
    while (spots.length) { const id = spots.pop(); if (id) await svc.from('parking_spots').delete().eq('id', id); }
    while (users.length) { const id = users.pop(); if (id) await deleteUser(id); }
  });

  async function makeSpot(): Promise<string> {
    const { data, error } = await serviceClient().from('parking_spots').insert({ spot_number: `T-${Date.now()}-${spots.length}`, status: 'available' }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }
  async function statusOf(id: string): Promise<string | undefined> {
    const { data } = await serviceClient().from('parking_spots').select('status').eq('id', id).single();
    return data?.status as string | undefined;
  }

  it('creating a disruption blocks the spot; completing it restores the spot', async () => {
    const admin = await createAdmin();
    users.push(admin.id);
    const spotId = await makeSpot();
    spots.push(spotId);
    const client = await signedInClient(admin.email, admin.password);

    const { data: created, error } = await client.rpc('tx_create_disruption', {
      p_spot_ids: [spotId], p_title: 'QA work', p_reason: 'testing', p_start: '2020-01-01', p_end: '2020-01-02', p_actor: admin.id,
    });
    expect(error).toBeNull();
    const disruptionId = created?.disruption_id as string;
    expect(disruptionId).toBeTruthy();
    disruptions.push(disruptionId);
    expect(await statusOf(spotId)).toBe('blocked');

    const { error: completeError } = await client.rpc('tx_complete_disruption', { p_disruption_id: disruptionId, p_actor: admin.id });
    expect(completeError).toBeNull();
    expect(await statusOf(spotId)).toBe('available');
  });

  it('a resident cannot create a disruption', async () => {
    const resident = await createResident({ approve: true });
    users.push(resident.id);
    const spotId = await makeSpot();
    spots.push(spotId);
    const client = await signedInClient(resident.email, resident.password);

    const { error } = await client.rpc('tx_create_disruption', {
      p_spot_ids: [spotId], p_title: 'x', p_reason: 'x', p_start: '2020-01-01', p_end: '2020-01-02', p_actor: resident.id,
    });
    expect(error?.message ?? '').toMatch(/FORBIDDEN|administrator/i);
  });
});
