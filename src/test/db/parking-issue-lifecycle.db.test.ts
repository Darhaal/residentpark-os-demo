// Title: Parking Issue Lifecycle DB Test
// Path: src/test/db/parking-issue-lifecycle.db.test.ts
// Functionality: Database authorization and RLS coverage for parking issue conflict lifecycle.

// multiple active issues keep a spot in conflict; the spot restores only
// after the final active issue is resolved/closed, and reopening restores conflict.

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

describe.skipIf(!hasDbEnv())('parking issue lifecycle', () => {
  const users: string[] = [];
  const apts: string[] = [];
  const spots: string[] = [];
  const vehicles: string[] = [];

  afterEach(async () => {
    const svc = serviceClient();
    if (spots.length) await svc.from('parking_issues').delete().in('spot_id', spots);
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

  async function makeAssignedSpot(apartmentId: string, ownerId: string): Promise<string> {
    const svc = serviceClient();
    const { data: vehicle, error: vehicleError } = await svc
      .from('vehicles')
      .insert({
        apartment_id: apartmentId,
        owner_id: ownerId,
        plate_number: `ISS-${Date.now()}-${vehicles.length}`,
        approval_status: 'approved',
      })
      .select('id')
      .single();
    if (vehicleError || !vehicle) throw new Error(`vehicle insert failed: ${vehicleError?.message ?? 'no row'}`);
    vehicles.push(vehicle.id as string);

    const { data: spot, error: spotError } = await svc
      .from('parking_spots')
      .insert({
        spot_number: `ISS-${Date.now()}-${spots.length}`,
        status: 'assigned',
        assigned_apartment_id: apartmentId,
        assigned_vehicle_id: vehicle.id,
      })
      .select('id')
      .single();
    if (spotError || !spot) throw new Error(`spot insert failed: ${spotError?.message ?? 'no row'}`);
    spots.push(spot.id as string);
    return spot.id as string;
  }

  async function spotStatus(spotId: string): Promise<string | undefined> {
    const { data } = await serviceClient().from('parking_spots').select('status').eq('id', spotId).single();
    return data?.status as string | undefined;
  }

  async function issueCountForSpot(spotId: string): Promise<number> {
    const { count, error } = await serviceClient()
      .from('parking_issues')
      .select('id', { count: 'exact', head: true })
      .eq('spot_id', spotId);
    if (error) throw new Error(`issue count failed: ${error.message}`);
    return count || 0;
  }

  async function setResidentStatus(residentId: string, status: 'pending_approval' | 'rejected' | 'suspended') {
    const { error } = await serviceClient()
      .from('profiles')
      .update({ approval_status: status })
      .eq('id', residentId);
    expect(error).toBeNull();
  }

  async function tryReportIssue(residentEmail: string, residentPassword: string, residentId: string, spotId: string, issueType = 'unauthorized_vehicle') {
    const client = await signedInClient(residentEmail, residentPassword);
    return client.rpc('tx_report_parking_issue', {
      p_spot_id: spotId,
      p_issue_type: issueType,
      p_violating_plate: 'BAD-PLATE',
      p_comment: 'Blocking access',
      p_actor_id: residentId,
    });
  }

  async function reportIssue(residentEmail: string, residentPassword: string, residentId: string, spotId: string, issueType = 'unauthorized_vehicle') {
    const { data, error } = await tryReportIssue(residentEmail, residentPassword, residentId, spotId, issueType);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    return data as string;
  }

  async function updateIssue(adminEmail: string, adminPassword: string, adminId: string, issueId: string, status: string, note = 'Reviewed and resolved') {
    const client = await signedInClient(adminEmail, adminPassword);
    const { error } = await client.rpc('tx_update_parking_issue', {
      p_issue_id: issueId,
      p_status: status,
      p_note: note,
      p_actor: adminId,
    });
    expect(error).toBeNull();
  }

  it('keeps conflict while any active issue remains and restores after the final active issue closes', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const spotId = await makeAssignedSpot(apt.id, resident.id);

    const firstIssueId = await reportIssue(resident.email, resident.password, resident.id, spotId, 'unauthorized_vehicle');
    const secondIssueId = await reportIssue(resident.email, resident.password, resident.id, spotId, 'blocked_access');
    expect(await spotStatus(spotId)).toBe('conflict');

    await updateIssue(admin.email, admin.password, admin.id, firstIssueId, 'resolved');
    expect(await spotStatus(spotId)).toBe('conflict');

    await updateIssue(admin.email, admin.password, admin.id, secondIssueId, 'closed');
    expect(await spotStatus(spotId)).toBe('assigned');

    await updateIssue(admin.email, admin.password, admin.id, firstIssueId, 'in_progress', '');
    expect(await spotStatus(spotId)).toBe('conflict');

    await updateIssue(admin.email, admin.password, admin.id, firstIssueId, 'closed');
    expect(await spotStatus(spotId)).toBe('assigned');
  });

  it('rejects duplicate active issues for the same spot and issue type, then allows a new report after resolution', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const firstResident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(firstResident.id);
    const secondResident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(secondResident.id);
    const admin = await createAdmin();
    users.push(admin.id);
    const spotId = await makeAssignedSpot(apt.id, firstResident.id);

    const issueType = 'blocked_access';
    const firstIssueId = await reportIssue(
      firstResident.email,
      firstResident.password,
      firstResident.id,
      spotId,
      issueType,
    );

    const duplicate = await tryReportIssue(
      secondResident.email,
      secondResident.password,
      secondResident.id,
      spotId,
      issueType,
    );

    expect(duplicate.data).toBeNull();
    expect(duplicate.error?.code).toBe('23505');
    expect(duplicate.error?.message ?? '').toMatch(/active parking issue already exists/i);
    expect(await issueCountForSpot(spotId)).toBe(1);
    expect(await spotStatus(spotId)).toBe('conflict');

    await updateIssue(admin.email, admin.password, admin.id, firstIssueId, 'resolved');
    expect(await spotStatus(spotId)).toBe('assigned');

    await expect(reportIssue(
      secondResident.email,
      secondResident.password,
      secondResident.id,
      spotId,
      issueType,
    )).resolves.toBeTruthy();
    expect(await issueCountForSpot(spotId)).toBe(2);
    expect(await spotStatus(spotId)).toBe('conflict');
  });

  it('refuses direct issue reports from non-approved residents even when the apartment link remains', async () => {
    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const spotId = await makeAssignedSpot(apt.id, resident.id);
    const client = await signedInClient(resident.email, resident.password);

    for (const status of ['pending_approval', 'rejected', 'suspended'] as const) {
      await setResidentStatus(resident.id, status);

      const { error } = await client.rpc('tx_report_parking_issue', {
        p_spot_id: spotId,
        p_issue_type: 'blocked_access',
        p_violating_plate: null,
        p_comment: `Should be rejected while ${status}`,
        p_actor_id: resident.id,
      });

      expect(error?.message ?? '').toMatch(/FORBIDDEN|approved account/i);
      expect(await issueCountForSpot(spotId)).toBe(0);
      expect(await spotStatus(spotId)).toBe('assigned');
    }
  });
});
