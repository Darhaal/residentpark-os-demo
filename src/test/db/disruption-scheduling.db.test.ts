// Title: Disruption Scheduling DB Test
// Path: src/test/db/disruption-scheduling.db.test.ts
// Functionality: Database coverage for the scheduled -> active disruption lifecycle (0023).

// a future-dated disruption is 'scheduled' and does not block its spots until
// activation; a past/today-dated one is created 'active' immediately;
// tx_activate_disruption flips a scheduled disruption to active and blocks its spots.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, deleteUser, serviceClient, signedInClient } from './harness';

const PAST = '2020-01-01';
const FUTURE = '2099-01-01';

describe.skipIf(!hasDbEnv())('disruption scheduling lifecycle (0023)', () => {
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
      .insert({ spot_number: `SC-${Date.now()}-${spots.length}`, status: 'available' }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }
  async function spotStatus(id: string): Promise<string | undefined> {
    const { data } = await serviceClient().from('parking_spots').select('status').eq('id', id).single();
    return data?.status as string | undefined;
  }
  async function disruptionStatus(id: string): Promise<string | undefined> {
    const { data } = await serviceClient().from('parking_disruptions').select('status').eq('id', id).single();
    return data?.status as string | undefined;
  }

  function create(client: Awaited<ReturnType<typeof signedInClient>>, spotId: string, start: string, adminId: string) {
    return client.rpc('tx_create_disruption', {
      p_spot_ids: [spotId], p_title: 'Sched QA', p_reason: 'testing', p_start: start, p_end: start, p_actor: adminId,
    });
  }

  it('a past-dated disruption is created active and blocks the spot', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);

    const { data, error } = await create(client, spot, PAST, admin.id);
    expect(error).toBeNull();
    disruptions.push(data?.disruption_id as string);
    expect(data?.status).toBe('active');
    expect(await spotStatus(spot)).toBe('blocked');
  });

  it('a future-dated disruption is scheduled and does not block the spot', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);

    const { data, error } = await create(client, spot, FUTURE, admin.id);
    expect(error).toBeNull();
    const id = data?.disruption_id as string;
    disruptions.push(id);
    expect(data?.status).toBe('scheduled');
    expect(await disruptionStatus(id)).toBe('scheduled');
    expect(await spotStatus(spot)).toBe('available'); // not blocked yet
  });

  it('activating a scheduled disruption blocks its spot', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);

    const { data: created } = await create(client, spot, FUTURE, admin.id);
    const id = created?.disruption_id as string;
    disruptions.push(id);

    const { error } = await client.rpc('tx_activate_disruption', { p_disruption_id: id });
    expect(error).toBeNull();
    expect(await disruptionStatus(id)).toBe('active');
    expect(await spotStatus(spot)).toBe('blocked');
  });

  it('refuses to complete a scheduled disruption before activation (0025)', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);

    const { data: created } = await create(client, spot, FUTURE, admin.id);
    const id = created?.disruption_id as string;
    disruptions.push(id);

    const { error } = await client.rpc('tx_complete_disruption', { p_disruption_id: id, p_actor: admin.id });
    expect(error?.message ?? '').toMatch(/only an active disruption can be completed/i);
    expect(await disruptionStatus(id)).toBe('scheduled');
    expect(await spotStatus(spot)).toBe('available');
  });

  it('cancels a scheduled disruption without blocking its spot (0024)', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);
    const { data: created } = await create(client, spot, FUTURE, admin.id);
    const id = created?.disruption_id as string;
    disruptions.push(id);

    const { error } = await client.rpc('tx_cancel_disruption', { p_disruption_id: id, p_actor: admin.id });
    expect(error).toBeNull();
    expect(await disruptionStatus(id)).toBe('cancelled');
    expect(await spotStatus(spot)).toBe('available');
  });

  it('refuses to cancel an active disruption (complete it instead) (0024)', async () => {
    const admin = await createAdmin(); users.push(admin.id);
    const client = await signedInClient(admin.email, admin.password);
    const spot = await makeSpot(); spots.push(spot);
    const { data: created } = await create(client, spot, PAST, admin.id);
    const id = created?.disruption_id as string;
    disruptions.push(id);

    const { error } = await client.rpc('tx_cancel_disruption', { p_disruption_id: id, p_actor: admin.id });
    expect(error?.message ?? '').toMatch(/only a scheduled disruption can be cancelled/i);
  });
});
