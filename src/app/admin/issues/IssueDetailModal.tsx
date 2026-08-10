// Title: Issue Detail Modal
// Path: src/app/admin/issues/IssueDetailModal.tsx
// Functionality: Focused admin modal for inspecting a resident parking issue and updating its workflow status.

// Presentational issue-detail workflow. The parent owns selected issue state,
// mutation dispatch, router refresh, and toast feedback.

'use client';

import { CalendarCheck2, CheckCircle2, Clock, FileText, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { ADMIN_ISSUES_CONFIG } from '@/config/admin-clients';
import { formatDateTime } from '@/lib/dates';
import { en as locale } from '@/localization/en';
import type { ParkingIssueRow } from '@/actions/issues';
import type { ParkingIssueStatus } from '@/services/ParkingIssueService';

const messages = locale.adminIssues;
const issueConfig = ADMIN_ISSUES_CONFIG;
const issueStatuses = issueConfig.statuses;

type IssueStatusTone = 'warning' | 'info' | 'success' | 'secondary';

const statusVariant = (status: ParkingIssueStatus): IssueStatusTone => issueConfig.statusTones[status];
const statusLabel = (status: ParkingIssueStatus) => messages.statusLabels[status];
const isClosingStatus = (status: ParkingIssueStatus) =>
  status === issueStatuses.resolved || status === issueStatuses.closed;

const statusOptions: { value: ParkingIssueStatus; label: string }[] = issueConfig.statusOrder.map(value => ({
  value,
  label: messages.statusLabels[value],
}));

const selectClassName =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

interface IssueDetailModalProps {
  selected: ParkingIssueRow;
  targetStatus: ParkingIssueStatus;
  note: string;
  isPending: boolean;
  onClose: () => void;
  onStatusChange: (status: ParkingIssueStatus) => void;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
}

export function IssueDetailModal({
  selected,
  targetStatus,
  note,
  isPending,
  onClose,
  onStatusChange,
  onNoteChange,
  onSubmit,
}: IssueDetailModalProps) {
  const noteTooShort = isClosingStatus(targetStatus) && note.trim().length < issueConfig.resolutionNoteMinLength;
  const noteHelpId = noteTooShort ? 'issue-resolution-note-requirement' : undefined;
  const spotLocation = [selected.floor, selected.zone].filter(Boolean).join(' / ') || messages.unknown;
  const reporter = selected.reporter_name || selected.reporter_email || messages.residentFallback;
  const resolutionStatusLabel = statusLabel(targetStatus);

  return (
    <Modal onClose={onClose} label={messages.detailTitle} overlayClassName="z-[150]" className="max-w-2xl">
      <div className="flex max-h-[90vh] w-full animate-in flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-foreground">{messages.detailTitle}</h2>
              <Badge variant={statusVariant(selected.status)} className="text-xs font-medium">
                {statusLabel(selected.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {messages.spotPrefix} {selected.spot_number || messages.unknown} · {selected.issue_type}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={messages.closeAria}
            className="size-8 shrink-0 rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto bg-muted/20 p-5">
          <section className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <Meta label={messages.meta.reporter} value={reporter} />
            <Meta label={messages.meta.unit} value={selected.unit || messages.unknown} />
            <Meta label={messages.meta.violationPlate} value={selected.violating_plate || messages.notProvided} />
            <Meta label={messages.meta.spotStatus} value={selected.spot_status || messages.unknown} />
          </section>

          <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
              <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">{messages.reportTitle}</h3>
            </div>
            <div className="space-y-3 p-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{selected.comment || messages.noComment}</p>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <Meta label={messages.meta.location} value={spotLocation} />
                <Meta label={messages.meta.reportedAt} value={formatDateTime(selected.created_at)} />
                <Meta label={messages.meta.currentStatus} value={statusLabel(selected.status)} />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
              <CalendarCheck2 className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">{messages.lifecycleTitle}</h3>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              <LifecyclePoint label={messages.timeline.reported} value={formatDateTime(selected.created_at)} />
              <LifecyclePoint label={messages.timeline.current} value={statusLabel(selected.status)} />
              <LifecyclePoint
                label={messages.timeline.resolved}
                value={selected.resolved_at ? formatDateTime(selected.resolved_at) : messages.notProvided}
                detail={selected.resolver_name || undefined}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="issue-workflow-status">{messages.workflowStatus}</Label>
              <select
                id="issue-workflow-status"
                value={targetStatus}
                onChange={event => onStatusChange(event.target.value as ParkingIssueStatus)}
                className={selectClassName}
              >
                {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-resolution-note">{messages.resolutionNote}</Label>
              <Textarea
                id="issue-resolution-note"
                value={note}
                onChange={event => onNoteChange(event.target.value)}
                placeholder={messages.resolutionPlaceholder}
                className="min-h-28 bg-background"
                aria-invalid={noteTooShort}
                aria-describedby={noteHelpId}
              />
              {noteTooShort && (
                <p id="issue-resolution-note-requirement" className="text-xs font-medium text-destructive">
                  {messages.resolutionRequirement(issueConfig.resolutionNoteMinLength, resolutionStatusLabel)}
                </p>
              )}
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border bg-muted/20 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>{messages.cancel}</Button>
          <Button type="button" onClick={onSubmit} disabled={isPending || noteTooShort}>
            {isClosingStatus(targetStatus) ? <CheckCircle2 className="mr-2 size-4" aria-hidden="true" /> : <Clock className="mr-2 size-4" aria-hidden="true" />}
            {messages.saveStatus}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate font-semibold text-foreground">{value}</div>
    </div>
  );
}

function LifecyclePoint({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
      {detail && <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}
