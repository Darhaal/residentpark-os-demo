// Title: Resident Parking Pass
// Path: src/components/resident/ResidentParkingPass.tsx
// Functionality: Resident-facing component for resident status, actions, and dashboard composition.

import Link from 'next/link';
import { ArrowRight, Lock, Map as MapIcon } from 'lucide-react';
import { APP_CONFIG } from '@/config/app';
import { ROUTES } from '@/config/routes';
import { en } from '@/localization/en';

export interface ResidentParkingPassSpot {
  spot_number: string;
  floor: string | null;
  zone: string | null;
}

interface ResidentParkingPassProps {
  primarySpot?: ResidentParkingPassSpot | null;
}

const t = en.residentDashboard;

export function ResidentParkingPass({ primarySpot }: ResidentParkingPassProps) {
  if (!primarySpot) {
    return (
      <section className="flex flex-col rounded-md border border-dashed border-border bg-card p-5 shadow-sm md:col-span-7 lg:col-span-8" aria-label={t.parkingCardAria}>
        <span className="inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <MapIcon className="size-3" aria-hidden="true" /> {t.noAllocation}
        </span>
        <div className="mt-5 flex-1">
          <h2 className="text-lg font-semibold text-foreground">{t.spotUnassignedTitle}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t.spotUnassignedDescription}</p>
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <span className="text-xs font-medium text-muted-foreground">{APP_CONFIG.name}</span>
          <Link
            href={ROUTES.parking}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.viewGarageMap} <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col overflow-hidden rounded-md border border-primary/30 bg-primary/5 p-5 text-foreground shadow-sm md:col-span-7 lg:col-span-8" aria-label={t.parkingCardAria}>
      <div>
        <span className="inline-flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" /> {t.parkingPassActive}
        </span>
        <h2 className="mt-5 font-mono text-4xl font-semibold tabular-nums text-foreground">{primarySpot.spot_number}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {en.residentParkingPage.spotMeta(primarySpot.floor, primarySpot.zone)}
        </p>
      </div>

      <div className="mt-7 flex items-center justify-between border-t border-border pt-4">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="size-3" aria-hidden="true" /> {t.secured}
        </span>
        <Link
          href={ROUTES.parking}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {t.viewGarageMap} <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
