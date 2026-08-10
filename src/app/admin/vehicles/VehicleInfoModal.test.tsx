// @vitest-environment jsdom
// Title: Vehicle Info Modal Test
// Path: src/app/admin/vehicles/VehicleInfoModal.test.tsx
// Functionality: Component coverage for the complete admin vehicle detail modal.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { en } from '@/localization/en';
import { VehicleInfoModal } from './VehicleInfoModal';
import type { VehicleDirectoryVehicle } from './vehicles-types';

const messages = en.adminVehicles;

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

function vehicle(overrides: Partial<VehicleDirectoryVehicle> = {}): VehicleDirectoryVehicle {
  return {
    id: 'vehicle-1',
    plate_number: 'QA123',
    make: 'Honda',
    model: 'Civic',
    color: 'Blue',
    year: 2024,
    approval_status: VEHICLE_APPROVAL_STATUS.rejected,
    created_at: '2026-07-01T12:00:00.000Z',
    owner_id: 'resident-1',
    apartments: { apartment_number: '20A' },
    profiles: { full_name: 'Erin Resident' },
    assigned_spot: {
      id: 'spot-1',
      spot_number: 'P-06',
      floor: '2',
      zone: 'East',
      status: 'occupied',
    },
    last_action_note: {
      action_type: 'VEHICLE_STATUS_CHANGED',
      reason: 'Registration document mismatch',
      created_at: '2026-07-02T12:00:00.000Z',
    },
    ...overrides,
  };
}

function renderModal(input: Partial<VehicleDirectoryVehicle> = {}) {
  return render(
    <VehicleInfoModal
      vehicle={vehicle(input)}
      reason=""
      setReason={vi.fn()}
      processingId={null}
      archiveId="archive"
      onClose={vi.fn()}
      onStatusChange={vi.fn()}
      onArchive={vi.fn()}
    />,
  );
}

describe('VehicleInfoModal', () => {
  it('renders lifecycle status, vehicle details, assignment, and recorded action reason', () => {
    renderModal();

    expect(screen.getByText(messages.statusLabels.rejected)).toBeTruthy();
    expect(screen.getByText('QA123')).toBeTruthy();
    expect(screen.getByText('Honda Civic')).toBeTruthy();
    expect(screen.getByText('2024')).toBeTruthy();
    expect(screen.getByText('Blue')).toBeTruthy();
    expect(screen.getByText('Erin Resident')).toBeTruthy();
    expect(screen.getByText(`${messages.apartmentLabel} 20A`)).toBeTruthy();
    expect(screen.getByText(messages.currentSpot('P-06'))).toBeTruthy();
    expect(screen.getByText(messages.spotLocation('2', 'East'))).toBeTruthy();
    expect(screen.getByText('Registration document mismatch')).toBeTruthy();
  });

  it('keeps status-appropriate actions visible for pending vehicles', () => {
    renderModal({
      approval_status: VEHICLE_APPROVAL_STATUS.pendingApproval,
      assigned_spot: null,
      last_action_note: null,
    });

    expect(screen.getByRole('button', { name: messages.approve })).toBeTruthy();
    expect(screen.getByRole('button', { name: messages.reject })).toBeTruthy();
    expect(screen.queryByRole('button', { name: messages.moveToArchive })).toBeNull();
    expect(screen.getByText(messages.noSpotAssigned)).toBeTruthy();
  });
});
