// Title: Non-Approved Resident Write Denial DB Test
// Path: src/test/db/resident-status-write-denial.db.test.ts
// Functionality: A resident who is not approved cannot perform operational writes (0015).

// account-status-rls covers that a deactivated resident loses operational READS;
// this covers the WRITE side: a suspended, rejected, or still-pending resident cannot
// submit a vehicle through tx_submit_vehicle_request.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';

async function setStatus(userId: string, status: string): Promise<void> {
  const { error } = await serviceClient().from('profiles').update({ approval_status: status }).eq('id', userId);
  if (error) throw new Error(`setStatus failed: ${error.message}`);
}

describe.skipIf(!hasDbEnv())('non-approved resident write denial', () => {
  const users: string[] = [];
  const apts: string[] = [];

  afterEach(async () => {
    while (users.length) { const id = users.pop(); if (id) await deleteUser(id); }
    while (apts.length) { const id = apts.pop(); if (id) await deleteApartment(id); }
  });

  it('a suspended, rejected, or pending resident cannot submit a vehicle', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const client = await signedInClient(resident.email, resident.password);

    for (const status of ['suspended', 'rejected', 'pending_approval']) {
      await setStatus(resident.id, status);
      const { error } = await client.rpc('tx_submit_vehicle_request', {
        p_apartment_id: apt.id,
        p_owner_id: resident.id,
        p_plate_number: `NS-${Date.now()}`,
        p_make: 'Test', p_model: 'Model', p_color: 'Black', p_year: 2020,
        p_actor_id: resident.id,
        p_payload: {},
      });
      expect(error).not.toBeNull();
    }
  });
});
