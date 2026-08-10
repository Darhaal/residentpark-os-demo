// Title: Reports Actions Test
// Path: src/actions/reports.test.ts
// Functionality: Unit coverage for operational report calculations.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_STATUS, PARKING_SPOT_STATUS, USER_ROLES, VEHICLE_APPROVAL_STATUS } from '@/config/domain';

const mocks = vi.hoisted(() => ({
  logActionError: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/action-logger', () => ({
  logActionError: mocks.logActionError,
}));

vi.mock('@/lib/auth', () => ({
  requireAdmin: mocks.requireAdmin,
}));

import { loadReportsAction } from './reports';

const apartmentId = '11111111-1111-4111-8111-111111111111';

function makeSelectResult(data: unknown[] = []) {
  return {
    select: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function makeCountQuery(count: number) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn().mockResolvedValue({ count, error: null }),
    in: vi.fn().mockResolvedValue({ count, error: null }),
  };
  return query;
}

function setupReportsClient() {
  const tableQueries: Record<string, unknown[]> = {
    parking_spots: [
      { id: 'spot-available', assigned_vehicle_id: null, status: PARKING_SPOT_STATUS.available },
      { id: 'spot-occupied', assigned_vehicle_id: 'vehicle-parked', status: PARKING_SPOT_STATUS.occupied },
      { id: 'spot-conflict', assigned_vehicle_id: 'vehicle-conflict', status: PARKING_SPOT_STATUS.conflict },
      { id: 'spot-blocked', assigned_vehicle_id: null, status: PARKING_SPOT_STATUS.blocked },
    ],
    vehicles: [
      {
        id: 'vehicle-parked',
        plate_number: 'AAA111',
        make: 'Toyota',
        model: 'Camry',
        approval_status: VEHICLE_APPROVAL_STATUS.approved,
        apartment_id: apartmentId,
        apartments: { apartment_number: '20A' },
        profiles: { full_name: 'A Resident' },
      },
      {
        id: 'vehicle-conflict',
        plate_number: 'BBB222',
        make: 'Honda',
        model: 'Civic',
        approval_status: VEHICLE_APPROVAL_STATUS.approved,
        apartment_id: apartmentId,
        apartments: { apartment_number: '20A' },
        profiles: { full_name: 'B Resident' },
      },
    ],
    apartments: [
      { id: apartmentId, apartment_number: '20A', status: 'occupied' },
    ],
    profiles: [
      {
        id: 'profile-resident',
        apartment_id: apartmentId,
        role: USER_ROLES.resident,
        approval_status: ACCOUNT_STATUS.approved,
      },
    ],
  };
  const counts = [makeCountQuery(0), makeCountQuery(0), makeCountQuery(0)];
  const from = vi.fn((table: string) => {
    if (table === 'profiles' && from.mock.calls.filter(([name]) => name === 'profiles').length > 1) {
      return counts.shift();
    }
    if (table === 'vehicles' && from.mock.calls.filter(([name]) => name === 'vehicles').length > 1) {
      return counts.shift();
    }
    if (table === 'parking_issues') return counts.shift();
    return makeSelectResult(tableQueries[table] ?? []);
  });
  const supabase = { from };
  mocks.requireAdmin.mockResolvedValue({
    supabase,
    userId: 'admin-id',
    email: 'admin@example.com',
    role: USER_ROLES.admin,
  });
}

describe('loadReportsAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logActionError.mockResolvedValue(undefined);
  });

  it('counts conflict spots as occupied while keeping conflict as a separate incident category', async () => {
    setupReportsClient();

    await expect(loadReportsAction()).resolves.toMatchObject({
      success: true,
      data: {
        occupancy: {
          total: 4,
          available: 1,
          occupied: 2,
          blocked: 1,
          conflict: 1,
          reserved: 0,
          percent: 50,
        },
      },
    });
  });
});
