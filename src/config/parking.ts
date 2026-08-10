// Title: Parking Configuration
// Path: src/config/parking.ts
// Functionality: Centralized configuration values and UI metadata for parking workflows.

import { PARKING_SPOT_STATUS } from '@/config/domain';

export type ParkingSpotState = 'available' | 'occupied' | 'blocked' | 'conflict' | 'reserved';

export const PARKING_ZONE_LABELS: Record<string, string> = {
  residential: 'Residential',
  valet: 'Valet',
  reserve: 'Reserve',
  visitor: 'Temporary Pool',
  guest: 'Temporary Pool',
} as const;

export const PARKING_LAYOUT = {
  spotsPerAisleSide: 4,
} as const;

export const PARKING_STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'conflict', label: 'Conflict' },
  { value: 'reserved', label: 'Reserved' },
] as const;

export const PARKING_MANUAL_STATUS_OPTIONS = [
  { value: PARKING_SPOT_STATUS.available, label: 'Available' },
  { value: PARKING_SPOT_STATUS.blocked, label: 'Blocked' },
  { value: PARKING_SPOT_STATUS.maintenance, label: 'Maintenance' },
  { value: PARKING_SPOT_STATUS.reserved, label: 'Reserved' },
] as const;

export const PARKING_ASSIGNABLE_STATUSES = [
  PARKING_SPOT_STATUS.available,
  PARKING_SPOT_STATUS.temporary,
] as const;

export const PARKING_ACTIVE_ASSIGNMENT_STATUSES = [
  PARKING_SPOT_STATUS.assigned,
  PARKING_SPOT_STATUS.occupied,
] as const;

type ParkingSpotStateUi = {
  label: string;
  tile: string;
  residentTile: string;
  badge: 'success' | 'secondary' | 'destructive' | 'warning' | 'info';
  dot: string;
};

export const PARKING_SPOT_STATE_UI: Record<ParkingSpotState, ParkingSpotStateUi> = {
  available: { label: 'Available', tile: 'border-success/40 bg-success/5 hover:bg-success/10 hover:border-success', residentTile: 'border-success/30 bg-success/5 text-success', badge: 'success', dot: 'bg-success' },
  occupied: { label: 'Occupied', tile: 'border-border bg-card hover:border-muted-foreground/40 hover:shadow-sm', residentTile: 'border-border bg-muted/60 text-muted-foreground', badge: 'secondary', dot: 'bg-muted-foreground' },
  blocked: { label: 'Blocked', tile: 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10', residentTile: 'border-destructive/30 bg-destructive/5 text-destructive', badge: 'destructive', dot: 'bg-destructive' },
  conflict: { label: 'Conflict', tile: 'border-warning/50 bg-warning/10 hover:bg-warning/15', residentTile: 'border-warning/40 bg-warning/10 text-warning', badge: 'warning', dot: 'bg-warning' },
  reserved: { label: 'Reserved', tile: 'border-info/40 bg-info/5 hover:bg-info/10', residentTile: 'border-info/30 bg-info/5 text-info', badge: 'info', dot: 'bg-info' },
};

export const parkingSpotStateOf = (status: string): ParkingSpotState => {
  if (status === PARKING_SPOT_STATUS.available || status === PARKING_SPOT_STATUS.temporary) return 'available';
  if (status === PARKING_SPOT_STATUS.assigned || status === PARKING_SPOT_STATUS.occupied) return 'occupied';
  if (status === PARKING_SPOT_STATUS.blocked || status === PARKING_SPOT_STATUS.maintenance) return 'blocked';
  if (status === PARKING_SPOT_STATUS.conflict) return 'conflict';
  return 'reserved';
};

export const parkingSpotStateCountsAsOccupied = (state: ParkingSpotState) =>
  state === 'occupied' || state === 'conflict';
