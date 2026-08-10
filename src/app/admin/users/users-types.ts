// Title: Users Types
// Path: src/app/admin/users/users-types.ts
// Functionality: Shared TypeScript types for identity and role screens, actions, and component contracts.

// Shared types and constants for the admin Users directory and its extracted modals.

import { ACCOUNT_STATUS, USER_ROLES } from '@/config/domain';
import { ADMIN_USERS_CONFIG } from '@/config/admin-clients';

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type EditableRole = typeof USER_ROLES.resident | typeof USER_ROLES.admin;
export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];
export type RoleChangeIntent = typeof ADMIN_USERS_CONFIG.bulkIntents.roleChange;
export type BulkIntent =
  | typeof ACCOUNT_STATUS.approved
  | typeof ACCOUNT_STATUS.suspended
  | typeof ACCOUNT_STATUS.rejected
  | RoleChangeIntent;

// Status values handed to the single-user lifecycle action.
export type LifecycleStatus =
  | typeof ACCOUNT_STATUS.approved
  | typeof ACCOUNT_STATUS.suspended
  | typeof ACCOUNT_STATUS.rejected;

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_apartment_manager: boolean;
  approval_status: AccountStatus;
  created_at: string;
  apartment_number: string | null;
  apartment_id: string | null;
}

export interface ApartmentOption {
  id: string;
  apartment_number: string;
}

export interface CreateAccountData {
  fullName: string;
  email: string;
  confirmAdminPassword: string;
  role: EditableRole;
  apartmentId: string | null;
}

export const ROLE_OPTIONS: readonly EditableRole[] = ADMIN_USERS_CONFIG.editableRoles;
export const roleChangeIntent = ADMIN_USERS_CONFIG.bulkIntents.roleChange;
