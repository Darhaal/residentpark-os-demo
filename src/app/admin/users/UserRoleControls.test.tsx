// @vitest-environment jsdom
// Title: User Role Controls Test
// Path: src/app/admin/users/UserRoleControls.test.tsx
// Functionality: Component coverage for hiding admin role controls from regular admins.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ACCOUNT_STATUS, USER_ROLES } from '@/config/domain';
import { en } from '@/localization/en';
import { UserEditModal } from './UserEditModal';
import { UsersBulkModal } from './UsersBulkModal';
import { roleChangeIntent, type Profile } from './users-types';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const messages = en.adminUsers;

const profile: Profile = {
  id: '11111111-1111-4111-8111-111111111111',
  full_name: 'Erin Pending',
  email: 'erin.pending@example.test',
  phone: null,
  role: USER_ROLES.resident,
  is_apartment_manager: false,
  approval_status: ACCOUNT_STATUS.approved,
  created_at: '2026-07-06T00:00:00.000Z',
  apartment_number: '101',
  apartment_id: '22222222-2222-4222-8222-222222222222',
};

function editProps(canAssignAdminRole: boolean) {
  return {
    user: profile,
    apartments: [{ id: profile.apartment_id!, apartment_number: profile.apartment_number! }],
    newRole: USER_ROLES.resident,
    setNewRole: vi.fn(),
    canAssignAdminRole,
    isManager: false,
    setIsManager: vi.fn(),
    selectedApartmentId: profile.apartment_id!,
    setSelectedApartmentId: vi.fn(),
    reason: 'Verified identity',
    setReason: vi.fn(),
    confirmPassword: 'admin-password',
    setConfirmPassword: vi.fn(),
    isSaving: false,
    onClose: vi.fn(),
    onToggleStatus: vi.fn(),
    onShowSuspendConfirm: vi.fn(),
    onSave: vi.fn(),
  };
}

function bulkProps(canAssignAdminRole: boolean) {
  return {
    intent: roleChangeIntent,
    selectedCount: 2,
    bulkRole: USER_ROLES.resident,
    setBulkRole: vi.fn(),
    canAssignAdminRole,
    reason: 'Verified identities',
    setReason: vi.fn(),
    isSaving: false,
    onCancel: vi.fn(),
    onCommit: vi.fn(),
  };
}

describe('admin user role controls', () => {
  it('hides single-user admin promotion controls from regular admins', () => {
    const { queryByRole, getByRole } = render(<UserEditModal {...editProps(false)} />);

    expect(getByRole('button', { name: new RegExp(messages.residentRole, 'i') })).toBeTruthy();
    expect(queryByRole('button', { name: new RegExp(messages.adminRole, 'i') })).toBeNull();
  });

  it('shows single-user admin promotion controls to superadmins', () => {
    const { getByRole } = render(<UserEditModal {...editProps(true)} />);

    expect(getByRole('button', { name: new RegExp(messages.residentRole, 'i') })).toBeTruthy();
    expect(getByRole('button', { name: new RegExp(messages.adminRole, 'i') })).toBeTruthy();
  });

  it('hides bulk admin promotion controls from regular admins', () => {
    const { queryByRole, getByRole } = render(<UsersBulkModal {...bulkProps(false)} />);

    expect(getByRole('button', { name: new RegExp(messages.residentRole, 'i') })).toBeTruthy();
    expect(queryByRole('button', { name: new RegExp(messages.adminRole, 'i') })).toBeNull();
  });

  it('shows bulk admin promotion controls to superadmins', () => {
    const { getByRole } = render(<UsersBulkModal {...bulkProps(true)} />);

    expect(getByRole('button', { name: new RegExp(messages.residentRole, 'i') })).toBeTruthy();
    expect(getByRole('button', { name: new RegExp(messages.adminRole, 'i') })).toBeTruthy();
  });
});
