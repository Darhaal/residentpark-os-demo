// Title: Audit Logs Client
// Path: src/app/admin/logs/AuditLogsClient.tsx
// Functionality: Composition root for the superadmin audit log. State, realtime
//   streaming and exports live in useAuditLogs; this file wires the header, filters,
//   table and the create-note / inspect modals together.

'use client';

import { AlertCircle, CheckCircle2, Database, Filter, Radio } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { en } from '@/localization/en';
import { CreateManualLogModal } from './CreateManualLogModal';
import { LogDetailsModal } from './LogDetailsModal';
import { AuditLogsHeader } from './AuditLogsHeader';
import { AuditLogsFilters } from './AuditLogsFilters';
import { AuditLogsTable } from './AuditLogsTable';
import { useAuditLogs, type AuditLogsClientProps } from './use-audit-logs';

export function AuditLogsClient(props: AuditLogsClientProps) {
  const t = en.adminLogs;
  const m = useAuditLogs(props);
  const activeFilterCount = [
    m.searchQuery.trim(),
    m.filterAction !== 'ALL' ? m.filterAction : '',
    m.dateFrom,
    m.dateTo,
  ].filter(Boolean).length;

  return (
    <main className="relative flex-1 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6 lg:px-8">
      {m.successMessage && (
        <div className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background shadow-xl animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
          {m.successMessage}
        </div>
      )}

      <div className="mx-auto max-w-6xl space-y-5">
        <AuditLogsHeader
          displayLiveActive={m.displayLiveActive}
          isRefreshing={m.isRefreshing}
          isExporting={m.isExporting}
          onAddNote={() => m.setIsCreateModalOpen(true)}
          onSync={() => m.fetchLogs(true)}
          onExport={m.handleExportFullCSV}
        />

        <section className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border shadow-sm sm:grid-cols-3" aria-label={t.summaryAria}>
          <AuditMetric icon={Database} label={t.summary.loaded} value={m.logs.length} />
          <AuditMetric icon={Radio} label={t.summary.streamMode} value={m.displayLiveActive ? t.live : t.history} />
          <AuditMetric icon={Filter} label={t.summary.activeFilters} value={activeFilterCount} />
        </section>

        {m.error && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-destructive">{t.errorTitle}</h3>
              <p className="text-sm text-destructive/90 mt-1">{m.error}</p>
            </div>
          </div>
        )}

        <AuditLogsFilters
          searchQuery={m.searchQuery}
          setSearchQuery={m.setSearchQuery}
          filterAction={m.filterAction}
          setFilterAction={m.setFilterAction}
          dateFrom={m.dateFrom}
          setDateFrom={m.setDateFrom}
          dateTo={m.dateTo}
          setDateTo={m.setDateTo}
        />

        <AuditLogsTable
          logs={m.logs}
          hasMore={m.hasMore}
          isLoadingMore={m.isLoadingMore}
          onLoadMore={m.handleLoadMore}
          onInspect={m.setSelectedLog}
        />
      </div>

      {m.isCreateModalOpen && (
        <CreateManualLogModal
          draft={m.newLog}
          setDraft={m.setNewLog}
          isCreating={m.isCreatingLog}
          onClose={() => m.setIsCreateModalOpen(false)}
          onSubmit={m.handleCreateManualLog}
        />
      )}

      {m.selectedLog && <LogDetailsModal log={m.selectedLog} onClose={() => m.setSelectedLog(null)} />}
    </main>
  );
}

function AuditMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  const valueClass = typeof value === 'number' ? 'text-2xl' : 'text-lg';

  return (
    <div className="flex min-h-[76px] items-center gap-3 bg-card p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div>
        <div className={`${valueClass} font-semibold tabular-nums text-foreground`}>{value}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
