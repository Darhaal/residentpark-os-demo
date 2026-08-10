// Title: Disruptions Types
// Path: src/app/admin/disruptions/disruptions-types.ts
// Functionality: Shared TypeScript types for construction disruption screens, actions, and component contracts.

// Shared types and pure helpers for the admin Disruptions workflow.

import { ADMIN_DISRUPTIONS_CONFIG } from '@/config/admin-clients';
import { en } from '@/localization/en';

const messages = en.adminDisruptions;
const disruptionsConfig = ADMIN_DISRUPTIONS_CONFIG;
const disruptionStatuses = disruptionsConfig.statuses;

export type DisruptionStatus = (typeof disruptionStatuses)[keyof typeof disruptionStatuses];

export interface Disruption {
  id: string;
  title: string;
  reason: string;
  start_date: string;
  end_date: string;
  status: string;
  completed_at: string | null;
}

export interface Spot {
  id: string;
  spot_number: string;
  floor: string | null;
  zone: string | null;
  status: string;
  assigned_vehicle_id: string | null;
}

export interface Relocation {
  disruption_id: string;
  status: string;
}

export interface BlockedSpot {
  disruption_id: string;
  spot_id: string;
}

export const isDisruptionStatus = (status: string): status is DisruptionStatus =>
  Object.values(disruptionStatuses).includes(status as DisruptionStatus);

export const statusVariant = (status: string): 'info' | 'warning' | 'success' | 'secondary' =>
  isDisruptionStatus(status) ? disruptionsConfig.statusTones[status] : 'secondary';

export const formatStatus = (status: string) => isDisruptionStatus(status) ? messages.statusLabels[status] : status;

export const todayStr = new Date().toISOString().split('T')[0];

export function getMetaNumber(meta: unknown, key: string) {
  if (!meta || typeof meta !== 'object' || !(key in meta)) return 0;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : 0;
}

export function normalizeFloor(floor: string | null) {
  const f = floor || disruptionsConfig.defaults.floor;
  return disruptionsConfig.streetFloorValues.includes(f.toLowerCase() as (typeof disruptionsConfig.streetFloorValues)[number])
    ? messages.floorLabels.street
    : messages.floorLabels.floorAbbreviation(f);
}

export function normalizeZone(zone: string | null) {
  return zone || messages.floorLabels.generalZone;
}
