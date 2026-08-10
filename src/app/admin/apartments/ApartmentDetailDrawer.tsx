// Title: Apartment Detail Drawer
// Path: src/app/admin/apartments/ApartmentDetailDrawer.tsx
// Functionality: Drawer workflow for apartment and occupancy inspection, editing, and related actions.

// Apartment detail drawer: status overrides, occupants, vehicles, and timeline.
// Presentational: details/loading and the status-override handler come from the parent.

'use client';

import { AlertTriangle, Car, CircleParking, Clock, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { APARTMENT_STATUS, isAuthorizedVehicleApprovalStatus } from '@/config/domain';
import { en } from '@/localization/en';
import { formatDateTime } from '@/lib/dates';
import { aptStatusVariant, approvalVariant, type ApartmentDetails, type ApartmentStatus } from './apartments-types';

const messages = en.adminApartments;

interface ApartmentDetailDrawerProps {
  details: ApartmentDetails | null;
  isLoading: boolean;
  onClose: () => void;
  onPromptStatusChange: (status: ApartmentStatus) => void;
}

export function ApartmentDetailDrawer({ details, isLoading, onClose, onPromptStatusChange }: ApartmentDetailDrawerProps) {
  const authorizedVehicles = details?.vehicles?.filter(vehicle => (
    isAuthorizedVehicleApprovalStatus(vehicle.approval_status)
  )) ?? [];

  return (
    <Modal
      onClose={onClose}
      label={messages.detailDrawerLabel}
      overlayClassName="z-[150] items-stretch justify-end p-0"
      className="h-full max-w-2xl"
    >
      <div className="flex h-full w-full animate-in flex-col border-l border-border bg-card text-card-foreground shadow-2xl slide-in-from-right duration-300">
        {isLoading || !details ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-muted/20 px-6 text-center">
            <Spinner className="size-8 mb-4" />
            <div className="text-sm font-medium text-muted-foreground">{messages.loadingProfile}</div>
          </div>
        ) : (
          <>
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-semibold text-foreground">{messages.unitPrefix} {details.apartment_number}</h2>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={aptStatusVariant(details.status)} className="text-xs font-medium">{details.status}</Badge>
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

            <div className="flex-1 space-y-5 overflow-y-auto bg-muted/20 px-5 py-5">
              <section className="rounded-md border border-border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground">{messages.quickStatusOverride}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onPromptStatusChange(APARTMENT_STATUS.vacant)} className="border-border">{messages.setVacant}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onPromptStatusChange(APARTMENT_STATUS.occupied)} className="border-success/30 text-success hover:bg-success/10">{messages.setOccupied}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onPromptStatusChange(APARTMENT_STATUS.problem)} className="border-destructive/30 text-destructive hover:bg-destructive/10">{messages.reportProblem}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onPromptStatusChange(APARTMENT_STATUS.restricted)} className="border-warning/30 text-warning hover:bg-warning/10">{messages.setRestricted}</Button>
                </div>
              </section>

              <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
                  <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">{messages.registeredOccupants}</h3>
                </div>
                <div className="divide-y divide-border">
                  {details.profiles?.length ? details.profiles.map(profile => (
                    <div key={profile.id} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/20">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{profile.full_name || messages.noName}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{profile.email}</div>
                      </div>
                      <Badge variant={approvalVariant(profile.approval_status)} className="shrink-0 text-xs font-medium">{profile.approval_status || messages.unknown}</Badge>
                    </div>
                  )) : <div className="p-4 text-center text-sm text-muted-foreground">{messages.noResidents}</div>}
                </div>
              </section>

              <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
                  <Car className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">{messages.authorizedVehicles}</h3>
                </div>
                <div className="divide-y divide-border">
                  {authorizedVehicles.length ? authorizedVehicles.map(vehicle => (
                    <div key={vehicle.id} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/20">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm font-semibold text-foreground">{vehicle.plate_number}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{vehicle.make} {vehicle.color}</div>
                      </div>
                      <Badge variant={approvalVariant(vehicle.approval_status)} className="shrink-0 text-xs font-medium">{vehicle.approval_status || messages.unknown}</Badge>
                    </div>
                  )) : <div className="p-4 text-center text-sm text-muted-foreground">{messages.noVehicles}</div>}
                </div>
              </section>

              <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
                  <CircleParking className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">{messages.assignedParkingSpots}</h3>
                </div>
                <div className="divide-y divide-border">
                  {details.parking_spots?.length ? details.parking_spots.map(spot => (
                    <div key={spot.id} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/20">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-sm font-semibold text-foreground">{spot.spot_number || messages.unknown}</div>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-xs font-medium">{spot.status || messages.unknown}</Badge>
                    </div>
                  )) : <div className="p-4 text-center text-sm text-muted-foreground">{messages.noParkingSpots}</div>}
                </div>
              </section>

              <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
                  <AlertTriangle className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">{messages.activeIncidents}</h3>
                </div>
                <div className="divide-y divide-border">
                  {details.active_incidents?.length ? details.active_incidents.map((incident, index) => (
                    <div key={incident.id || incident.entity_id || index} className="flex items-start justify-between gap-3 p-4 hover:bg-muted/20">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{incident.content || messages.unknown}</div>
                      </div>
                      <Badge variant="warning" className="shrink-0 text-xs font-medium">{incident.workflow_status || messages.unknown}</Badge>
                    </div>
                  )) : <div className="p-4 text-center text-sm text-muted-foreground">{messages.noActiveIncidents}</div>}
                </div>
              </section>

              <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-3">
                  <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-foreground">{messages.eventTimeline}</h3>
                </div>
                <div className="space-y-4 p-4">
                  {details.timeline?.length ? details.timeline.map(event => (
                    <div key={event.id} className="relative border-l border-border pl-4">
                      <div className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-muted-foreground/40 ring-4 ring-card" />
                      <div className="mb-1 font-mono text-xs text-muted-foreground">{formatDateTime(event.created_at)}</div>
                      <div className="rounded-md border border-border bg-background p-3 shadow-sm">
                        <p className="text-sm font-medium text-foreground">{event.content}</p>
                        <div className="mt-2 text-xs text-muted-foreground">{event.author_name} ({event.author_role})</div>
                      </div>
                    </div>
                  )) : <div className="p-4 text-center text-sm text-muted-foreground">{messages.noEvents}</div>}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
