// Title: Resident Parking Sidebar
// Path: src/app/parking/ResidentParkingSidebar.tsx
// Functionality: Presents resident identity, assigned parking, and vehicle access context on desktop.

import Link from 'next/link';
import { ArrowLeft, Car, Lock, MapPin, ShieldCheck, User } from 'lucide-react';
import { RegisterVehicleButton } from '@/components/resident/RegisterVehicleButton';
import type { ResidentParkingPassSpot } from '@/components/resident/ResidentParkingPass';
import type { ResidentVehicle } from '@/components/resident/ResidentVehicleList';
import { ResidentVehicleStatusBadge } from '@/components/resident/ResidentVehicleStatusBadge';
import { Badge } from '@/components/ui/badge';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { ROUTES } from '@/config/routes';
import { en } from '@/localization/en';

const dashboardMessages = en.residentDashboard;
const pageMessages = en.residentParkingPage;

interface ResidentParkingSidebarProps {
  apartmentNumber: string | null;
  displayRole: string;
  fullName: string | null;
  primarySpot: ResidentParkingPassSpot | null;
  vehicles: ResidentVehicle[];
}

export function ResidentParkingSidebar({ apartmentNumber, displayRole, fullName, primarySpot, vehicles }: ResidentParkingSidebarProps) {
  return (
    <aside aria-label={pageMessages.sidebarAria} className="hidden w-80 shrink-0 flex-col overflow-y-auto border-r border-border bg-card lg:flex xl:w-96">
      <div className="border-b border-border px-5 py-4">
        <Link href={ROUTES.home} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {dashboardMessages.backToDashboard}
        </Link>
      </div>

      <section className="border-b border-border px-5 py-5" aria-labelledby="parking-resident-identity">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
            <User className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="parking-resident-identity" className="truncate text-sm font-semibold text-foreground">{fullName || dashboardMessages.fallbackResidentName}</h2>
            <Badge variant="success" className="mt-1">
              <ShieldCheck className="size-3" aria-hidden="true" />
              {dashboardMessages.identityVerified}
            </Badge>
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{dashboardMessages.assignedUnit}</dt>
            <dd className="text-right font-semibold text-foreground">{dashboardMessages.unitPrefix} {apartmentNumber || dashboardMessages.unitNone}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{dashboardMessages.accessLevel}</dt>
            <dd className="text-right font-semibold text-foreground">{displayRole}</dd>
          </div>
        </dl>
      </section>

      <section className="border-b border-border px-5 py-5" aria-labelledby="parking-assignment-title">
        <h2 id="parking-assignment-title" className="text-xs font-semibold text-muted-foreground">{pageMessages.assignedSpotLabel}</h2>
        {primarySpot ? (
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-4">
            <Badge variant="success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              {dashboardMessages.parkingPassActive}
            </Badge>
            <div className="mt-4 font-mono text-4xl font-semibold tabular-nums text-foreground">{primarySpot.spot_number}</div>
            <div className="mt-1 text-sm text-muted-foreground">{pageMessages.spotMeta(primarySpot.floor, primarySpot.zone)}</div>
            <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs font-medium text-muted-foreground">
              <Lock className="size-3" aria-hidden="true" />
              {dashboardMessages.secured}
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-3 rounded-md border border-dashed border-border bg-muted/20 p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
              <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{dashboardMessages.spotUnassignedTitle}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{dashboardMessages.spotUnassignedDescription}</p>
            </div>
          </div>
        )}
      </section>

      <section className="flex-1 px-5 py-5" aria-labelledby="parking-vehicles-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="parking-vehicles-title" className="text-xs font-semibold text-muted-foreground">{dashboardMessages.authorizedAssets}</h2>
          <RegisterVehicleButton hasApartment={Boolean(apartmentNumber)} />
        </div>

        {vehicles.length > 0 ? (
          <div className="mt-3 space-y-2">
            {vehicles.map((vehicle) => {
              const isRejected = vehicle.approval_status === VEHICLE_APPROVAL_STATUS.rejected;
              const vehicleName = [vehicle.make, vehicle.model].filter(Boolean).join(' ') || pageMessages.vehicleDetailsUnavailable;

              return (
                <article key={vehicle.id} className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                    <Car className="size-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-semibold text-foreground">{vehicle.plate_number}</div>
                    <div className="truncate text-xs text-muted-foreground">{vehicleName}</div>
                    {isRejected ? (
                      <p className="mt-1 text-xs font-medium text-destructive">{dashboardMessages.rejectedVehicleDescription}</p>
                    ) : null}
                  </div>
                  <ResidentVehicleStatusBadge status={vehicle.approval_status} className="shrink-0" />
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-3 rounded-md border border-dashed border-border bg-muted/20 p-4">
            <Car className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">{dashboardMessages.noVehiclesTitle}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{dashboardMessages.noVehiclesDescription}</p>
            </div>
          </div>
        )}
      </section>
    </aside>
  );
}
