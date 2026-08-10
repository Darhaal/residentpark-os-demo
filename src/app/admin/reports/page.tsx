// Title: Operational Reports
// Path: src/app/admin/reports/page.tsx
// Functionality: Server-loaded operational reports wrapper.

import { BarChart3 } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadReportsAction } from '@/actions/reports';
import { en } from '@/localization/en';
import { ReportsClient } from './ReportsClient';

export default async function ReportsPage() {
  const messages = en.adminReports;
  const res = await loadReportsAction();

  if (!res.success) {
    return (
      <PageErrorState
        navTitle={messages.pageTitle}
        icon={BarChart3}
        title={messages.unavailableTitle}
        description={res.error || messages.unavailableDescription}
      />
    );
  }

  return (
    <PageShell title={messages.pageTitle} currentUser={res.currentUser}>
      <ReportsClient data={res.data} />
    </PageShell>
  );
}
