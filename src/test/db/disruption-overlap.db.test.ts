// Title: Disruption Overlap DB Test
// Path: src/test/db/disruption-overlap.db.test.ts
// Functionality: Database coverage for disruption overlap prevention (0022).

// a spot already controlled by a non-terminal disruption cannot be put into a
// second one; tx_create_disruption rejects the overlap so restoration stays correct.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('disruption overlap prevention (0022)', () => {
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
    const { data, error } = await serviceClient().from('parking_spots')
      .insert({ spot_number: `OV-${Date.now()}-${spots.length}`, status: 'available' }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }

  function createDisruption(client: Awaited<ReturnType<typeof signedInClient>>, spotIds: string[], adminId: string) {
    return client.rpc('tx_create_disruption', {
      p_spot_ids: spotIds, p_title: 'Overlap QA', p_reason: 'testing',
      p_start: '2020-01-01', p_end: '2020-01-02', p_actor: adminId,
    });
  }

  it('rejects a second disruption that includes a spot already in an active one', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);

    const { data: first, error: firstErr } = await createDisruption(client, [spot], admin.id);
    expect(firstErr).toBeNull();
    disruptions.push(first?.disruption_id as string);

    const { error: overlapErr } = await createDisruption(client, [spot], admin.id);
    expect(overlapErr?.message ?? '').toMatch(/already in an active disruption/i);
  });

  it('allows re-disrupting a spot once the first disruption is completed', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);

    const { data: first } = await createDisruption(client, [spot], admin.id);
    const firstId = first?.disruption_id as string;
    disruptions.push(firstId);
    await client.rpc('tx_complete_disruption', { p_disruption_id: firstId, p_actor: admin.id });

    const { data: second, error: secondErr } = await createDisruption(client, [spot], admin.id);
    expect(secondErr).toBeNull();
    disruptions.push(second?.disruption_id as string);
  });
});
