// Title: Parking Layout Authorization DB Test
// Path: src/test/db/parking-layout.db.test.ts
// Functionality: Verifies atomic admin saves, approved reads, privacy-safe coordinates, and write denial.

import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { hasDbEnv } from './env';
import {
  anonClient,
  createAdmin,
  createApartment,
  createResident,
  deleteApartment,
  deleteUser,
  serviceClient,
  signedInClient,
} from './harness';

describe.skipIf(!hasDbEnv())('parking layout phase 1', () => {
  const users: string[] = [];
  const apartments: string[] = [];
  const spots: string[] = [];
  const floors: string[] = [];

  afterEach(async () => {
    const service = serviceClient();
    for (const floor of floors.splice(0)) {
      await service.from('parking_layout_shapes').delete().eq('floor', floor);
    }
    while (spots.length) {
      const id = spots.pop();
      if (id) await service.from('parking_spots').delete().eq('id', id);
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

  async function makeSpot(floor: string): Promise<string> {
    const { data, error } = await serviceClient().from('parking_spots').insert({
      spot_number: `LAYOUT-${Date.now()}-${spots.length}`,
      floor,
      zone: 'residential',
      status: 'available',
    }).select('id').single();
    if (error || !data) throw new Error(`spot insert: ${error?.message ?? 'no row'}`);
    const id = data.id as string;
    spots.push(id);
    return id;
  }

  async function setup() {
    const floor = `layout-${Date.now()}`;
    floors.push(floor);
    const firstSpot = await makeSpot(floor);
    const secondSpot = await makeSpot(floor);
    const apartment = await createApartment();
    apartments.push(apartment.id);
    const resident = await createResident({ approve: true, apartmentId: apartment.id });
    users.push(resident.id);
    const pendingResident = await createResident({ apartmentId: apartment.id });
    users.push(pendingResident.id);
    const admin = await createAdmin();
    users.push(admin.id);
    return { floor, firstSpot, secondSpot, resident, pendingResident, admin };
  }

  it('allows atomic admin RPC writes and approved privacy-safe reads only', async () => {
    const { floor, firstSpot, secondSpot, resident, pendingResident, admin } = await setup();
    const adminClient = await signedInClient(admin.email, admin.password);
    const shapeId = randomUUID();

    const { data: saveResult, error: saveError } = await adminClient.rpc('tx_save_parking_layout', {
      p_floor: floor,
      p_spots: [
        { id: firstSpot, pos_x: 40, pos_y: 60, rotation: 0 },
        { id: secondSpot, pos_x: 180, pos_y: 60, rotation: 90 },
      ],
      p_shapes: [
        { id: shapeId, kind: 'lane', x: 20, y: 200, w: 420, h: 80, rotation: 0, label: 'Exit lane' },
      ],
      p_actor_id: admin.id,
    });
    expect(saveError).toBeNull();
    expect(saveResult).toEqual({ floor, spots: 2, shapes: 1 });

    const { error: directWriteError } = await adminClient.from('parking_layout_shapes').insert({
      floor,
      kind: 'label',
      x: 0,
      y: 0,
      w: 100,
      h: 40,
      label: 'Direct write must fail',
    });
    expect(directWriteError).not.toBeNull();

    const residentClient = await signedInClient(resident.email, resident.password);
    const { data: residentShapes, error: residentReadError } = await residentClient
      .from('parking_layout_shapes')
      .select('id, floor, kind, label')
      .eq('floor', floor);
    expect(residentReadError).toBeNull();
    expect(residentShapes).toEqual([{ id: shapeId, floor, kind: 'lane', label: 'Exit lane' }]);

    const { data: residentMap, error: residentMapError } = await residentClient.rpc('get_resident_parking_map');
    expect(residentMapError).toBeNull();
    expect(residentMap).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstSpot, pos_x: 40, pos_y: 60, rotation: 0, plate_number: null }),
      expect.objectContaining({ id: secondSpot, pos_x: 180, pos_y: 60, rotation: 90, plate_number: null }),
    ]));

    const { error: residentWriteError } = await residentClient.rpc('tx_save_parking_layout', {
      p_floor: floor,
      p_spots: [],
      p_shapes: [],
      p_actor_id: resident.id,
    });
    expect(residentWriteError).not.toBeNull();

    const pendingClient = await signedInClient(pendingResident.email, pendingResident.password);
    const { data: pendingShapes } = await pendingClient.from('parking_layout_shapes').select('id').eq('floor', floor);
    expect(pendingShapes).toEqual([]);

    const { data: anonShapes, error: anonError } = await anonClient().from('parking_layout_shapes').select('id');
    expect(anonError !== null || (anonShapes?.length ?? 0) === 0).toBe(true);
  });

  it('rejects incomplete floor layouts without changing existing coordinates or shapes', async () => {
    const { floor, firstSpot, secondSpot, admin } = await setup();
    const adminClient = await signedInClient(admin.email, admin.password);

    const firstSave = await adminClient.rpc('tx_save_parking_layout', {
      p_floor: floor,
      p_spots: [
        { id: firstSpot, pos_x: 40, pos_y: 60, rotation: 0 },
        { id: secondSpot, pos_x: 180, pos_y: 60, rotation: 0 },
      ],
      p_shapes: [
        { kind: 'wall', x: 10, y: 10, w: 400, h: 8, rotation: 0, label: null },
      ],
      p_actor_id: admin.id,
    });
    expect(firstSave.error).toBeNull();

    const failedSave = await adminClient.rpc('tx_save_parking_layout', {
      p_floor: floor,
      p_spots: [{ id: firstSpot, pos_x: 500, pos_y: 500, rotation: 0 }],
      p_shapes: [],
      p_actor_id: admin.id,
    });
    expect(failedSave.error?.message ?? '').toMatch(/position every floor spot exactly once/i);

    const service = serviceClient();
    const { data: positionRows } = await service.from('parking_spots')
      .select('id, pos_x, pos_y')
      .in('id', [firstSpot, secondSpot]);
    expect(positionRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: firstSpot, pos_x: 40, pos_y: 60 }),
      expect.objectContaining({ id: secondSpot, pos_x: 180, pos_y: 60 }),
    ]));

    const { data: shapeRows } = await service.from('parking_layout_shapes')
      .select('kind')
      .eq('floor', floor);
    expect(shapeRows).toEqual([{ kind: 'wall' }]);
  });
});
