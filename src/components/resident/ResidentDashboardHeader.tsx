// Title: Resident Dashboard Header
// Path: src/components/resident/ResidentDashboardHeader.tsx
// Functionality: Resident-facing component for resident status, actions, and dashboard composition.

import { en } from '@/localization/en';
import { Home } from 'lucide-react';

interface ResidentDashboardHeaderProps {
  firstName: string;
}

export function ResidentDashboardHeader({ firstName }: ResidentDashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card shadow-sm">
          <Home className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
            {en.residentDashboard.welcome(firstName)}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{en.residentDashboard.healthyStatus}</p>
        </div>
      </div>
    </header>
  );
}
