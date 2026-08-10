// Title: Resident Dashboard
// Path: src/components/resident/ResidentDashboard.tsx
// Functionality: Resident-facing component for resident status, actions, and dashboard composition.

import { ResidentDashboardHeader } from '@/components/resident/ResidentDashboardHeader';
import { ResidentIdentityCard } from '@/components/resident/ResidentIdentityCard';
import { ResidentParkingPass, type ResidentParkingPassSpot } from '@/components/resident/ResidentParkingPass';
import { ResidentVehicleList, type ResidentVehicle } from '@/components/resident/ResidentVehicleList';
import { en } from '@/localization/en';
import { VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { cn } from '@/lib/utils';

interface ResidentDashboardProps {
  firstName: string;
  fullName?: string | null;
  apartmentNumber: string | null;
  displayRole: string;
  primarySpot?: ResidentParkingPassSpot | null;
  vehicles: ResidentVehicle[];
  hasApartment: boolean;
  residentPortalNotice: string;
}

const messages = en.residentDashboard;

function StatCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'success' | 'warning' | 'info';
}) {
  const valueClass = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'info' ? 'text-info' : 'text-foreground';

  return (
    <div className="min-h-24 rounded-md border border-border bg-card px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn('mt-1 truncate text-2xl font-semibold tabular-nums', valueClass)}>{value}</div>
      {sub ? <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export function ResidentDashboard({
  firstName,
  fullName,
  apartmentNumber,
  displayRole,
  primarySpot,
  vehicles,
  hasApartment,
  residentPortalNotice,
}: ResidentDashboardProps) {
  const approvedCount = vehicles.filter(v => v.approval_status === VEHICLE_APPROVAL_STATUS.approved).length;
  const pendingCount = vehicles.length - approvedCount;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <ResidentDashboardHeader firstName={firstName} />

      {residentPortalNotice && (
        <section className="rounded-md border border-info/20 bg-info/10 px-4 py-3 text-sm text-foreground">
          <div className="mb-1 text-xs font-semibold text-info">{messages.portalNoticeTitle}</div>
          <p className="whitespace-pre-wrap leading-6 text-muted-foreground">{residentPortalNotice}</p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={messages.overviewAria}>
        <StatCell
          label={messages.overviewParkingSpot}
          value={primarySpot?.spot_number ?? messages.overviewSpotUnassigned}
          sub={primarySpot ? en.residentParkingPage.spotMeta(primarySpot.floor, primarySpot.zone) : undefined}
          tone={primarySpot ? 'success' : 'warning'}
        />
        <StatCell
          label={messages.overviewVehicles}
          value={String(approvedCount)}
          tone={approvedCount ? 'success' : undefined}
        />
        <StatCell
          label={messages.overviewPending}
          value={String(pendingCount)}
          tone={pendingCount ? 'warning' : undefined}
        />
        <StatCell
          label={messages.overviewAccount}
          value={messages.overviewAccountActive}
          sub={displayRole}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        <ResidentIdentityCard
          fullName={fullName}
          apartmentNumber={apartmentNumber}
          displayRole={displayRole}
        />
        <ResidentParkingPass primarySpot={primarySpot} />
      </div>

      <ResidentVehicleList vehicles={vehicles} hasApartment={hasApartment} />
    </div>
  );
}
