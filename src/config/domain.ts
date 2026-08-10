// Title: Domain Configuration
// Path: src/config/domain.ts
// Functionality: Centralized configuration values and UI metadata for application workflows.

export const USER_ROLES = {
  resident: 'resident',
  admin: 'admin',
  superadmin: 'superadmin',
} as const;

export const ADMIN_ROLES = [
  USER_ROLES.admin,
  USER_ROLES.superadmin,
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const isAdminRole = (role?: string | null): role is AdminRole =>
  ADMIN_ROLES.includes(role as AdminRole);

export const isSuperadminRole = (role?: string | null) => role === USER_ROLES.superadmin;

export const ACCOUNT_STATUS = {
  approved: 'approved',
  pendingApproval: 'pending_approval',
  suspended: 'suspended',
  rejected: 'rejected',
} as const;

/** A profile is active only while approved; pending/suspended/rejected are deactivated. */
export const isApprovedStatus = (status?: string | null): boolean =>
  status === ACCOUNT_STATUS.approved;

export const APARTMENT_STATUS = {
  vacant: 'vacant',
  occupied: 'occupied',
  problem: 'problem',
  restricted: 'restricted',
} as const;

export const VEHICLE_APPROVAL_STATUS = {
  approved: 'approved',
  pendingApproval: 'pending_approval',
  rejected: 'rejected',
  archived: 'archived',
} as const;

export const AUTHORIZED_VEHICLE_APPROVAL_STATUSES = [
  VEHICLE_APPROVAL_STATUS.approved,
  VEHICLE_APPROVAL_STATUS.pendingApproval,
] as const;

export type AuthorizedVehicleApprovalStatus = (typeof AUTHORIZED_VEHICLE_APPROVAL_STATUSES)[number];

export const isAuthorizedVehicleApprovalStatus = (
  status?: string | null,
): status is AuthorizedVehicleApprovalStatus =>
  AUTHORIZED_VEHICLE_APPROVAL_STATUSES.includes(status as AuthorizedVehicleApprovalStatus);

export const PARKING_SPOT_STATUS = {
  available: 'available',
  temporary: 'temporary',
  assigned: 'assigned',
  occupied: 'occupied',
  blocked: 'blocked',
  maintenance: 'maintenance',
  conflict: 'conflict',
  reserved: 'reserved',
} as const;

// Mirrors the database parking-issue lifecycle (see ADMIN_ISSUES_CONFIG + the
// tx_update_parking_issue RPC): open -> in_progress -> resolved/closed.
export const PARKING_ISSUE_STATUS = {
  open: 'open',
  inProgress: 'in_progress',
  resolved: 'resolved',
  closed: 'closed',
} as const;

export const DISRUPTION_STATUS = {
  scheduled: 'scheduled',
  active: 'active',
  completed: 'completed',
  cancelled: 'cancelled',
} as const;

export const RELOCATION_STATUS = {
  active: 'active',
  returned: 'returned',
  needsPlacement: 'needs_placement',
  needsReview: 'needs_review',
} as const;

export const PARKING_ISSUE_TYPE = {
  unauthorizedVehicle: 'unauthorized_vehicle',
  wrongPlate: 'wrong_plate',
  blockedAccess: 'blocked_access',
  maintenance: 'maintenance',
  safety: 'safety',
  damaged: 'damaged',
  other: 'other',
} as const;

export const INVITATION_STATUS = {
  pending: 'pending',
  accepted: 'accepted',
  expired: 'expired',
  revoked: 'revoked',
} as const;

export const FILTER_ALL = 'ALL';
