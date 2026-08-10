// Title: Reports Client
// Path: src/app/admin/reports/ReportsClient.tsx
// Functionality: Render report data and export CSV files.

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { BarChart3, Download, Car, Building, Gauge } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReportsData } from '@/actions/reports';
import { useFeedback } from '@/hooks/use-feedback';
import { en as locale } from '@/localization/en';
import { cn } from '@/lib/utils';
import { buildCSV } from './report-csv';

const messages = locale.adminReports;

function downloadCSV(filename: string, headers: readonly string[], rows: (string | number | null)[][]) {
  const content = buildCSV(headers, rows);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', url);
  anchor.setAttribute('download', filename);
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}

export function ReportsClient({ data }: { data: ReportsData }) {
  const { errorMsg, successMsg, showToast, clearFeedback } = useFeedback();
  const today = new Date().toISOString().split('T')[0];

  return (
    <main className="flex-1 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6 lg:px-8">
      <FeedbackToasts successMsg={successMsg} errorMsg={errorMsg} onClear={clearFeedback} />

      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
                <BarChart3 className="size-4 text-muted-foreground" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{messages.clientTitle}</h1>
                <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{messages.pageDescription}</p>
              </div>
            </div>
          </div>
          <div className="inline-flex h-8 w-fit items-center gap-2 rounded-md border border-border bg-card px-3 text-xs shadow-sm">
            <span className="text-muted-foreground">{messages.snapshotLabel}</span>
            <span className="font-medium tabular-nums text-foreground">{today}</span>
          </div>
        </header>

        <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm" aria-labelledby="reports-occupancy-title">
          <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Gauge className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 id="reports-occupancy-title" className="text-sm font-semibold text-foreground">
                  {messages.sections.occupancy}
                </h2>
              </div>
              <div className="h-2 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
                <div className="h-full rounded-sm bg-primary" style={{ width: `${data.occupancy.percent}%` }} />
              </div>
              <p className="max-w-3xl text-xs text-muted-foreground">{messages.occupancyNote}</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-4 py-3 sm:min-w-32 sm:text-right">
              <div className="text-3xl font-semibold tabular-nums text-foreground">{data.occupancy.percent}%</div>
              <div className="mt-0.5 text-xs font-medium text-muted-foreground">{messages.occupancyStats.occupied}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-6">
            <Stat label={messages.occupancyStats.total} value={data.occupancy.total} />
            <Stat label={messages.occupancyStats.available} value={data.occupancy.available} tone="success" />
            <Stat label={messages.occupancyStats.occupied} value={data.occupancy.occupied} />
            <Stat label={messages.occupancyStats.blocked} value={data.occupancy.blocked} tone="destructive" />
            <Stat label={messages.occupancyStats.conflict} value={data.occupancy.conflict} tone="warning" />
            <Stat label={messages.occupancyStats.reserved} value={data.occupancy.reserved} tone="info" />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat card label={messages.summaryStats.pendingAccounts} value={data.pendingAccounts} tone={data.pendingAccounts ? 'warning' : undefined} />
          <Stat card label={messages.summaryStats.pendingVehicles} value={data.pendingVehicles} tone={data.pendingVehicles ? 'warning' : undefined} />
          <Stat card label={messages.summaryStats.openIssues} value={data.openIssues} tone={data.openIssues ? 'destructive' : undefined} />
        </div>

        <ReportTable
          icon={Car}
          title={messages.sections.vehiclesWithoutSpot}
          count={data.vehiclesWithoutSpot.length}
          onExport={() => downloadCSV(
            messages.csv.vehiclesWithoutSpotFilename(today),
            messages.csv.vehiclesWithoutSpotHeaders,
            data.vehiclesWithoutSpot.map(vehicle => [vehicle.plate_number, vehicle.make, vehicle.model || '', vehicle.unit || '', vehicle.owner || ''])
          )}
          head={messages.tables.vehiclesWithoutSpotHead}
          rows={data.vehiclesWithoutSpot.map(vehicle => [
            <span key="p" className="font-mono font-bold">{vehicle.plate_number}</span>,
            `${vehicle.make} ${vehicle.model || ''}`.trim(),
            vehicle.unit || messages.empty.value,
            vehicle.owner || messages.empty.value,
          ])}
          emptyText={messages.empty.vehiclesWithoutSpot}
          showToast={showToast}
        />

        <ReportTable
          icon={Building}
          title={messages.sections.unitsWithoutVehicle}
          count={data.unitsWithoutVehicle.length}
          onExport={() => downloadCSV(
            messages.csv.unitsWithoutVehicleFilename(today),
            messages.csv.unitsWithoutVehicleHeaders,
            data.unitsWithoutVehicle.map(unit => [unit.apartment_number, unit.status, unit.residents])
          )}
          head={messages.tables.unitsWithoutVehicleHead}
          rows={data.unitsWithoutVehicle.map(unit => [
            <span key="u" className="font-semibold">{messages.unitPrefix} {unit.apartment_number}</span>,
            <Badge key="s" variant="secondary" className="uppercase text-[10px]">{unit.status}</Badge>,
            unit.residents,
          ])}
          emptyText={messages.empty.unitsWithoutVehicle}
          showToast={showToast}
        />
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  card,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'destructive' | 'warning' | 'info';
  card?: boolean;
}) {
  const toneCls = tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : tone === 'info' ? 'text-info' : 'text-foreground';

  return (
    <div className={cn('min-h-[72px] bg-card p-3', card && 'min-h-[96px] rounded-md border border-border p-4 shadow-sm')}>
      <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function ReportTable({ icon: Icon, title, count, onExport, head, rows, emptyText, showToast }: {
  icon: LucideIcon;
  title: string;
  count: number;
  onExport: () => void;
  head: readonly string[];
  rows: React.ReactNode[][];
  emptyText: string;
  showToast: (message: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
            {title}
          </h2>
          <Badge variant="secondary" className="shrink-0 tabular-nums">{count}</Badge>
        </div>
        <Button variant="outline" size="sm" disabled={count === 0} onClick={() => { onExport(); showToast(messages.csv.downloadedToast); }} className="w-full font-medium sm:w-auto">
          <Download className="size-4" aria-hidden="true" /> {messages.csv.label}
        </Button>
      </div>
      {count === 0 ? (
        <EmptyState icon={Icon} title={messages.empty.title} description={emptyText} className="rounded-none border-0 bg-transparent" />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
              <tr>{head.map(heading => <th key={heading} className="px-4 py-2.5 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="transition-colors hover:bg-muted/25">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 align-middle text-foreground">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
