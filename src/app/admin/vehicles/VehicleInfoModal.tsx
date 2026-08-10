// Title: Vehicle Info Modal
// Path: src/app/admin/vehicles/VehicleInfoModal.tsx
// Functionality: Modal workflow for vehicle operations, validation, and feedback.

// Vehicle info / review modal: details + approve/reject/archive actions.
// Presentational: state and handlers are owned by VehiclesClient.

'use client';

import type { ReactNode } from 'react';
import { Archive, Ban, Calendar, Car, CheckCircle2, Clock, MapPin, Palette, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { approvalStatusBadgeVariant } from '@/config/status-ui';
import { en } from '@/localization/en';
import type { VehicleDirectoryVehicle } from './vehicles-types';

const messages = en.adminVehicles;

const statusLabel = (status: string) =>
  messages.statusLabels[status as keyof typeof messages.statusLabels] ?? status.replace(/_/g, ' ');

function StatusIcon({ status }: { status: string }) {
  if (status === VEHICLE_APPROVAL_STATUS.approved) return <ShieldCheck className="size-3" aria-hidden="true" />;
  if (status === VEHICLE_APPROVAL_STATUS.pendingApproval) return <Clock className="size-3" aria-hidden="true" />;
  if (status === VEHICLE_APPROVAL_STATUS.rejected) return <Ban className="size-3" aria-hidden="true" />;
  if (status === VEHICLE_APPROVAL_STATUS.archived) return <Archive className="size-3" aria-hidden="true" />;
  return <Car className="size-3" aria-hidden="true" />;
}

interface VehicleInfoModalProps {
  vehicle: VehicleDirectoryVehicle;
  reason: string;
  setReason: (value: string) => void;
  processingId: string | null;
  archiveId: string;
  onClose: () => void;
  onStatusChange: (id: string, decision: typeof VEHICLE_APPROVAL_STATUS.approved | typeof VEHICLE_APPROVAL_STATUS.rejected) => void;
  onArchive: (id: string) => void;
}

export function VehicleInfoModal({
  vehicle,
  reason,
  setReason,
  processingId,
  archiveId,
  onClose,
  onStatusChange,
  onArchive,
}: VehicleInfoModalProps) {
  const showReasonInput =
    vehicle.approval_status === VEHICLE_APPROVAL_STATUS.pendingApproval ||
    vehicle.approval_status === VEHICLE_APPROVAL_STATUS.approved ||
    vehicle.approval_status === VEHICLE_APPROVAL_STATUS.rejected;
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || messages.notAvailable;
  const assignment = vehicle.assigned_spot;
  const assignmentLocation = assignment
    ? [assignment.floor, assignment.zone].filter((value): value is string => Boolean(value))
    : [];
  const shouldShowRecordedNote =
    vehicle.approval_status === VEHICLE_APPROVAL_STATUS.rejected ||
    vehicle.approval_status === VEHICLE_APPROVAL_STATUS.archived;

  return (
    <Modal onClose={onClose} label={messages.modalTitle} overlayClassName="z-[150]" className="max-w-lg">
      <div className="w-full animate-in overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-2xl fade-in zoom-in-95 duration-200">
        <header className="border-b border-border px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <h2 className="flex min-w-0 items-center gap-3 text-xl font-semibold text-foreground">
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted/30">
                <Car className="size-4 text-info" aria-hidden="true" />
              </span>
              <span className="min-w-0 truncate">{messages.modalTitle}</span>
            </h2>
            <Badge
              variant={approvalStatusBadgeVariant(vehicle.approval_status)}
              className="shrink-0"
              aria-label={`${messages.statusLabel}: ${statusLabel(vehicle.approval_status)}`}
            >
              <StatusIcon status={vehicle.approval_status} />
              {statusLabel(vehicle.approval_status)}
            </Badge>
          </div>
        </header>
        <div className="space-y-4 px-5 py-5">
          <section className="rounded-md border border-border bg-muted/20 p-4" aria-label={messages.vehicleRecord}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="mb-1 text-xs font-medium text-muted-foreground">{messages.plateNumber}</div>
                <div className="font-mono text-xl font-semibold text-foreground">{vehicle.plate_number}</div>
                <div className="mt-2 text-sm font-medium text-foreground">{makeModel}</div>
              </div>
              <div className="grid min-w-32 grid-cols-2 gap-3 text-sm sm:text-right">
                <Meta label={messages.yearLabel} value={vehicle.year ? String(vehicle.year) : messages.notAvailable} icon={<Calendar className="size-3.5" aria-hidden="true" />} />
                <Meta label={messages.colorLabel} value={vehicle.color || messages.notAvailable} icon={<Palette className="size-3.5" aria-hidden="true" />} />
              </div>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-md border border-border bg-background p-3 shadow-sm">
              <div className="mb-2 text-xs font-medium text-muted-foreground">{messages.linkedUnitOwner}</div>
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
                  <Users className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{vehicle.profiles?.full_name || messages.notAssigned}</div>
                  <div className="mt-0.5 text-xs font-medium text-muted-foreground">{messages.apartmentLabel} {vehicle.apartments?.apartment_number || messages.notAvailable}</div>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-border bg-background p-3 shadow-sm">
              <div className="mb-2 text-xs font-medium text-muted-foreground">{messages.assignmentLabel}</div>
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-success/10 text-success">
                  <MapPin className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {assignment?.spot_number ? messages.currentSpot(assignment.spot_number) : messages.noSpotAssigned}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {assignment && assignmentLocation.length === 2
                      ? messages.spotLocation(assignmentLocation[0], assignmentLocation[1])
                      : assignment?.status || messages.notAvailable}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {shouldShowRecordedNote && (
            <section className="rounded-md border border-border bg-background p-3 shadow-sm">
              <div className="text-xs font-medium text-muted-foreground">{messages.lastActionNote}</div>
              <div className="mt-1 text-sm font-medium text-foreground">
                {vehicle.last_action_note?.reason || messages.noActionNote}
              </div>
            </section>
          )}

          {showReasonInput && (
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={messages.adminNotePlaceholder}
              aria-label={messages.adminNoteAria}
              className="h-10 bg-background"
            />
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-border bg-muted/20 px-5 py-4">
          {vehicle.approval_status === VEHICLE_APPROVAL_STATUS.pendingApproval && (
            <div className="flex w-full gap-2">
              <Button
                variant="default"
                onClick={() => onStatusChange(vehicle.id, VEHICLE_APPROVAL_STATUS.approved)}
                disabled={processingId === vehicle.id}
                className="h-10 flex-1 bg-success text-success-foreground hover:bg-success/90"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" /> {messages.approve}
              </Button>
              <Button
                variant="destructive"
                onClick={() => onStatusChange(vehicle.id, VEHICLE_APPROVAL_STATUS.rejected)}
                disabled={processingId === vehicle.id}
                className="h-10 flex-1"
              >
                <Ban className="size-4" aria-hidden="true" /> {messages.reject}
              </Button>
            </div>
          )}
          {(vehicle.approval_status === VEHICLE_APPROVAL_STATUS.approved || vehicle.approval_status === VEHICLE_APPROVAL_STATUS.rejected) && (
            <Button
              variant="outline"
              onClick={() => onArchive(vehicle.id)}
              disabled={processingId === archiveId}
              className="h-10 w-full"
            >
              {processingId === archiveId ? <Spinner className="size-4 text-current" /> : <Archive className="size-4" aria-hidden="true" />}
              {messages.moveToArchive}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose} className="h-10 w-full text-muted-foreground hover:text-foreground">{messages.dismiss}</Button>
        </footer>
      </div>
    </Modal>
  );
}

function Meta({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground sm:justify-end">
        {icon}
        {label}
      </div>
      <div className="truncate font-semibold text-foreground">{value}</div>
    </div>
  );
}
