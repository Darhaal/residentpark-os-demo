// Title: Parking Issue Domain Service
// Path: src/services/ParkingIssueService.ts
// Functionality: Typed adapter around parking issue RPCs with request validation and safe error mapping.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_ISSUES_CONFIG } from '@/config/admin-clients';
import { PARKING_ISSUE_TYPE } from '@/config/domain';
import { AppError, toDatabaseAppError } from '@/lib/errors';
import { validateUuid } from '@/lib/action-validation';
import { en } from '@/localization/en';

export type ParkingIssueStatus = (typeof ADMIN_ISSUES_CONFIG.statusOrder)[number];
export type ParkingIssueType = (typeof PARKING_ISSUE_TYPE)[keyof typeof PARKING_ISSUE_TYPE];

interface ReportIssueParams {
  spotId: string;
  issueType: string;
  violatingPlate: string;
  comment: string;
  actorId: string;
}

interface UpdateIssueStatusParams {
  issueId: string;
  status: ParkingIssueStatus;
  note: string;
  actorId: string;
}

const messages = en.adminIssues.actionErrors;
const residentParkingMessages = en.residentParkingMap;
const issueStatuses = ADMIN_ISSUES_CONFIG.statuses;
const issueTypeValues = Object.values(PARKING_ISSUE_TYPE) as ParkingIssueType[];

const nullableText = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export class ParkingIssueService {
  private static parseIssueType(value: string): ParkingIssueType {
    if (issueTypeValues.includes(value as ParkingIssueType)) return value as ParkingIssueType;
    throw new AppError('VALIDATION_ERROR', messages.invalidIssueType);
  }

  private static parseStatus(value: ParkingIssueStatus): ParkingIssueStatus {
    if ((ADMIN_ISSUES_CONFIG.statusOrder as readonly string[]).includes(value)) return value;
    throw new AppError('VALIDATION_ERROR', messages.invalidStatus);
  }

  static async reportIssue(supabase: SupabaseClient, params: ReportIssueParams): Promise<string> {
    const spotId = validateUuid(params.spotId, 'parking spot ID');
    const issueType = this.parseIssueType(params.issueType);

    const { data, error } = await supabase.rpc('tx_report_parking_issue', {
      p_spot_id: spotId,
      p_issue_type: issueType,
      p_violating_plate: nullableText(params.violatingPlate),
      p_comment: nullableText(params.comment),
      p_actor_id: params.actorId,
    });

    if (error) {
      throw toDatabaseAppError(error, {
        CONFLICT: residentParkingMessages.duplicateActiveIssue,
        INTERNAL_ERROR: messages.reportIssue,
      });
    }

    if (typeof data !== 'string' || !data) {
      throw new AppError('INTERNAL_ERROR', messages.reportIssue);
    }

    return data;
  }

  static async updateStatus(supabase: SupabaseClient, params: UpdateIssueStatusParams): Promise<void> {
    if (!params.issueId) throw new AppError('VALIDATION_ERROR', messages.issueIdRequired);
    const issueId = validateUuid(params.issueId, 'parking issue ID');
    const status = this.parseStatus(params.status);
    const note = params.note.trim();

    if (
      (status === issueStatuses.resolved || status === issueStatuses.closed) &&
      note.length < ADMIN_ISSUES_CONFIG.resolutionNoteMinLength
    ) {
      throw new AppError('VALIDATION_ERROR', messages.resolutionRequired);
    }

    const { error } = await supabase.rpc('tx_update_parking_issue', {
      p_issue_id: issueId,
      p_status: status,
      p_note: note || null,
      p_actor: params.actorId,
    });

    if (error) {
      throw toDatabaseAppError(error, { INTERNAL_ERROR: messages.updateIssue });
    }
  }
}
