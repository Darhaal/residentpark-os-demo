// Title: Resident Parking Map Test
// Path: src/components/resident/ResidentParkingMap.test.tsx
// Functionality: Component coverage for privacy-safe tiles and assigned-spot issue reporting.

/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PARKING_ISSUE_TYPE } from '@/config/domain';
import { en } from '@/localization/en';
import type { ResidentMapSpot } from './resident-parking-map-types';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  reportParkingIssueAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('@/actions/resident', () => ({
  reportParkingIssueAction: mocks.reportParkingIssueAction,
}));

import { ResidentParkingMap } from './ResidentParkingMap';

const messages = en.residentParkingMap;
const ownSpot: ResidentMapSpot = {
  id: '11111111-1111-4111-8111-111111111111',
  spot_number: 'A-1',
  floor: '1',
  zone: 'residential',
  status: 'assigned',
  pos_x: null,
  pos_y: null,
  rotation: 0,
  is_own: true,
  is_occupied: true,
  plate_number: 'HOME1',
  make: 'Honda',
  model: 'Civic',
  relocation_status: null,
  original_spot_number: null,
  temporary_spot_number: null,
  disruption_title: null,
};

const privateOccupiedSpot: ResidentMapSpot = {
  ...ownSpot,
  id: '22222222-2222-4222-8222-222222222222',
  spot_number: 'A-2',
  status: 'conflict',
  is_own: false,
  plate_number: null,
  make: null,
  model: null,
};

describe('ResidentParkingMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reportParkingIssueAction.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('shows own details while reducing another occupied spot to a coarse state', () => {
    render(<ResidentParkingMap spots={[ownSpot, privateOccupiedSpot]} layoutShapes={[]} apartmentNumber="101" />);

    expect(screen.getByRole('article', { name: messages.yourAssignedSpot('A-1') })).toBeTruthy();
    expect(screen.getByRole('article', { name: messages.spotStatusTitle('A-2', 'Occupied') })).toBeTruthy();
    expect(screen.getByText('HOME1')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: messages.reportIssue })).toHaveLength(1);
  });

  it('submits a normalized issue for the selected assigned spot', async () => {
    render(<ResidentParkingMap spots={[ownSpot, privateOccupiedSpot]} layoutShapes={[]} apartmentNumber="101" />);

    fireEvent.click(screen.getByRole('button', { name: messages.reportIssue }));
    expect(screen.getByRole('dialog', { name: messages.modalTitle })).toBeTruthy();

    fireEvent.change(screen.getByLabelText(messages.observedPlateLabel), { target: { value: ' abc123 ' } });
    fireEvent.change(screen.getByLabelText(messages.commentLabel), { target: { value: '  Blocking the lane  ' } });
    fireEvent.click(screen.getByRole('button', { name: messages.submit }));

    await waitFor(() => {
      expect(mocks.reportParkingIssueAction).toHaveBeenCalledWith(
        ownSpot.id,
        ownSpot.spot_number,
        PARKING_ISSUE_TYPE.unauthorizedVehicle,
        'ABC123',
        'Blocking the lane',
      );
    });
    await waitFor(() => {
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('uses the spatial floor only when every spot has coordinates and keeps other identities private', () => {
    const positionedOwnSpot = { ...ownSpot, pos_x: 40, pos_y: 60 };
    const positionedPrivateSpot = { ...privateOccupiedSpot, pos_x: 180, pos_y: 60 };

    const { container } = render(
      <ResidentParkingMap
        spots={[positionedOwnSpot, positionedPrivateSpot]}
        layoutShapes={[{
          id: 'shape-1', floor: '1', kind: 'lane', x: 20, y: 200, w: 420, h: 80, rotation: 0, label: 'Exit lane',
        }]}
        apartmentNumber="101"
        spatialRenderEnabled
      />,
    );

    expect(container.querySelector('[data-parking-layout="spatial"]')).toBeTruthy();
    expect(container.querySelector('[data-layout-shape="lane"]')?.textContent).toBe('Exit lane');
    expect(screen.getByText('HOME1')).toBeTruthy();
    expect(screen.getByRole('article', { name: messages.spotStatusTitle('A-2', 'Occupied') })).toBeTruthy();
  });

  it('forces a fully positioned resident floor onto the grid while the release flag is off', () => {
    const { container } = render(
      <ResidentParkingMap
        spots={[
          { ...ownSpot, pos_x: 40, pos_y: 60 },
          { ...privateOccupiedSpot, pos_x: 180, pos_y: 60 },
        ]}
        layoutShapes={[{
          id: 'shape-1', floor: '1', kind: 'lane', x: 20, y: 200, w: 420, h: 80, rotation: 0, label: 'Exit lane',
        }]}
        apartmentNumber="101"
      />,
    );

    expect(container.querySelector('[data-parking-layout="spatial"]')).toBeNull();
    expect(container.querySelector('[data-layout-shape]')).toBeNull();
    expect(screen.getByText('HOME1')).toBeTruthy();
    expect(screen.getByRole('article', { name: messages.spotStatusTitle('A-2', 'Occupied') })).toBeTruthy();
  });

  it('keeps the existing grid when any spot on the floor is not positioned', () => {
    const { container } = render(
      <ResidentParkingMap
        spots={[{ ...ownSpot, pos_x: 40, pos_y: 60 }, privateOccupiedSpot]}
        layoutShapes={[]}
        apartmentNumber="101"
      />,
    );

    expect(container.querySelector('[data-parking-layout="spatial"]')).toBeNull();
    expect(screen.getByRole('article', { name: messages.yourAssignedSpot('A-1') })).toBeTruthy();
    expect(screen.getByRole('article', { name: messages.spotStatusTitle('A-2', 'Occupied') })).toBeTruthy();
  });
});
