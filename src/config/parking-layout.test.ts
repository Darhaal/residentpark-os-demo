// Title: Parking Layout Configuration Test
// Path: src/config/parking-layout.test.ts
// Functionality: Verifies complete-coordinate detection and the release spatial-render flag.

import { describe, expect, it } from 'vitest';
import {
  PARKING_SPATIAL_LAYOUT,
  floorHasSpatialLayout,
  hasCompleteParkingCoordinates,
  type ParkingPosition,
} from './parking-layout';

const positionedFloor: ParkingPosition[] = [
  { pos_x: 40, pos_y: 60, rotation: 0 },
  { pos_x: 180, pos_y: 60, rotation: 90 },
];

describe('parking layout release configuration', () => {
  it('keeps the spatial renderer disabled for this release', () => {
    expect(PARKING_SPATIAL_LAYOUT.spatialRenderEnabled).toBe(false);
    expect(floorHasSpatialLayout(positionedFloor)).toBe(false);
  });

  it('keeps complete-coordinate detection available for editor and layout tests', () => {
    expect(hasCompleteParkingCoordinates(positionedFloor)).toBe(true);
    expect(hasCompleteParkingCoordinates([
      positionedFloor[0],
      { pos_x: null, pos_y: null, rotation: 0 },
    ])).toBe(false);
  });

  it('can explicitly exercise the hidden spatial branch in focused tests', () => {
    expect(floorHasSpatialLayout(positionedFloor, true)).toBe(true);
  });
});
