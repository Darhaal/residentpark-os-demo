// Title: Apartment Active Incidents DB Test
// Path: src/test/db/apartment-open-incidents.db.test.ts
// Functionality: Verifies apartment incident reads follow current parking issue status.

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

describe.skipIf(!hasDbEnv())('apartment active incidents', () => {
  const users: string[] = [];
  const apartments: string[] = [];
  const spots: string[] = [];
  const vehicles: string[] = [];

  afterEach(async () => {
    const service = serviceClient();
    if (spots.length > 0) await service.from('parking_issues').delete().in('spot_id', spots);
    while (spots.length) {
      const id = spots.pop();
      if (id) await service.from('parking_spots').delete().eq('id', id);
    }
    while (vehicles.length) {
      const id = vehicles.pop();
      if (id) await service.from('vehicles').delete().eq('id', id);
    }
    if (users.length > 0) await service.from('events').delete().in('actor_id', users);
    while (users.length) {
      const id = users.pop();
      if (id) await deleteUser(id);
    }
    while (apartments.length) {
      const id = apartments.pop();
      if (id) await deleteApartment(id);
    }
  });

  async function makeAssignedSpot(apartmentId: string, ownerId: string): Promise<string> {
    const service = serviceClient();
    const { data: vehicle, error: vehicleError } = await service.from('vehicles').insert({
      apartment_id: apartmentId,
      owner_id: ownerId,
      plate_number: `APT-INC-${Date.now()}-${vehicles.length}`,
      approval_status: 'approved',
    }).select('id').single();
    if (vehicleError || !vehicle) {
      throw new Error(`vehicle insert failed: ${vehicleError?.message ?? 'no row'}`);
    }
    vehicles.push(vehicle.id as string);

    const { data, error } = await service.from('parking_spots').insert({
      spot_number: `APT-INC-${Date.now()}-${spots.length}`,
      assigned_apartment_id: apartmentId,
      assigned_vehicle_id: vehicle.id,
      status: 'assigned',
    }).select('id').single();
    if (error || !data) throw new Error(`spot insert failed: ${error?.message ?? 'no row'}`);
    const id = data.id as string;
    spots.push(id);
    return id;
  }

  it('returns only open or in-progress parking issues and becomes empty when all resolve', async () => {
    const apartment = await createApartment();
    apartments.push(apartment.id);
    const resident = await createResident({ approve: true, apartmentId: apartment.id });
    users.push(resident.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const spotId = await makeAssignedSpot(apartment.id, resident.id);
    const residentClient = await signedInClient(resident.email, resident.password);
    const adminClient = await signedInClient(admin.email, admin.password);

    const firstReport = await residentClient.rpc('tx_report_parking_issue', {
      p_spot_id: spotId,
      p_issue_type: 'unauthorized_vehicle',
      p_violating_plate: 'OLD-ISSUE',
      p_comment: 'Resolved issue must leave Active Incidents',
      p_actor_id: resident.id,
    });
    expect(firstReport.error).toBeNull();

    const secondReport = await residentClient.rpc('tx_report_parking_issue', {
      p_spot_id: spotId,
      p_issue_type: 'blocked_access',
      p_violating_plate: null,
      p_comment: 'Open issue stays visible',
      p_actor_id: resident.id,
    });
    expect(secondReport.error).toBeNull();

    const firstUpdate = await adminClient.rpc('tx_update_parking_issue', {
      p_issue_id: firstReport.data,
      p_status: 'resolved',
      p_note: 'Resolved for active-incident test',
      p_actor: admin.id,
    });
    expect(firstUpdate.error).toBeNull();

    const activeRead = await adminClient.rpc('get_apartment_open_incidents', {
      p_apartment_id: apartment.id,
    });
    expect(activeRead.error).toBeNull();
    expect(activeRead.data).toEqual([
      expect.objectContaining({
        id: secondReport.data,
        content: 'Open issue stays visible',
        workflow_status: 'open',
        action_type: 'PARKING_ISSUE_REPORTED',
      }),
    ]);

    const secondUpdate = await adminClient.rpc('tx_update_parking_issue', {
      p_issue_id: secondReport.data,
      p_status: 'closed',
      p_note: 'Closed for active-incident test',
      p_actor: admin.id,
    });
    expect(secondUpdate.error).toBeNull();

    const emptyRead = await adminClient.rpc('get_apartment_open_incidents', {
      p_apartment_id: apartment.id,
    });
    expect(emptyRead.error).toBeNull();
    expect(emptyRead.data).toEqual([]);
  });
});
