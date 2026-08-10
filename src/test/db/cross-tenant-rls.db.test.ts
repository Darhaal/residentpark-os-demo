// Title: Cross Tenant RLS DB Test
// Path: src/test/db/cross-tenant-rls.db.test.ts
// Functionality: Database authorization and RLS coverage for cross-tenant isolation.

// a resident sees only their own profile and only their own apartment's vehicles;
// they must not be able to read another apartment's rows (profiles_own_read /
// vehicles_resident RLS policies).

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('cross-tenant isolation', () => {
  const users: string[] = [];
  const apts: string[] = [];

  afterEach(async () => {
    while (users.length) {
      const id = users.pop();
      if (id) await deleteUser(id);
    }
    while (apts.length) {
      const id = apts.pop();
      if (id) await deleteApartment(id);
    }
  });

  async function addVehicle(apartmentId: string, ownerId: string): Promise<string> {
    const { data, error } = await serviceClient()
      .from('vehicles')
      .insert({ apartment_id: apartmentId, owner_id: ownerId, plate_number: `XT-${Date.now()}-${users.length}`, approval_status: 'approved' })
      .select('id')
      .single();
    if (error || !data) throw new Error(`vehicle insert failed: ${error?.message ?? 'no row'}`);
    return data.id as string;
  }

  it('a resident cannot read another apartment\'s profile or vehicle', async () => {
    const aptA = await createApartment();
    apts.push(aptA.id);
    const aptB = await createApartment();
    apts.push(aptB.id);
    const alice = await createResident({ approve: true, apartmentId: aptA.id });
    users.push(alice.id);
    const bob = await createResident({ approve: true, apartmentId: aptB.id });
    users.push(bob.id);

    const aliceVehicle = await addVehicle(aptA.id, alice.id);
    const bobVehicle = await addVehicle(aptB.id, bob.id);

    const aliceClient = await signedInClient(alice.email, alice.password);

    const { data: profiles } = await aliceClient.from('profiles').select('id');
    const profileIds = (profiles ?? []).map((p) => p.id);
    expect(profileIds).toContain(alice.id);
    expect(profileIds).not.toContain(bob.id);

    const { data: vehicles } = await aliceClient.from('vehicles').select('id');
    const vehicleIds = (vehicles ?? []).map((v) => v.id);
    expect(vehicleIds).toContain(aliceVehicle);
    expect(vehicleIds).not.toContain(bobVehicle);
  });
});
