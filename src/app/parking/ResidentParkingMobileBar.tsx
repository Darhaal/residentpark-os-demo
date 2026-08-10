// Title: Resident Parking Mobile Bar
// Path: src/app/parking/ResidentParkingMobileBar.tsx
// Functionality: Provides compact dashboard navigation and assigned-spot context on small screens.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ResidentParkingPassSpot } from '@/components/resident/ResidentParkingPass';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
import { en } from '@/localization/en';

const dashboardMessages = en.residentDashboard;
const pageMessages = en.residentParkingPage;

export function ResidentParkingMobileBar({ primarySpot }: { primarySpot: ResidentParkingPassSpot | null }) {
  return (
    <nav aria-label={pageMessages.mobileNavigationAria} className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
      <Link href={ROUTES.home} className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{dashboardMessages.backToDashboard}</span>
      </Link>
      {primarySpot && (
        <Badge variant="outline" className="shrink-0 bg-background font-mono font-semibold">
          {pageMessages.spotBadge(primarySpot.spot_number)}
        </Badge>
      )}
    </nav>
  );
}
