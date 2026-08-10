// Title: Domain Contracts & State Machine
// Path: src/domain/contracts.ts
// Functionality: 100% Strictly Typed Event Contracts (Zero 'any').

import { AppError } from '@/lib/errors';

export type EventDomain = 'identity' | 'property' | 'vehicle' | 'system';
export type WorkflowStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type EventSeverity = 'info' | 'warning' | 'critical';

export class WorkflowStateMachine {
  private static allowedTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
    open: ['in_progress', 'resolved', 'closed'],
    in_progress: ['resolved', 'closed'],
    resolved: ['closed', 'open'],
    closed: ['open']
  };

  static validate(current: WorkflowStatus, next: WorkflowStatus): void {
    if (!this.allowedTransitions[current].includes(next)) {
      throw new AppError('RULE_VIOLATION', `Strict Machine: Invalid workflow transition from [${current}] to [${next}]`);
    }
  }
}

export interface BasePayload { operation_type?: 'manual' | 'bulk' | 'system'; }

// --- IDENTITY & SYSTEM CONTRACTS ---
export interface AccountStatusChangedPayload extends BasePayload { target_email: string; target_name: string | null; old_status: string; new_status: string; reason: string; }
export interface IncidentResolvedPayload extends BasePayload { resolution_note: string; resolved_at: string; resolved_by: string; time_to_resolution_ms?: number; }
export interface IncidentReportedPayload extends BasePayload { content: string; }
export interface SystemSettingsChangedPayload extends BasePayload { content: string; apartment_number: string; old_admin_id: string | null; new_admin_id: string | null; }
export interface UserInvitedPayload extends BasePayload { email: string; apartment_number: string; }
export interface UpdatePermissionsPayload extends BasePayload { target_email: string; old_data: Record<string, unknown>; new_data: Record<string, unknown>; }
export interface ApartmentLinkedPayload extends BasePayload { apartment_number: string; profile_id: string; }
export interface InvitationUpdatedPayload extends BasePayload { email: string; old_status: string; new_status: string; }
export interface AuditLogExportedPayload extends BasePayload { export_format: string; records_count: number; query_params: Record<string, unknown>; }

// --- PARKING & VEHICLE CONTRACTS ---
export interface VehicleSubmittedPayload extends BasePayload {
  plate_number: string;
  make: string;
  model: string | null;
  owner_id: string | null;
}

export interface VehicleStatusChangedPayload extends BasePayload { plate_number: string; old_status: string; new_status: string; reason?: string; }
export interface VehicleRemovedPayload extends BasePayload { plate_number: string; reason: string; }
export interface ParkingAssignedPayload extends BasePayload { spot_number: string; apartment_number: string; plate_number: string | null; assignment_type: string; starts_at: string; ends_at: string | null; }
export interface ParkingRevokedPayload extends BasePayload { spot_number: string; previous_apartment_id: string; reason: string; }
export interface ParkingTransferredPayload extends BasePayload { spot_from: string; spot_to: string; apartment_number: string; plate_number: string | null; reason: string; }
export interface ParkingSpotUpdatedPayload extends BasePayload { spot_number: string; old_status: string; new_status: string; reason: string; }
export interface ParkingSpotBlockedPayload extends BasePayload { spot_number: string; reason: string; blocked_until: string | null; }
export interface ParkingIssueReportedPayload extends BasePayload { spot_number: string; issue_type: string; violating_plate: string | null; comment: string; }

export interface EventPayloadMap {
  'ACCOUNT_STATUS_CHANGED': AccountStatusChangedPayload;
  'INCIDENT_RESOLVED': IncidentResolvedPayload;
  'NOTE_ADDED': IncidentReportedPayload;
  'INCIDENT_REPORTED': IncidentReportedPayload;
  'SYSTEM_SETTINGS_CHANGED': SystemSettingsChangedPayload;
  'USER_INVITED': UserInvitedPayload;
  'UPDATE_PERMISSIONS': UpdatePermissionsPayload;
  'APARTMENT_LINKED': ApartmentLinkedPayload;
  'INVITATION_UPDATED': InvitationUpdatedPayload;
  'AUDIT_LOG_EXPORTED': AuditLogExportedPayload;

  // Strict Parking
  'VEHICLE_SUBMITTED': VehicleSubmittedPayload;
  'VEHICLE_STATUS_CHANGED': VehicleStatusChangedPayload;
  'VEHICLE_ADDED_BY_ADMIN': VehicleSubmittedPayload;
  'VEHICLE_REMOVED': VehicleRemovedPayload;
  'PARKING_SPOT_CREATED': ParkingSpotUpdatedPayload;
  'PARKING_SPOT_UPDATED': ParkingSpotUpdatedPayload;
  'PARKING_ASSIGNED': ParkingAssignedPayload;
  'PARKING_REVOKED': ParkingRevokedPayload;
  'PARKING_TRANSFERRED': ParkingTransferredPayload; // NEW
  'PARKING_SPOT_BLOCKED': ParkingSpotBlockedPayload;
  'PARKING_SPOT_UNBLOCKED': ParkingSpotUpdatedPayload;
  'PARKING_ISSUE_REPORTED': ParkingIssueReportedPayload;
}

export type ExtractPayload<T extends keyof EventPayloadMap> = EventPayloadMap[T];