// Title: Resident Parking Map View Model Test
// Path: src/components/resident/resident-parking-map-utils.test.ts
// Functionality: Unit coverage for privacy-safe state reduction and garage grouping.

import { describe, expect, it } from 'vitest';
import type { ResidentMapSpot } from './resident-parking-map-types';
import { buildResidentParkingFloors, residentSpotState, residentZoneLabel } from './resident-parking-map-utils';

function spot(overrides: Partial<ResidentMapSpot>): ResidentMapSpot {
  return {
    id: 'spot-1',
    spot_number: 'A-1',
    floor: '1',
    zone: 'residential',
    status: 'available',
    pos_x: null,
    pos_y: null,
    rotation: 0,
    is_own: false,
    is_occupied: false,
    plate_number: null,
    make: null,
    model: null,
    relocation_status: null,
    original_spot_number: null,
    temporary_spot_number: null,
    disruption_title: null,
    ...overrides,
  };
}

describe('resident parking map view model', () => {
  it('reduces every occupied non-owned spot to the privacy-safe occupied state', () => {
    expect(residentSpotState(spot({ status: 'conflict', is_occupied: true }))).toBe('occupied');
    expect(residentSpotState(spot({ status: 'conflict', is_occupied: true, is_own: true }))).toBe('conflict');
  });

  it('groups spots by sorted floors and zones with readable labels', () => {
    const floors = buildResidentParkingFloors([
      spot({ id: 'spot-2', spot_number: 'B-1', floor: '2', zone: 'visitor' }),
      spot({ id: 'spot-1', spot_number: 'A-1', floor: '1', zone: 'resident_west' }),
    ]);

    expect(floors.map((floor) => floor.label)).toEqual(['Floor 1', 'Floor 2']);
    expect(floors[0].zones[0]).toEqual(expect.objectContaining({
      label: 'Resident west',
      spots: [expect.objectContaining({ id: 'spot-1' })],
    }));
    expect(floors[1].zones[0].label).toBe('Temporary Pool');
    expect(residentZoneLabel(null)).toBe('Residential');
  });
});
