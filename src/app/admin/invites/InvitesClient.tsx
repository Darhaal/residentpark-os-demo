// Title: Invitations Client
// Path: src/app/admin/invites/InvitesClient.tsx
// Functionality: Coordinates invitation workflow tabs, visible directory state, and shared feedback.

'use client';

import { useMemo, useState } from 'react';
import type { InvitationDirectoryRow } from '@/actions/invites';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { useFeedback } from '@/hooks/use-feedback';
import { InvitationImportPanel } from './InvitationImportPanel';
import { InvitationsDirectoryPanel } from './InvitationsDirectoryPanel';
import { InvitationsOverview } from './InvitationsOverview';
import type { InvitationsTab, InvitesClientProps } from './invites-types';
import { getInvitationStats } from './invites-view-model';

export function InvitesClient({ initialInvitations, initialHasMore }: InvitesClientProps) {
  const feedback = useFeedback();
  const [activeTab, setActiveTab] = useState<InvitationsTab>('import');
  const [invitations, setInvitations] = useState<InvitationDirectoryRow[]>(initialInvitations);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const stats = useMemo(() => getInvitationStats(invitations), [invitations]);
  const feedbackHandlers = {
    clearFeedback: feedback.clearFeedback,
    showError: feedback.showError,
    showToast: feedback.showToast,
  };

  return (
    <main className="flex-1 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6 lg:px-8">
      <FeedbackToasts
        successMsg={feedback.successMsg}
        errorMsg={feedback.errorMsg}
        onClear={feedback.clearFeedback}
      />

      <div className="mx-auto max-w-6xl space-y-5">
        <InvitationsOverview activeTab={activeTab} stats={stats} onTabChange={setActiveTab} />
        <InvitationImportPanel active={activeTab === 'import'} {...feedbackHandlers} />
        <InvitationsDirectoryPanel
          active={activeTab === 'directory'}
          invitations={invitations}
          setInvitations={setInvitations}
          hasMore={hasMore}
          setHasMore={setHasMore}
          {...feedbackHandlers}
        />
      </div>
    </main>
  );
}
