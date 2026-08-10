// Title: Apartment Detail Drawer Test
// Path: src/app/admin/apartments/ApartmentDetailDrawer.test.tsx
// Functionality: Verifies Authorized Vehicles excludes rejected and archived lifecycle records.

/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { APARTMENT_STATUS, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { en } from '@/localization/en';
import { ApartmentDetailDrawer } from './ApartmentDetailDrawer';
import type { ApartmentDetails } from './apartments-types';

const details: ApartmentDetails = {
  id: 'apartment-1',
  apartment_number: '101',
  status: APARTMENT_STATUS.occupied,
  vehicles: [
    { id: 'approved', plate_number: 'LIVE-1', make: 'Honda', color: 'Blue', approval_status: VEHICLE_APPROVAL_STATUS.approved },
    { id: 'pending', plate_number: 'WAIT-2', make: 'Kia', color: 'White', approval_status: VEHICLE_APPROVAL_STATUS.pendingApproval },
    { id: 'rejected', plate_number: 'NO-3', make: 'Ford', color: 'Black', approval_status: VEHICLE_APPROVAL_STATUS.rejected },
    { id: 'archived', plate_number: 'OLD-4', make: 'Saab', color: 'Gray', approval_status: VEHICLE_APPROVAL_STATUS.archived },
  ],
};

describe('ApartmentDetailDrawer', () => {
  afterEach(() => cleanup());

  it('shows only approved and pending vehicles under Authorized Vehicles', () => {
    render(
      <ApartmentDetailDrawer
        details={details}
        isLoading={false}
        onClose={vi.fn()}
        onPromptStatusChange={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: en.adminApartments.detailDrawerLabel });
    expect(within(dialog).getByText('LIVE-1')).toBeTruthy();
    expect(within(dialog).getByText('WAIT-2')).toBeTruthy();
    expect(within(dialog).queryByText('NO-3')).toBeNull();
    expect(within(dialog).queryByText('OLD-4')).toBeNull();
  });
});
