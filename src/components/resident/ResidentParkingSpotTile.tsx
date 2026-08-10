// Title: Resident Parking Spot Tile
// Path: src/components/resident/ResidentParkingSpotTile.tsx
// Functionality: Renders one privacy-safe resident spot in grid and spatial layouts.

import { Lock, ShieldCheck } from 'lucide-react';
import { VehicleTopDownIcon } from '@/components/parking/VehicleTopDownIcon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PARKING_SPOT_STATE_UI } from '@/config/parking';
import { en } from '@/localization/en';
import type { ResidentMapSpot } from './resident-parking-map-types';
import { residentSpotState } from './resident-parking-map-utils';

const messages = en.residentParkingMap;

interface ResidentParkingSpotTileProps {
  spot: ResidentMapSpot;
  onReportIssue: (spot: ResidentMapSpot) => void;
  className?: string;
}

export function ResidentParkingSpotTile({ spot, onReportIssue, className = '' }: ResidentParkingSpotTileProps) {
  const state = residentSpotState(spot);
  const stateUi = PARKING_SPOT_STATE_UI[state];
  const label = spot.is_own
    ? messages.yourAssignedSpot(spot.spot_number)
    : messages.spotStatusTitle(spot.spot_number, stateUi.label);

  return (
    <article
      aria-label={label}
      className={`flex min-h-24 flex-col gap-2 rounded-md border p-3 ${spot.is_own ? 'border-primary/40 bg-primary/5 text-foreground shadow-sm' : stateUi.residentTile} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-foreground">{spot.spot_number}</span>
        {spot.is_own
          ? <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          : state === 'blocked'
            ? <Lock className="size-4" aria-hidden="true" />
            : null}
      </div>

      <div className="space-y-1.5">
        {spot.is_own && spot.plate_number ? (
          <>
            <div className="flex items-center gap-2 font-mono text-xs font-semibold text-foreground">
              <VehicleTopDownIcon make={spot.make} model={spot.model} className="h-9 w-7 shrink-0" />
              {spot.plate_number}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {[spot.make, spot.model].filter(Boolean).join(' ') || messages.registeredVehicle}
            </div>
          </>
        ) : state === 'occupied' ? (
          <div className="flex items-center justify-between gap-2">
            <VehicleTopDownIcon privacy className="h-9 w-7 shrink-0 opacity-70" />
            <Badge variant={stateUi.badge}>{stateUi.label}</Badge>
          </div>
        ) : (
          <Badge variant={stateUi.badge} className="w-fit">{stateUi.label}</Badge>
        )}

        {spot.is_own && spot.relocation_status && (
          <Badge variant="warning" className="w-fit">{spot.relocation_status.replace(/_/g, ' ')}</Badge>
        )}

        {spot.is_own && (
          <Button type="button" variant="outline" size="sm" onClick={() => onReportIssue(spot)} className="mt-1 h-7 w-fit">
            {messages.reportIssue}
          </Button>
        )}
      </div>
    </article>
  );
}
