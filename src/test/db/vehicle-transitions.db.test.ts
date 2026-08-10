// Title: Vehicle Transitions DB Test
// Path: src/test/db/vehicle-transitions.db.test.ts
// Functionality: Database authorization and RLS coverage for vehicle owner consistency and status transitions.

// vehicle RPCs enforce owner/apartment consistency, normalize plates,
// release parking assignment on rejection/archive, and keep archived terminal.

import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import {
  createAdmin,
  createApartment,
  createResident,
  deleteApartment,
  deleteUser,
  serviceClient,
  signedInClient,
} from './harness';

describe.skipIf(!hasDbEnv())('vehicle transitions', () => {
  const users: string[] = [];
  const apts: string[] = [];
  const spots: string[] = [];
  const vehicles: string[] = [];

  afterEach(async () => {
    const svc = serviceClient();
    while (spots.length) {
      const id = spots.pop();
      if (id) await svc.from('parking_spots').delete().eq('id', id);
    }
    while (vehicles.length) {
      const id = vehicles.pop();
      if (id) await svc.from('vehicles').delete().eq('id', id);
    }
    while (users.length) {
      const id = users.pop();
      if (id) await deleteUser(id);
    }
    while (apts.length) {
      const id = apts.pop();
      if (id) await deleteApartment(id);
    }
  });

  async function adminClient() {
    const admin = await createAdmin();
    users.push(admin.id);
    return {
      admin,
      client: await signedInClient(admin.email, admin.password),
    };
  }

  async function vehicleStatus(vehicleId: string) {
    const { data, error } = await serviceClient()
      .from('vehicles')
      .select('approval_status, plate_number')
      .eq('id', vehicleId)
      .single();
    if (error || !data) throw new Error(`vehicle read failed: ${error?.message ?? 'no row'}`);
    return data as { approval_status: string; plate_number: string };
  }

  async function spotState(spotId: string) {
    const { data, error } = await serviceClient()
      .from('parking_spots')
      .select('status, assigned_vehicle_id, assigned_apartment_id')
      .eq('id', spotId)
      .single();
    if (error || !data) throw new Error(`spot read failed: ${error?.message ?? 'no row'}`);
    return data as { status: string; assigned_vehicle_id: string | null; assigned_apartment_id: string | null };
  }

  it('admin add rejects an owner from another apartment and normalizes a valid plate', async () => {
    const aptA = await createApartment();
    const aptB = await createApartment();
    apts.push(aptA.id, aptB.id);
    const residentA = await createResident({ approve: true, apartmentId: aptA.id });
    const residentB = await createResident({ approve: true, apartmentId: aptB.id });
    users.push(residentA.id, residentB.id);
    const { admin, client } = await adminClient();

    const { error: wrongOwnerError } = await client.rpc('tx_add_vehicle_by_admin', {
      p_apartment_id: aptA.id,
      p_owner_id: residentB.id,
      p_plate_number: 'bad-owner-1',
      p_make: 'Toyota',
      p_model: 'Camry',
      p_color: 'Black',
      p_year: 2023,
      p_actor_id: admin.id,
      p_payload: {},
    });
    expect(wrongOwnerError?.message ?? '').toMatch(/owner.*target apartment|RULE/i);

    const { data: vehicleId, error: addError } = await client.rpc('tx_add_vehicle_by_admin', {
      p_apartment_id: aptA.id,
      p_owner_id: residentA.id,
      p_plate_number: '  mix-123  ',
      p_make: 'Toyota',
      p_model: 'Camry',
      p_color: 'Black',
      p_year: 2023,
      p_actor_id: admin.id,
      p_payload: {},
    });
    expect(addError).toBeNull();
    expect(vehicleId).toBeTruthy();
    vehicles.push(vehicleId as string);
    await expect(vehicleStatus(vehicleId as string)).resolves.toMatchObject({
      approval_status: 'approved',
      plate_number: 'MIX-123',
    });
  });

  it('rejecting or archiving an assigned vehicle releases the parking spot and archived is terminal', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const { admin, client } = await adminClient();

    const { data: vehicle, error: vehicleError } = await serviceClient()
      .from('vehicles')
      .insert({
        apartment_id: apt.id,
        owner_id: resident.id,
        plate_number: `TRN-${Date.now()}`,
        approval_status: 'approved',
      })
      .select('id')
      .single();
    expect(vehicleError).toBeNull();
    const vehicleId = vehicle?.id as string;
    vehicles.push(vehicleId);

    const { data: spot, error: spotError } = await serviceClient()
      .from('parking_spots')
      .insert({
        spot_number: `TRN-${Date.now()}`,
        status: 'assigned',
        assigned_apartment_id: apt.id,
        assigned_vehicle_id: vehicleId,
      })
      .select('id')
      .single();
    expect(spotError).toBeNull();
    const spotId = spot?.id as string;
    spots.push(spotId);

    const { error: assignmentError } = await serviceClient()
      .from('parking_assignments')
      .insert({
        spot_id: spotId,
        apartment_id: apt.id,
        vehicle_id: vehicleId,
        assignment_type: 'permanent',
        status: 'active',
        created_by: admin.id,
      });
    expect(assignmentError).toBeNull();

    const { error: rejectError } = await client.rpc('tx_review_vehicle', {
      p_vehicle_id: vehicleId,
      p_decision: 'rejected',
      p_reason: 'Wrong documents',
      p_actor_id: admin.id,
      p_payload: {},
    });
    expect(rejectError).toBeNull();
    await expect(vehicleStatus(vehicleId)).resolves.toMatchObject({ approval_status: 'rejected' });
    await expect(spotState(spotId)).resolves.toMatchObject({
      status: 'available',
      assigned_vehicle_id: null,
      assigned_apartment_id: null,
    });

    const { error: archiveError } = await client.rpc('tx_archive_vehicle', {
      p_vehicle_id: vehicleId,
      p_actor_id: admin.id,
      p_reason: 'No longer active',
    });
    expect(archiveError).toBeNull();
    await expect(vehicleStatus(vehicleId)).resolves.toMatchObject({ approval_status: 'archived' });

    const { error: reviewArchivedError } = await client.rpc('tx_review_vehicle', {
      p_vehicle_id: vehicleId,
      p_decision: 'approved',
      p_reason: 'Reopen',
      p_actor_id: admin.id,
      p_payload: {},
    });
    expect(reviewArchivedError?.message ?? '').toMatch(/archived.*cannot be reviewed|RULE/i);
    await expect(vehicleStatus(vehicleId)).resolves.toMatchObject({ approval_status: 'archived' });
  });
});
