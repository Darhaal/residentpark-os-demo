// Title: Invitations View Model
// Path: src/app/admin/invites/invites-view-model.ts
// Functionality: Parses bulk input and maps invitation rows into stable UI labels, tones, and statistics.

import type { BulkInviteInput, InvitationDirectoryRow } from '@/actions/invites';
import { en } from '@/localization/en';
import type { InviteBadgeTone, InviteStatus, InvitationStats } from './invites-types';

const messages = en.invitations;

export interface ParsedBulkInvites {
  invites: BulkInviteInput[];
  failures: { email: string; reason: string }[];
}

export function parseBulkInviteInput(rawInput: string): ParsedBulkInvites {
  const invites: BulkInviteInput[] = [];
  const failures: { email: string; reason: string }[] = [];
  const lines = rawInput.split(/\r?\n/).filter((line) => line.trim().length > 0);

  lines.forEach((line, index) => {
    const parts = line.split(/[,\t]/).map((part) => part.trim());
    if (parts.length < 2) {
      failures.push({ email: messages.rowLabel(index + 1), reason: messages.missingColumns });
      return;
    }

    invites.push({ email: parts[0], apartmentNumber: parts[1], role: 'resident' });
  });

  return { invites, failures };
}

export function getInvitationStats(invitations: InvitationDirectoryRow[]): InvitationStats {
  return invitations.reduce<InvitationStats>((stats, invitation) => {
    stats.total += 1;
    if (invitation.status === 'pending') stats.pending += 1;
    else if (invitation.status === 'accepted') stats.accepted += 1;
    else stats.closed += 1;
    return stats;
  }, { total: 0, pending: 0, accepted: 0, closed: 0 });
}

export function inviteStatusVariant(status: InviteStatus): InviteBadgeTone {
  if (status === 'pending') return 'warning';
  if (status === 'accepted') return 'success';
  if (status === 'revoked') return 'destructive';
  return 'secondary';
}

export function deliveryVariant(status: InviteStatus): InviteBadgeTone {
  if (status === 'pending') return 'info';
  if (status === 'accepted') return 'success';
  if (status === 'revoked') return 'destructive';
  return 'warning';
}

export function getDeliveryLabel(status: InviteStatus) {
  if (status === 'pending') return messages.deliveryStatus.ready;
  if (status === 'accepted') return messages.deliveryStatus.completed;
  if (status === 'revoked') return messages.deliveryStatus.disabled;
  return messages.deliveryStatus.expired;
}

export function getDeliveryDescription(status: InviteStatus) {
  if (status === 'pending') return messages.deliveryDescriptions.pending;
  if (status === 'accepted') return messages.deliveryDescriptions.accepted;
  if (status === 'revoked') return messages.deliveryDescriptions.revoked;
  return messages.deliveryDescriptions.expired;
}

export function getConsumptionDescription(status: InviteStatus) {
  if (status === 'pending') return messages.consumptionDescriptions.pending;
  if (status === 'accepted') return messages.consumptionDescriptions.accepted;
  if (status === 'revoked') return messages.consumptionDescriptions.revoked;
  return messages.consumptionDescriptions.expired;
}
