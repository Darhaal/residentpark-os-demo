// Title: Approvals Client Test
// Path: src/app/admin/approvals/ApprovalsClient.test.tsx
// Functionality: Component coverage for queue tabs and success/failure selection invariants.

/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ACCOUNT_STATUS } from '@/config/domain';
import { en } from '@/localization/en';
import type { PendingAccount } from './approvals-types';

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  processAccountRequest: vi.fn(),
  approveAndAssignUnitAction: vi.fn(),
  bulkApproveAndAssignUnitsAction: vi.fn(),
  reviewVehicleAction: vi.fn(),
  bulkReviewVehiclesAction: vi.fn(),
  submitVehicleRequestAction: vi.fn(),
  loadPendingApprovalsAction: vi.fn(),
  bulkUpdateUserStatusAction: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('@/actions/approvals', () => ({ processAccountRequest: mocks.processAccountRequest }));
vi.mock('@/actions/quick-approve', () => ({
  approveAndAssignUnitAction: mocks.approveAndAssignUnitAction,
  bulkApproveAndAssignUnitsAction: mocks.bulkApproveAndAssignUnitsAction,
}));
vi.mock('@/actions/parking', () => ({
  reviewVehicleAction: mocks.reviewVehicleAction,
  bulkReviewVehiclesAction: mocks.bulkReviewVehiclesAction,
  submitVehicleRequestAction: mocks.submitVehicleRequestAction,
}));
vi.mock('@/actions/loaders', () => ({ loadPendingApprovalsAction: mocks.loadPendingApprovalsAction }));
vi.mock('@/actions/users', () => ({ bulkUpdateUserStatusAction: mocks.bulkUpdateUserStatusAction }));

import { ApprovalsClient } from './ApprovalsClient';

const messages = en.adminApprovals;
const account: PendingAccount = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'erin@example.com',
  full_name: 'Erin Resident',
  created_at: '2026-06-26T10:00:00.000Z',
  apartments: null,
};

function renderClient() {
  return render(
    <ApprovalsClient
      initialPendingAccounts={[account]}
      initialPendingVehicles={[]}
      initialApartments={[{ id: '22222222-2222-4222-8222-222222222222', apartment_number: '101' }]}
    />,
  );
}

describe('ApprovalsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.approveAndAssignUnitAction.mockResolvedValue({ success: true });
    mocks.bulkUpdateUserStatusAction.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('links queue tabs to panels and supports arrow-key navigation', async () => {
    renderClient();
    const accountTab = screen.getByRole('tab', { name: new RegExp(messages.tabs.accounts, 'i') });
    const vehicleTab = screen.getByRole('tab', { name: new RegExp(messages.tabs.vehicles, 'i') });

    expect(accountTab.getAttribute('aria-selected')).toBe('true');
    expect(accountTab.getAttribute('aria-controls')).toBe('approvals-accounts-panel');
    fireEvent.keyDown(accountTab, { key: 'ArrowRight' });

    await waitFor(() => expect(vehicleTab.getAttribute('aria-selected')).toBe('true'));
    expect(vehicleTab.getAttribute('aria-controls')).toBe('approvals-vehicles-panel');
    expect(screen.getByRole('button', { name: messages.addRequest })).toBeTruthy();
  });

  it('removes a processed row from selection after individual approval', async () => {
    renderClient();
    const checkbox = screen.getByLabelText(messages.selectAccount(account.full_name as string)) as HTMLInputElement;
    const row = checkbox.closest('tr');
    if (!row) throw new Error('Expected account table row');

    fireEvent.click(checkbox);
    expect(screen.getByRole('region', { name: messages.bulkSelectionAria })).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: messages.approve }));

    await waitFor(() => {
      expect(mocks.approveAndAssignUnitAction).toHaveBeenCalledWith(account.id, null, messages.defaultReasons.accountApproval);
    });
    await waitFor(() => expect(screen.queryByText(account.email as string)).toBeNull());
    expect(screen.queryByRole('region', { name: messages.bulkSelectionAria })).toBeNull();
  });

  it('preserves bulk selection and reason after a recoverable failure', async () => {
    mocks.bulkUpdateUserStatusAction.mockResolvedValue({ success: false, error: 'Bulk rejection failed.' });
    renderClient();

    const checkbox = screen.getByLabelText(messages.selectAccount(account.full_name as string)) as HTMLInputElement;
    fireEvent.click(checkbox);
    const bulkBar = screen.getByRole('region', { name: messages.bulkSelectionAria });
    fireEvent.click(within(bulkBar).getByRole('button', { name: messages.reject }));

    const reason = screen.getByLabelText(messages.resolutionLog) as HTMLTextAreaElement;
    fireEvent.change(reason, { target: { value: 'Incomplete identity documents' } });
    fireEvent.click(screen.getByRole('button', { name: messages.confirm }));

    await waitFor(() => {
      expect(mocks.bulkUpdateUserStatusAction).toHaveBeenCalledWith(
        [account.id],
        ACCOUNT_STATUS.rejected,
        'Incomplete identity documents',
      );
    });
    expect(checkbox.checked).toBe(true);
    expect(reason.value).toBe('Incomplete identity documents');
    expect(screen.getByText(messages.bulkModalDescription(1))).toBeTruthy();
  });
});
