// Title: Parking Issues Queue
// Path: src/app/admin/issues/page.tsx
// Functionality: Server-loaded admin queue for resident-reported parking issues.

import { AlertTriangle } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadAdminParkingIssuesAction } from '@/actions/issues';
import { en } from '@/localization/en';
import { IssuesClient } from './IssuesClient';

export default async function AdminIssuesPage() {
  const messages = en.adminIssues;
  const res = await loadAdminParkingIssuesAction();

  if (!res.success) {
    return <PageErrorState navTitle={messages.pageTitle} icon={AlertTriangle} title={messages.unavailableTitle} description={res.error || messages.unavailableDescription} />;
  }

  return (
    <PageShell title={messages.pageTitle} currentUser={res.currentUser}>
      <IssuesClient issues={res.issues} />
    </PageShell>
  );
}
