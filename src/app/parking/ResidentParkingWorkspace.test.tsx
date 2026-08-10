// Title: Resident Parking Workspace Test
// Path: src/app/parking/ResidentParkingWorkspace.test.tsx
// Functionality: Component coverage for mobile context, desktop identity, parking assignment, and vehicle states.

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { en } from '@/localization/en';
import type { ResidentVehicle } from '@/components/resident/ResidentVehicleList';

vi.mock('@/components/resident/ResidentParkingMap', () => ({
  ResidentParkingMap: ({ apartmentNumber }: { apartmentNumber: string | null }) => (
    <div data-testid="resident-parking-map" data-apartment={apartmentNumber || ''} />
  ),
}));

vi.mock('@/components/resident/RegisterVehicleButton', () => ({
  RegisterVehicleButton: ({ hasApartment }: { hasApartment: boolean }) => (
    <button type="button" data-has-apartment={String(hasApartment)}>Register vehicle</button>
  ),
}));

import { ResidentParkingWorkspace } from './ResidentParkingWorkspace';

const dashboardMessages = en.residentDashboard;
const pageMessages = en.residentParkingPage;
const vehicles: ResidentVehicle[] = [
  {
    id: 'vehicle-1',
    plate_number: 'ACTIVE1',
    make: 'Honda',
    model: 'Civic',
    color: 'Blue',
    year: 2022,
    approval_status: VEHICLE_APPROVAL_STATUS.approved,
  },
  {
    id: 'vehicle-2',
    plate_number: 'WAIT2',
    make: 'Toyota',
    model: 'Corolla',
    color: 'White',
    year: 2024,
    approval_status: VEHICLE_APPROVAL_STATUS.pendingApproval,
  },
  {
    id: 'vehicle-3',
    plate_number: 'DENIED3',
    make: 'Ford',
    model: 'Focus',
    color: 'Red',
    year: 2020,
    approval_status: VEHICLE_APPROVAL_STATUS.rejected,
  },
];

describe('ResidentParkingWorkspace', () => {
  afterEach(() => cleanup());

  it('presents mobile and desktop context for an assigned resident', () => {
    render(
      <ResidentParkingWorkspace
        spots={[]}
        layoutShapes={[]}
        apartmentNumber="101"
        fullName="Erin Resident"
        displayRole={dashboardMessages.primaryTenant}
        primarySpot={{ spot_number: 'A-1', floor: '1', zone: 'Residential' }}
        vehicles={vehicles}
      />,
    );

    expect(screen.getByRole('navigation', { name: pageMessages.mobileNavigationAria })).toBeTruthy();
    const sidebar = screen.getByRole('complementary', { name: pageMessages.sidebarAria });
    expect(within(sidebar).getByRole('heading', { name: 'Erin Resident' })).toBeTruthy();
    expect(within(sidebar).getByText(`${dashboardMessages.unitPrefix} 101`)).toBeTruthy();
    expect(within(sidebar).getByText(dashboardMessages.primaryTenant)).toBeTruthy();
    expect(within(sidebar).getByText('ACTIVE1')).toBeTruthy();
    expect(within(sidebar).getByText('WAIT2')).toBeTruthy();
    expect(within(sidebar).getByText('DENIED3')).toBeTruthy();
    expect(within(sidebar).getByText(dashboardMessages.rejectedVehicle)).toBeTruthy();
    expect(within(sidebar).getByText(dashboardMessages.rejectedVehicleDescription)).toBeTruthy();
    expect(screen.getByText(pageMessages.spotBadge('A-1'))).toBeTruthy();
    expect(screen.getByTestId('resident-parking-map').getAttribute('data-apartment')).toBe('101');
  });

  it('presents explicit empty assignment and vehicle states', () => {
    render(
      <ResidentParkingWorkspace
        spots={[]}
        layoutShapes={[]}
        apartmentNumber={null}
        fullName={null}
        displayRole={dashboardMessages.residentRole}
        primarySpot={null}
        vehicles={[]}
      />,
    );

    const sidebar = screen.getByRole('complementary', { name: pageMessages.sidebarAria });
    expect(within(sidebar).getByText(dashboardMessages.spotUnassignedTitle)).toBeTruthy();
    expect(within(sidebar).getByText(dashboardMessages.noVehiclesTitle)).toBeTruthy();
    expect(screen.queryByText(/Spot A-1/)).toBeNull();
    expect(within(sidebar).getByRole('button', { name: 'Register vehicle' }).getAttribute('data-has-apartment')).toBe('false');
  });
});
