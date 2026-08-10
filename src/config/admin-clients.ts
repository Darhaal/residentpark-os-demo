// Title: Admin Clients Configuration
// Path: src/config/admin-clients.ts
// Functionality: Centralized configuration values and UI metadata for application workflows.

import {
  ACCOUNT_STATUS,
  APARTMENT_STATUS,
  DISRUPTION_STATUS,
  FILTER_ALL,
  PARKING_SPOT_STATUS,
  RELOCATION_STATUS,
  USER_ROLES,
} from '@/config/domain';

export const ADMIN_VEHICLES_CONFIG = {
  defaultSort: {
    field: 'apartment',
    direction: 'asc',
  },
  processingIds: {
    addVehicle: 'add_vehicle',
    archive: 'archive',
  },
} as const;

export const ADMIN_APPROVALS_CONFIG = {
  tabs: {
    accounts: 'accounts',
    vehicles: 'vehicles',
  },
  processingIds: {
    submitVehicle: 'submit_vehicle',
    bulkAccount: 'bulk_account',
    bulkVehicle: 'bulk_vehicle',
    bulkPrefix: 'bulk_',
  },
  bulkAccountStatuses: {
    approved: ACCOUNT_STATUS.approved,
    rejected: ACCOUNT_STATUS.rejected,
  },
} as const;

export const ADMIN_USERS_CONFIG = {
  bulkIntents: {
    roleChange: 'role_change',
  },
  editableRoles: [
    USER_ROLES.resident,
    USER_ROLES.admin,
  ],
} as const;

export const ADMIN_APARTMENTS_CONFIG = {
  filters: {
    all: FILTER_ALL,
  },
  floorGrouping: {
    defaultFloor: '1',
    skippedFloor: '13',
    penthousePrefix: 'PH',
    penthouseLabel: 'PH',
    unitFloorDivisor: 100,
  },
  statusOptions: [
    APARTMENT_STATUS.vacant,
    APARTMENT_STATUS.occupied,
    APARTMENT_STATUS.problem,
    APARTMENT_STATUS.restricted,
  ],
  statusReasonMinLength: 3,
} as const;

export const ADMIN_ISSUES_CONFIG = {
  filters: {
    all: FILTER_ALL,
  },
  statuses: {
    open: 'open',
    inProgress: 'in_progress',
    resolved: 'resolved',
    closed: 'closed',
  },
  statusOrder: [
    'open',
    'in_progress',
    'resolved',
    'closed',
  ],
  defaultTargetStatus: 'in_progress',
  resolutionNoteMinLength: 3,
  statusTones: {
    open: 'warning',
    in_progress: 'info',
    resolved: 'success',
    closed: 'secondary',
  },
} as const;

export const ADMIN_NOTICES_CONFIG = {
  audiences: {
    all: 'all',
    apartment: 'apartment',
    profile: 'profile',
  },
  noticeTypes: [
    'announcement',
    'construction_notice',
    'temporary_relocation',
    'return_to_original_spot',
    'vehicle_approved',
    'vehicle_rejected',
    'spot_assigned',
    'issue_update',
  ],
  defaultNoticeType: 'announcement',
} as const;

export const ADMIN_DISRUPTIONS_CONFIG = {
  defaults: {
    floor: '1',
  },
  reasonMinLength: 3,
  statuses: DISRUPTION_STATUS,
  completableStatuses: [
    DISRUPTION_STATUS.active,
  ],
  pastStatuses: [
    DISRUPTION_STATUS.completed,
    DISRUPTION_STATUS.cancelled,
  ],
  relocationStatuses: RELOCATION_STATUS,
  blockableExcludedStatus: PARKING_SPOT_STATUS.blocked,
  streetFloorValues: [
    '0',
    'street',
  ],
  statusTones: {
    scheduled: 'info',
    active: 'warning',
    completed: 'success',
    cancelled: 'secondary',
  },
  metaKeys: {
    blocked: 'blocked',
    relocated: 'relocated',
    needsPlacement: 'needs_placement',
    returned: 'returned',
    needsReview: 'needs_review',
  },
} as const;
