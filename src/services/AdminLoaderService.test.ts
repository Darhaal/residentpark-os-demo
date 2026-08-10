// Title: Admin Loader Service Test
// Path: src/services/AdminLoaderService.test.ts
// Functionality: Unit coverage for typed admin read-RPC adapters and result validation.

import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTHORIZED_VEHICLE_APPROVAL_STATUSES, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { AdminLoaderService } from './AdminLoaderService';

const apartmentId = '11111111-1111-4111-8111-111111111111';

function supabaseWithRpc(rpc = vi.fn()) {
  return { rpc } as unknown as SupabaseClient;
}

function supabaseWithParkingReads(
  rpc: ReturnType<typeof vi.fn>,
  positions: unknown[] = [],
  shapes: unknown[] = [],
  errors: Partial<Record<'parking_spots' | 'parking_layout_shapes', { code: string; message: string }>> = {},
) {
  const from = vi.fn((table: string) => ({
    select: vi.fn().mockResolvedValue({
      data: table === 'parking_spots' ? positions : shapes,
      error: errors[table as 'parking_spots' | 'parking_layout_shapes'] || null,
    }),
  }));
  return { supabase: { rpc, from } as unknown as SupabaseClient, from };
}

describe('AdminLoaderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads parking map state through the typed read RPC contract', async () => {
    const state = { spots: [{ id: 'spot-1' }], unassigned_pool: [{ id: 'vehicle-1' }] };
    const rpc = vi.fn().mockResolvedValue({ data: state, error: null });
    const layoutShape = {
      id: 'shape-1', floor: '1', kind: 'lane', x: 0, y: 0, w: 400, h: 80, rotation: 0, label: null,
    };
    const { supabase, from } = supabaseWithParkingReads(
      rpc,
      [{ id: 'spot-1', pos_x: 40, pos_y: 60, rotation: 90 }],
      [layoutShape],
    );

    await expect(AdminLoaderService.loadParkingMapState(supabase, '2026-06-24'))
      .resolves.toEqual({
        spots: [{ id: 'spot-1', pos_x: 40, pos_y: 60, rotation: 90 }],
        unassigned_pool: [{ id: 'vehicle-1' }],
        layout_shapes: [layoutShape],
      });

    expect(rpc).toHaveBeenCalledWith('get_parking_map_state', {
      p_target_date: '2026-06-24T23:59:59.999Z',
    });
    expect(from).toHaveBeenCalledWith('parking_spots');
    expect(from).toHaveBeenCalledWith('parking_layout_shapes');
  });

  it('rejects invalid parking map RPC result shapes', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { spots: [] }, error: null });
    const { supabase } = supabaseWithParkingReads(rpc);

    await expect(AdminLoaderService.loadParkingMapState(supabase, '2026-06-24'))
      .rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Parking map RPC returned an invalid shape.',
      });
  });

  it('rejects invalid parking layout rows', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { spots: [], unassigned_pool: [] },
      error: null,
    });
    const { supabase } = supabaseWithParkingReads(rpc, [], [{ id: 'shape-1', kind: 'unknown' }]);

    await expect(AdminLoaderService.loadParkingMapState(supabase, '2026-06-24'))
      .rejects.toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Parking layout returned an invalid shape.',
      });
  });

  it('keeps the legacy grid available while the additive layout schema is not deployed', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { spots: [{ id: 'spot-1' }], unassigned_pool: [] },
      error: null,
    });
    const { supabase } = supabaseWithParkingReads(rpc, [], [], {
      parking_spots: { code: '42703', message: 'column pos_x does not exist' },
      parking_layout_shapes: { code: 'PGRST205', message: 'table not found in schema cache' },
    });

    await expect(AdminLoaderService.loadParkingMapState(supabase, '2026-06-24'))
      .resolves.toEqual({
        spots: [{ id: 'spot-1', pos_x: null, pos_y: null, rotation: 0 }],
        unassigned_pool: [],
        layout_shapes: [],
      });
  });

  it('loads apartment timeline and incidents through typed read RPC contracts', async () => {
    const rpc = vi.fn((name: string) => {
      if (name === 'get_apartment_timeline') {
        return Promise.resolve({ data: [{ id: 'event-1', created_at: '2026-06-24T00:00:00Z', content: 'Note', author_name: null, author_role: null }], error: null });
      }
      if (name === 'get_apartment_open_incidents') {
        return Promise.resolve({ data: [{ id: 'event-2', workflow_status: 'open', content: 'Incident' }], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    const supabase = supabaseWithRpc(rpc);

    await expect(AdminLoaderService.loadApartmentTimeline(supabase, apartmentId))
      .resolves.toEqual([{ id: 'event-1', created_at: '2026-06-24T00:00:00Z', content: 'Note', author_name: null, author_role: null }]);
    await expect(AdminLoaderService.loadApartmentOpenIncidents(supabase, apartmentId))
      .resolves.toEqual([{ id: 'event-2', workflow_status: 'open', content: 'Incident' }]);

    expect(rpc).toHaveBeenCalledWith('get_apartment_timeline', { p_apartment_id: apartmentId });
    expect(rpc).toHaveBeenCalledWith('get_apartment_open_incidents', { p_apartment_id: apartmentId });
  });

  it('maps read-RPC failures to safe errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const supabase = supabaseWithRpc(rpc);

    await expect(AdminLoaderService.loadApartmentTimeline(supabase, apartmentId))
      .rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      });
  });

  it('loads only approved and pending vehicles for Apartment Detail', async () => {
    const rows = [
      { id: 'approved', plate_number: 'LIVE-1', make: 'Honda', color: 'Blue', approval_status: VEHICLE_APPROVAL_STATUS.approved },
      { id: 'pending', plate_number: 'WAIT-2', make: 'Kia', color: 'White', approval_status: VEHICLE_APPROVAL_STATUS.pendingApproval },
      { id: 'rejected', plate_number: 'NO-3', make: 'Ford', color: 'Black', approval_status: VEHICLE_APPROVAL_STATUS.rejected },
      { id: 'archived', plate_number: 'OLD-4', make: 'Saab', color: 'Gray', approval_status: VEHICLE_APPROVAL_STATUS.archived },
    ];
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    const inFilter = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ in: inFilter });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as unknown as SupabaseClient;

    await expect(AdminLoaderService.loadApartmentAuthorizedVehicles(supabase, apartmentId))
      .resolves.toEqual(rows.slice(0, 2));

    expect(from).toHaveBeenCalledWith('vehicles');
    expect(select).toHaveBeenCalledWith('id, plate_number, make, color, approval_status');
    expect(eq).toHaveBeenCalledWith('apartment_id', apartmentId);
    expect(inFilter).toHaveBeenCalledWith('approval_status', [...AUTHORIZED_VEHICLE_APPROVAL_STATUSES]);
    expect(order).toHaveBeenCalledWith('plate_number');
  });
});
