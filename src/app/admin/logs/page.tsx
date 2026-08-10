// Title: Enterprise Event Logs
// Path: src/app/admin/logs/page.tsx
// Functionality: Server-loaded wrapper for superadmin audit logs.

import { Server } from 'lucide-react';
import { PageErrorState, PageShell } from '@/components/layout/PageShell';
import { loadAuditLogsAction } from '@/actions/audit';
import { en } from '@/localization/en';
import { AuditLogsClient } from './AuditLogsClient';

type SearchParams = Record<string, string | string[] | undefined>;

const getParam = (params: SearchParams, key: string) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
};

export default async function AuditLogsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const initialFilters = {
    search: getParam(params, 'search'),
    action: getParam(params, 'action') || 'ALL',
    from: getParam(params, 'from'),
    to: getParam(params, 'to'),
  };

  const res = await loadAuditLogsAction({
    limit: 500,
    search: initialFilters.search || null,
    actionFilter: initialFilters.action,
    dateFrom: initialFilters.from || null,
    dateTo: initialFilters.to || null,
  });

  const t = en.adminLogs;

  if (!res.success) {
    return (
      <PageErrorState
        navTitle={t.navTitle}
        icon={Server}
        title={t.unavailableTitle}
        description={res.error || t.unavailableDescription}
      />
    );
  }

  const clientKey = `${initialFilters.search}:${initialFilters.action}:${initialFilters.from}:${initialFilters.to}`;

  return (
    <PageShell title={t.navTitle} currentUser={res.currentUser}>
      <AuditLogsClient
        key={clientKey}
        initialLogs={res.logs}
        initialHasMore={res.hasMore}
        initialFilters={initialFilters}
      />
    </PageShell>
  );
}
