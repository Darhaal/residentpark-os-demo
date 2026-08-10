// Title: Invitations Workspace Types
// Path: src/app/admin/invites/invites-types.ts
// Functionality: Shared UI contracts for invitation import, directory, tabs, and feedback.

import type { InvitationDirectoryRow } from '@/actions/invites';

export type InvitationsTab = 'import' | 'directory';
export type InviteStatus = InvitationDirectoryRow['status'];
export type InviteBadgeTone = 'warning' | 'success' | 'secondary' | 'destructive' | 'info';

export interface InvitesClientProps {
  initialInvitations: InvitationDirectoryRow[];
  initialHasMore: boolean;
}

export interface InviteFeedbackHandlers {
  clearFeedback: () => void;
  showError: (message: string) => void;
  showToast: (message: string) => void;
}

export interface InvitationStats {
  total: number;
  pending: number;
  accepted: number;
  closed: number;
}
