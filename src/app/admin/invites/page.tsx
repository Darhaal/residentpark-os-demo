// Title: Invitations Manager
// Path: src/app/admin/invites/page.tsx
// Functionality: Server-loaded wrapper for invitation import and directory management.

import { UploadCloud } from 'lucide-react';
import { loadInvitesDirectoryAction } from '@/actions/invites';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { en } from '@/localization/en';
import { PAGE_LIMITS } from '@/config/limits';
import { InvitesClient } from './InvitesClient';

export default async function InvitesManagerPage() {
  const res = await loadInvitesDirectoryAction({ limit: PAGE_LIMITS.invitations });

  if (!res.success) {
    return (
      <PageErrorState
        navTitle={en.invitations.pageTitle}
        icon={UploadCloud}
        title={en.invitations.unavailableTitle}
        description={res.error || en.invitations.unavailableDescription}
      />
    );
  }

  return (
    <PageShell title={en.invitations.pageTitle} currentUser={res.currentUser}>
      <InvitesClient initialInvitations={res.invitations} initialHasMore={res.hasMore} />
    </PageShell>
  );
}
