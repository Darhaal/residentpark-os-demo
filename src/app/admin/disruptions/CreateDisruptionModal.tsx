// Title: Create Disruption Modal
// Path: src/app/admin/disruptions/CreateDisruptionModal.tsx
// Functionality: Modal workflow for construction disruption operations, validation, and feedback.

// Create-disruption modal: title/dates/reason + Explorer-style spot selection.
// Presentational: all selection state and handlers are owned by DisruptionsClient.

'use client';

import { AlertTriangle, Car, Construction, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { en } from '@/localization/en';
import { normalizeFloor, normalizeZone, type Spot } from './disruptions-types';

const messages = en.adminDisruptions;

interface CreateDisruptionModalProps {
  heading?: string;
  title: string;
  setTitle: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  floors: string[];
  activeFloor: string;
  onSelectFloor: (floor: string) => void;
  zonesOnFloor: string[];
  blockableOnFloor: Spot[];
  selected: Set<string>;
  selectedOccupied: number;
  anchorIdx: number | null;
  floorAllSelected: boolean;
  isSaving: boolean;
  reasonMinLength: number;
  primaryActionLabel: string;
  onSpotClick: (id: string, idx: number, event: React.MouseEvent) => void;
  onToggleZone: (zone: string) => void;
  onToggleFloor: () => void;
  onClearAll: () => void;
  onClose: () => void;
  onCreate: () => void;
}

export function CreateDisruptionModal({
  heading = messages.newDisruption,
  title,
  setTitle,
  reason,
  setReason,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  floors,
  activeFloor,
  onSelectFloor,
  zonesOnFloor,
  blockableOnFloor,
  selected,
  selectedOccupied,
  anchorIdx,
  floorAllSelected,
  isSaving,
  reasonMinLength,
  primaryActionLabel,
  onSpotClick,
  onToggleZone,
  onToggleFloor,
  onClearAll,
  onClose,
  onCreate,
}: CreateDisruptionModalProps) {
  return (
    <Modal onClose={onClose} label={heading} overlayClassName="z-[150]" className="max-w-2xl" dismissOnBackdrop={!isSaving}>
      <div className="flex max-h-[90vh] w-full animate-in flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted/30">
              <Construction className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <h2 className="truncate text-xl font-semibold text-foreground">{heading}</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={messages.close}
            className="size-8 shrink-0 rounded-md border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{messages.fields.title}</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={messages.placeholders.title} className="h-10 bg-background" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{messages.fields.constructionStart}</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 bg-background" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{messages.fields.constructionEnd}</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 bg-background" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{messages.fields.reason}</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={messages.placeholders.reason} className="min-h-[72px] bg-background" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="shrink-0 text-xs font-medium text-muted-foreground">{messages.fields.spotsToBlock}</Label>
              <div className="flex items-center gap-1 flex-wrap">
                {floors.map(floor => (
                  <button
                    type="button"
                    key={floor}
                    onClick={() => onSelectFloor(floor)}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      activeFloor === floor && 'bg-primary/10 text-foreground ring-1 ring-primary/20'
                    )}
                  >
                    {normalizeFloor(floor)}
                  </button>
                ))}
              </div>
            </div>

            {zonesOnFloor.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">{messages.zoneLabel}</span>
                {zonesOnFloor.map(zone => {
                  const zSpots = blockableOnFloor.filter(s => normalizeZone(s.zone) === zone);
                  const allOn = zSpots.length > 0 && zSpots.every(s => selected.has(s.id));
                  return (
                    <button
                      type="button"
                      key={zone}
                      onClick={() => onToggleZone(zone)}
                      className={cn(
                        'rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        allOn && 'border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20'
                      )}
                    >
                      {zone}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <button type="button" onClick={onToggleFloor} className="font-medium text-foreground hover:underline">
                  {floorAllSelected ? messages.selection.clearFloor : messages.selection.selectFloor}
                </button>
                {selected.size > 0 && (
                  <button type="button" onClick={onClearAll} className="text-muted-foreground hover:text-foreground hover:underline">{messages.selection.clearAll}</button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden text-xs sm:inline">{messages.selection.rangeHint}</span>
                <span>
                  {messages.selection.selected(selected.size)}
                  {selectedOccupied > 0 && <> / {messages.selection.occupied(selectedOccupied)}</>}
                </span>
              </div>
            </div>

            <div
              className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 overflow-y-auto rounded-md border border-border bg-muted/10 p-1"
              onContextMenu={e => e.preventDefault()}
            >
              {blockableOnFloor.map((spot, idx) => {
                const isSel = selected.has(spot.id);
                const isAnchor = anchorIdx === idx;
                return (
                  <button
                    type="button"
                    key={spot.id}
                    onClick={e => onSpotClick(spot.id, idx, e)}
                    aria-pressed={isSel}
                    title={spot.zone ? messages.zoneTitle(spot.zone) : undefined}
                    className={cn(
                      'relative flex h-14 select-none flex-col items-center justify-center gap-0.5 rounded-md border bg-background text-xs font-semibold tabular-nums text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      isSel && 'border-primary/40 bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20',
                      isAnchor && isSel && 'ring-2 ring-ring/50 ring-offset-1'
                    )}
                  >
                    {spot.spot_number}
                    {spot.assigned_vehicle_id && (
                      <Car className="size-3 text-warning" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
              {blockableOnFloor.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-muted-foreground">{messages.selection.noBlockableSpots}</p>
              )}
            </div>
          </div>

          {selectedOccupied > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {messages.occupiedWarning(selectedOccupied)}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-10 sm:min-w-28">
            {messages.cancel}
          </Button>
          <Button
            type="button"
            onClick={onCreate}
            disabled={isSaving || selected.size === 0 || !title.trim() || reason.trim().length < reasonMinLength}
            className="h-10 sm:min-w-44"
          >
            {isSaving ? <Spinner className="size-4 text-current" /> : primaryActionLabel}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
