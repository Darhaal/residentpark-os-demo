// Title: Resident Vehicle List Test
// Path: src/components/resident/ResidentVehicleList.test.tsx
// Functionality: Verifies resident vehicle cards distinguish approved, pending, and rejected states.

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { en } from '@/localization/en';
import { ResidentVehicleList, type ResidentVehicle } from './ResidentVehicleList';

vi.mock('@/components/resident/RegisterVehicleButton', () => ({
  RegisterVehicleButton: () => <button type="button">Register vehicle</button>,
}));

const vehicle = (
  id: string,
  approvalStatus: string,
): ResidentVehicle => ({
  id,
  plate_number: id.toUpperCase(),
  make: 'Honda',
  model: 'Civic',
  color: 'Blue',
  year: 2024,
  approval_status: approvalStatus,
});

describe('ResidentVehicleList', () => {
  afterEach(() => cleanup());

  it('renders rejected as destructive guidance instead of pending', () => {
    render(
      <ResidentVehicleList
        hasApartment
        vehicles={[
          vehicle('active-1', VEHICLE_APPROVAL_STATUS.approved),
          vehicle('pending-2', VEHICLE_APPROVAL_STATUS.pendingApproval),
          vehicle('rejected-3', VEHICLE_APPROVAL_STATUS.rejected),
        ]}
      />,
    );

    expect(screen.getByText(en.residentDashboard.activeVehicle)).toBeTruthy();
    expect(screen.getByText(en.residentDashboard.pendingVehicle)).toBeTruthy();
    const rejectedLabel = screen.getByText(en.residentDashboard.rejectedVehicle);
    expect(rejectedLabel.closest('[data-slot="badge"]')?.className).toContain('text-destructive');
    expect(screen.getByText(en.residentDashboard.rejectedVehicleDescription)).toBeTruthy();
  });

  it('does not mislabel unexpected lifecycle states as pending', () => {
    render(
      <ResidentVehicleList
        hasApartment
        vehicles={[
          vehicle('archived-1', VEHICLE_APPROVAL_STATUS.archived),
          vehicle('unknown-2', 'unexpected_status'),
        ]}
      />,
    );

    expect(screen.getByText(en.residentDashboard.archivedVehicle)).toBeTruthy();
    expect(screen.getByText(en.residentDashboard.unknownVehicleStatus)).toBeTruthy();
    expect(screen.queryByText(en.residentDashboard.pendingVehicle)).toBeNull();
  });
});
