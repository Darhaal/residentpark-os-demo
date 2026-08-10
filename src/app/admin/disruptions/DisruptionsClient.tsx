// Title: Disruptions Client
// Path: src/app/admin/disruptions/DisruptionsClient.tsx
// Functionality: Create, schedule, activate, cancel, and complete construction disruptions.
// Selection: Shift+click range, Ctrl+click toggle (Explorer-style). Zone and floor quick-select.

'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { AlertTriangle, Construction, Plus, Calendar, ArrowRight, CheckCircle2, Play, Ban, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  loadDisruptionsAction,
  createDisruptionAction,
  updateDisruptionAction,
  completeDisruptionAction,
  activateDisruptionAction,
  cancelDisruptionAction,
} from '@/actions/disruptions';
import { ADMIN_DISRUPTIONS_CONFIG } from '@/config/admin-clients';
import { useFeedback } from '@/hooks/use-feedback';
import { en as locale } from '@/localization/en';
import { CreateDisruptionModal } from './CreateDisruptionModal';
import {
  formatStatus,
  getMetaNumber,
  normalizeZone,
  statusVariant,
  todayStr,
  type BlockedSpot,
  type Disruption,
  type Relocation,
  type Spot,
} from './disruptions-types';

export type { Disruption, Spot, Relocation, BlockedSpot } from './disruptions-types';

const messages = locale.adminDisruptions;
const disruptionsConfig = ADMIN_DISRUPTIONS_CONFIG;
const relocationStatuses = disruptionsConfig.relocationStatuses;

interface DisruptionsClientProps {
  initialDisruptions: Disruption[];
  initialRelocations: Relocation[];
  initialBlockedSpots: BlockedSpot[];
  initialSpots: Spot[];
}

export function DisruptionsClient({ initialDisruptions, initialRelocations, initialBlockedSpots, initialSpots }: DisruptionsClientProps) {
  const { errorMsg, successMsg, showToast, showError, clearFeedback } = useFeedback();
  const [disruptions, setDisruptions] = useState<Disruption[]>(initialDisruptions);
  const [relocations, setRelocations] = useState<Relocation[]>(initialRelocations);
  const [blockedSpots, setBlockedSpots] = useState<BlockedSpot[]>(initialBlockedSpots);
  const [spots, setSpots] = useState<Spot[]>(initialSpots);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activeFloor, setActiveFloor] = useState(initialSpots[0]?.floor || disruptionsConfig.defaults.floor);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchorIdx, setAnchorIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const refreshDisruptions = async () => {
    clearFeedback();
    const res = await loadDisruptionsAction();
    if (!res.success) { showError(res.error || messages.loadError); return false; }
    const nextSpots = (res.spots || []) as Spot[];
    setDisruptions(res.disruptions as Disruption[]);
    setRelocations((res.relocations || []) as Relocation[]);
    setBlockedSpots((res.blockedSpots || []) as BlockedSpot[]);
    setSpots(nextSpots);
    setActiveFloor(prev => prev || nextSpots[0]?.floor || disruptionsConfig.defaults.floor);
    return true;
  };

  const floors = useMemo(() =>
    Array.from(new Set(spots.map(s => s.floor || disruptionsConfig.defaults.floor))).sort()
  , [spots]);

  const blockableOnFloor = useMemo(() =>
    spots.filter(s => (s.floor || disruptionsConfig.defaults.floor) === activeFloor && s.status !== disruptionsConfig.blockableExcludedStatus)
  , [spots, activeFloor]);

  const zonesOnFloor = useMemo(() =>
    Array.from(new Set(blockableOnFloor.map(s => normalizeZone(s.zone)))).sort()
  , [blockableOnFloor]);

  const selectedOccupied = useMemo(() =>
    spots.filter(s => selected.has(s.id) && s.assigned_vehicle_id).length
  , [spots, selected]);

  const past = useMemo(() =>
    disruptions.filter(d => disruptionsConfig.pastStatuses.includes(d.status as (typeof disruptionsConfig.pastStatuses)[number]))
  , [disruptions]);

  const counts = (id: string) => ({
    blocked: blockedSpots.filter(b => b.disruption_id === id).length,
    active: relocations.filter(r => r.disruption_id === id && r.status === relocationStatuses.active).length,
    needs: relocations.filter(r => r.disruption_id === id && r.status === relocationStatuses.needsPlacement).length,
    review: relocations.filter(r => r.disruption_id === id && r.status === relocationStatuses.needsReview).length,
  });

  const needsReview = (id: string) => counts(id).review > 0;
  const scheduledDisruptions = disruptions.filter(d => d.status === disruptionsConfig.statuses.scheduled && !needsReview(d.id));
  const activeDisruptions = disruptions.filter(d => d.status === disruptionsConfig.statuses.active && !needsReview(d.id));
  const reviewNeededDisruptions = disruptions.filter(d => needsReview(d.id));
  const completedDisruptions = past.filter(d => !needsReview(d.id));

  const resetForm = () => {
    setEditingId(null);
    setTitle(''); setReason('');
    setStartDate(todayStr); setEndDate(todayStr);
    setSelected(new Set()); setAnchorIdx(null);
  };

  // Explorer-style selection: click = toggle, Shift+click = extend range, Ctrl+click = toggle
  const handleSpotClick = (id: string, idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const next = new Set(selected);
    if (e.shiftKey && anchorIdx !== null) {
      const lo = Math.min(anchorIdx, idx);
      const hi = Math.max(anchorIdx, idx);
      for (let i = lo; i <= hi; i++) next.add(blockableOnFloor[i].id);
    } else {
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setAnchorIdx(idx);
    }
    setSelected(next);
  };

  const toggleZone = (zone: string) => {
    const zoneSpots = blockableOnFloor.filter(s => normalizeZone(s.zone) === zone);
    const next = new Set(selected);
    const allOn = zoneSpots.length > 0 && zoneSpots.every(s => next.has(s.id));
    for (const s of zoneSpots) { if (allOn) next.delete(s.id); else next.add(s.id); }
    setSelected(next);
    setAnchorIdx(null);
  };

  const toggleFloor = () => {
    const next = new Set(selected);
    const allOn = blockableOnFloor.length > 0 && blockableOnFloor.every(s => next.has(s.id));
    for (const s of blockableOnFloor) { if (allOn) next.delete(s.id); else next.add(s.id); }
    setSelected(next);
    setAnchorIdx(null);
  };

  const clearAll = () => { setSelected(new Set()); setAnchorIdx(null); };

  // Open the modal pre-filled to edit a scheduled disruption (metadata + target spots).
  const handleEdit = (disruption: Disruption) => {
    clearFeedback();
    const spotIds = blockedSpots.filter(b => b.disruption_id === disruption.id).map(b => b.spot_id);
    setEditingId(disruption.id);
    setTitle(disruption.title);
    setReason(disruption.reason);
    setStartDate(disruption.start_date);
    setEndDate(disruption.end_date);
    setSelected(new Set(spotIds));
    setAnchorIdx(null);
    const firstSpot = spots.find(s => spotIds.includes(s.id));
    if (firstSpot) setActiveFloor(firstSpot.floor || disruptionsConfig.defaults.floor);
    setCreateOpen(true);
  };

  const handleSubmit = async () => {
    if (selected.size === 0 || !title.trim() || reason.trim().length < disruptionsConfig.reasonMinLength) return;
    setIsSaving(true);

    if (editingId) {
      const res = await updateDisruptionAction({
        disruptionId: editingId, spotIds: Array.from(selected), title, reason, startDate, endDate,
      });
      if (res.success) {
        showToast(messages.updatedToast);
        setCreateOpen(false);
        resetForm();
        await refreshDisruptions();
      } else {
        showError(res.error || messages.updateError);
      }
      setIsSaving(false);
      return;
    }

    const selectedCount = selected.size;
    const isScheduledStart = startDate > todayStr;
    const res = await createDisruptionAction({
      spotIds: Array.from(selected), title, reason,
      startDate, endDate,
    });
    if (res.success) {
      showToast(isScheduledStart
        ? messages.createdScheduledToast(selectedCount, startDate)
        : messages.createdToast(
            getMetaNumber(res.meta, disruptionsConfig.metaKeys.blocked),
            getMetaNumber(res.meta, disruptionsConfig.metaKeys.relocated),
            getMetaNumber(res.meta, disruptionsConfig.metaKeys.needsPlacement),
          ));
      setCreateOpen(false);
      resetForm();
      await refreshDisruptions();
    } else {
      showError(res.error || messages.createError);
    }
    setIsSaving(false);
  };

  const handleComplete = async (id: string) => {
    setCompletingId(id);
    const res = await completeDisruptionAction(id);
    if (res.success) {
      showToast(messages.completedToast(
        getMetaNumber(res.meta, disruptionsConfig.metaKeys.returned),
        getMetaNumber(res.meta, disruptionsConfig.metaKeys.needsReview),
      ));
      await refreshDisruptions();
    } else {
      showError(res.error || messages.completeError);
    }
    setCompletingId(null);
  };

  const handleActivate = async (id: string) => {
    setActivatingId(id);
    const res = await activateDisruptionAction(id);
    if (res.success) {
      showToast(messages.activatedToast(
        getMetaNumber(res.meta, disruptionsConfig.metaKeys.blocked),
        getMetaNumber(res.meta, disruptionsConfig.metaKeys.relocated),
        getMetaNumber(res.meta, disruptionsConfig.metaKeys.needsPlacement),
      ));
      await refreshDisruptions();
    } else {
      showError(res.error || messages.activateError);
    }
    setActivatingId(null);
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    const res = await cancelDisruptionAction(id);
    if (res.success) {
      showToast(messages.cancelledToast);
      await refreshDisruptions();
    } else {
      showError(res.error || messages.cancelError);
    }
    setCancellingId(null);
  };

  const floorAllSelected = blockableOnFloor.length > 0 && blockableOnFloor.every(s => selected.has(s.id));
  const primaryActionLabel = editingId
    ? messages.saveChanges
    : startDate > todayStr
      ? messages.scheduleSpots(selected.size)
      : messages.blockSpotsNow(selected.size);

  return (
    <main className="flex-1 overflow-y-auto bg-muted/30 px-4 py-5 sm:px-6 lg:px-8">
      <FeedbackToasts successMsg={successMsg} errorMsg={errorMsg} onClear={clearFeedback} />

      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
              <Construction className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{messages.pageTitle}</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{messages.pageDescription}</p>
            </div>
          </div>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="w-full md:w-auto">
            <Plus className="size-4" aria-hidden="true" /> {messages.newDisruption}
          </Button>
        </header>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border shadow-sm lg:grid-cols-4" aria-label={messages.summaryAria}>
          <WorkflowMetric icon={Calendar} label={messages.summary.scheduled} value={scheduledDisruptions.length} />
          <WorkflowMetric icon={Construction} label={messages.summary.active} value={activeDisruptions.length} />
          <WorkflowMetric icon={AlertTriangle} label={messages.summary.reviewNeeded} value={reviewNeededDisruptions.length} />
          <WorkflowMetric icon={CheckCircle2} label={messages.summary.completed} value={completedDisruptions.length} />
        </section>

        {scheduledDisruptions.length === 0 && activeDisruptions.length === 0 && reviewNeededDisruptions.length === 0 ? (
          <EmptyState icon={Construction} title={messages.emptyCurrentTitle} description={messages.emptyCurrentDescription} className="rounded-md border-border bg-card" />
        ) : (
          <div className="space-y-5">
            {scheduledDisruptions.length > 0 && (
              <DisruptionSection
                title={messages.sections.scheduled}
                icon={Calendar}
                disruptions={scheduledDisruptions}
                counts={counts}
                completingId={completingId}
                activatingId={activatingId}
                cancellingId={cancellingId}
                onActivate={handleActivate}
                onCancel={handleCancel}
                onEdit={handleEdit}
              />
            )}
            {activeDisruptions.length > 0 && (
              <DisruptionSection
                title={messages.sections.active}
                icon={Construction}
                disruptions={activeDisruptions}
                counts={counts}
                completingId={completingId}
                onComplete={handleComplete}
              />
            )}
            {reviewNeededDisruptions.length > 0 && (
              <DisruptionSection
                title={messages.sections.reviewNeeded}
                icon={AlertTriangle}
                disruptions={reviewNeededDisruptions}
                counts={counts}
                completingId={completingId}
                onComplete={handleComplete}
              />
            )}
          </div>
        )}

        {completedDisruptions.length > 0 && (
          <DisruptionSection
            title={messages.sections.completed}
            icon={CheckCircle2}
            disruptions={completedDisruptions}
            counts={counts}
            compact
          />
        )}
      </div>

      {createOpen && (
        <CreateDisruptionModal
          heading={editingId ? messages.editDisruption : messages.newDisruption}
          title={title}
          setTitle={setTitle}
          reason={reason}
          setReason={setReason}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          floors={floors}
          activeFloor={activeFloor}
          onSelectFloor={(floor) => { setActiveFloor(floor); setAnchorIdx(null); }}
          zonesOnFloor={zonesOnFloor}
          blockableOnFloor={blockableOnFloor}
          selected={selected}
          selectedOccupied={selectedOccupied}
          anchorIdx={anchorIdx}
          floorAllSelected={floorAllSelected}
          isSaving={isSaving}
          reasonMinLength={disruptionsConfig.reasonMinLength}
          primaryActionLabel={primaryActionLabel}
          onSpotClick={handleSpotClick}
          onToggleZone={toggleZone}
          onToggleFloor={toggleFloor}
          onClearAll={clearAll}
          onClose={() => { setCreateOpen(false); setEditingId(null); }}
          onCreate={handleSubmit}
        />
      )}
    </main>
  );
}

interface DisruptionCounts {
  blocked: number;
  active: number;
  needs: number;
  review: number;
}

function WorkflowMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 bg-card p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function DisruptionSection({
  title,
  icon: Icon,
  disruptions,
  counts,
  completingId,
  activatingId,
  cancellingId,
  onComplete,
  onActivate,
  onCancel,
  onEdit,
  compact = false,
}: {
  title: string;
  icon: LucideIcon;
  disruptions: Disruption[];
  counts: (id: string) => DisruptionCounts;
  completingId?: string | null;
  activatingId?: string | null;
  cancellingId?: string | null;
  onComplete?: (id: string) => void;
  onActivate?: (id: string) => void;
  onCancel?: (id: string) => void;
  onEdit?: (disruption: Disruption) => void;
  compact?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant="secondary" className="tabular-nums">{disruptions.length}</Badge>
      </div>
      <div className="space-y-3">
        {disruptions.map(disruption => (
          <DisruptionCard
            key={disruption.id}
            disruption={disruption}
            counts={counts(disruption.id)}
            compact={compact}
            isCompleting={completingId === disruption.id}
            isActivating={activatingId === disruption.id}
            isCancelling={cancellingId === disruption.id}
            onComplete={onComplete}
            onActivate={onActivate}
            onCancel={onCancel}
            onEdit={onEdit}
          />
        ))}
      </div>
    </section>
  );
}

function DisruptionCard({
  disruption,
  counts,
  compact,
  isCompleting,
  isActivating,
  isCancelling,
  onComplete,
  onActivate,
  onCancel,
  onEdit,
}: {
  disruption: Disruption;
  counts: DisruptionCounts;
  compact: boolean;
  isCompleting: boolean;
  isActivating: boolean;
  isCancelling: boolean;
  onComplete?: (id: string) => void;
  onActivate?: (id: string) => void;
  onCancel?: (id: string) => void;
  onEdit?: (disruption: Disruption) => void;
}) {
  const isScheduled = disruption.status === disruptionsConfig.statuses.scheduled;
  const canEdit = Boolean(onEdit && isScheduled);
  const canActivate = Boolean(onActivate && isScheduled);
  const canCancel = Boolean(onCancel && isScheduled);
  const canComplete = Boolean(onComplete && disruptionsConfig.completableStatuses.includes(disruption.status as (typeof disruptionsConfig.completableStatuses)[number]));
  const hasActions = canEdit || canActivate || canCancel || canComplete;
  const isBusy = isCompleting || isActivating || isCancelling;

  return (
    <article className={`rounded-md border border-border bg-card shadow-sm ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{disruption.title}</h3>
            <Badge variant={statusVariant(disruption.status)} className="text-xs font-medium">{formatStatus(disruption.status)}</Badge>
          </div>
          {!compact && <p className="mt-1 text-sm text-muted-foreground">{disruption.reason}</p>}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden="true" />
            <span className="tabular-nums">{disruption.start_date}</span>
            <ArrowRight className="size-3" aria-hidden="true" />
            <span className="tabular-nums">{disruption.end_date}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="destructive" className="text-xs font-medium">{messages.countLabels.blocked(counts.blocked)}</Badge>
            <Badge variant="success" className="text-xs font-medium">{messages.countLabels.relocated(counts.active)}</Badge>
            {counts.needs > 0 && <Badge variant="warning" className="text-xs font-medium">{messages.countLabels.awaitingPlacement(counts.needs)}</Badge>}
            {counts.review > 0 && <Badge variant="warning" className="text-xs font-medium">{messages.countLabels.needReview(counts.review)}</Badge>}
          </div>
        </div>
        {hasActions && (
          <div className="flex shrink-0 flex-col gap-2 sm:min-w-44">
            {canEdit && (
              <Button variant="outline" onClick={() => onEdit?.(disruption)} disabled={isBusy} className="justify-center font-medium">
                <Pencil className="size-4" aria-hidden="true" /> {messages.editButton}
              </Button>
            )}
            {canActivate && (
              <Button variant="outline" onClick={() => onActivate?.(disruption.id)} disabled={isBusy} className="justify-center font-medium text-success hover:bg-success/10">
                {isActivating ? <Spinner className="size-4" /> : <><Play className="size-4" aria-hidden="true" /> {messages.activateNow}</>}
              </Button>
            )}
            {canCancel && (
              <Button variant="destructive" onClick={() => onCancel?.(disruption.id)} disabled={isBusy} className="justify-center font-medium">
                {isCancelling ? <Spinner className="size-4" /> : <><Ban className="size-4" aria-hidden="true" /> {messages.cancelScheduled}</>}
              </Button>
            )}
            {canComplete && (
              <Button variant="outline" onClick={() => onComplete?.(disruption.id)} disabled={isBusy} className="justify-center font-medium text-success hover:bg-success/10">
                {isCompleting ? <Spinner className="size-4" /> : <><CheckCircle2 className="size-4" aria-hidden="true" /> {messages.completeAndReturn}</>}
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
