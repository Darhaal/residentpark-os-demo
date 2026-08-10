// Title: Resident Identity Card
// Path: src/components/resident/ResidentIdentityCard.tsx
// Functionality: Resident-facing component for resident status, actions, and dashboard composition.

import { MapPin, ShieldCheck, User, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { en } from '@/localization/en';

interface ResidentIdentityCardProps {
  fullName?: string | null;
  apartmentNumber: string | null;
  displayRole: string;
}

function IdentityMetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3.5 py-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-card">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}

export function ResidentIdentityCard({ fullName, apartmentNumber, displayRole }: ResidentIdentityCardProps) {
  return (
    <section className="flex flex-col rounded-md border border-border bg-card p-5 shadow-sm md:col-span-5 lg:col-span-4" aria-label={en.residentDashboard.identityCardAria}>
      <div className="flex items-center gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-md bg-foreground text-background">
          <User className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">
            {fullName || en.residentDashboard.fallbackResidentName}
          </h2>
          <Badge variant="success" className="mt-1.5 text-xs font-medium">
            <ShieldCheck className="size-3" aria-hidden="true" /> {en.residentDashboard.identityVerified}
          </Badge>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <IdentityMetaRow
          icon={MapPin}
          label={en.residentDashboard.assignedUnit}
          value={`${en.residentDashboard.unitPrefix} ${apartmentNumber || en.residentDashboard.unitNone}`}
        />
        <IdentityMetaRow icon={ShieldCheck} label={en.residentDashboard.accessLevel} value={displayRole} />
      </div>
    </section>
  );
}
