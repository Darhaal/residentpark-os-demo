// Title: Approvals Types
// Path: src/app/admin/approvals/approvals-types.ts
// Functionality: Shared TypeScript types for approval screens, actions, and component contracts.

// Shared types and helpers for the admin Approvals queue and its extracted parts.

import { ADMIN_APPROVALS_CONFIG } from '@/config/admin-clients';
import { ACCOUNT_STATUS } from '@/config/domain';
import type { ExtendedApartmentObj } from '@/components/shared/VehicleForm';

export type ApartmentRef = { apartment_number: string | null } | { apartment_number: string | null }[] | null;

export interface PendingAccount {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  apartments: ApartmentRef;
}

export interface PendingVehicle {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  year: number | null;
  created_at: string;
  apartments: ApartmentRef;
  owner_id: string | null;
  profiles?: { full_name: string | null } | null;
}

export type ApprovalTab = (typeof ADMIN_APPROVALS_CONFIG.tabs)[keyof typeof ADMIN_APPROVALS_CONFIG.tabs];
export type ApprovalRejectType = 'account' | 'vehicle';
export type ApprovalBulkIntent = typeof ACCOUNT_STATUS.approved | typeof ACCOUNT_STATUS.rejected;

export interface ApprovalsClientProps {
  initialPendingAccounts: PendingAccount[];
  initialPendingVehicles: PendingVehicle[];
  initialApartments: ExtendedApartmentObj[];
}

export function getApartmentNumber(apartments: ApartmentRef) {
  const apartment = Array.isArray(apartments) ? apartments[0] : apartments;
  return apartment?.apartment_number || null;
}
