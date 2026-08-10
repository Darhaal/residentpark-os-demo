// Title: Parking Issues Client
// Path: src/app/admin/issues/IssuesClient.tsx
// Functionality: Filters and updates the admin parking issue queue.

'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, MapPin, Search, ShieldAlert, User, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { formatDateTime } from '@/lib/dates';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import {
  updateParkingIssueStatusAction,
  type ParkingIssueRow,
} from '@/actions/issues';
import type { ParkingIssueStatus } from '@/services/ParkingIssueService';
import { ADMIN_ISSUES_CONFIG } from '@/config/admin-clients';
import { en as locale } from '@/localization/en';
import { IssueDetailModal } from './IssueDetailModal';
import {
  ISSUE_TIME_FILTER_BASIS,
  ISSUE_TIME_FILTER_PRESET,
  issueMatchesTimeFilter,
  type IssueTimeFilterBasis,
  type IssueTimeFilterPreset,
  type IssueTimeFilterState,
} from './issue-time-filters';

type IssueFilterStatus = typeof ADMIN_ISSUES_CONFIG.filters.all | ParkingIssueStatus;
type IssueStatusTone = 'warning' | 'info' | 'success' | 'secondary';
type ActiveIssueCountBySpot = Map<string, number>;

const messages = locale.adminIssues;
const issueConfig = ADMIN_ISSUES_CONFIG;
const issueStatuses = issueConfig.statuses;
const selectClassName = 'h-9 rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';
const dateInputClassName = 'h-9 rounded-md border border-border bg-background px-2.5 text-sm font-medium text-foreground shadow-none outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

const statusVariant = (status: ParkingIssueStatus): IssueStatusTone => issueConfig.statusTones[status];

const statusLabel = (status: ParkingIssueStatus) => messages.statusLabels[status];

const statusOptions: { value: ParkingIssueStatus; label: string }[] = issueConfig.statusOrder.map(value => ({
  value,
  label: messages.statusLabels[value],
}));

const isClosingStatus = (status: ParkingIssueStatus) =>
  status === issueStatuses.resolved || status === issueStatuses.closed;

const timeBasisOptions: { value: IssueTimeFilterBasis; label: string }[] = [
  { value: ISSUE_TIME_FILTER_BASIS.reported, label: messages.timeFilters.basis.reported },
  { value: ISSUE_TIME_FILTER_BASIS.resolved, label: messages.timeFilters.basis.resolved },
];

const timePresetOptions: { value: IssueTimeFilterPreset; label: string }[] = [
  { value: ISSUE_TIME_FILTER_PRESET.all, label: messages.timeFilters.presets.all },
  { value: ISSUE_TIME_FILTER_PRESET.today, label: messages.timeFilters.presets.today },
  { value: ISSUE_TIME_FILTER_PRESET.last7Days, label: messages.timeFilters.presets.last7Days },
  { value: ISSUE_TIME_FILTER_PRESET.last30Days, label: messages.timeFilters.presets.last30Days },
  { value: ISSUE_TIME_FILTER_PRESET.custom, label: messages.timeFilters.presets.custom },
];

const defaultTimeFilter: IssueTimeFilterState = {
  basis: ISSUE_TIME_FILTER_BASIS.reported,
  preset: ISSUE_TIME_FILTER_PRESET.all,
  customFrom: '',
  customTo: '',
};

export function IssuesClient({ issues }: { issues: ParkingIssueRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ParkingIssueRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<IssueFilterStatus>(issueConfig.filters.all);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<IssueTimeFilterState>(defaultTimeFilter);
  const [targetStatus, setTargetStatus] = useState<ParkingIssueStatus>(issueConfig.defaultTargetStatus);
  const [note, setNote] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const next = Object.fromEntries(issueConfig.statusOrder.map(status => [status, 0])) as Record<ParkingIssueStatus, number>;
    issues.forEach(issue => {
      next[issue.status] += 1;
    });
    return next;
  }, [issues]);

  const activeIssueCountBySpot = useMemo(() => {
    const next: ActiveIssueCountBySpot = new Map();
    issues.forEach(issue => {
      if (!issue.spot_id || (issue.status !== issueStatuses.open && issue.status !== issueStatuses.inProgress)) return;
      next.set(issue.spot_id, (next.get(issue.spot_id) || 0) + 1);
    });
    return next;
  }, [issues]);

  const activeConflictCount = useMemo(() => (
    Array.from(activeIssueCountBySpot.values()).filter(count => count > 1).length
  ), [activeIssueCountBySpot]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    return issues.filter(issue => {
      if (statusFilter !== issueConfig.filters.all && issue.status !== statusFilter) return false;
      if (!issueMatchesTimeFilter(issue, timeFilter, now)) return false;
      if (!q) return true;
      return [
        issue.issue_type,
        issue.violating_plate,
        issue.comment,
        issue.spot_number,
        issue.reporter_name,
        issue.reporter_email,
        issue.unit,
      ].some(value => (value || '').toLowerCase().includes(q));
    });
  }, [issues, search, statusFilter, timeFilter]);

  const openEditor = (issue: ParkingIssueRow) => {
    setSelected(issue);
    setTargetStatus(issue.status === issueStatuses.open ? issueStatuses.inProgress : issue.status);
    setNote(issue.resolution_note || '');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const updateIssue = () => {
    if (!selected) return;
    startTransition(async () => {
      const res = await updateParkingIssueStatusAction(selected.id, targetStatus, note);
      if (!res.success) {
        setErrorMsg(res.error || messages.updateError);
        return;
      }
      setSuccessMsg(messages.updatedToast);
      setSelected(null);
      router.refresh();
    });
  };

  return (
    <main className="flex-1 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6 lg:px-8">
      <FeedbackToasts successMsg={successMsg} errorMsg={errorMsg} onClear={() => { setSuccessMsg(''); setErrorMsg(''); }} />

      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
              <ShieldAlert className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{messages.pageTitle}</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{messages.pageDescription}</p>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border shadow-sm lg:grid-cols-5" aria-label={messages.summaryAria}>
          <IssueMetric icon={AlertTriangle} label={messages.statusLabels.open} value={counts[issueStatuses.open]} tone="warning" />
          <IssueMetric icon={Clock} label={messages.statusLabels.in_progress} value={counts[issueStatuses.inProgress]} tone="info" />
          <IssueMetric icon={ShieldAlert} label={messages.summary.activeConflicts} value={activeConflictCount} tone={activeConflictCount ? 'warning' : undefined} />
          <IssueMetric icon={CheckCircle2} label={messages.statusLabels.resolved} value={counts[issueStatuses.resolved]} tone="success" />
          <IssueMetric icon={X} label={messages.statusLabels.closed} value={counts[issueStatuses.closed]} />
        </section>

        <section className="grid gap-3 rounded-md border border-border bg-card p-3 shadow-sm" aria-label={messages.filtersAria}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem]">
            <FilterField label={messages.searchLabel} htmlFor="issue-search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="issue-search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={messages.searchPlaceholder}
                  className="h-9 bg-background pl-9 shadow-none"
                  aria-label={messages.searchAria}
                />
              </div>
            </FilterField>
            <FilterField label={messages.statusFilterLabel} htmlFor="issue-status-filter">
              <select
                id="issue-status-filter"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as IssueFilterStatus)}
                className={`${selectClassName} w-full`}
                aria-label={messages.filterAria}
              >
                <option value={issueConfig.filters.all}>{messages.allStatuses}</option>
                {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FilterField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[13rem_13rem_10rem_10rem]">
            <FilterField label={messages.timeFilters.basisLabel} htmlFor="issue-time-basis">
              <select
                id="issue-time-basis"
                value={timeFilter.basis}
                onChange={e => setTimeFilter(prev => ({ ...prev, basis: e.target.value as IssueTimeFilterBasis }))}
                className={`${selectClassName} w-full`}
                aria-label={messages.timeFilters.basisAria}
              >
                {timeBasisOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FilterField>

            <FilterField label={messages.timeFilters.presetLabel} htmlFor="issue-time-preset">
              <select
                id="issue-time-preset"
                value={timeFilter.preset}
                onChange={e => setTimeFilter(prev => ({ ...prev, preset: e.target.value as IssueTimeFilterPreset }))}
                className={`${selectClassName} w-full`}
                aria-label={messages.timeFilters.presetAria}
              >
                {timePresetOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FilterField>

            {timeFilter.preset === ISSUE_TIME_FILTER_PRESET.custom && (
              <>
                <FilterField label={messages.timeFilters.customFromLabel} htmlFor="issue-time-from">
                  <input
                    id="issue-time-from"
                    type="date"
                    value={timeFilter.customFrom}
                    onChange={e => setTimeFilter(prev => ({ ...prev, customFrom: e.target.value }))}
                    className={`${dateInputClassName} w-full`}
                    aria-label={messages.timeFilters.customFromAria}
                  />
                </FilterField>
                <FilterField label={messages.timeFilters.customToLabel} htmlFor="issue-time-to">
                  <input
                    id="issue-time-to"
                    type="date"
                    value={timeFilter.customTo}
                    onChange={e => setTimeFilter(prev => ({ ...prev, customTo: e.target.value }))}
                    className={`${dateInputClassName} w-full`}
                    aria-label={messages.timeFilters.customToAria}
                  />
                </FilterField>
              </>
            )}
          </div>
        </section>

        {filtered.length === 0 ? (
          <EmptyState icon={AlertTriangle} title={messages.emptyTitle} description={messages.emptyDescription} className="rounded-md border-border bg-card" />
        ) : (
          <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
            <div className="divide-y divide-border">
              {filtered.map(issue => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  activeConflictCount={issue.spot_id ? activeIssueCountBySpot.get(issue.spot_id) || 0 : 0}
                  onOpen={() => openEditor(issue)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {selected && (
        <IssueDetailModal
          selected={selected}
          targetStatus={targetStatus}
          note={note}
          isPending={isPending}
          onClose={() => setSelected(null)}
          onStatusChange={setTargetStatus}
          onNoteChange={setNote}
          onSubmit={updateIssue}
        />
      )}
    </main>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function IssueMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: IssueStatusTone;
}) {
  const toneCls = tone === 'warning' ? 'text-warning' : tone === 'info' ? 'text-info' : tone === 'success' ? 'text-success' : 'text-foreground';

  return (
    <div className="flex min-h-[76px] items-center gap-3 bg-card p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div>
        <div className={`text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  activeConflictCount,
  onOpen,
}: {
  issue: ParkingIssueRow;
  activeConflictCount: number;
  onOpen: () => void;
}) {
  const hasActiveConflict = activeConflictCount > 1 && (issue.status === issueStatuses.open || issue.status === issueStatuses.inProgress);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full p-4 text-left transition-colors hover:bg-muted/25"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(issue.status)} className="text-xs font-medium">
              {statusLabel(issue.status)}
            </Badge>
            {hasActiveConflict && (
              <Badge variant="warning" className="text-xs font-medium">
                {messages.conflictBadge(activeConflictCount)}
              </Badge>
            )}
            <span className="font-semibold text-foreground">{issue.issue_type}</span>
            {issue.violating_plate && (
              <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                {issue.violating_plate}
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{issue.comment || messages.noResidentNote}</p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" /> {messages.spotPrefix} {issue.spot_number || messages.unknown}</span>
            <span className="flex items-center gap-1"><User className="size-3.5" aria-hidden="true" /> {issue.reporter_name || issue.reporter_email || messages.residentFallback}</span>
            {issue.unit && <span>{messages.unitPrefix} {issue.unit}</span>}
          </div>
        </div>
        <IssueTimeline issue={issue} />
      </div>
    </button>
  );
}

function IssueTimeline({ issue }: { issue: ParkingIssueRow }) {
  const isDone = isClosingStatus(issue.status);

  return (
    <div className="grid min-w-44 gap-1 text-xs text-muted-foreground lg:text-right">
      <div>
        <span className="font-medium text-foreground">{messages.timeline.reported}</span>
        <span className="block tabular-nums">{formatDateTime(issue.created_at)}</span>
      </div>
      <div>
        <span className="font-medium text-foreground">{isDone ? messages.timeline.resolved : messages.timeline.current}</span>
        <span className="block tabular-nums">{isDone && issue.resolved_at ? formatDateTime(issue.resolved_at) : statusLabel(issue.status)}</span>
      </div>
    </div>
  );
}
