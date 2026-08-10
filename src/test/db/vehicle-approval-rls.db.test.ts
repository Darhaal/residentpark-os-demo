// Title: Vehicle Approval RLS DB Test
// Path: src/test/db/vehicle-approval-rls.db.test.ts
// Functionality: Database authorization and RLS coverage for vehicle approval workflows.

// vehicle approval is admin-only. A resident may submit a vehicle (it lands
// pending) but cannot approve it via tx_review_vehicle; an admin can.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import { createAdmin, createApartment, createResident, deleteApartment, deleteUser, serviceClient, signedInClient } from './harness';

describe.skipIf(!hasDbEnv())('vehicle approval', () => {
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

  async function statusOf(vehicleId: string): Promise<string | undefined> {
    const { data } = await serviceClient().from('vehicles').select('approval_status').eq('id', vehicleId).single();
    return data?.approval_status as string | undefined;
  }

  it('resident submits a pending vehicle, cannot approve it; an admin can', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const admin = await createAdmin();
    users.push(admin.id);

    const residentClient = await signedInClient(resident.email, resident.password);
    const { data: vehicleId, error: submitError } = await residentClient.rpc('tx_submit_vehicle_request', {
      p_apartment_id: apt.id,
      p_owner_id: resident.id,
      p_plate_number: `RV-${Date.now()}`,
      p_make: 'Toyota',
      p_model: 'Corolla',
      p_color: 'Silver',
      p_year: 2021,
      p_actor_id: resident.id,
      p_payload: {},
    });
    expect(submitError).toBeNull();
    expect(vehicleId).toBeTruthy();
    expect(await statusOf(vehicleId)).toBe('pending_approval');

    // Resident cannot approve their own vehicle.
    const { error: residentReview } = await residentClient.rpc('tx_review_vehicle', {
      p_vehicle_id: vehicleId, p_decision: 'approved', p_reason: 'self', p_actor_id: resident.id, p_payload: {},
    });
    expect(residentReview?.message ?? '').toMatch(/FORBIDDEN|administrator/i);
    expect(await statusOf(vehicleId)).toBe('pending_approval');

    // An admin can approve.
    const adminClient = await signedInClient(admin.email, admin.password);
    const { error: adminReview } = await adminClient.rpc('tx_review_vehicle', {
      p_vehicle_id: vehicleId, p_decision: 'approved', p_reason: 'ok', p_actor_id: admin.id, p_payload: {},
    });
    expect(adminReview).toBeNull();
    expect(await statusOf(vehicleId)).toBe('approved');
  });
});
