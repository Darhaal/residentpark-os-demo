// Title: Direct Core-Table Write Denial DB Test
// Path: src/test/db/direct-write-denial.db.test.ts
// Functionality: Verifies core tables are RPC-only for writes (0008).

// an authenticated resident cannot bypass the tx_* RPCs by writing core tables
// directly through PostgREST. Every core mutation must go through a SECURITY DEFINER RPC.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';
import type { SupabaseClient } from '@supabase/supabase-js';

describe.skipIf(!hasDbEnv())('direct core-table write denial (0008)', () => {
  const users: string[] = [];
  const apts: string[] = [];
  const spots: string[] = [];

  afterEach(async () => {
    const svc = serviceClient();
    while (spots.length) { const id = spots.pop(); if (id) await svc.from('parking_spots').delete().eq('id', id); }
    while (users.length) { const id = users.pop(); if (id) await deleteUser(id); }
    while (apts.length) { const id = apts.pop(); if (id) await deleteApartment(id); }
  });

  async function makeSpot(): Promise<string> {
    const { data, error } = await serviceClient().from('parking_spots')
      .insert({ spot_number: `DW-${Date.now()}-${spots.length}`, status: 'available' }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }

  async function setup(): Promise<{ aptId: string; spotId: string; client: SupabaseClient }> {
    const apt = await createApartment(); apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id }); users.push(resident.id);
    const spotId = await makeSpot(); spots.push(spotId);
    const client = await signedInClient(resident.email, resident.password);
    return { aptId: apt.id, spotId, client };
  }

  it('a resident cannot directly INSERT a parking assignment', async () => {
    const { aptId, spotId, client } = await setup();
    const { error } = await client.from('parking_assignments')
      .insert({ spot_id: spotId, apartment_id: aptId, assignment_type: 'permanent', status: 'active' });
    expect(error).not.toBeNull();
  });

  it('a resident cannot directly UPDATE a parking spot status', async () => {
    const { spotId, client } = await setup();
    const { data, error } = await client.from('parking_spots')
      .update({ status: 'available' }).eq('id', spotId).select('id');
    // Either the write is rejected, or RLS makes it affect zero rows.
    expect(error !== null || (data?.length ?? 0) === 0).toBe(true);
  });

  it('a resident cannot directly INSERT a vehicle (must use the RPC)', async () => {
    const { aptId, client } = await setup();
    const { error } = await client.from('vehicles')
      .insert({ apartment_id: aptId, plate_number: `DW-${Date.now()}`, approval_status: 'approved' });
    expect(error).not.toBeNull();
  });

  it('a resident cannot directly INSERT an apartment', async () => {
    const { client } = await setup();
    const { error } = await client.from('apartments').insert({ apartment_number: `DW-${Date.now()}` });
    expect(error).not.toBeNull();
  });
});
