// Title: Resident Parking Map Header
// Path: src/components/resident/ResidentParkingMapHeader.tsx
// Functionality: Presents privacy context, assignment summary, legend, and relocation status.

import { AlertTriangle, MapPin, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PARKING_SPOT_STATE_UI } from '@/config/parking';
import { en } from '@/localization/en';
import type { ResidentMapSpot } from './resident-parking-map-types';

const messages = en.residentParkingMap;

interface ResidentParkingMapHeaderProps {
  apartmentNumber: string | null;
  ownSpotCount: number;
  activeRelocation: ResidentMapSpot | undefined;
}

export function ResidentParkingMapHeader({
  apartmentNumber,
  ownSpotCount,
  activeRelocation,
}: ResidentParkingMapHeaderProps) {
  return (
    <>
      <header className="flex flex-col gap-4 border-b border-border bg-muted/20 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 id="resident-parking-map-title" className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <MapPin className="size-5 text-muted-foreground" aria-hidden="true" />
            {messages.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{messages.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">
            <ShieldCheck className="size-3" aria-hidden="true" />
            {messages.unitPrefix} {apartmentNumber || messages.noUnit}
          </Badge>
          <Badge variant="secondary">{messages.visibleAssignment(ownSpotCount)}</Badge>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-6" aria-label={messages.legendTitle}>
        <span className="text-xs font-semibold text-muted-foreground">{messages.legendTitle}</span>
        <span className="flex items-center gap-1.5 text-xs text-foreground">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
          {messages.legendOwn}
        </span>
        {(['available', 'occupied', 'blocked'] as const).map((state) => (
          <span key={state} className="flex items-center gap-1.5 text-xs text-foreground">
            <span className={`size-2.5 rounded-full ${PARKING_SPOT_STATE_UI[state].dot}`} aria-hidden="true" />
            {PARKING_SPOT_STATE_UI[state].label}
          </span>
        ))}
      </div>

      {activeRelocation && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm sm:mx-6">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <div className="font-semibold text-foreground">{messages.temporaryRelocationTitle}</div>
            <div className="mt-0.5 text-muted-foreground">
              {messages.temporaryRelocation(
                activeRelocation.original_spot_number || messages.pendingSpot,
                activeRelocation.temporary_spot_number || messages.pendingSpot,
              )}
              {activeRelocation.disruption_title
                ? messages.temporaryRelocationReason(activeRelocation.disruption_title)
                : ''}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
