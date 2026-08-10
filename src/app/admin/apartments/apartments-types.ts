// Title: Apartments Types
// Path: src/app/admin/apartments/apartments-types.ts
// Functionality: Shared TypeScript types for apartment and occupancy screens, actions, and component contracts.

// Shared types and pure helpers for the admin Apartments directory.

import { ADMIN_APARTMENTS_CONFIG } from '@/config/admin-clients';
import { APARTMENT_STATUS } from '@/config/domain';
import { approvalStatusBadgeVariant } from '@/config/status-ui';
import { en } from '@/localization/en';

export type ApartmentStatus = (typeof APARTMENT_STATUS)[keyof typeof APARTMENT_STATUS];
export type ApprovalStatus = string;

export interface ApartmentListItem {
  id: string;
  apartment_number: string;
  status: ApartmentStatus;
  profiles?: { count: number | null }[] | null;
  vehicles?: { count: number | null }[] | null;
}

export interface ResidentProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  approval_status: ApprovalStatus | null;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  make: string | null;
  color: string | null;
  approval_status: ApprovalStatus | null;
}

export interface TimelineEvent {
  id: string;
  created_at: string;
  content: string | null;
  author_name: string | null;
  author_role: string | null;
}

export interface ParkingSpot {
  id: string;
  spot_number?: string | null;
  status?: string | null;
}

export interface ActiveIncident {
  id?: string;
  entity_id?: string | null;
  workflow_status?: string | null;
  content?: string | null;
}

export interface ApartmentDetails {
  id: string;
  apartment_number: string;
  status: ApartmentStatus;
  profiles?: ResidentProfile[] | null;
  vehicles?: Vehicle[] | null;
  timeline?: TimelineEvent[] | null;
  parking_spots?: ParkingSpot[] | null;
  active_incidents?: ActiveIncident[] | null;
}

const messages = en.adminApartments;
const floorConfig = ADMIN_APARTMENTS_CONFIG.floorGrouping;
export const APARTMENT_STATUSES = ADMIN_APARTMENTS_CONFIG.statusOptions;

export const getErrorMessage = (error: unknown, fallback: string = messages.unexpectedError) => {
  if (error instanceof Error) return error.message;
  return fallback;
};

export const getCount = (items: { count: number | null }[] | null | undefined) => items?.[0]?.count || 0;

export const getStatusColorClass = (status: string) => {
  switch (status) {
    case APARTMENT_STATUS.occupied: return 'bg-success';
    case APARTMENT_STATUS.vacant: return 'bg-muted-foreground/30';
    case APARTMENT_STATUS.problem: return 'bg-destructive';
    case APARTMENT_STATUS.restricted: return 'bg-warning';
    default: return 'bg-muted';
  }
};

export const getStatusBorderClass = (status: string) => {
  switch (status) {
    case APARTMENT_STATUS.problem: return 'border-destructive/20 hover:border-destructive/40';
    case APARTMENT_STATUS.restricted: return 'border-warning/30 hover:border-warning/50';
    default: return 'border-border hover:border-muted-foreground/40';
  }
};

export const aptStatusVariant = (status: string): 'success' | 'secondary' | 'warning' | 'destructive' =>
  status === APARTMENT_STATUS.occupied ? 'success' : status === APARTMENT_STATUS.restricted ? 'warning' : status === APARTMENT_STATUS.problem ? 'destructive' : 'secondary';

export const approvalVariant = (status: string | null | undefined): 'success' | 'warning' | 'destructive' | 'secondary' =>
  status ? approvalStatusBadgeVariant(status) : 'secondary';

export const groupByFloor = (apartments: ApartmentListItem[]) => {
  const floors: Record<string, ApartmentListItem[]> = {};
  for (const apt of apartments) {
    let floorLabel: string = floorConfig.defaultFloor;
    if (apt.apartment_number.toUpperCase().startsWith(floorConfig.penthousePrefix)) {
      floorLabel = floorConfig.penthouseLabel;
    } else {
      const numMatch = apt.apartment_number.match(/\d+/);
      if (numMatch) {
        const num = Number.parseInt(numMatch[0], 10);
        floorLabel = num >= floorConfig.unitFloorDivisor
          ? Math.floor(num / floorConfig.unitFloorDivisor).toString()
          : floorConfig.defaultFloor;
      }
    }
    if (floorLabel === floorConfig.skippedFloor) continue;
    (floors[floorLabel] ||= []).push(apt);
  }

  return Object.entries(floors).sort((a, b) => {
    if (a[0] === floorConfig.penthouseLabel) return -1;
    if (b[0] === floorConfig.penthouseLabel) return 1;
    return Number.parseInt(b[0], 10) - Number.parseInt(a[0], 10);
  });
};

export const sortApartments = (apartments: ApartmentListItem[]) =>
  [...apartments].sort((a, b) => a.apartment_number.localeCompare(b.apartment_number, undefined, { numeric: true }));
