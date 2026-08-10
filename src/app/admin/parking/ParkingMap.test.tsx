// Title: Admin Parking Map Test
// Path: src/app/admin/parking/ParkingMap.test.tsx
// Functionality: Verifies spatial rendering and the no-coordinate grid fallback.

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ParkingLayoutShape } from '@/config/parking-layout';
import { ParkingMap } from './ParkingMap';
import type { ParkingSpot } from './types';

const baseSpot: ParkingSpot = {
  id: '11111111-1111-4111-8111-111111111111',
  spot_number: 'A-1',
  zone: 'residential',
  floor: '1',
  status: 'available',
  type: 'regular',
  assigned_apartment_id: null,
  assigned_vehicle_id: null,
  pos_x: null,
  pos_y: null,
  rotation: 0,
};

const secondSpot: ParkingSpot = {
  ...baseSpot,
  id: '22222222-2222-4222-8222-222222222222',
  spot_number: 'A-2',
};

const shape: ParkingLayoutShape = {
  id: 'shape-1',
  floor: '1',
  kind: 'zone',
  x: 20,
  y: 20,
  w: 420,
  h: 180,
  rotation: 0,
  label: 'Residential',
};

describe('ParkingMap', () => {
  afterEach(() => cleanup());

  const renderSpot = (spot: ParkingSpot, side: 'left' | 'right' | 'grid' | 'spatial') => (
    <button key={spot.id} type="button" data-testid={`spot-${spot.id}`} data-side={side}>
      {spot.spot_number}
    </button>
  );

  it('preserves the existing grid when a floor has no positioned spots', () => {
    const { container } = render(
      <ParkingMap
        byZone={[['residential', [baseSpot, secondSpot]]]}
        spots={[baseSpot, secondSpot]}
        layoutShapes={[]}
        spatialFloorKeys={[]}
        viewMode="grid"
        renderSpot={renderSpot}
      />,
    );

    expect(container.querySelector('[data-parking-layout="spatial"]')).toBeNull();
    expect(screen.getByTestId(`spot-${baseSpot.id}`).getAttribute('data-side')).toBe('grid');
    expect(screen.getByTestId(`spot-${secondSpot.id}`).getAttribute('data-side')).toBe('grid');
  });

  it('renders a fully positioned floor and its shapes on the spatial canvas', () => {
    const positioned = [
      { ...baseSpot, pos_x: 40, pos_y: 60 },
      { ...secondSpot, pos_x: 180, pos_y: 60, rotation: 90 },
    ];
    const { container } = render(
      <ParkingMap
        byZone={[['residential', positioned]]}
        spots={positioned}
        layoutShapes={[shape]}
        spatialFloorKeys={['1']}
        spatialRenderEnabled
        viewMode="lanes"
        renderSpot={renderSpot}
      />,
    );

    expect(container.querySelector('[data-parking-layout="spatial"]')).toBeTruthy();
    expect(container.querySelector('[data-layout-shape="zone"]')?.textContent).toBe('Residential');
    expect(screen.getByTestId(`spot-${baseSpot.id}`).getAttribute('data-side')).toBe('spatial');
    expect(screen.getByTestId(`spot-${secondSpot.id}`).parentElement?.getAttribute('style')).toContain('rotate(90deg)');
  });

  it('forces a fully positioned floor onto the grid while the release flag is off', () => {
    const positioned = [
      { ...baseSpot, pos_x: 40, pos_y: 60 },
      { ...secondSpot, pos_x: 180, pos_y: 60 },
    ];
    const { container } = render(
      <ParkingMap
        byZone={[['residential', positioned]]}
        spots={positioned}
        layoutShapes={[shape]}
        spatialFloorKeys={['1']}
        viewMode="grid"
        renderSpot={renderSpot}
      />,
    );

    expect(container.querySelector('[data-parking-layout="spatial"]')).toBeNull();
    expect(container.querySelector('[data-layout-shape]')).toBeNull();
    expect(screen.getByTestId(`spot-${baseSpot.id}`).getAttribute('data-side')).toBe('grid');
    expect(screen.getByTestId(`spot-${secondSpot.id}`).getAttribute('data-side')).toBe('grid');
  });

  it('falls back for a partially positioned floor so no spot disappears', () => {
    const partial = [{ ...baseSpot, pos_x: 40, pos_y: 60 }, secondSpot];
    const { container } = render(
      <ParkingMap
        byZone={[['residential', partial]]}
        spots={partial}
        layoutShapes={[shape]}
        spatialFloorKeys={[]}
        viewMode="grid"
        renderSpot={renderSpot}
      />,
    );

    expect(container.querySelector('[data-parking-layout="spatial"]')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
