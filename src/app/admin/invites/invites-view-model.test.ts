// Title: Invitations View Model Test
// Path: src/app/admin/invites/invites-view-model.test.ts
// Functionality: Unit coverage for bulk parsing, visible statistics, and status presentation.

import { describe, expect, it } from 'vitest';
import type { InvitationDirectoryRow } from '@/actions/invites';
import {
  deliveryVariant,
  getDeliveryLabel,
  getInvitationStats,
  inviteStatusVariant,
  parseBulkInviteInput,
} from './invites-view-model';

function invitation(status: InvitationDirectoryRow['status']): InvitationDirectoryRow {
  return {
    id: `${status}-id`,
    email: `${status}@example.com`,
    role: 'resident',
    status,
    created_at: '2026-06-26T10:00:00.000Z',
    expires_at: '2026-07-03T10:00:00.000Z',
    token: `${status}-token`,
    apartments: { apartment_number: '101' },
  };
}

describe('invitations view model', () => {
  it('parses comma and tab rows while reporting malformed lines', () => {
    const result = parseBulkInviteInput([
      'erin@example.com, 101',
      'sam@example.com\t202',
      'missing-unit@example.com',
    ].join('\r\n'));

    expect(result.invites).toEqual([
      { email: 'erin@example.com', apartmentNumber: '101', role: 'resident' },
      { email: 'sam@example.com', apartmentNumber: '202', role: 'resident' },
    ]);
    expect(result.failures).toEqual([{ email: 'Row 3', reason: 'Missing columns' }]);
  });

  it('counts pending, accepted, and closed visible records', () => {
    expect(getInvitationStats([
      invitation('pending'),
      invitation('accepted'),
      invitation('expired'),
      invitation('revoked'),
    ])).toEqual({ total: 4, pending: 1, accepted: 1, closed: 2 });
  });

  it('maps status and delivery presentation consistently', () => {
    expect(inviteStatusVariant('revoked')).toBe('destructive');
    expect(deliveryVariant('pending')).toBe('info');
    expect(getDeliveryLabel('accepted')).toBe('Accepted');
  });
});
