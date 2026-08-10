// Title: Disruption Update DB Test
// Path: src/test/db/disruption-update.db.test.ts
// Functionality: Database coverage for editing a scheduled disruption (0027).

// #9 — tx_update_disruption edits a scheduled disruption's metadata and re-points its
// target spots. Only scheduled disruptions are editable; active ones are immutable here,
// and overlapping another active/scheduled disruption's spots is rejected.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, deleteUser, serviceClient, signedInClient } from './harness';

const FUTURE = '2099-01-01';
const FUTURE_2 = '2099-02-01';
const PAST = '2020-01-01';

describe.skipIf(!hasDbEnv())('disruption update (0027)', () => {
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
      .insert({ spot_number: `UP-${Date.now()}-${spots.length}`, status: 'available' }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }
  function create(client: Awaited<ReturnType<typeof signedInClient>>, spotIds: string[], start: string, adminId: string) {
    return client.rpc('tx_create_disruption', {
      p_spot_ids: spotIds, p_title: 'Before', p_reason: 'before reason', p_start: start, p_end: start, p_actor: adminId,
    });
  }
  async function spotIdsOf(disruptionId: string): Promise<string[]> {
    const { data } = await serviceClient().from('parking_disruption_spots').select('spot_id').eq('disruption_id', disruptionId);
    return (data || []).map((r) => r.spot_id as string).sort();
  }
  async function titleOf(disruptionId: string): Promise<string | undefined> {
    const { data } = await serviceClient().from('parking_disruptions').select('title').eq('id', disruptionId).single();
    return data?.title as string | undefined;
  }

  it('edits a scheduled disruption: updates metadata and re-points its spots', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spotA = await makeSpot(); spots.push(spotA);
    const spotB = await makeSpot(); spots.push(spotB);

    const { data: created } = await create(client, [spotA], FUTURE, admin.id);
    const id = created?.disruption_id as string;
    disruptions.push(id);

    const { error } = await client.rpc('tx_update_disruption', {
      p_disruption_id: id, p_spot_ids: [spotB], p_title: 'After', p_reason: 'updated reason', p_start: FUTURE_2, p_end: FUTURE_2, p_actor: admin.id,
    });
    expect(error).toBeNull();
    expect(await titleOf(id)).toBe('After');
    expect(await spotIdsOf(id)).toEqual([spotB]); // spotA removed, spotB added
  });

  it('refuses to edit an active disruption', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);

    const { data: created } = await create(client, [spot], PAST, admin.id); // active
    const id = created?.disruption_id as string;
    disruptions.push(id);

    const { error } = await client.rpc('tx_update_disruption', {
      p_disruption_id: id, p_spot_ids: [spot], p_title: 'After', p_reason: 'updated reason', p_start: PAST, p_end: PAST, p_actor: admin.id,
    });
    expect(error?.message ?? '').toMatch(/only scheduled disruptions can be edited/i);
    expect(await titleOf(id)).toBe('Before');
  });

  it('rejects re-pointing onto a spot already in another scheduled disruption', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spotA = await makeSpot(); spots.push(spotA);
    const spotB = await makeSpot(); spots.push(spotB);

    const { data: d1 } = await create(client, [spotA], FUTURE, admin.id);
    disruptions.push(d1?.disruption_id as string);
    const { data: d2 } = await create(client, [spotB], FUTURE, admin.id);
    const id2 = d2?.disruption_id as string;
    disruptions.push(id2);

    const { error } = await client.rpc('tx_update_disruption', {
      p_disruption_id: id2, p_spot_ids: [spotA, spotB], p_title: 'After', p_reason: 'updated reason', p_start: FUTURE, p_end: FUTURE, p_actor: admin.id,
    });
    expect(error?.message ?? '').toMatch(/already in an active disruption/i);
    expect(await spotIdsOf(id2)).toEqual([spotB]); // unchanged
  });
});
