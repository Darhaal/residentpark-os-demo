// Title: Resident Vehicle List
// Path: src/components/resident/ResidentVehicleList.tsx
// Functionality: Resident-facing component for resident vehicle status and add-vehicle access.

import { Car } from 'lucide-react';
import { RegisterVehicleButton } from '@/components/resident/RegisterVehicleButton';
import { ResidentVehicleStatusBadge } from '@/components/resident/ResidentVehicleStatusBadge';
import { en } from '@/localization/en';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';

export interface ResidentVehicle {
  id: string;
  plate_number: string;
  make: string;
  model: string | null;
  color: string | null;
  year: number | null;
  approval_status: string;
}

interface ResidentVehicleListProps {
  vehicles: ResidentVehicle[];
  hasApartment: boolean;
}

function ResidentVehicleCard({ vehicle }: { vehicle: ResidentVehicle }) {
  const isRejected = vehicle.approval_status === VEHICLE_APPROVAL_STATUS.rejected;
  const vehicleName = `${vehicle.make} ${vehicle.model ?? ''}`.trim();
  const vehicleMeta = [vehicle.color, vehicle.year].filter(Boolean).join(' - ');

  return (
    <div className="flex flex-col justify-between rounded-md border border-border bg-card p-4 transition-colors hover:bg-muted/25">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-sm font-bold text-foreground shadow-sm">
          {vehicle.plate_number}
        </div>

        <ResidentVehicleStatusBadge status={vehicle.approval_status} className="text-xs font-medium" />
      </div>

      <div className="mt-5">
        <div className="text-base font-semibold text-foreground">{vehicleName}</div>
        {vehicleMeta ? <div className="mt-0.5 text-sm text-muted-foreground">{vehicleMeta}</div> : null}
        {isRejected ? (
          <p className="mt-2 text-sm font-medium text-destructive">{en.residentDashboard.rejectedVehicleDescription}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ResidentVehicleList({ vehicles, hasApartment }: ResidentVehicleListProps) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card shadow-sm" aria-labelledby="resident-vehicles-title">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
            <Car className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 id="resident-vehicles-title" className="text-sm font-semibold text-foreground">{en.residentDashboard.authorizedAssets}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{en.residentDashboard.authorizedAssetsDescription}</p>
          </div>
        </div>
        <RegisterVehicleButton hasApartment={hasApartment} />
      </div>

      <div className="p-4 sm:p-5">
        {vehicles.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {vehicles.map(vehicle => (
              <ResidentVehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-md border border-dashed border-border bg-muted/20 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <Car className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-foreground">{en.residentDashboard.noVehiclesTitle}</h4>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{en.residentDashboard.noVehiclesDescription}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
