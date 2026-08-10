// Title: Audit Logs Header
// Path: src/app/admin/logs/AuditLogsHeader.tsx
// Functionality: Page title with the live/history stream indicator plus the add-note,
//   sync and export-CSV actions for the superadmin audit log.

'use client';

import { Download, PlusCircle, Radio, RefreshCcw, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { en } from '@/localization/en';

interface AuditLogsHeaderProps {
  displayLiveActive: boolean;
  isRefreshing: boolean;
  isExporting: boolean;
  onAddNote: () => void;
  onSync: () => void;
  onExport: () => void;
}

export function AuditLogsHeader({
  displayLiveActive,
  isRefreshing,
  isExporting,
  onAddNote,
  onSync,
  onExport,
}: AuditLogsHeaderProps) {
  const t = en.adminLogs;

  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
          <Server className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{t.pageTitle}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {t.pageDescription}
            {displayLiveActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                {t.live}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Radio className="size-3" aria-hidden="true" /> {t.history}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button variant="outline" size="sm" onClick={onAddNote} className="w-full font-medium text-info hover:bg-info/10 sm:w-auto">
          <PlusCircle className="size-4" aria-hidden="true" /> {t.addNote}
        </Button>
        <Button variant="outline" size="sm" onClick={onSync} disabled={isRefreshing || isExporting} className="w-full bg-background font-medium sm:w-auto">
          <RefreshCcw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> {t.sync}
        </Button>
        <Button variant="default" size="sm" onClick={onExport} disabled={isExporting} className="w-full font-medium sm:w-auto">
          {isExporting ? <Spinner className="size-4 text-current" /> : <Download className="size-4" aria-hidden="true" />}
          {isExporting ? t.exporting : t.exportCsv}
        </Button>
      </div>
    </header>
  );
}
