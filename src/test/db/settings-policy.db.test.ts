// Title: Settings Policy DB Test
// Path: src/test/db/settings-policy.db.test.ts
// Functionality: Database authorization and RLS coverage for fixed operational policy settings.

// PD-010 is enforced in SQL: legacy settings writes cannot disable vehicle
// approval or restore the retired max-spots policy, and resident vehicle submissions
// always land in pending_approval.

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

describe.skipIf(!hasDbEnv())('fixed settings policy', () => {
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

  async function settings() {
    const { data, error } = await serviceClient()
      .from('building_settings')
      .select('max_spots_per_unit, require_vehicle_approval, resident_portal_notice')
      .limit(1)
      .single();
    if (error || !data) throw new Error(`settings read failed: ${error?.message ?? 'no row'}`);
    return data as {
      max_spots_per_unit: number;
      require_vehicle_approval: boolean;
      resident_portal_notice: string;
    };
  }

  async function vehicleStatus(vehicleId: string): Promise<string | undefined> {
    const { data } = await serviceClient().from('vehicles').select('approval_status').eq('id', vehicleId).single();
    return data?.approval_status as string | undefined;
  }

  it('ignores retired settings fields and keeps resident vehicle approval mandatory', async () => {
    const admin = await createAdmin();
    users.push(admin.id);
    const adminClient = await signedInClient(admin.email, admin.password);

    const { error: legacySettingsError } = await adminClient.rpc('tx_update_settings', {
      p_settings: {
        max_spots_per_unit: 99,
        require_vehicle_approval: false,
        resident_portal_notice: 'Garage maintenance tonight.',
      },
      p_actor: admin.id,
    });
    expect(legacySettingsError).toBeNull();

    await expect(settings()).resolves.toMatchObject({
      max_spots_per_unit: 2,
      require_vehicle_approval: true,
      resident_portal_notice: 'Garage maintenance tonight.',
    });

    const { error: portalNoticeError } = await adminClient.rpc('tx_update_portal_notice', {
      p_notice: 'Garage maintenance cleared.',
      p_actor: admin.id,
    });
    expect(portalNoticeError).toBeNull();
    await expect(settings()).resolves.toMatchObject({
      max_spots_per_unit: 2,
      require_vehicle_approval: true,
      resident_portal_notice: 'Garage maintenance cleared.',
    });

    const apt = await createApartment();
    apts.push(apt.id);
    const resident = await createResident({ approve: true, apartmentId: apt.id });
    users.push(resident.id);
    const residentClient = await signedInClient(resident.email, resident.password);

    const { data: vehicleId, error: submitError } = await residentClient.rpc('tx_submit_vehicle_request', {
      p_apartment_id: apt.id,
      p_owner_id: resident.id,
      p_plate_number: `FIX-${Date.now()}`,
      p_make: 'Honda',
      p_model: 'Civic',
      p_color: 'Blue',
      p_year: 2022,
      p_actor_id: resident.id,
      p_payload: {},
    });

    expect(submitError).toBeNull();
    expect(vehicleId).toBeTruthy();
    expect(await vehicleStatus(vehicleId)).toBe('pending_approval');
  });
});
