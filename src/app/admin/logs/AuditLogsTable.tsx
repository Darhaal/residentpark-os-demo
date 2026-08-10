// Title: Audit Logs Table
// Path: src/app/admin/logs/AuditLogsTable.tsx
// Functionality: The audit log table — timestamp, actor, action type and summary with an
//   inspect action per row, plus the "load older records" footer. Presentational.

'use client';

import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { en } from '@/localization/en';
import type { AuditLog } from '@/services/AuditService';

interface AuditLogsTableProps {
  logs: AuditLog[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onInspect: (log: AuditLog) => void;
}

function formatUtc(value: string) {
  const d = new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function AuditLogsTable({ logs, hasMore, isLoadingMore, onLoadMore, onInspect }: AuditLogsTableProps) {
  const t = en.adminLogs;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="overflow-x-auto min-h-[400px]">
        <table className="min-w-[800px] w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="w-48 px-4 py-3">{t.colTimestamp}</th>
              <th className="w-64 px-4 py-3">{t.colActor}</th>
              <th className="w-48 px-4 py-3">{t.colActionType}</th>
              <th className="px-4 py-3">{t.colSummary}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map(log => {
              const actorName = log.admin_full_name || t.systemActor;
              const actorEmail = log.actor_email_snapshot || log.admin_email || t.unknownEmail;

              return (
                <tr key={log.id} className="group transition-colors hover:bg-muted/25">
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-xs text-muted-foreground">{formatUtc(log.created_at)}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-foreground">{actorName}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{actorEmail}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground">{log.action_type}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start justify-between gap-4">
                      <span className="max-w-sm truncate text-sm leading-relaxed text-muted-foreground">{log.description}</span>
                      <Button variant="outline" size="sm" onClick={() => onInspect(log)} className="shrink-0 bg-background font-medium">{t.inspectButton}</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-0">
                  <EmptyState icon={Database} title={t.noRecordsTitle} description={t.noRecordsDescription} className="rounded-none border-0 bg-transparent" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="flex justify-center border-t border-border bg-muted/20 p-3">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoadingMore} className="min-w-48 bg-background">
            {isLoadingMore ? <><Spinner className="size-4" /> {t.queryingDb}</> : <><Database className="size-4" aria-hidden="true" /> {t.loadOlderRecords}</>}
          </Button>
        </div>
      )}
    </div>
  );
}
