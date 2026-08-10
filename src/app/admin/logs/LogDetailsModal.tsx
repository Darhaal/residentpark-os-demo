// Title: Log Details Modal
// Path: src/app/admin/logs/LogDetailsModal.tsx
// Functionality: Modal workflow for audit log operations, validation, and feedback.

// Audit-log detail inspector: renders a deep old/new diff for one log entry.
// Presentational: receives the selected log and a close handler.

'use client';

import { ArrowRightCircle, Fingerprint, Network, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { en } from '@/localization/en';
import type { AuditLog } from '@/services/AuditService';
import { getDeepDiff } from './audit-logs-utils';

interface LogDetailsModalProps {
  log: AuditLog;
  onClose: () => void;
}

const diffValueClassName =
  'block max-w-full rounded-md border px-2 py-1 text-[13px] font-medium whitespace-pre-wrap break-words [overflow-wrap:anywhere]';
const diffColumnClassName = 'min-w-0 p-4';
const diffFieldClassName =
  'mb-1.5 min-w-0 font-mono text-[11px] font-medium text-muted-foreground break-words [overflow-wrap:anywhere]';

export function LogDetailsModal({ log, onClose }: LogDetailsModalProps) {
  const t = en.adminLogs;
  const diffs = getDeepDiff(log.old_data, log.new_data);

  return (
    <Modal onClose={onClose} label={t.eventDetailsTitle} overlayClassName="z-[150]" backdropClassName="bg-foreground/40" className="max-w-3xl">
      <div className="flex max-h-[85vh] w-full animate-in flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95 duration-200">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{t.eventDetailsTitle}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-[13px] text-muted-foreground">
                <Fingerprint className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{log.entity_type || t.entityFallback}:</span>
                <span className="min-w-0 truncate font-mono text-xs font-medium text-foreground">{log.entity_id || t.entityIdFallback}</span>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-[13px] text-muted-foreground">
                <Network className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{t.ipLabel}:</span>
                <span className="min-w-0 truncate font-mono text-xs font-medium text-foreground">{log.ip_address || t.ipFallback}</span>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 shrink-0 rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
            aria-label={en.common.closeDialog}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto bg-muted/20">
          <div className="sticky top-0 z-10 grid grid-cols-2 gap-px border-b border-border bg-border">
            <div className="bg-muted/30 p-3 text-xs font-semibold text-muted-foreground shadow-sm">{t.oldValueLabel}</div>
            <div className="bg-card p-3 text-xs font-semibold text-muted-foreground shadow-sm">{t.newValueLabel}</div>
          </div>
          <div className="divide-y divide-border bg-card">
            {diffs.length > 0 ? (
              diffs.map((diff, index) => (
                <div key={`${diff.field}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-0 transition-colors hover:bg-muted/20">
                  <div className={diffColumnClassName}>
                    <div className={diffFieldClassName}>{diff.field}</div>
                    <div className={`${diffValueClassName} border-destructive/20 bg-destructive/5 text-destructive line-through decoration-destructive/40`}>{diff.oldValue}</div>
                  </div>
                  <div className="z-10 -mx-3 flex items-center justify-center">
                    <ArrowRightCircle className="size-5 rounded-full bg-card text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className={`${diffColumnClassName} pl-6`}>
                    <div className={diffFieldClassName}>{diff.field}</div>
                    <div className={`${diffValueClassName} border-success/20 bg-success/5 text-success`}>{diff.newValue}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">{t.noDifferences}</div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
